/**
 * WebSocket contract for `wss://<host>/api/v1/room/stream` (Socket.IO).
 * Keep in sync with artifacts/mobile/lib/realtime/events.ts.
 */
import type { ValidationSnapshot } from '../validation/validation.types';

export const ClientEvents = {
  TELEMETRY: 'TELEMETRY',
  CHAT_MESSAGE_SENT: 'CHAT_MESSAGE_SENT',
  SAFETY_ALERT_TRIGGERED: 'SAFETY_ALERT_TRIGGERED',
} as const;

export const ServerEvents = {
  /** Every processed telemetry sample (live speed, score, module breakdown). */
  VALIDATION_UPDATE: 'VALIDATION_UPDATE',
  /** Only when the validation state changes (PENDING → VERIFIED, VERIFIED → GRACE…). */
  VALIDATION_STATE_CHANGED: 'VALIDATION_STATE_CHANGED',
  CHAT_MESSAGE_TRANSLATED: 'CHAT_MESSAGE_TRANSLATED',
  ROOM_MEMBER_JOINED: 'ROOM_MEMBER_JOINED',
  ROOM_MEMBER_LEFT: 'ROOM_MEMBER_LEFT',
  SESSION_TERMINATED: 'SESSION_TERMINATED',
} as const;

export type ValidationUpdatePayload = ValidationSnapshot;

export type ChatMessagePayload = {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  /** Text in the recipient's language (or the original when not translated). */
  text: string;
  original: string;
  originalLanguage: string | null;
  translated: boolean;
  targetLanguage: string | null;
  sentAt: string;
};

export type SessionTerminatedPayload = {
  reason: string;
  message: string;
};
