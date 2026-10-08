import { ConflictException, Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreCollections, RIDES_SUBCOLLECTION, type RideDoc } from '@workspace/firebase';
import type { ErrorResponseBody } from '../common/error-response';
import { requireRedis } from '../common/service-unavailable';
import { FIRESTORE } from '../firebase/firebase.tokens';
import { ProfilesService } from '../profiles/profiles.service';
import { REDIS } from '../redis/redis.module';
import { ServerEvents } from '../realtime/realtime.events';
import { RealtimeService } from '../realtime/realtime.service';
import { MPS_TO_MPH } from '../validation/validation.config';
import { ValidationService } from '../validation/validation.service';
import type { TerminationReason } from '../validation/validation.types';
import { LiveKitService } from './livekit.service';
import {
  ROOM_CAPACITY,
  SKIP_BLOCK_SEC,
  VIBES,
  type RideSummaryDto,
  type RoomMemberDto,
  type RoomSessionDto,
  type Vibe,
} from './rooms.types';

const SESSION_TTL_SEC = 12 * 60 * 60;
const LAST_SUMMARY_TTL_SEC = 24 * 60 * 60;
const LOCK_TTL_MS = 5_000;

const keys = {
  room: (id: string) => `room:${id}`,
  members: (id: string) => `room:${id}:members`,
  open: (vibe: Vibe) => `vibe:${vibe}:open`,
  all: (vibe: Vibe) => `vibe:${vibe}:all`,
  userRoom: (uid: string) => `user:${uid}:room`,
  block: (a: string, b: string) => `block:${a}:${b}`,
  session: (uid: string) => `sess:${uid}`,
  peers: (uid: string) => `sess:${uid}:peers`,
  lastSummary: (uid: string) => `ride:last:${uid}`,
  lock: (vibe: Vibe) => `lock:vibe:${vibe}`,
};

type RideSession = { vibe: Vibe; roomJoinedAt: number; roomMs: number; currentJoinedAt: number | null };

function conflict(code: string, message: string): never {
  const body: ErrorResponseBody = { code, message };
  throw new ConflictException(body);
}

