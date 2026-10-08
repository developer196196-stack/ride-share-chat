import type { Timestamp } from 'firebase-admin/firestore';

/** Ride-style badge chosen on Profile Setup — keep in sync with OpenAPI `RideStyle`. */
export type RideStyle = 'party_tech' | 'networking' | 'deep_talks' | 'just_chilling';

/** `users/{uid}` — one document per Firebase Auth user (rider). */
export type UserDoc = {
  uid: string;
  phoneNumber: string | null;
  /** ISO 3166-1 alpha-2 of the dial code used at sign-in (e.g. "US"). */
  countryCode: string | null;
  displayName: string | null;
  /** Lower-cased display name, reserved for uniqueness checks / search. */
  displayNameLower: string | null;
  homeCity: string | null;
  rideStyle: RideStyle | null;
  incognitoDropoff: boolean;
  /** Firebase Storage object path of the avatar (never a public URL). */
  photoStoragePath: string | null;
  profileCompletedAt: Timestamp | null;
  /** Language, translation, subtitle and safety preferences (absent until first saved). */
  preferences?: UserPreferencesDoc;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type UserPreferencesDoc = {
  nativeLanguage: string;
  autoTranslate: boolean;
  subtitleSize: 'sm' | 'md' | 'lg';
  subtitleStyle: 'bubble' | 'subtitle';
  promptShareOnVerified: boolean;
};

export type ContactChannel = 'sms' | 'whatsapp' | 'email';

/** `users/{uid}/trustedContacts/{id}` */
export type TrustedContactDoc = {
  name: string;
  phone: string | null;
  email: string | null;
  channel: ContactChannel;
  createdAt: Timestamp;
};

/** `shareLinks/{token}` — public live trip status link. */
export type ShareLinkDoc = {
  uid: string;
  riderName: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
};

/** `safetyAlerts/{id}` */
export type SafetyAlertDoc = {
  uid: string;
  kind: 'share_status' | 'emergency';
  shareToken: string;
  location: { lat: number; lng: number; accuracyM: number | null } | null;
  validationState: string | null;
  roomId: string | null;
  createdAt: Timestamp;
};

/** `reports/{id}` */
export type ReportDoc = {
  reporterUid: string;
  reportedUid: string | null;
  roomId: string | null;
  reason: string;
  details: string | null;
  /** Recent room chat for moderator context. */
  recentMessages: { senderId: string; text: string; sentAt: string }[];
  status: 'open' | 'reviewed';
  createdAt: Timestamp;
};

/** `users/{uid}/rides/{id}` — one validated ride session. */
export type RideDoc = {
  startedAt: Timestamp;
  endedAt: Timestamp;
  durationSec: number;
  roomDurationSec: number;
  distanceMiles: number;
  avgMph: number;
  peersMet: number;
  graceCount: number;
  graceSeconds: number;
  vibe: string | null;
  endReason: string;
};
