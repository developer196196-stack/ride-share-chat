import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type Redis from 'ioredis';
import type { Firestore, Query, QueryDocumentSnapshot, Timestamp as FsTimestamp } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import {
  FirestoreCollections,
  FOLLOWERS_SUBCOLLECTION,
  FOLLOWING_SUBCOLLECTION,
  getAuth,
  getStorageBucket,
  RIDES_SUBCOLLECTION,
  userAvatarStoragePrefix,
  type ReportDoc,
  type RideDoc,
  type SafetyAlertDoc,
  type UserDoc,
} from '@workspace/firebase';
import type { ErrorResponseBody } from '../common/error-response';
import { requireFirestore } from '../common/require-firestore';
import { validationError } from '../common/zod-parse';
import { DEVICE_BLOCKED_MESSAGE, DevicesService } from '../devices/devices.service';
import type { CreateRiderInput } from './admin.controller';
import { SUSPENDED_MESSAGE, SUSPENDED_SET } from '../common/suspension';
import { FIRESTORE } from '../firebase/firebase.tokens';
import { ProfilesService } from '../profiles/profiles.service';
import { REDIS } from '../redis/redis.module';
import { ServerEvents } from '../realtime/realtime.events';
import { RealtimeService } from '../realtime/realtime.service';
import { RoomsService } from '../rooms/rooms.service';
import { RoomCategoriesService } from '../rooms/room-categories.service';
import { getValidationOverrides, relaxedValidationOverrides, setValidationOverrides } from '../validation/validation.config';
import { ValidationService } from '../validation/validation.service';
import { VALIDATION_SETTING_KEYS, VALIDATION_SETTINGS, validateSetting } from './validation-settings';

const VALIDATION_CONFIG_DOC = 'validation';
/** Other API instances pick up panel changes within this time. */
const OVERRIDES_REFRESH_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const iso = (t: FsTimestamp | null | undefined) => (t ? t.toDate().toISOString() : null);

function notFound(message: string): never {
  const body: ErrorResponseBody = { code: 'NOT_FOUND', message };
  throw new NotFoundException(body);
}

function riderExists(uid: string): never {
  const body: ErrorResponseBody = {
    code: 'RIDER_EXISTS',
    message: 'A rider with this phone number already exists.',
    details: { uid },
  };
  throw new ConflictException(body);
}

type LiveState ={ validationState: string | null; roomId: string | null };

