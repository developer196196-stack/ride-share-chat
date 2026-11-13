import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreCollections, type PushTokenDoc, type UserPreferencesDoc } from '@workspace/firebase';
import { loadAppConfig } from '../config/configuration';
import { validationError } from '../common/zod-parse';
import { FIRESTORE } from '../firebase/firebase.tokens';
import { PreferencesService } from '../preferences/preferences.service';
import { REDIS } from '../redis/redis.module';

/** What a notification is about. The app routes a tap by `data.type`. */
export type PushKind = 'new_follower' | 'room_invite' | 'join_request' | 'friend_live';

export type PushMessage = {
  kind: PushKind;
  title: string;
  body: string;
  /** Extra fields for the app; `type` is added from `kind`. */
  data?: Record<string, unknown>;
  /** Drop the notification if it can't be delivered within this time (e.g. a 10-minute invite). */
  ttlSec?: number;
  /** Send at most once per recipient per `dedupeSec` for the same key. */
  dedupe?: { key: string; sec: number };
};

/** The rider's switch for each kind (Settings → Notifications). */
const PREFERENCE: Record<PushKind, keyof UserPreferencesDoc> = {
  new_follower: 'notifyNewFollowers',
  friend_live: 'notifyFriendsLive',
  room_invite: 'notifyRoomInvites',
  join_request: 'notifyRoomInvites',
};

/** Android notification channels, created by the app (lib/notifications). */
const CHANNEL: Record<PushKind, 'social' | 'rooms'> = {
  new_follower: 'social',
  friend_live: 'social',
  room_invite: 'rooms',
  join_request: 'rooms',
};

const EXPO_SEND = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS = 'https://exp.host/--/api/v2/push/getReceipts';
const TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]{1,200}\]$/;
/** Expo accepts up to 100 messages per request. */
const SEND_CHUNK = 100;
/** Expo asks to check receipts after ~15 minutes; dead tokens show up there. */
const RECEIPT_DELAY_MS = 15 * 60_000;
/** Firestore `in` queries take up to 30 values. */
const IN_CHUNK = 30;

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
  priority: 'high' | 'normal';
  channelId: string;
  ttl?: number;
};
type ExpoTicket = { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };
type ExpoReceipt = { status: 'ok' } | { status: 'error'; message: string; details?: { error?: string } };

const docId = (token: string) => createHash('sha256').update(token).digest('hex');

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Push notifications through Expo's push service: one API for Android (FCM) and iOS (APNs).
 * Each device's Expo push token is stored in `pushTokens/{sha256(token)}` with the rider signed in
 * on it, so a phone that changes account notifies only the new rider. Sending never throws: a
 * notification is a nice-to-have on top of the in-app (socket) event.
 */