function newRoomId(): string {
  const hex = randomBytes(3).toString('hex').toUpperCase();
  return `ROOM-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/**
 * Rolling R.O.O.M.s: every vibe keeps a sorted set of rooms with open seats. A joining rider goes
 * to the fullest open room containing nobody they recently skipped, so rooms backfill as riders
 * reach their drop-off; a new room opens only when none fits.
 */
@Injectable()
export class RoomsService implements OnModuleInit {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @Inject(REDIS) private readonly redisClient: Redis | null,
    @Inject(FIRESTORE) private readonly firestore: Firestore | null,
    private readonly validation: ValidationService,
    private readonly livekit: LiveKitService,
    private readonly profiles: ProfilesService,
    private readonly realtime: RealtimeService,
  ) {}

  onModuleInit(): void {
    this.validation.onTerminated((uid, reason) => this.handleTermination(uid, reason));
  }

  private get redis(): Redis {
    return requireRedis(this.redisClient);
  }

  // ---------------------------------------------------------------- locking

  private async withVibeLock<T>(vibe: Vibe, task: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    const key = keys.lock(vibe);
    for (let attempt = 0; attempt < 40; attempt++) {
      if (await this.redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX')) {
        try {
          return await task();
        } finally {
          // Release only our own lock.
          await this.redis.eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            1,
            key,
            token,
          );
        }
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    conflict('MATCHMAKER_BUSY', 'Matchmaking is busy. Please try again.');
  }

  // ---------------------------------------------------------------- queries

  async vibeStats(): Promise<{ vibe: Vibe; rooms: number; riders: number; openSeats: number }[]> {
    return Promise.all(
      VIBES.map(async (vibe) => {
        const roomIds = await this.redis.smembers(keys.all(vibe));
        const counts = await Promise.all(roomIds.map((id) => this.redis.scard(keys.members(id))));
        const riders = counts.reduce((a, b) => a + b, 0);
        return { vibe, rooms: roomIds.length, riders, openSeats: roomIds.length * ROOM_CAPACITY - riders };
      }),
    );
  }

  async currentRoomId(uid: string): Promise<string | null> {
    return this.redis.get(keys.userRoom(uid));
  }

  async roomMembers(roomId: string): Promise<string[]> {
    return this.redis.smembers(keys.members(roomId));
  }

  async getCurrent(uid: string): Promise<RoomSessionDto | null> {
    const roomId = await this.currentRoomId(uid);
    if (!roomId) return null;
    return this.buildSession(uid, roomId);
  }

  private async buildSession(uid: string, roomId: string): Promise<RoomSessionDto | null> {
    const [vibe, memberIds, session] = await Promise.all([
      this.redis.hget(keys.room(roomId), 'vibe'),
      this.roomMembers(roomId),
      this.getRideSession(uid),
    ]);
    if (!vibe) return null;
    const profiles = await this.profiles.getMany(memberIds);
    const members: RoomMemberDto[] = memberIds
      .map((id) => {
        const p = profiles.get(id);
        return {
          uid: id,
          displayName: p?.displayName ?? 'Rider',
          homeCity: p?.homeCity ?? null,
          photoUrl: p?.photoUrl ?? null,
          isSelf: id === uid,
        };
      })
      // You first, then by name, matching the grid layout.
      .sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.displayName.localeCompare(b.displayName));
    const self = members.find((m) => m.isSelf);
    return {
      roomId,
      vibe: vibe as Vibe,
      capacity: ROOM_CAPACITY,
      members,
      livekit: await this.livekit.connectionFor(roomId, uid, self?.displayName ?? 'Rider'),
      joinedAt: new Date(session?.currentJoinedAt ?? Date.now()).toISOString(),
    };
  }

  // ---------------------------------------------------------------- join / leave

  async join(uid: string, vibe: Vibe): Promise<RoomSessionDto> {
    const state = await this.validation.getState(uid);
    if (state.state !== 'VERIFIED') {
      conflict('NOT_VERIFIED', 'Your trip must be verified before you can enter a R.O.O.M.');
    }
    const current = await this.currentRoomId(uid);
    if (current) {
      const currentVibe = await this.redis.hget(keys.room(current), 'vibe');
      if (currentVibe === vibe) {
        const session = await this.buildSession(uid, current);
        if (session) return session;
      }
      await this.leaveRoom(uid);
    }
    return this.assign(uid, vibe, null);
  }

  /** Instant Escape: block this room's riders for 60 minutes and move to another room. */
  async next(uid: string): Promise<RoomSessionDto> {
    const state = await this.validation.getState(uid);
    if (state.state !== 'VERIFIED' && state.state !== 'GRACE') {
      conflict('NOT_VERIFIED', 'Your trip must be verified before you can enter a R.O.O.M.');
    }
    const roomId = await this.currentRoomId(uid);
    if (!roomId) conflict('NOT_IN_ROOM', 'You are not in a R.O.O.M.');
    const vibe = ((await this.redis.hget(keys.room(roomId), 'vibe')) ?? 'party_mode') as Vibe;
    const others = (await this.roomMembers(roomId)).filter((m) => m !== uid);
    if (others.length > 0) {
      const pipeline = this.redis.multi();
      for (const other of others) {
        pipeline.set(keys.block(uid, other), '1', 'EX', SKIP_BLOCK_SEC);
        pipeline.set(keys.block(other, uid), '1', 'EX', SKIP_BLOCK_SEC);
      }
      await pipeline.exec();
    }
    await this.leaveRoom(uid);
    return this.assign(uid, vibe, roomId);
  }

  private async assign(uid: string, vibe: Vibe, excludeRoomId: string | null): Promise<RoomSessionDto> {
    const roomId = await this.withVibeLock(vibe, async () => {
      // Open rooms, fullest first.
      const candidates = await this.redis.zrevrangebyscore(keys.open(vibe), ROOM_CAPACITY - 1, 1);
      let chosen: string | null = null;
      for (const candidate of candidates) {
        if (candidate === excludeRoomId) continue;
        const members = await this.roomMembers(candidate);
        if (members.length === 0 || members.length >= ROOM_CAPACITY) continue;
        const blocked = await Promise.all(members.map((m) => this.redis.exists(keys.block(uid, m))));
        if (blocked.some((b) => b === 1)) continue;
        chosen = candidate;
        break;
      }

      if (!chosen) {
        chosen = newRoomId();
        await this.redis
          .multi()
          .hset(keys.room(chosen), { vibe, createdAt: String(Date.now()) })
          .sadd(keys.all(vibe), chosen)
          .exec();
      }

      await this.redis.sadd(keys.members(chosen), uid);
      const count = await this.redis.scard(keys.members(chosen));
      const pipeline = this.redis.multi().set(keys.userRoom(uid), chosen, 'EX', SESSION_TTL_SEC);
      if (count >= ROOM_CAPACITY) pipeline.zrem(keys.open(vibe), chosen);
      else pipeline.zadd(keys.open(vibe), count, chosen);
      await pipeline.exec();
      return chosen;
    });

    await this.recordJoin(uid, roomId, vibe);
    const session = await this.buildSession(uid, roomId);
    if (!session) conflict('ROOM_UNAVAILABLE', 'That R.O.O.M. closed. Please try again.');
    const self = session.members.find((m) => m.isSelf);
    const others = session.members.filter((m) => !m.isSelf).map((m) => m.uid);
    if (self) {
      this.realtime.emitToUsers(others, ServerEvents.ROOM_MEMBER_JOINED, {
        roomId,
        member: { ...self, isSelf: false },
      });
    }
    return session;
  }

  private async recordJoin(uid: string, roomId: string, vibe: Vibe): Promise<void> {
    const now = Date.now();
    const existing = await this.getRideSession(uid);
    const session: RideSession = existing
      ? { ...existing, vibe, currentJoinedAt: now }
      : { vibe, roomJoinedAt: now, roomMs: 0, currentJoinedAt: now };
    const others = (await this.roomMembers(roomId)).filter((m) => m !== uid);
    const pipeline = this.redis.multi().set(keys.session(uid), JSON.stringify(session), 'EX', SESSION_TTL_SEC);
    if (others.length > 0) {
      pipeline.sadd(keys.peers(uid), ...others).expire(keys.peers(uid), SESSION_TTL_SEC);
      for (const other of others) pipeline.sadd(keys.peers(other), uid).expire(keys.peers(other), SESSION_TTL_SEC);
    }
    await pipeline.exec();
  }

  private async getRideSession(uid: string): Promise<RideSession | null> {
    const raw = await this.redis.get(keys.session(uid));
    return raw ? (JSON.parse(raw) as RideSession) : null;
  }

  /** Leaves the current room (if any) without ending the ride. */
  async leaveRoom(uid: string): Promise<string | null> {
    const roomId = await this.currentRoomId(uid);
    if (!roomId) return null;
    const vibe = (await this.redis.hget(keys.room(roomId), 'vibe')) as Vibe | null;

    await this.redis.multi().srem(keys.members(roomId), uid).del(keys.userRoom(uid)).exec();
    const remaining = await this.roomMembers(roomId);
    if (vibe) {
      if (remaining.length === 0) {
        await this.redis
          .multi()
          .zrem(keys.open(vibe), roomId)
          .srem(keys.all(vibe), roomId)
          .del(keys.room(roomId), keys.members(roomId), `room:${roomId}:chat`)
          .exec();
      } else {
        await this.redis.zadd(keys.open(vibe), remaining.length, roomId);
      }
    }

    const session = await this.getRideSession(uid);
    if (session?.currentJoinedAt) {
      session.roomMs += Date.now() - session.currentJoinedAt;
      session.currentJoinedAt = null;
      await this.redis.set(keys.session(uid), JSON.stringify(session), 'EX', SESSION_TTL_SEC);
    }

    this.realtime.emitToUsers(remaining, ServerEvents.ROOM_MEMBER_LEFT, { roomId, uid });
    await this.livekit.remove(roomId, uid);
    return roomId;
  }

  // ---------------------------------------------------------------- ride end

  /** Hang up: leave the room, end validation and return the ride summary. */
  async endRide(uid: string): Promise<RideSummaryDto> {
    const hadSession = Boolean(await this.getRideSession(uid)) || Boolean(await this.currentRoomId(uid));
    if (!hadSession) {
      const last = await this.redis.get(keys.lastSummary(uid));
      if (last) return JSON.parse(last) as RideSummaryDto;
    }
    await this.leaveRoom(uid);
    const engine = await this.validation.end(uid);
    return this.finishRide(uid, engine.state === 'TERMINATED' ? (engine.terminationReason ?? 'user_ended') : 'user_ended');
  }

  private async handleTermination(uid: string, reason: TerminationReason): Promise<void> {
    const inRoom = await this.currentRoomId(uid);
    const session = await this.getRideSession(uid);
    if (!inRoom && !session) return;
    await this.leaveRoom(uid);
    await this.finishRide(uid, reason);
  }

  private async finishRide(uid: string, endReason: string): Promise<RideSummaryDto> {
    const now = Date.now();
    const [engine, session, peersMet] = await Promise.all([
      this.validation.getState(uid),
      this.getRideSession(uid),
      this.redis.scard(keys.peers(uid)),
    ]);
    const startedAt = engine.verifiedAt ?? session?.roomJoinedAt ?? now;
    const distanceMiles = (engine.stats.distanceM / 1609.344);
    const avgMps = engine.stats.movingMs > 0 ? engine.stats.distanceM / (engine.stats.movingMs / 1000) : 0;
    const summary: RideSummaryDto = {
      rideId: randomUUID(),
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(now).toISOString(),
      durationSec: Math.max(0, Math.round((now - startedAt) / 1000)),
      roomDurationSec: Math.round((session?.roomMs ?? 0) / 1000),
      distanceMiles: Math.round(distanceMiles * 10) / 10,
      avgMph: Math.round(avgMps * MPS_TO_MPH * 10) / 10,
      peersMet,
      graceCount: engine.stats.graceCount,
      graceSeconds: Math.round(engine.stats.graceMs / 1000),
      vibe: session?.vibe ?? null,
      endReason,
    };

    await this.redis
      .multi()
      .set(keys.lastSummary(uid), JSON.stringify(summary), 'EX', LAST_SUMMARY_TTL_SEC)
      .del(keys.session(uid), keys.peers(uid))
      .exec();

    if (this.firestore && summary.durationSec > 0) {
      const doc: RideDoc = {
        startedAt: Timestamp.fromMillis(startedAt),
        endedAt: Timestamp.fromMillis(now),
        durationSec: summary.durationSec,
        roomDurationSec: summary.roomDurationSec,
        distanceMiles: summary.distanceMiles,
        avgMph: summary.avgMph,
        peersMet: summary.peersMet,
        graceCount: summary.graceCount,
        graceSeconds: summary.graceSeconds,
        vibe: summary.vibe,
        endReason,
      };
      await this.firestore
        .collection(FirestoreCollections.users)
        .doc(uid)
        .collection(RIDES_SUBCOLLECTION)
        .doc(summary.rideId)
        .set(doc)
        .catch((error: unknown) =>
          this.logger.warn(`Saving ride failed: ${error instanceof Error ? error.message : String(error)}`),
        );
    }
    return summary;
  }

  async listRides(uid: string): Promise<RideSummaryDto[]> {
    if (!this.firestore) return [];
    const snap = await this.firestore
      .collection(FirestoreCollections.users)
      .doc(uid)
      .collection(RIDES_SUBCOLLECTION)
      .orderBy('endedAt', 'desc')
      .limit(20)
      .get();
    return snap.docs.map((d) => {
      const r = d.data() as RideDoc;
      return {
        rideId: d.id,
        startedAt: r.startedAt.toDate().toISOString(),
        endedAt: r.endedAt.toDate().toISOString(),
        durationSec: r.durationSec,
        roomDurationSec: r.roomDurationSec,
        distanceMiles: r.distanceMiles,
        avgMph: r.avgMph,
        peersMet: r.peersMet,
        graceCount: r.graceCount,
        graceSeconds: r.graceSeconds,
        vibe: (r.vibe as Vibe | null) ?? null,
        endReason: r.endReason,
      };
    });
  }
}
