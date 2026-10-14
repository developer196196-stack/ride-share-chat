import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreCollections, FOLLOWERS_SUBCOLLECTION, FOLLOWING_SUBCOLLECTION } from '@workspace/firebase';
import type { ErrorResponseBody } from '../common/error-response';
import { requireFirestore } from '../common/require-firestore';
import { FIRESTORE } from '../firebase/firebase.tokens';
import { ProfilesService } from '../profiles/profiles.service';
import { RoomsService } from '../rooms/rooms.service';
import type { LiveRoomDto } from '../rooms/rooms.types';

export type SocialUserDto = {
  uid: string;
  displayName: string;
  homeCity: string | null;
  photoUrl: string | null;
  isFollowing: boolean;
  followsYou: boolean;
  /** Only for friends (mutual follows) who are in a R.O.O.M. right now. */
  live: LiveRoomDto | null;
};

export type PublicProfileDto = SocialUserDto & { followerCount: number; followingCount: number };

/** Lists stop here; enough for a phase-one social graph. */
const LIST_LIMIT = 200;

function userNotFound(): never {
  const body: ErrorResponseBody = { code: 'USER_NOT_FOUND', message: 'That rider does not exist.' };
  throw new NotFoundException(body);
}

/**
 * Follow graph: `users/{uid}/following/{target}` mirrored by `users/{target}/followers/{uid}`.
 * Following is one-way, so live room status (where someone is riding) is shared with friends
 * only — riders who follow each other — never with one-way followers.
 */
@Injectable()
export class SocialService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore | null,
    private readonly profiles: ProfilesService,
    private readonly rooms: RoomsService,
  ) {}

  private get db(): Firestore {
    return requireFirestore(this.firestore);
  }

  private edge(uid: string, sub: string, other: string): DocumentReference {
    return this.db.collection(FirestoreCollections.users).doc(uid).collection(sub).doc(other);
  }

  private async exists(uid: string): Promise<boolean> {
    return (await this.db.collection(FirestoreCollections.users).doc(uid).get()).exists;
  }

  private async countOf(uid: string, sub: string): Promise<number> {
    const snap = await this.db.collection(FirestoreCollections.users).doc(uid).collection(sub).count().get();
    return snap.data().count;
  }

  async follow(uid: string, target: string): Promise<{ following: boolean; followerCount: number }> {
    if (target === uid) {
      const body: ErrorResponseBody = { code: 'CANNOT_FOLLOW_SELF', message: 'You cannot follow yourself.' };
      throw new ConflictException(body);
    }
    if (!(await this.exists(target))) userNotFound();
    const doc = { createdAt: Timestamp.now() };
    await this.db
      .batch()
      .set(this.edge(uid, FOLLOWING_SUBCOLLECTION, target), doc)
      .set(this.edge(target, FOLLOWERS_SUBCOLLECTION, uid), doc)
      .commit();
    return { following: true, followerCount: await this.countOf(target, FOLLOWERS_SUBCOLLECTION) };
  }

  async unfollow(uid: string, target: string): Promise<{ following: boolean; followerCount: number }> {
    await this.db
      .batch()
      .delete(this.edge(uid, FOLLOWING_SUBCOLLECTION, target))
      .delete(this.edge(target, FOLLOWERS_SUBCOLLECTION, uid))
      .commit();
    return { following: false, followerCount: await this.countOf(target, FOLLOWERS_SUBCOLLECTION) };
  }

  /** For each uid: does `uid` follow them, and do they follow `uid`? */
  private async relations(uid: string, others: string[]): Promise<Map<string, { isFollowing: boolean; followsYou: boolean }>> {
    const result = new Map<string, { isFollowing: boolean; followsYou: boolean }>();
    if (others.length === 0) return result;
    const refs = others.flatMap((o) => [this.edge(uid, FOLLOWING_SUBCOLLECTION, o), this.edge(uid, FOLLOWERS_SUBCOLLECTION, o)]);
    const snaps = await this.db.getAll(...refs);
    others.forEach((o, i) => result.set(o, { isFollowing: snaps[2 * i]!.exists, followsYou: snaps[2 * i + 1]!.exists }));
    return result;
  }

  async areFriends(a: string, b: string): Promise<boolean> {
    const rel = (await this.relations(a, [b])).get(b);
    return Boolean(rel?.isFollowing && rel.followsYou);
  }

  /** In the rider's network: either follows the other. */
  async isConnected(a: string, b: string): Promise<boolean> {
    const rel = (await this.relations(a, [b])).get(b);
    return Boolean(rel?.isFollowing || rel?.followsYou);
  }

  private async toUsers(uid: string, ids: string[]): Promise<SocialUserDto[]> {
    const [relations, profiles] = await Promise.all([this.relations(uid, ids), this.profiles.getMany(ids)]);
    const friends = ids.filter((id) => relations.get(id)?.isFollowing && relations.get(id)?.followsYou);
    const live = await this.rooms.liveRooms(friends);
    return ids.map((id) => {
      const p = profiles.get(id);
      const rel = relations.get(id) ?? { isFollowing: false, followsYou: false };
      return {
        uid: id,
        displayName: p?.displayName ?? 'Rider',
        homeCity: p?.homeCity ?? null,
        photoUrl: p?.photoUrl ?? null,
        ...rel,
        live: live.get(id) ?? null,
      };
    });
  }

  private async list(uid: string, sub: string): Promise<{ users: SocialUserDto[] }> {
    const snap = await this.db
      .collection(FirestoreCollections.users)
      .doc(uid)
      .collection(sub)
      .orderBy('createdAt', 'desc')
      .limit(LIST_LIMIT)
      .get();
    const users = await this.toUsers(uid, snap.docs.map((d) => d.id));
    // Friends riding right now first.
    users.sort((a, b) => Number(b.live != null) - Number(a.live != null));
    return { users };
  }

  listFollowing(uid: string) {
    return this.list(uid, FOLLOWING_SUBCOLLECTION);
  }

  listFollowers(uid: string) {
    return this.list(uid, FOLLOWERS_SUBCOLLECTION);
  }

  async profile(viewer: string, target: string): Promise<PublicProfileDto> {
    if (!(await this.exists(target))) userNotFound();
    const [[user], followerCount, followingCount] = await Promise.all([
      target === viewer ? this.selfUser(viewer) : this.toUsers(viewer, [target]),
      this.countOf(target, FOLLOWERS_SUBCOLLECTION),
      this.countOf(target, FOLLOWING_SUBCOLLECTION),
    ]);
    return { ...user!, followerCount, followingCount };
  }

  private async selfUser(uid: string): Promise<SocialUserDto[]> {
    const p = (await this.profiles.getMany([uid])).get(uid);
    const live = (await this.rooms.liveRooms([uid])).get(uid) ?? null;
    return [
      {
        uid,
        displayName: p?.displayName ?? 'Rider',
        homeCity: p?.homeCity ?? null,
        photoUrl: p?.photoUrl ?? null,
        isFollowing: false,
        followsYou: false,
        live,
      },
    ];
  }
}