/** Admin panel: riders, reports, live rooms, safety alerts and Trip Validation settings. */
@Injectable()
export class AdminService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminService.name);
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore | null,
    @Inject(REDIS) private readonly redis: Redis | null,
    private readonly profiles: ProfilesService,
    private readonly rooms: RoomsService,
    private readonly validation: ValidationService,
    private readonly realtime: RealtimeService,
    private readonly categories: RoomCategoriesService,
    private readonly devices: DevicesService,
  ) {}

  async onModuleInit(): Promise<void> {
    const ignored = Object.keys(process.env).filter((key) => VALIDATION_SETTING_KEYS.has(key));
    if (ignored.length > 0) {
      this.logger.warn(
        `Ignoring ${ignored.join(', ')} in .env — Trip Validation settings are managed only from the admin panel. Remove these lines.`,
      );
    }
    await this.loadValidationOverrides();
    this.refreshTimer = setInterval(() => void this.loadValidationOverrides(), OVERRIDES_REFRESH_MS);
    await this.syncSuspendedSet();
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  private get db(): Firestore {
    return requireFirestore(this.firestore);
  }

  private users() {
    return this.db.collection(FirestoreCollections.users);
  }

  // ---------------------------------------------------------------- startup sync

  /** Validation thresholds saved from the panel survive restarts and reach every API instance. */
  private async loadValidationOverrides(): Promise<void> {
    if (!this.firestore) return;
    try {
      const snap = await this.firestore.collection(FirestoreCollections.appConfig).doc(VALIDATION_CONFIG_DOC).get();
      const values = (snap.data()?.values ?? {}) as Record<string, string | number | boolean>;
      const next = JSON.stringify(values);
      if (next !== JSON.stringify(getValidationOverrides())) {
        setValidationOverrides(values);
        if (Object.keys(values).length > 0) this.logger.log(`Trip Validation settings from the admin panel: ${next}`);
        const relaxed = relaxedValidationOverrides();
        if (relaxed.length > 0) {
          this.logger.warn(`Trip Validation differs from production defaults: ${relaxed.join(', ')}. Reset these in the admin panel before launch.`);
        }
      }
    } catch (error) {
      this.logger.warn(`Loading validation overrides failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Rebuilds the fast Redis suspension set from Firestore (the source of truth). */
  private async syncSuspendedSet(): Promise<void> {
    if (!this.firestore || !this.redis) return;
    try {
      const snap = await this.users().where('suspended', '==', true).get();
      const pipeline = this.redis.multi().del(SUSPENDED_SET);
      if (!snap.empty) pipeline.sadd(SUSPENDED_SET, ...snap.docs.map((d) => d.id));
      await pipeline.exec();
    } catch (error) {
      this.logger.warn(`Syncing suspended riders failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ---------------------------------------------------------------- overview

  async stats() {
    const now = Date.now();
    const count = async (query: Query) => (await query.count().get()).data().count;
    const [totalRiders, newRiders7d, suspended, openReports, safetyAlerts24h, vibes, verifiedNow, onHold] = await Promise.all([
      count(this.users()),
      count(this.users().where('createdAt', '>=', Timestamp.fromMillis(now - 7 * DAY_MS))),
      count(this.users().where('suspended', '==', true)),
      count(this.db.collection(FirestoreCollections.reports).where('status', '==', 'open')),
      count(this.db.collection(FirestoreCollections.safetyAlerts).where('createdAt', '>=', Timestamp.fromMillis(now - DAY_MS))),
      this.redis ? this.rooms.vibeStats() : Promise.resolve([]),
      this.redis ? this.redis.zcard('val:seen') : Promise.resolve(0),
      this.redis ? this.redis.zcard('val:grace') : Promise.resolve(0),
    ]);
    return {
      totalRiders,
      newRiders7d,
      suspended,
      openReports,
      safetyAlerts24h,
      liveRooms: vibes.reduce((a, v) => a + v.rooms, 0),
      ridersInRooms: vibes.reduce((a, v) => a + v.riders, 0),
      verifiedNow,
      /** In traffic grace or the post-ride extension. */
      onHold,
      validationOverrides: Object.keys(getValidationOverrides()).length,
      byVibe: vibes,
    };
  }

  // ---------------------------------------------------------------- riders

  private async liveStates(uids: string[]): Promise<Map<string, LiveState>> {
    const result = new Map<string, LiveState>();
    if (!this.redis || uids.length === 0) return result;
    const pipeline = this.redis.pipeline();
    for (const uid of uids) pipeline.get(`val:${uid}`).get(`user:${uid}:room`);
    const replies = (await pipeline.exec()) ?? [];
    uids.forEach((uid, i) => {
      const raw = replies[2 * i]?.[1] as string | null;
      let validationState: string | null = null;
      try {
        validationState = raw ? ((JSON.parse(raw) as { state?: string }).state ?? null) : null;
      } catch {
        validationState = null;
      }
      result.set(uid, { validationState, roomId: (replies[2 * i + 1]?.[1] as string | null) ?? null });
    });
    return result;
  }

  async listUsers(search?: string) {
    const snap = await this.users().orderBy('createdAt', 'desc').limit(500).get();
    const q = search?.trim().toLowerCase();
    const docs = snap.docs
      .map((d) => ({ id: d.id, data: d.data() as UserDoc }))
      .filter(({ id, data }) => {
        if (!q) return true;
        return [id, data.displayName, data.phoneNumber, data.homeCity].some((v) => v?.toLowerCase().includes(q));
      });
    const live = await this.liveStates(docs.map((d) => d.id));
    return docs.map(({ id, data }) => ({
      uid: id,
      displayName: data.displayName,
      phoneNumber: data.phoneNumber,
      homeCity: data.homeCity,
      rideStyle: data.rideStyle,
      incognitoDropoff: data.incognitoDropoff ?? true,
      profileComplete: data.profileCompletedAt != null,
      suspended: data.suspended === true,
      createdAt: iso(data.createdAt),
      validationState: live.get(id)?.validationState ?? null,
      roomId: live.get(id)?.roomId ?? null,
    }));
  }

  async getUser(uid: string) {
    const doc = await this.users().doc(uid).get();
    if (!doc.exists) notFound('That rider does not exist.');
    const data = doc.data() as UserDoc;
    const reports = this.db.collection(FirestoreCollections.reports);
    const [profile, ridesSnap, against, by, followers, following, snapshot, liveRooms, authUser, devices] = await Promise.all([
      this.profiles.getMany([uid]).then((m) => m.get(uid)),
      this.users().doc(uid).collection(RIDES_SUBCOLLECTION).orderBy('endedAt', 'desc').limit(20).get(),
      reports.where('reportedUid', '==', uid).limit(50).get(),
      reports.where('reporterUid', '==', uid).limit(50).get(),
      this.users().doc(uid).collection(FOLLOWERS_SUBCOLLECTION).count().get(),
      this.users().doc(uid).collection(FOLLOWING_SUBCOLLECTION).count().get(),
      this.redis ? this.validation.getSnapshot(uid).catch(() => null) : Promise.resolve(null),
      this.redis ? this.rooms.liveRooms([uid]) : Promise.resolve(new Map()),
      getAuth().getUser(uid).catch(() => null),
      this.devices.listForUser(uid).catch(() => []),
    ]);
    const toReport = (d: QueryDocumentSnapshot) => {
      const r = d.data() as ReportDoc;
      return { id: d.id, reason: r.reason, source: r.source ?? 'rider_report', status: r.status, details: r.details, createdAt: iso(r.createdAt) };
    };
    const byDate = (a: { createdAt: string | null }, b: { createdAt: string | null }) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    return {
      uid,
      displayName: data.displayName,
      phoneNumber: data.phoneNumber,
      countryCode: data.countryCode,
      homeCity: data.homeCity,
      rideStyle: data.rideStyle,
      incognitoDropoff: data.incognitoDropoff,
      photoUrl: profile?.photoUrl ?? null,
      profileComplete: data.profileCompletedAt != null,
      preferences: data.preferences ?? null,
      createdAt: iso(data.createdAt),
      lastSignInAt: authUser?.metadata.lastSignInTime ? new Date(authUser.metadata.lastSignInTime).toISOString() : null,
      suspended: data.suspended === true,
      suspendedAt: iso(data.suspendedAt ?? null),
      suspendedReason: data.suspendedReason ?? null,
      followerCount: followers.data().count,
      followingCount: following.data().count,
      validation: snapshot,
      liveRoom: liveRooms.get(uid) ?? null,
      rides: ridesSnap.docs.map((d) => {
        const r = d.data() as RideDoc;
        return {
          id: d.id,
          startedAt: iso(r.startedAt),
          endedAt: iso(r.endedAt),
          durationSec: r.durationSec,
          roomDurationSec: r.roomDurationSec,
          distanceMiles: r.distanceMiles,
          peersMet: r.peersMet,
          graceCount: r.graceCount,
          vibe: this.categories.resolve(r.vibe),
          endReason: r.endReason,
        };
      }),
      reportsAgainst: against.docs.map(toReport).sort(byDate),
      reportsBy: by.docs.map(toReport).sort(byDate),
      devices,
    };
  }

  /**
   * Adds a rider from the panel: a Firebase phone account plus a finished `users/{uid}` profile.
   * When that person signs in on the app with the same number (SMS code), Firebase gives them this
   * account, so they skip Profile Setup. A phone that already has a Firebase account but never
   * finished signing up gets the profile on that account instead.
   */
  async createUser(input: CreateRiderInput, adminEmail: string | null) {
    const taken = await this.users().where('phoneNumber', '==', input.phoneNumber).limit(1).get();
    if (!taken.empty) riderExists(taken.docs[0]!.id);

    const auth = getAuth();
    let uid: string;
    let createdAuthUser = false;
    const existing = await auth.getUserByPhoneNumber(input.phoneNumber).catch(() => null);
    if (existing) {
      if ((await this.users().doc(existing.uid).get()).exists) riderExists(existing.uid);
      uid = existing.uid;
    } else {
      try {
        uid = (await auth.createUser({ phoneNumber: input.phoneNumber, displayName: input.displayName })).uid;
        createdAuthUser = true;
      } catch (error) {
        const code = (error as { code?: string }).code ?? '';
        if (code === 'auth/invalid-phone-number') {
          validationError('That phone number is not valid.', { field: 'phoneNumber' });
        }
        throw error;
      }
    }

    const now = Timestamp.now();
    const doc: UserDoc = {
      uid,
      phoneNumber: input.phoneNumber,
      countryCode: null,
      displayName: input.displayName,
      displayNameLower: input.displayName.toLowerCase(),
      homeCity: input.homeCity,
      rideStyle: input.rideStyle,
      incognitoDropoff: input.incognitoDropoff,
      photoStoragePath: null,
      profileCompletedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await this.users().doc(uid).create(doc);
    } catch (error) {
      // Don't leave a Firebase account behind without its rider profile.
      if (createdAuthUser) await auth.deleteUser(uid).catch(() => undefined);
      throw error;
    }
    this.logger.log(`Rider ${uid} added by ${adminEmail ?? 'admin'}`);
    return { uid };
  }

  /** Edit a rider's profile. A new phone number moves their sign-in to that number. */
  async updateUser(uid: string, input: CreateRiderInput, adminEmail: string | null) {
    const ref = this.users().doc(uid);
    const snap = await ref.get();
    if (!snap.exists) notFound('That rider does not exist.');
    const current = snap.data() as UserDoc;

    if (input.phoneNumber !== current.phoneNumber) {
      const taken = await this.users().where('phoneNumber', '==', input.phoneNumber).limit(2).get();
      if (taken.docs.some((d) => d.id !== uid)) riderExists(taken.docs.find((d) => d.id !== uid)!.id);
      try {
        await getAuth().updateUser(uid, { phoneNumber: input.phoneNumber });
      } catch (error) {
        const code = (error as { code?: string }).code ?? '';
        if (code === 'auth/phone-number-already-exists') riderExists(uid);
        if (code === 'auth/invalid-phone-number') validationError('That phone number is not valid.', { field: 'phoneNumber' });
        if (code !== 'auth/user-not-found') throw error;
      }
    }

    const now = Timestamp.now();
    await ref.update({
      phoneNumber: input.phoneNumber,
      displayName: input.displayName,
      displayNameLower: input.displayName.toLowerCase(),
      homeCity: input.homeCity,
      rideStyle: input.rideStyle,
      incognitoDropoff: input.incognitoDropoff,
      ...(current.profileCompletedAt ? {} : { profileCompletedAt: now }),
      updatedAt: now,
    });
    this.profiles.invalidate(uid);
    this.logger.log(`Rider ${uid} profile edited by ${adminEmail ?? 'admin'}`);
    return { ok: true };
  }

  /** "Kill session": the ride ends and they leave any room. They can start a new ride straight away. */
  async endRide(uid: string, adminEmail: string | null) {
    if (!(await this.users().doc(uid).get()).exists) notFound('That rider does not exist.');
    if (this.redis) await this.rooms.adminEndForSuspension(uid);
    this.realtime.emitToUser(uid, ServerEvents.SESSION_TERMINATED, {
      reason: 'admin_ended',
      message: 'Your ride was ended by RideShare Chats support.',
    });
    this.logger.log(`Rider ${uid} ride ended by ${adminEmail ?? 'admin'}`);
    return { ok: true };
  }

  /**
   * Deletes the account: Firebase sign-in, `users/{uid}` with its rides, contacts and follows (both
   * sides), devices, share links and avatar files. Reports and safety alerts stay for the record.
   */
  async deleteUser(uid: string, adminEmail: string | null) {
    const ref = this.users().doc(uid);
    if (!(await ref.get()).exists) notFound('That rider does not exist.');

    // Live state first, so nothing is recreated while we delete.
    this.realtime.emitToUser(uid, ServerEvents.SESSION_TERMINATED, {
      reason: 'account_deleted',
      message: 'This account has been deleted.',
    });
    this.realtime.disconnectUser(uid);
    if (this.redis) {
      await this.rooms.adminEndForSuspension(uid);
      await this.redis.multi().srem(SUSPENDED_SET, uid).del(`prefs:${uid}`, `share:active:${uid}`).exec();
    }

    const db = this.db;
    // The other side of each follow lives under the other rider.
    const [following, followers, tokens, links] = await Promise.all([
      ref.collection(FOLLOWING_SUBCOLLECTION).select().get(),
      ref.collection(FOLLOWERS_SUBCOLLECTION).select().get(),
      db.collection(FirestoreCollections.pushTokens).where('uid', '==', uid).select().get(),
      db.collection(FirestoreCollections.shareLinks).where('uid', '==', uid).select().get(),
    ]);
    const writer = db.bulkWriter();
    for (const d of following.docs) writer.delete(this.users().doc(d.id).collection(FOLLOWERS_SUBCOLLECTION).doc(uid));
    for (const d of followers.docs) writer.delete(this.users().doc(d.id).collection(FOLLOWING_SUBCOLLECTION).doc(uid));
    for (const d of [...tokens.docs, ...links.docs]) writer.delete(d.ref);
    await writer.close();
    await db.recursiveDelete(ref);
    // A block on their phone stays; only the link to this account goes.
    await this.devices.forgetUser(uid).catch((e: unknown) => this.logger.warn(`Forget devices of ${uid}: ${String(e)}`));

    await getStorageBucket()
      ?.deleteFiles({ prefix: userAvatarStoragePrefix(uid) })
      .catch((e: unknown) => this.logger.warn(`Delete avatar files of ${uid}: ${String(e)}`));
    await getAuth()
      .deleteUser(uid)
      .catch((e: unknown) => {
        if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
      });
    this.profiles.invalidate(uid);
    this.logger.log(`Rider ${uid} deleted by ${adminEmail ?? 'admin'}`);
    return { ok: true };
  }

  // ---------------------------------------------------------------- devices

  /** Block or unblock one phone. Whoever is using it is signed out and their ride ends. */
  async setDeviceBlocked(key: string, blocked: boolean, reason: string | null, adminEmail: string | null) {
    const uids = await this.devices.setBlocked(key, blocked, adminEmail, reason);
    if (blocked) await Promise.all(uids.map((uid) => this.kickForBlockedDevice(uid)));
    return { ok: true };
  }

  /**
   * Every blocked phone, including ones whose riders were deleted (they appear under no rider any
   * more, so this is where they can be unblocked).
   */
  async listBlockedDevices() {
    const devices = await this.devices.listBlocked();
    const uids = [...new Set(devices.flatMap((d) => d.uids))];
    const snaps = uids.length > 0 ? await this.db.getAll(...uids.map((u) => this.users().doc(u))) : [];
    const names = new Map(snaps.filter((s) => s.exists).map((s) => [s.id, (s.data() as UserDoc).displayName]));
    return devices.map(({ uids: deviceUids, ...d }) => ({
      ...d,
      riders: deviceUids.filter((u) => names.has(u)).map((uid) => ({ uid, displayName: names.get(uid) ?? null })),
    }));
  }

  /** "Block device" on a rider: every phone they have used. */
  async blockRiderDevices(uid: string, reason: string | null, adminEmail: string | null) {
    if (!(await this.users().doc(uid).get()).exists) notFound('That rider does not exist.');
    const devices = (await this.devices.listForUser(uid)).filter((d) => !d.blocked);
    const affected = new Set<string>([uid]);
    for (const d of devices) {
      for (const u of await this.devices.setBlocked(d.key, true, adminEmail, reason)) affected.add(u);
    }
    if (devices.length > 0) await Promise.all([...affected].map((u) => this.kickForBlockedDevice(u)));
    return { blocked: devices.length };
  }

  private async kickForBlockedDevice(uid: string): Promise<void> {
    if (this.redis) await this.rooms.adminEndForSuspension(uid).catch(() => undefined);
    this.realtime.emitToUser(uid, ServerEvents.SESSION_TERMINATED, { reason: 'device_blocked', message: DEVICE_BLOCKED_MESSAGE });
    this.realtime.disconnectUser(uid);
  }

  /** Suspend: API and sockets refuse the account, Firebase sign-in is disabled, the ride ends. */
  async suspend(uid: string, reason: string | null, adminEmail: string | null) {
    const ref = this.users().doc(uid);
    if (!(await ref.get()).exists) notFound('That rider does not exist.');
    await ref.update({ suspended: true, suspendedAt: Timestamp.now(), suspendedReason: reason?.trim() || null, updatedAt: Timestamp.now() });
    if (this.redis) {
      await this.redis.sadd(SUSPENDED_SET, uid);
      await this.rooms.adminEndForSuspension(uid);
    }
    await getAuth().updateUser(uid, { disabled: true }).catch((e: unknown) => this.logger.warn(`Disable auth user ${uid}: ${String(e)}`));
    await getAuth().revokeRefreshTokens(uid).catch(() => undefined);
    this.realtime.emitToUser(uid, ServerEvents.SESSION_TERMINATED, { reason: 'account_suspended', message: SUSPENDED_MESSAGE });
    this.realtime.disconnectUser(uid);
    this.logger.log(`Rider ${uid} suspended by ${adminEmail ?? 'admin'}${reason ? `: ${reason}` : ''}`);
    return { ok: true };
  }

  async reinstate(uid: string, adminEmail: string | null) {
    const ref = this.users().doc(uid);
    if (!(await ref.get()).exists) notFound('That rider does not exist.');
    await ref.update({ suspended: false, suspendedAt: null, suspendedReason: null, updatedAt: Timestamp.now() });
    if (this.redis) await this.redis.srem(SUSPENDED_SET, uid);
    await getAuth().updateUser(uid, { disabled: false }).catch((e: unknown) => this.logger.warn(`Enable auth user ${uid}: ${String(e)}`));
    this.logger.log(`Rider ${uid} reinstated by ${adminEmail ?? 'admin'}`);
    return { ok: true };
  }

  // ---------------------------------------------------------------- reports

  async listReports(status: 'open' | 'reviewed' | 'all') {
    const snap = await this.db.collection(FirestoreCollections.reports).orderBy('createdAt', 'desc').limit(300).get();
    const reports = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as ReportDoc) }))
      .filter((r) => status === 'all' || r.status === status);
    const ids = [...new Set(reports.flatMap((r) => [r.reporterUid, r.reportedUid].filter((x): x is string => Boolean(x))))];
    const profiles = await this.profiles.getMany(ids);
    const name = (uid: string | null) => (uid ? (profiles.get(uid)?.displayName ?? 'Rider') : null);
    return reports.map((r) => ({
      id: r.id,
      source: r.source ?? 'rider_report',
      reason: r.reason,
      details: r.details,
      status: r.status,
      roomId: r.roomId,
      reporterUid: r.reporterUid,
      reporterName: name(r.reporterUid),
      reportedUid: r.reportedUid,
      reportedName: name(r.reportedUid),
      recentMessages: r.recentMessages ?? [],
      createdAt: iso(r.createdAt),
      reviewedAt: iso(r.reviewedAt ?? null),
      reviewedBy: r.reviewedBy ?? null,
      reviewNote: r.reviewNote ?? null,
    }));
  }

  async reviewReport(id: string, note: string | null, adminEmail: string | null) {
    const ref = this.db.collection(FirestoreCollections.reports).doc(id);
    if (!(await ref.get()).exists) notFound('That report does not exist.');
    await ref.update({ status: 'reviewed', reviewedAt: Timestamp.now(), reviewedBy: adminEmail, reviewNote: note?.trim() || null });
    return { ok: true };
  }

  // ---------------------------------------------------------------- live rooms & safety alerts

  listRooms() {
    return this.rooms.adminListRooms();
  }

  closeRoom(roomId: string) {
    return this.rooms.adminCloseRoom(roomId, 'This R.O.O.M. was closed by a moderator. Pick another room to keep chatting.');
  }

  async listSafetyAlerts() {
    const snap = await this.db.collection(FirestoreCollections.safetyAlerts).orderBy('createdAt', 'desc').limit(200).get();
    const alerts = snap.docs.map((d) => ({ id: d.id, ...(d.data() as SafetyAlertDoc) }));
    const profiles = await this.profiles.getMany([...new Set(alerts.map((a) => a.uid))]);
    return alerts.map((a) => ({
      id: a.id,
      uid: a.uid,
      riderName: profiles.get(a.uid)?.displayName ?? 'Rider',
      kind: a.kind,
      location: a.location,
      validationState: a.validationState,
      roomId: a.roomId,
      shareToken: a.shareToken,
      createdAt: iso(a.createdAt),
    }));
  }

  // ---------------------------------------------------------------- Trip Validation settings

  getValidationSettings() {
    const overrides = getValidationOverrides();
    return {
      settings: VALIDATION_SETTINGS.map((meta) => {
        const raw = overrides[meta.key];
        let value: number | boolean = meta.default;
        if (raw != null && raw !== '') {
          value = meta.kind === 'boolean' ? ['true', '1', 'yes'].includes(raw.toLowerCase()) : Number(raw);
          if (meta.kind === 'number' && !Number.isFinite(value)) value = meta.default;
        }
        return { ...meta, value, source: raw != null ? 'panel' : 'default' };
      }),
    };
  }

  /** `null` resets a setting to its production default. */
  async updateValidationSettings(values: Record<string, number | boolean | null>, adminEmail: string | null) {
    const errors = Object.entries(values)
      .filter(([, v]) => v !== null)
      .map(([key, v]) => validateSetting(key, v))
      .filter((e): e is string => e != null);
    const unknown = Object.keys(values).filter((key) => !VALIDATION_SETTINGS.some((s) => s.key === key));
    if (errors.length > 0 || unknown.length > 0) {
      const body: ErrorResponseBody = {
        code: 'VALIDATION_ERROR',
        message: [...errors, ...unknown.map((k) => `${k} is not an editable setting.`)].join(' '),
      };
      throw new UnprocessableEntityException(body);
    }
    const next: Record<string, string | number | boolean> = { ...getValidationOverrides() };
    for (const [key, value] of Object.entries(values)) {
      if (value === null) delete next[key];
      else next[key] = value;
    }
    await this.db
      .collection(FirestoreCollections.appConfig)
      .doc(VALIDATION_CONFIG_DOC)
      .set({ values: next, updatedAt: Timestamp.now(), updatedBy: adminEmail });
    setValidationOverrides(next);
    this.logger.log(`Trip Validation settings changed by ${adminEmail ?? 'admin'}: ${JSON.stringify(next)}`);
    return this.getValidationSettings();
  }
}
