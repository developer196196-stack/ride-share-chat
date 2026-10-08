import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type Redis from 'ioredis';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreCollections, type SafetyAlertDoc, type ShareLinkDoc } from '@workspace/firebase';
import type { ErrorResponseBody } from '../common/error-response';
import { requireFirestore } from '../common/require-firestore';
import { FIRESTORE } from '../firebase/firebase.tokens';
import { PreferencesService, type TrustedContactDto } from '../preferences/preferences.service';
import { ProfilesService } from '../profiles/profiles.service';
import { REDIS } from '../redis/redis.module';
import { RoomsService } from '../rooms/rooms.service';
import { ValidationService } from '../validation/validation.service';
import type { ValidationState } from '../validation/validation.types';

const DEFAULT_TTL_MIN = 4 * 60;

export type ShareLinkDto = { token: string; url: string; expiresAt: string };

export type SafetyAlertResultDto = {
  alertId: string;
  shareUrl: string;
  message: string;
  contacts: TrustedContactDto[];
};

export type PublicShareDto = {
  riderName: string;
  active: boolean;
  state: ValidationState | null;
  speedMph: number | null;
  location: { lat: number; lng: number; accuracyM: number | null } | null;
  updatedAt: string | null;
  expiresAt: string;
};

type CachedLink = { uid: string; riderName: string; expiresAt: number };

const keys = {
  link: (token: string) => `share:${token}`,
  active: (uid: string) => `share:active:${uid}`,
};

/** Live trip status links (public page) and safety alerts. Messages are sent by the rider's own apps. */
@Injectable()
export class SafetyService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore | null,
    @Inject(REDIS) private readonly redis: Redis | null,
    private readonly validation: ValidationService,
    private readonly preferences: PreferencesService,
    private readonly profiles: ProfilesService,
    private readonly rooms: RoomsService,
  ) {}

  /** Reuses the rider's active link so repeated taps don't spam new URLs. */
  async createShareLink(uid: string, baseUrl: string, ttlMinutes = DEFAULT_TTL_MIN): Promise<ShareLinkDto> {
    const db = requireFirestore(this.firestore);
    const now = Date.now();

    const activeToken = await this.redis?.get(keys.active(uid));
    if (activeToken) {
      const cached = await this.readLink(activeToken);
      if (cached && cached.expiresAt > now + 10 * 60_000) {
        return { token: activeToken, url: shareUrl(baseUrl, activeToken), expiresAt: new Date(cached.expiresAt).toISOString() };
      }
    }

    const token = randomBytes(18).toString('base64url');
    const riderName = (await this.profiles.get(uid)).displayName;
    const expiresAt = now + ttlMinutes * 60_000;
    const doc: ShareLinkDoc = {
      uid,
      riderName,
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(expiresAt),
    };
    await db.collection(FirestoreCollections.shareLinks).doc(token).set(doc);
    const ttlSec = Math.ceil((expiresAt - now) / 1000);
    const cached: CachedLink = { uid, riderName, expiresAt };
    await this.redis
      ?.multi()
      .set(keys.link(token), JSON.stringify(cached), 'EX', ttlSec)
      .set(keys.active(uid), token, 'EX', ttlSec)
      .exec();
    return { token, url: shareUrl(baseUrl, token), expiresAt: new Date(expiresAt).toISOString() };
  }

  private async readLink(token: string): Promise<CachedLink | null> {
    const cached = await this.redis?.get(keys.link(token));
    if (cached) return JSON.parse(cached) as CachedLink;
    if (!this.firestore) return null;
    const snap = await this.firestore.collection(FirestoreCollections.shareLinks).doc(token).get();
    const doc = snap.data() as ShareLinkDoc | undefined;
    return doc ? { uid: doc.uid, riderName: doc.riderName, expiresAt: doc.expiresAt.toMillis() } : null;
  }

  async getPublic(token: string): Promise<PublicShareDto> {
    const link = /^[A-Za-z0-9_-]{16,64}$/.test(token) ? await this.readLink(token) : null;
    if (!link) {
      const body: ErrorResponseBody = { code: 'SHARE_NOT_FOUND', message: 'This trip link does not exist.' };
      throw new NotFoundException(body);
    }
    const active = link.expiresAt > Date.now();
    const base: PublicShareDto = {
      riderName: link.riderName,
      active,
      state: null,
      speedMph: null,
      location: null,
      updatedAt: null,
      expiresAt: new Date(link.expiresAt).toISOString(),
    };
    if (!active || !this.redis) return base;

    const [location, snapshot] = await Promise.all([
      this.validation.getLatestLocation(link.uid),
      this.validation.getSnapshot(link.uid),
    ]);
    return {
      ...base,
      state: snapshot.state,
      speedMph: location?.speedMph ?? null,
      location: location ? { lat: location.lat, lng: location.lng, accuracyM: location.accuracyM } : null,
      updatedAt: location ? new Date(location.updatedAt).toISOString() : null,
    };
  }

  async createAlert(
    uid: string,
    kind: 'share_status' | 'emergency',
    location: { lat: number; lng: number; accuracyM: number | null } | null,
    baseUrl: string,
  ): Promise<SafetyAlertResultDto> {
    const db = requireFirestore(this.firestore);
    const [link, contacts, profile, snapshot, roomId] = await Promise.all([
      this.createShareLink(uid, baseUrl),
      this.preferences.listContacts(uid),
      this.profiles.get(uid),
      this.redis ? this.validation.getSnapshot(uid) : Promise.resolve(null),
      this.redis ? this.rooms.currentRoomId(uid) : Promise.resolve(null),
    ]);

    const doc: SafetyAlertDoc = {
      uid,
      kind,
      shareToken: link.token,
      location,
      validationState: snapshot?.state ?? null,
      roomId,
      createdAt: Timestamp.now(),
    };
    const ref = await db.collection(FirestoreCollections.safetyAlerts).add(doc);

    const name = profile.displayName;
    const message =
      kind === 'emergency'
        ? `SAFETY ALERT from ${name} (Rideshare Chats). I may need help. Live trip status: ${link.url}`
        : `I'm on a ride. Follow my trip live on Rideshare Chats: ${link.url}`;

    return { alertId: ref.id, shareUrl: link.url, message, contacts };
  }
}

export function shareUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/share/${token}`;
}
