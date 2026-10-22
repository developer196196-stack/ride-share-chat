import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type Redis from 'ioredis';
import type { Firestore, Query, Timestamp as FsTimestamp } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import {
  FirestoreCollections,
  FOLLOWERS_SUBCOLLECTION,
  FOLLOWING_SUBCOLLECTION,
  getAuth,
  RIDES_SUBCOLLECTION,
  type RideDoc,
  type UserDoc,
} from '@workspace/firebase';
import type { ErrorResponseBody } from '../common/error-response';
import { requireFirestore } from '../common/require-firestore';
import { SUSPENDED_SET } from '../common/suspension';
import { FIRESTORE } from '../firebase/firebase.tokens';
import { ProfilesService } from '../profiles/profiles.service';
import { REDIS } from '../redis/redis.module';
import { RoomsService } from '../rooms/rooms.service';
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

type LiveState = { validationState: string | null; roomId: string | null };

/** Admin panel: overview, riders (read-only) and Trip Validation settings. */
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
    const [totalRiders, newRiders7d, suspended, vibes, verifiedNow, onHold] = await Promise.all([
      count(this.users()),
      count(this.users().where('createdAt', '>=', Timestamp.fromMillis(now - 7 * DAY_MS))),
      count(this.users().where('suspended', '==', true)),
      this.redis ? this.rooms.vibeStats() : Promise.resolve([]),
      this.redis ? this.redis.zcard('val:seen') : Promise.resolve(0),
      this.redis ? this.redis.zcard('val:grace') : Promise.resolve(0),
    ]);
    return {
      totalRiders,
      newRiders7d,
      suspended,
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
    const [profile, ridesSnap, followers, following, snapshot, liveRooms, authUser] = await Promise.all([
      this.profiles.getMany([uid]).then((m) => m.get(uid)),
      this.users().doc(uid).collection(RIDES_SUBCOLLECTION).orderBy('endedAt', 'desc').limit(20).get(),
      this.users().doc(uid).collection(FOLLOWERS_SUBCOLLECTION).count().get(),
      this.users().doc(uid).collection(FOLLOWING_SUBCOLLECTION).count().get(),
      this.redis ? this.validation.getSnapshot(uid).catch(() => null) : Promise.resolve(null),
      this.redis ? this.rooms.liveRooms([uid]) : Promise.resolve(new Map()),
      getAuth().getUser(uid).catch(() => null),
    ]);
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
          vibe: r.vibe,
          endReason: r.endReason,
        };
      }),
    };
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
