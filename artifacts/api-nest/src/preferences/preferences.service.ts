import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  FirestoreCollections,
  TRUSTED_CONTACTS_SUBCOLLECTION,
  type TrustedContactDoc,
  type UserDoc,
  type UserPreferencesDoc,
} from '@workspace/firebase';
import { requireFirestore } from '../common/require-firestore';
import { validationError } from '../common/zod-parse';
import { FIRESTORE } from '../firebase/firebase.tokens';
import { REDIS } from '../redis/redis.module';

export type TrustedContactDto = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  channel: TrustedContactDoc['channel'];
  createdAt: string;
};

export type TrustedContactInput = Omit<TrustedContactDto, 'id' | 'createdAt'>;

export type LanguageSettings = { language: string; autoTranslate: boolean };

const MAX_CONTACTS = 5;
const CACHE_TTL_SEC = 60 * 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const DEFAULT_PREFERENCES: UserPreferencesDoc = {
  nativeLanguage: 'en',
  autoTranslate: true,
  subtitleSize: 'md',
  subtitleStyle: 'bubble',
  promptShareOnVerified: false,
};

const cacheKey = (uid: string) => `prefs:${uid}`;

@Injectable()
export class PreferencesService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore | null,
    @Inject(REDIS) private readonly redis: Redis | null,
  ) {}

  private users() {
    return requireFirestore(this.firestore).collection(FirestoreCollections.users);
  }

  private contacts(uid: string) {
    return this.users().doc(uid).collection(TRUSTED_CONTACTS_SUBCOLLECTION);
  }

  async get(uid: string, languageHint?: string | null): Promise<UserPreferencesDoc> {
    const cached = await this.redis?.get(cacheKey(uid));
    if (cached) return JSON.parse(cached) as UserPreferencesDoc;

    const snap = await this.users().doc(uid).get();
    const stored = (snap.data() as UserDoc | undefined)?.preferences;
    const prefs: UserPreferencesDoc = {
      ...DEFAULT_PREFERENCES,
      ...(languageHint ? { nativeLanguage: normalizeLanguage(languageHint) } : {}),
      ...stored,
    };
    if (stored) await this.redis?.set(cacheKey(uid), JSON.stringify(prefs), 'EX', CACHE_TTL_SEC);
    return prefs;
  }

  async update(uid: string, prefs: UserPreferencesDoc): Promise<UserPreferencesDoc> {
    const next = { ...prefs, nativeLanguage: normalizeLanguage(prefs.nativeLanguage) };
    // set+merge: works before auth bootstrap created the user document.
    await this.users().doc(uid).set({ preferences: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await this.redis?.set(cacheKey(uid), JSON.stringify(next), 'EX', CACHE_TTL_SEC);
    return next;
  }

  /** Chat translation settings for several riders at once. */
  async languageSettings(uids: string[]): Promise<Map<string, LanguageSettings>> {
    const entries = await Promise.all(
      uids.map(async (uid) => {
        try {
          const p = await this.get(uid);
          return [uid, { language: p.nativeLanguage, autoTranslate: p.autoTranslate }] as const;
        } catch {
          return [uid, { language: DEFAULT_PREFERENCES.nativeLanguage, autoTranslate: true }] as const;
        }
      }),
    );
    return new Map(entries);
  }

  async listContacts(uid: string): Promise<TrustedContactDto[]> {
    const snap = await this.contacts(uid).orderBy('createdAt', 'asc').get();
    return snap.docs.map((d) => toContactDto(d.id, d.data() as TrustedContactDoc));
  }

  async addContact(uid: string, input: TrustedContactInput): Promise<TrustedContactDto> {
    const name = input.name.trim();
    const email = input.email?.trim() || null;
    const phone = input.phone?.trim() || null;
    if ((input.channel === 'sms' || input.channel === 'whatsapp') && !phone) {
      validationError('A phone number is required for SMS and WhatsApp contacts.', { field: 'phone' });
    }
    if (input.channel === 'email' && !email) {
      validationError('An email address is required for email contacts.', { field: 'email' });
    }
    if (email && !EMAIL_RE.test(email)) {
      validationError('Enter a valid email address.', { field: 'email' });
    }

    const existing = await this.contacts(uid).count().get();
    if (existing.data().count >= MAX_CONTACTS) {
      validationError(`You can add up to ${MAX_CONTACTS} trusted contacts.`, { field: 'contacts' });
    }

    const doc: TrustedContactDoc = { name, phone, email, channel: input.channel, createdAt: Timestamp.now() };
    const ref = await this.contacts(uid).add(doc);
    return toContactDto(ref.id, doc);
  }

  async removeContact(uid: string, contactId: string): Promise<void> {
    await this.contacts(uid).doc(contactId).delete();
  }
}

function toContactDto(id: string, doc: TrustedContactDoc): TrustedContactDto {
  return {
    id,
    name: doc.name,
    phone: doc.phone ?? null,
    email: doc.email ?? null,
    channel: doc.channel,
    createdAt: doc.createdAt.toDate().toISOString(),
  };
}

/** "en-US" → "en", keeps script variants Google Translate needs (zh-CN, zh-TW). */
export function normalizeLanguage(code: string): string {
  const trimmed = code.trim();
  const [base, region] = trimmed.split(/[-_]/);
  if (!base) return DEFAULT_PREFERENCES.nativeLanguage;
  const lower = base.toLowerCase();
  if (lower === 'zh') return region?.toUpperCase() === 'TW' || region?.toUpperCase() === 'HK' ? 'zh-TW' : 'zh-CN';
  return lower;
}
