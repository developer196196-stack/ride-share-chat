import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
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
import { getRoomSkipBlockSec, MPS_TO_MPH } from '../validation/validation.config';
import { ValidationService } from '../validation/validation.service';
import type { TerminationReason } from '../validation/validation.types';
import { LiveKitService } from './livekit.service';
import {
  DISCOVER_LIMIT,
  ROOM_CAPACITY,
  VIBES,
  type DiscoverRoomDto,
  type LiveRoomDto,
  type RoomHostDto,
  type RideSummaryDto,
  type RoomMatching,
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
  /** uid → join time, for handing the host role to the longest-present rider. */
  joined: (id: string) => `room:${id}:joined`,
  /** Riders the host ejected; kept out of this room for its lifetime. */
  ejected: (id: string) => `room:${id}:ejected`,
  /** Host invite (or accepted join request): lets the rider into a private room. */
  invite: (id: string, uid: string) => `room:${id}:invite:${uid}`,
  /** Pending join requests: uid → request time. */
  requests: (id: string) => `room:${id}:requests`,
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

type RoomMeta = { vibe?: string; hostUid?: string; matching?: string; locked?: string; createdAt?: string };

/** Public = on the Discovery Grid and open to matchmaking. */
const isPublic = (meta: RoomMeta) => meta.matching !== 'manual' && meta.locked !== '1';

function forbidden(code: string, message: string): never {
  const body: ErrorResponseBody = { code, message };
  throw new ForbiddenException(body);
}

function memberNotFound(): never {
  const body: ErrorResponseBody = { code: 'MEMBER_NOT_FOUND', message: "That rider isn't in your R.O.O.M. anymore." };
  throw new NotFoundException(body);
}

/** Invites and join requests expire after this long. */
const INVITE_TTL_SEC = 10 * 60;

const EJECTED_MESSAGE = 'The host removed you from this R.O.O.M. Pick another room to keep chatting.';
const FORCE_MUTED_MESSAGE = 'The Host has muted your microphone.';

function notFound(): never {
  const body: ErrorResponseBody = { code: 'ROOM_NOT_FOUND', message: 'That R.O.O.M. no longer exists.' };
  throw new NotFoundException(body);
}

function newRoomId(): string {
  const hex = randomBytes(3).toString('hex').toUpperCase();
  return `ROOM-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/** Room ids look like ROOM-1A2B-3C. */
const ROOM_ID = /^ROOM-[0-9A-F]{4}-[0-9A-F]{2}$/;

/**
 * Rolling R.O.O.M.s: every vibe keeps a sorted set of rooms with open seats. A joining rider goes
 * to the fullest open room containing nobody they recently skipped, so rooms backfill as riders
 * reach their drop-off; a new room opens only when none fits.
 *
 * Every room has a host (moderator): the rider who hosted it, or the first rider in a room the
 * matchmaker opened. When the host leaves, the longest-present rider takes over. Riders can also
 * browse live rooms (Discovery Grid) and join a specific one.
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

  /** Discovery Grid: live rooms with open seats, fullest first (newest breaks ties). */
  async discover(uid: string): Promise<{ rooms: DiscoverRoomDto[]; liveRooms: number }> {
    const current = await this.currentRoomId(uid);
    const perVibe = await Promise.all(
      VIBES.map(async (vibe) => (await this.redis.smembers(keys.all(vibe))).map((roomId) => ({ roomId, vibe }))),
    );
    const all = perVibe.flat();
    const rooms = await Promise.all(
      all.map(async ({ roomId, vibe }) => {
        const [members, meta, ejected] = await Promise.all([
          this.roomMembers(roomId),
          this.redis.hgetall(keys.room(roomId)) as Promise<RoomMeta>,
          this.redis.sismember(keys.ejected(roomId), uid),
        ]);
        return {
          roomId,
          vibe,
          members,
          hostUid: meta.hostUid ?? null,
          createdAt: Number(meta.createdAt ?? 0),
          listed: isPublic(meta) && ejected === 0,
        };
      }),
    );
    const liveRooms = rooms.filter((r) => r.members.length > 0).length;

    const candidates = rooms
      .filter((r) => r.listed && r.roomId !== current && r.members.length > 0 && r.members.length < ROOM_CAPACITY)
      .sort((a, b) => b.members.length - a.members.length || b.createdAt - a.createdAt);
    const visible: typeof candidates = [];
    for (const room of candidates) {
      if (visible.length >= DISCOVER_LIMIT) break;
      if (await this.blockedFrom(uid, room.members)) continue;
      visible.push(room);
    }

    const hostIds = visible.map((r) => (r.hostUid && r.members.includes(r.hostUid) ? r.hostUid : r.members[0]!));
    const profiles = await this.profiles.getMany([...new Set(hostIds)]);
    return {
      liveRooms,
      rooms: visible.map((room, i) => {
        const hostId = hostIds[i]!;
        const p = profiles.get(hostId);
        return {
          roomId: room.roomId,
          vibe: room.vibe,
          memberCount: room.members.length,
          capacity: ROOM_CAPACITY,
          host: { uid: hostId, displayName: p?.displayName ?? 'Rider', homeCity: p?.homeCity ?? null, photoUrl: p?.photoUrl ?? null },
          createdAt: new Date(room.createdAt || Date.now()).toISOString(),
        };
      }),
    };
  }

  /** True when the rider skipped (or was skipped by) any of these riders in the last 60 minutes. */
  private async blockedFrom(uid: string, members: string[]): Promise<boolean> {
    if (members.length === 0) return false;
    const blocked = await Promise.all(members.map((m) => this.redis.exists(keys.block(uid, m))));
    return blocked.some((b) => b === 1);
  }

  async getCurrent(uid: string): Promise<RoomSessionDto | null> {
    const roomId = await this.currentRoomId(uid);
    if (!roomId) return null;
    return this.buildSession(uid, roomId);
  }

  private async buildSession(uid: string, roomId: string): Promise<RoomSessionDto | null> {
    const [[vibe, hostUid, matching, locked], memberIds, session] = await Promise.all([
      this.redis.hmget(keys.room(roomId), 'vibe', 'hostUid', 'matching', 'locked'),
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
          isHost: id === hostUid,
        };
      })
      // You first, then by name, matching the grid layout.
      .sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.displayName.localeCompare(b.displayName));
    const self = members.find((m) => m.isSelf);
    return {
      roomId,
      vibe: vibe as Vibe,
      capacity: ROOM_CAPACITY,
      hostUid: hostUid ?? null,
      matching: matching === 'manual' ? 'manual' : 'auto',
      locked: locked === '1',
      members,
      livekit: await this.livekit.connectionFor(roomId, uid, self?.displayName ?? 'Rider'),
      joinedAt: new Date(session?.currentJoinedAt ?? Date.now()).toISOString(),
    };
  }

  // ---------------------------------------------------------------- join / leave

  /** A verified ride, including traffic grace (stopped at a light or in traffic mid-ride). */
  private async requireVerified(uid: string): Promise<void> {
    const state = await this.validation.getState(uid);
    if (state.state !== 'VERIFIED' && state.state !== 'GRACE') {
      conflict('NOT_VERIFIED', 'Your trip must be verified before you can enter a R.O.O.M.');
    }
  }

  /** Host a Room: open a new public room for the mood with the rider as moderator. */
  async host(uid: string, vibe: Vibe): Promise<RoomSessionDto> {
    await this.requireVerified(uid);
    await this.leaveRoom(uid);
    const roomId = await this.withVibeLock(vibe, async () => {
      const id = newRoomId();
      await this.redis
        .multi()
        .hset(keys.room(id), { vibe, createdAt: String(Date.now()), hostUid: uid })
        .sadd(keys.all(vibe), id)
        .exec();
      await this.seat(uid, id, vibe);
      return id;
    });
    return this.afterJoin(uid, roomId, vibe);
  }

  /** Join a specific room from the Discovery Grid. */
  async joinById(uid: string, roomId: string): Promise<RoomSessionDto> {
    if (!ROOM_ID.test(roomId)) notFound();
    await this.requireVerified(uid);
    const vibe = (await this.redis.hget(keys.room(roomId), 'vibe')) as Vibe | null;
    if (!vibe) notFound();
    if ((await this.currentRoomId(uid)) === roomId) {
      const session = await this.buildSession(uid, roomId);
      if (session) return session;
    }
    // A host invite gets past Manual matching and the Privacy Lock (never past an ejection or skip).
    const invited = (await this.redis.exists(keys.invite(roomId, uid))) === 1;
    // Check before leaving the current room, so a rejected join keeps the rider where they are.
    await this.assertJoinable(uid, roomId, invited);
    await this.leaveRoom(uid);
    await this.withVibeLock(vibe, async () => {
      // Re-check under the lock: the room may have filled or closed meanwhile.
      await this.assertJoinable(uid, roomId, invited);
      await this.seat(uid, roomId, vibe);
    });
    await this.redis.multi().del(keys.invite(roomId, uid)).hdel(keys.requests(roomId), uid).exec();
    return this.afterJoin(uid, roomId, vibe);
  }

  private async assertJoinable(uid: string, roomId: string, invited = false): Promise<void> {
    const [members, meta, ejected] = await Promise.all([
      this.roomMembers(roomId),
      this.redis.hgetall(keys.room(roomId)) as Promise<RoomMeta>,
      this.redis.sismember(keys.ejected(roomId), uid),
    ]);
    if (ejected === 1) conflict('ROOM_UNAVAILABLE', 'The host removed you from that R.O.O.M.');
    if (!invited && !isPublic(meta)) conflict('ROOM_PRIVATE', 'That R.O.O.M. is private right now. Pick another one.');
    if (members.length === 0) conflict('ROOM_UNAVAILABLE', 'That R.O.O.M. just closed. Pick another one.');
    if (members.length >= ROOM_CAPACITY) conflict('ROOM_FULL', 'That R.O.O.M. is full. Pick another one.');
    if (await this.blockedFrom(uid, members)) {
      conflict('ROOM_UNAVAILABLE', 'Someone you recently skipped is in that R.O.O.M.');
    }
  }

  async join(uid: string, vibe: Vibe): Promise<RoomSessionDto> {
    await this.requireVerified(uid);
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
    const blockSec = getRoomSkipBlockSec();
    if (others.length > 0 && blockSec > 0) {
      const pipeline = this.redis.multi();
      for (const other of others) {
        pipeline.set(keys.block(uid, other), '1', 'EX', blockSec);
        pipeline.set(keys.block(other, uid), '1', 'EX', blockSec);
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
        if (await this.blockedFrom(uid, members)) continue;
        if ((await this.redis.sismember(keys.ejected(candidate), uid)) === 1) continue;
        chosen = candidate;
        break;
      }

      if (!chosen) {
        // The matchmaker opened this room, so its first rider hosts it.
        chosen = newRoomId();
        await this.redis
          .multi()
          .hset(keys.room(chosen), { vibe, createdAt: String(Date.now()), hostUid: uid })
          .sadd(keys.all(vibe), chosen)
          .exec();
      }

      await this.seat(uid, chosen, vibe);
      return chosen;
    });

    return this.afterJoin(uid, roomId, vibe);
  }

  /** Adds the rider to the room's seats (call under the vibe lock). */
  private async seat(uid: string, roomId: string, vibe: Vibe): Promise<void> {
    await this.redis
      .multi()
      .sadd(keys.members(roomId), uid)
      .hset(keys.joined(roomId), uid, String(Date.now()))
      .exec();
    await this.redis.set(keys.userRoom(uid), roomId, 'EX', SESSION_TTL_SEC);
    await this.syncOpenSeats(roomId, vibe);
  }

  /** Keeps the matchmaker's open-room set in step with occupancy and the room's privacy. */
  private async syncOpenSeats(roomId: string, vibe: Vibe): Promise<void> {
    const [count, meta] = await Promise.all([
      this.redis.scard(keys.members(roomId)),
      this.redis.hgetall(keys.room(roomId)) as Promise<RoomMeta>,
    ]);
    if (count > 0 && count < ROOM_CAPACITY && isPublic(meta)) await this.redis.zadd(keys.open(vibe), count, roomId);
    else await this.redis.zrem(keys.open(vibe), roomId);
  }

  /** Ride bookkeeping, session for the rider, and a join notice for the others. */
  private async afterJoin(uid: string, roomId: string, vibe: Vibe): Promise<RoomSessionDto> {
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

    await this.redis
      .multi()
      .srem(keys.members(roomId), uid)
      .hdel(keys.joined(roomId), uid)
      .del(keys.userRoom(uid))
      .exec();
    const remaining = await this.roomMembers(roomId);
    if (vibe) {
      if (remaining.length === 0) {
        await this.redis
          .multi()
          .zrem(keys.open(vibe), roomId)
          .srem(keys.all(vibe), roomId)
          .del(
            keys.room(roomId),
            keys.members(roomId),
            keys.joined(roomId),
            keys.ejected(roomId),
            keys.requests(roomId),
            `room:${roomId}:chat`,
          )
          .exec();
      } else {
        await this.syncOpenSeats(roomId, vibe);
        await this.handOverHost(roomId, uid, remaining);
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

  /** When the host leaves, the longest-present rider becomes host. */
  private async handOverHost(roomId: string, leftUid: string, remaining: string[]): Promise<void> {
    const hostUid = await this.redis.hget(keys.room(roomId), 'hostUid');
    if (hostUid && hostUid !== leftUid && remaining.includes(hostUid)) return;
    const joined = await this.redis.hgetall(keys.joined(roomId));
    const next = [...remaining].sort((a, b) => Number(joined[a] ?? Infinity) - Number(joined[b] ?? Infinity))[0]!;
    await this.redis.hset(keys.room(roomId), 'hostUid', next);
    this.realtime.emitToUsers(remaining, ServerEvents.ROOM_HOST_CHANGED, { roomId, hostUid: next });
  }

  // ---------------------------------------------------------------- host moderation

  /** The caller must be the host of their current room. */
  private async requireHost(uid: string): Promise<{ roomId: string; meta: RoomMeta; members: string[] }> {
    const roomId = await this.currentRoomId(uid);
    if (!roomId) conflict('NOT_IN_ROOM', 'You are not in a R.O.O.M.');
    const [meta, members] = await Promise.all([
      this.redis.hgetall(keys.room(roomId)) as Promise<RoomMeta>,
      this.roomMembers(roomId),
    ]);
    if (meta.hostUid !== uid) forbidden('NOT_HOST', 'Only the host can do that.');
    return { roomId, meta, members };
  }

  /** Host + a target rider in the same room (never the host themselves). */
  async requireHostOf(uid: string, target: string): Promise<string> {
    const { roomId, members } = await this.requireHost(uid);
    if (target === uid || !members.includes(target)) memberNotFound();
    return roomId;
  }

  /** Eject: out of the room and video, and kept out of this room for its lifetime. The ride goes on. */
  async eject(uid: string, target: string): Promise<{ ok: true }> {
    const roomId = await this.requireHostOf(uid, target);
    await this.redis.multi().sadd(keys.ejected(roomId), target).expire(keys.ejected(roomId), SESSION_TTL_SEC).exec();
    await this.leaveRoom(target);
    this.realtime.emitToUser(target, ServerEvents.ROOM_EJECTED, { roomId, message: EJECTED_MESSAGE });
    this.logger.log(`Host ${uid} ejected ${target} from ${roomId}`);
    return { ok: true };
  }

  /** Force-mute: server-side mute on the video server plus a notice to the rider. */
  async forceMute(uid: string, target: string): Promise<{ ok: true }> {
    const roomId = await this.requireHostOf(uid, target);
    await this.livekit.muteMicrophone(roomId, target);
    this.realtime.emitToUser(target, ServerEvents.FORCE_MUTED, { roomId, message: FORCE_MUTED_MESSAGE });
    return { ok: true };
  }

  /** Mood shift, automatic/manual matching and privacy lock. */
  async updateSettings(
    uid: string,
    update: { vibe?: Vibe; matching?: RoomMatching; locked?: boolean },
  ): Promise<RoomSessionDto> {
    const { roomId, meta, members } = await this.requireHost(uid);
    const oldVibe = meta.vibe as Vibe;
    const vibe = update.vibe ?? oldVibe;

    if (vibe !== oldVibe) {
      // Move the room from the old mood's pool to the new one.
      await this.withVibeLock(oldVibe, () =>
        this.redis.multi().zrem(keys.open(oldVibe), roomId).srem(keys.all(oldVibe), roomId).exec(),
      );
    }
    const fields: Record<string, string> = { vibe };
    if (update.matching) fields.matching = update.matching;
    if (update.locked != null) fields.locked = update.locked ? '1' : '0';
    await this.withVibeLock(vibe, async () => {
      await this.redis.multi().hset(keys.room(roomId), fields).sadd(keys.all(vibe), roomId).exec();
      await this.syncOpenSeats(roomId, vibe);
    });

    const session = await this.buildSession(uid, roomId);
    if (!session) conflict('ROOM_UNAVAILABLE', 'That R.O.O.M. closed.');
    this.realtime.emitToUsers(members, ServerEvents.ROOM_SETTINGS_CHANGED, {
      roomId,
      vibe: session.vibe,
      matching: session.matching,
      locked: session.locked,
    });
    return session;
  }

  // ---------------------------------------------------------------- friends: live rooms, invites, requests

  /** Current room for each rider (only riders in a room are in the map). */
  async liveRooms(uids: string[]): Promise<Map<string, LiveRoomDto>> {
    const result = new Map<string, LiveRoomDto>();
    await Promise.all(
      uids.map(async (uid) => {
        const roomId = await this.currentRoomId(uid);
        if (!roomId) return;
        const [meta, count] = await Promise.all([
          this.redis.hgetall(keys.room(roomId)) as Promise<RoomMeta>,
          this.redis.scard(keys.members(roomId)),
        ]);
        if (!meta.vibe || count === 0) return;
        result.set(uid, {
          roomId,
          vibe: meta.vibe as Vibe,
          isHost: meta.hostUid === uid,
          memberCount: count,
          capacity: ROOM_CAPACITY,
          open: isPublic(meta) && count < ROOM_CAPACITY,
        });
      }),
    );
    return result;
  }

  /** Host of a room (404 when the room is gone). */
  async hostOf(roomId: string): Promise<string> {
    if (!ROOM_ID.test(roomId)) notFound();
    const hostUid = await this.redis.hget(keys.room(roomId), 'hostUid');
    if (!hostUid) notFound();
    return hostUid;
  }

  private async hostCard(uid: string): Promise<RoomHostDto> {
    const p = (await this.profiles.getMany([uid])).get(uid);
    return { uid, displayName: p?.displayName ?? 'Rider', homeCity: p?.homeCity ?? null, photoUrl: p?.photoUrl ?? null };
  }

  /** Host invite: valid for 10 minutes, gets past Manual / Privacy Lock. Network check is the caller's. */
  async invite(uid: string, target: string, opts: { viaRequest?: boolean } = {}): Promise<{ ok: true }> {
    const { roomId, meta, members } = await this.requireHost(uid);
    if (target === uid || members.includes(target)) conflict('ALREADY_IN_ROOM', 'That rider is already in your R.O.O.M.');
    if ((await this.redis.sismember(keys.ejected(roomId), target)) === 1) {
      conflict('ROOM_UNAVAILABLE', 'You removed that rider from this R.O.O.M.');
    }
    await this.redis
      .multi()
      .set(keys.invite(roomId, target), uid, 'EX', INVITE_TTL_SEC)
      .hdel(keys.requests(roomId), target)
      .exec();
    this.realtime.emitToUser(target, ServerEvents.ROOM_INVITE, {
      roomId,
      vibe: meta.vibe,
      from: await this.hostCard(uid),
      viaRequest: opts.viaRequest === true,
      expiresAt: new Date(Date.now() + INVITE_TTL_SEC * 1000).toISOString(),
    });
    return { ok: true };
  }

  /** A friend asks a private room for a seat (friendship is checked by the caller). */
  async requestToJoin(uid: string, roomId: string): Promise<{ ok: true }> {
    await this.requireVerified(uid);
    const [meta, members, ejected] = await Promise.all([
      this.redis.hgetall(keys.room(roomId)) as Promise<RoomMeta>,
      this.roomMembers(roomId),
      this.redis.sismember(keys.ejected(roomId), uid),
    ]);
    if (!meta.vibe || !meta.hostUid || members.length === 0) notFound();
    if (members.includes(uid)) conflict('ALREADY_IN_ROOM', 'You are already in that R.O.O.M.');
    if (isPublic(meta)) conflict('ROOM_PUBLIC', 'That R.O.O.M. is open — just join it.');
    if (ejected === 1) conflict('ROOM_UNAVAILABLE', 'The host removed you from that R.O.O.M.');
    if (members.length >= ROOM_CAPACITY) conflict('ROOM_FULL', 'That R.O.O.M. is full.');
    if (await this.blockedFrom(uid, members)) conflict('ROOM_UNAVAILABLE', 'Someone you recently skipped is in that R.O.O.M.');
    await this.redis
      .multi()
      .hset(keys.requests(roomId), uid, String(Date.now()))
      .expire(keys.requests(roomId), INVITE_TTL_SEC)
      .exec();
    this.realtime.emitToUser(meta.hostUid, ServerEvents.ROOM_JOIN_REQUEST, { roomId, requester: await this.hostCard(uid) });
    return { ok: true };
  }

  async listRequests(uid: string): Promise<{ requests: { user: RoomHostDto; requestedAt: string }[] }> {
    const { roomId } = await this.requireHost(uid);
    const raw = await this.redis.hgetall(keys.requests(roomId));
    const cutoff = Date.now() - INVITE_TTL_SEC * 1000;
    const pending = Object.entries(raw)
      .map(([id, at]) => ({ id, at: Number(at) }))
      .filter((r) => r.at >= cutoff)
      .sort((a, b) => a.at - b.at);
    const profiles = await this.profiles.getMany(pending.map((r) => r.id));
    return {
      requests: pending.map(({ id, at }) => {
        const p = profiles.get(id);
        return {
          user: { uid: id, displayName: p?.displayName ?? 'Rider', homeCity: p?.homeCity ?? null, photoUrl: p?.photoUrl ?? null },
          requestedAt: new Date(at).toISOString(),
        };
      }),
    };
  }

  async acceptRequest(uid: string, requester: string): Promise<{ ok: true }> {
    const { roomId } = await this.requireHost(uid);
    if (!(await this.redis.hexists(keys.requests(roomId), requester))) {
      const body: ErrorResponseBody = { code: 'REQUEST_NOT_FOUND', message: 'That request expired or was withdrawn.' };
      throw new NotFoundException(body);
    }
    return this.invite(uid, requester, { viaRequest: true });
  }

  async declineRequest(uid: string, requester: string): Promise<{ ok: true }> {
    const { roomId } = await this.requireHost(uid);
    const removed = await this.redis.hdel(keys.requests(roomId), requester);
    if (removed > 0) {
      this.realtime.emitToUser(requester, ServerEvents.ROOM_REQUEST_DECLINED, {
        roomId,
        message: "The host couldn't fit you in this time.",
      });
    }
    return { ok: true };
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