@Injectable()
export class PushService implements OnModuleDestroy {
  private readonly logger = new Logger(PushService.name);
  private readonly accessToken = loadAppConfig().EXPO_ACCESS_TOKEN;
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore | null,
    @Inject(REDIS) private readonly redis: Redis | null,
    private readonly preferences: PreferencesService,
  ) {}

  onModuleDestroy(): void {
    for (const t of this.timers) clearTimeout(t);
  }

  private tokens() {
    return this.firestore?.collection(FirestoreCollections.pushTokens) ?? null;
  }

  async register(uid: string, token: string, platform: 'ios' | 'android'): Promise<void> {
    if (!TOKEN_RE.test(token)) validationError('That is not an Expo push token.', { field: 'token' });
    const doc: PushTokenDoc = { uid, token, platform, updatedAt: Timestamp.now() };
    await this.tokens()?.doc(docId(token)).set(doc);
  }

  /** Sign-out: stop notifying this device (only if it still belongs to `uid`). */
  async unregister(uid: string, token: string): Promise<void> {
    const ref = this.tokens()?.doc(docId(token));
    if (!ref) return;
    const snap = await ref.get();
    if (snap.exists && (snap.data() as PushTokenDoc).uid === uid) await ref.delete();
  }

  sendToUser(uid: string, message: PushMessage): Promise<void> {
    return this.sendToUsers([uid], message);
  }

  async sendToUsers(uids: string[], message: PushMessage): Promise<void> {
    try {
      const recipients = await this.filterRecipients([...new Set(uids)], message);
      if (recipients.length === 0) return;
      const tokens = await this.tokensOf(recipients);
      if (tokens.length === 0) return;
      const data = { ...message.data, type: message.kind };
      const messages: ExpoMessage[] = tokens.map((to) => ({
        to,
        title: message.title,
        body: message.body,
        data,
        sound: 'default',
        priority: 'high',
        channelId: CHANNEL[message.kind],
        ...(message.ttlSec ? { ttl: message.ttlSec } : {}),
      }));
      for (const batch of chunk(messages, SEND_CHUNK)) await this.send(batch);
    } catch (err) {
      this.logger.warn(`Push "${message.kind}" failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Riders who allow this kind and haven't had the same notification recently. */
  private async filterRecipients(uids: string[], message: PushMessage): Promise<string[]> {
    const pref = PREFERENCE[message.kind];
    const allowed = await Promise.all(
      uids.map(async (uid) => {
        const prefs = await this.preferences.get(uid).catch(() => null);
        if (prefs && prefs[pref] === false) return false;
        if (message.dedupe && this.redis) {
          const first = await this.redis.set(`push:dedupe:${message.dedupe.key}:${uid}`, '1', 'EX', message.dedupe.sec, 'NX');
          if (first !== 'OK') return false;
        }
        return true;
      }),
    );
    return uids.filter((_, i) => allowed[i]);
  }

  private async tokensOf(uids: string[]): Promise<string[]> {
    const col = this.tokens();
    if (!col) return [];
    const snaps = await Promise.all(chunk(uids, IN_CHUNK).map((ids) => col.where('uid', 'in', ids).get()));
    return snaps.flatMap((s) => s.docs.map((d) => (d.data() as PushTokenDoc).token));
  }

  private headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
    };
  }

  private async send(messages: ExpoMessage[]): Promise<void> {
    const res = await fetch(EXPO_SEND, { method: 'POST', headers: this.headers(), body: JSON.stringify(messages) });
    if (!res.ok) throw new Error(`Expo push HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const { data: tickets } = (await res.json()) as { data: ExpoTicket[] };
    const receiptIds = new Map<string, string>();
    tickets.forEach((ticket, i) => {
      const token = messages[i]!.to;
      if (ticket.status === 'ok') receiptIds.set(ticket.id, token);
      else this.handleError(token, ticket.message, ticket.details?.error);
    });
    if (receiptIds.size > 0) {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        void this.checkReceipts(receiptIds);
      }, RECEIPT_DELAY_MS);
      timer.unref();
      this.timers.add(timer);
    }
  }

  private async checkReceipts(receiptIds: Map<string, string>): Promise<void> {
    try {
      for (const ids of chunk([...receiptIds.keys()], 300)) {
        const res = await fetch(EXPO_RECEIPTS, { method: 'POST', headers: this.headers(), body: JSON.stringify({ ids }) });
        if (!res.ok) return;
        const { data } = (await res.json()) as { data: Record<string, ExpoReceipt> };
        for (const [id, receipt] of Object.entries(data)) {
          if (receipt.status === 'error') this.handleError(receiptIds.get(id)!, receipt.message, receipt.details?.error);
        }
      }
    } catch (err) {
      this.logger.debug(`Push receipts check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private handleError(token: string, message: string, code: string | undefined): void {
    if (code === 'DeviceNotRegistered') {
      // The app was uninstalled or notifications were reset: forget the token.
      void this.tokens()?.doc(docId(token)).delete().catch(() => undefined);
      return;
    }
    // InvalidCredentials / MismatchSenderId mean the FCM or APNs keys in EAS need fixing.
    this.logger.warn(`Push to a device failed (${code ?? 'error'}): ${message}`);
  }
}
