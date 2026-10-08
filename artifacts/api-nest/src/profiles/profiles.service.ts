import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import { createSignedDownloadUrl, FirestoreCollections, type UserDoc } from '@workspace/firebase';
import { FIRESTORE } from '../firebase/firebase.tokens';

export type ProfileSummary = {
  uid: string;
  displayName: string;
  homeCity: string | null;
  photoUrl: string | null;
};

const CACHE_TTL_MS = 5 * 60_000;

/** Public-facing rider details shown to other R.O.O.M. members (short in-memory cache). */
@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);
  private readonly cache = new Map<string, { value: ProfileSummary; expiresAt: number }>();

  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore | null) {}

  invalidate(uid: string): void {
    this.cache.delete(uid);
  }

  async getMany(uids: string[]): Promise<Map<string, ProfileSummary>> {
    const now = Date.now();
    const result = new Map<string, ProfileSummary>();
    const missing: string[] = [];
    for (const uid of uids) {
      const hit = this.cache.get(uid);
      if (hit && hit.expiresAt > now) result.set(uid, hit.value);
      else missing.push(uid);
    }
    if (missing.length === 0 || !this.firestore) {
      for (const uid of missing) result.set(uid, fallback(uid));
      return result;
    }

    const refs = missing.map((uid) => this.firestore!.collection(FirestoreCollections.users).doc(uid));
    const snaps = await this.firestore.getAll(...refs);
    await Promise.all(
      snaps.map(async (snap, i) => {
        const uid = missing[i]!;
        const doc = snap.data() as UserDoc | undefined;
        let photoUrl: string | null = null;
        if (doc?.photoStoragePath) {
          try {
            photoUrl = await createSignedDownloadUrl(doc.photoStoragePath);
          } catch (error) {
            this.logger.warn(`Avatar signing failed for ${uid}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        const value: ProfileSummary = {
          uid,
          displayName: doc?.displayName ?? 'Rider',
          homeCity: doc?.homeCity ?? null,
          photoUrl,
        };
        this.cache.set(uid, { value, expiresAt: now + CACHE_TTL_MS });
        result.set(uid, value);
      }),
    );
    return result;
  }

  async get(uid: string): Promise<ProfileSummary> {
    return (await this.getMany([uid])).get(uid) ?? fallback(uid);
  }
}

function fallback(uid: string): ProfileSummary {
  return { uid, displayName: 'Rider', homeCity: null, photoUrl: null };
}
