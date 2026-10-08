import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { requireRedis } from '../common/service-unavailable';
import { validationError } from '../common/zod-parse';
import { PreferencesService, normalizeLanguage } from '../preferences/preferences.service';
import { ProfilesService } from '../profiles/profiles.service';
import { REDIS } from '../redis/redis.module';
import { ServerEvents, type ChatMessagePayload } from '../realtime/realtime.events';
import { RealtimeService } from '../realtime/realtime.service';
import { RoomsService } from '../rooms/rooms.service';
import { TranslationService } from './translation.service';

const MAX_LENGTH = 500;
const HISTORY_LENGTH = 50;
const HISTORY_TTL_SEC = 24 * 60 * 60;
const RATE_WINDOW_SEC = 10;
const RATE_MAX = 8;

type StoredMessage = {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  original: string;
  originalLanguage: string | null;
  /** language → translated text */
  translations: Record<string, string>;
  sentAt: string;
};

const keys = {
  history: (roomId: string) => `room:${roomId}:chat`,
  rate: (uid: string) => `rate:chat:${uid}`,
};

/** In-R.O.O.M. text chat with real-time auto-translation (CHAT_MESSAGE_SENT → CHAT_MESSAGE_TRANSLATED). */
@Injectable()
export class ChatService {
  constructor(
    @Inject(REDIS) private readonly redisClient: Redis | null,
    private readonly rooms: RoomsService,
    private readonly preferences: PreferencesService,
    private readonly profiles: ProfilesService,
    private readonly translation: TranslationService,
    private readonly realtime: RealtimeService,
  ) {}

  private get redis(): Redis {
    return requireRedis(this.redisClient);
  }

  async send(uid: string, rawText: string): Promise<ChatMessagePayload> {
    const text = rawText.replace(/\s+/g, ' ').trim();
    if (!text) validationError('Message is empty.', { field: 'text' });
    if (text.length > MAX_LENGTH) validationError(`Messages can be up to ${MAX_LENGTH} characters.`, { field: 'text' });

    const roomId = await this.rooms.currentRoomId(uid);
    if (!roomId) validationError('You are not in a R.O.O.M.', { field: 'roomId' });

    const count = await this.redis.incr(keys.rate(uid));
    if (count === 1) await this.redis.expire(keys.rate(uid), RATE_WINDOW_SEC);
    if (count > RATE_MAX) validationError('You are sending messages too quickly.', { field: 'rate' });

    const members = await this.rooms.roomMembers(roomId);
    const [sender, languages] = await Promise.all([
      this.profiles.get(uid),
      this.preferences.languageSettings(members),
    ]);

    // Translate once per distinct language among riders who want translation.
    const senderLanguage = languages.get(uid)?.language ?? null;
    const targets = new Set<string>();
    for (const [memberId, settings] of languages) {
      if (memberId !== uid && settings.autoTranslate) targets.add(normalizeLanguage(settings.language));
    }
    const translations: Record<string, string> = {};
    let detected: string | null = null;
    await Promise.all(
      [...targets].map(async (target) => {
        const result = await this.translation.translate(text, target);
        if (!result) return;
        detected = detected ?? result.detectedLanguage;
        if (result.detectedLanguage && normalizeLanguage(result.detectedLanguage) === target) return;
        translations[target] = result.text;
      }),
    );

    const stored: StoredMessage = {
      id: randomUUID(),
      roomId,
      senderId: uid,
      senderName: sender.displayName,
      original: text,
      originalLanguage: detected ?? senderLanguage,
      translations,
      sentAt: new Date().toISOString(),
    };
    await this.redis
      .multi()
      .rpush(keys.history(roomId), JSON.stringify(stored))
      .ltrim(keys.history(roomId), -HISTORY_LENGTH, -1)
      .expire(keys.history(roomId), HISTORY_TTL_SEC)
      .exec();

    for (const memberId of members) {
      const settings = languages.get(memberId);
      const target = settings?.autoTranslate && memberId !== uid ? normalizeLanguage(settings.language) : null;
      this.realtime.emitToUser(memberId, ServerEvents.CHAT_MESSAGE_TRANSLATED, toPayload(stored, target));
    }
    return toPayload(stored, null);
  }

  /** Recent history for the caller's current room, in the caller's language. */
  async recent(uid: string): Promise<ChatMessagePayload[]> {
    const roomId = await this.rooms.currentRoomId(uid);
    if (!roomId) return [];
    const [raw, settings] = await Promise.all([
      this.redis.lrange(keys.history(roomId), 0, -1),
      this.preferences.languageSettings([uid]),
    ]);
    const mine = settings.get(uid);
    return raw.map((item) => {
      const message = JSON.parse(item) as StoredMessage;
      const target = mine?.autoTranslate && message.senderId !== uid ? normalizeLanguage(mine.language) : null;
      return toPayload(message, target);
    });
  }

  /** Last messages of a room, for moderator context on reports. */
  async contextFor(roomId: string, limit = 20): Promise<{ senderId: string; text: string; sentAt: string }[]> {
    const raw = await this.redis.lrange(keys.history(roomId), -limit, -1);
    return raw.map((item) => {
      const m = JSON.parse(item) as StoredMessage;
      return { senderId: m.senderId, text: m.original, sentAt: m.sentAt };
    });
  }
}

function toPayload(message: StoredMessage, targetLanguage: string | null): ChatMessagePayload {
  const translatedText = targetLanguage ? message.translations[targetLanguage] : undefined;
  return {
    id: message.id,
    roomId: message.roomId,
    senderId: message.senderId,
    senderName: message.senderName,
    text: translatedText ?? message.original,
    original: message.original,
    originalLanguage: message.originalLanguage,
    translated: translatedText != null,
    targetLanguage: translatedText != null ? targetLanguage : null,
    sentAt: message.sentAt,
  };
}
