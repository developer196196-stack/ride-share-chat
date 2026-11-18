import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { FirestoreCollections, type DeviceDoc } from '@workspace/firebase';
import type { ErrorResponseBody } from '../common/error-response';
import { FIRESTORE } from '../firebase/firebase.tokens';
import { REDIS } from '../redis/redis.module';

/** Redis set of blocked device keys: the fast check on every request (Firestore is the source of truth). */
export const BLOCKED_DEVICES_SET = 'blocked:devices';
export const DEVICE_BLOCKED_MESSAGE = 'This phone has been blocked from RideShare Chats. Contact support if you think this is a mistake.';

/** What the app sends in `x-device-id` (lib/device/device-id.ts). */
const DEVICE_ID_RE = /^(android|ios):[A-Za-z0-9-]{4,100}$/;
/** Write `lastSeenAt` at most this often per rider and device. */
const SEEN_THROTTLE_SEC = 6 * 60 * 60;

export type DeviceDto = {
  key: string;
  platform: 'ios' | 'android';
  name: string | null;
  lastSeenAt: string;
  /** Other riders who have signed in on this phone. */
  otherRiders: number;
  blocked: boolean;
  blockedAt: string | null;
  blockedBy: string | null;
  blockedReason: string | null;
};

/** The parsed device headers, or null when the app didn't send a usable ID. */
export function readDevice(id: unknown, name: unknown): { id: string; name: string | null } | null {
  if (typeof id !== 'string' || !DEVICE_ID_RE.test(id)) return null;
  return { id, name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : null };
}

/** Stored and blocked by a hash, so the raw device ID never sits in the database. */
export const deviceKey = (deviceId: string) => createHash('sha256').update(deviceId).digest('hex');

/** Phones riders use, and blocking them from the admin panel. */
@Injectable()
export class DevicesService implements OnModuleInit {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore | null,
    @Inject(REDIS) private readonly redis: Redis | null,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.firestore || !this.redis) return;
    try {
      const snap = await this.col()!.where('blocked', '==', true).select().get();
      const pipeline = this.redis.multi().del(BLOCKED_DEVICES_SET);
      if (!snap.empty) pipeline.sadd(BLOCKED_DEVICES_SET, ...snap.docs.map((d) => d.id));
      await pipeline.exec();
    } catch (error) {
      this.logger.warn(`Syncing blocked devices failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private col() {
    return this.firestore?.collection(FirestoreCollections.devices) ?? null;
  }

  async isBlocked(deviceId: string): Promise<boolean> {
    const key = deviceKey(deviceId);
    if (this.redis) {
      try {
        return (await this.redis.sismember(BLOCKED_DEVICES_SET, key)) === 1;
      } catch {
        // Fall through to Firestore.
      }
    }
    const snap = await this.col()?.doc(key).get().catch(() => null);
    return (snap?.data() as DeviceDoc | undefined)?.blocked === true;
  }

  /** Remember that `uid` uses this phone. Throttled; never throws. */
  async record(uid: string, device: { id: string; name: string | null }): Promise<void> {
    const col = this.col();
    if (!col) return;
    const key = deviceKey(device.id);
    const seenKey = `device:seen:${key}:${uid}`;
    try {
      if (this.redis) {
        const first = await this.redis.set(seenKey, '1', 'EX', SEEN_THROTTLE_SEC, 'NX');
        if (first !== 'OK') return;
      }
      const ref = col.doc(key);
      const exists = (await ref.get()).exists;
      const update = {
        platform: device.id.startsWith('ios:') ? 'ios' : 'android',
        ...(device.name ? { name: device.name } : {}),
        uids: FieldValue.arrayUnion(uid),
        lastUid: uid,
        lastSeenAt: Timestamp.now(),
      };
      if (exists) await ref.update(update);
      else {
        await ref.set({ name: null, blocked: false, blockedAt: null, blockedBy: null, blockedReason: null, ...update });
        this.logger.log(`New ${update.platform} device recorded for rider ${uid}`);
      }
    } catch (error) {
      // Try again on the next request rather than waiting out the throttle.
      await this.redis?.del(seenKey).catch(() => 0);
      this.logger.warn(`Recording device failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listForUser(uid: string): Promise<DeviceDto[]> {
    const col = this.col();
    if (!col) return [];
    const snap = await col.where('uids', 'array-contains', uid).get();
    return snap.docs
      .map((d) => {
        const doc = d.data() as DeviceDoc;
        return {
          key: d.id,
          platform: doc.platform,
          name: doc.name,
          lastSeenAt: doc.lastSeenAt.toDate().toISOString(),
          otherRiders: doc.uids.filter((u) => u !== uid).length,
          blocked: doc.blocked === true,
          blockedAt: doc.blockedAt?.toDate().toISOString() ?? null,
          blockedBy: doc.blockedBy ?? null,
          blockedReason: doc.blockedReason ?? null,
        };
      })
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }

  /** Every blocked phone, newest block first, with the riders who have used it. */
  async listBlocked(): Promise<(Omit<DeviceDto, 'otherRiders'> & { uids: string[] })[]> {
    const col = this.col();
    if (!col) return [];
    const snap = await col.where('blocked', '==', true).get();
    return snap.docs
      .map((d) => {
        const doc = d.data() as DeviceDoc;
        return {
          key: d.id,
          platform: doc.platform,
          name: doc.name,
          lastSeenAt: doc.lastSeenAt.toDate().toISOString(),
          uids: doc.uids,
          blocked: true,
          blockedAt: doc.blockedAt?.toDate().toISOString() ?? null,
          blockedBy: doc.blockedBy ?? null,
          blockedReason: doc.blockedReason ?? null,
        };
      })
      .sort((a, b) => (b.blockedAt ?? '').localeCompare(a.blockedAt ?? ''));
  }

  /** Block (or unblock) one device. Returns every rider who has used it. */
  async setBlocked(key: string, blocked: boolean, adminEmail: string | null, reason: string | null = null): Promise<string[]> {
    const ref = this.col()?.doc(key);
    const snap = await ref?.get();
    if (!ref || !snap?.exists) {
      const body: ErrorResponseBody = { code: 'NOT_FOUND', message: 'That device does not exist.' };
      throw new NotFoundException(body);
    }
    await ref.update(
      blocked
        ? { blocked: true, blockedAt: Timestamp.now(), blockedBy: adminEmail, blockedReason: reason?.trim() || null }
        : { blocked: false, blockedAt: null, blockedBy: null, blockedReason: null },
    );
    if (this.redis) {
      if (blocked) await this.redis.sadd(BLOCKED_DEVICES_SET, key);
      else await this.redis.srem(BLOCKED_DEVICES_SET, key);
    }
    this.logger.log(`Device ${key.slice(0, 12)}… ${blocked ? 'blocked' : 'unblocked'} by ${adminEmail ?? 'admin'}`);
    return (snap.data() as DeviceDoc).uids;
  }

  /** Account deleted: drop the rider from their devices (a block stays on the phone). */
  async forgetUser(uid: string): Promise<void> {
    const col = this.col();
    if (!col) return;
    const snap = await col.where('uids', 'array-contains', uid).select().get();
    await Promise.all(snap.docs.map((d) => d.ref.update({ uids: FieldValue.arrayRemove(uid) })));
  }
}
