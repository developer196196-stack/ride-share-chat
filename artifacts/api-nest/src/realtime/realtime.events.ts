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
  /** The room's moderator changed (the host left; the longest-present rider takes over). */
  ROOM_HOST_CHANGED: 'ROOM_HOST_CHANGED',
  /** Host changed the mood, matching mode or privacy lock. */
  ROOM_SETTINGS_CHANGED: 'ROOM_SETTINGS_CHANGED',
  /** To the ejected rider only. */
  ROOM_EJECTED: 'ROOM_EJECTED',
  /** To the muted rider only: turn the local microphone off and show the notice. */
  FORCE_MUTED: 'FORCE_MUTED',
  /** To the invitee: the host invited you (or accepted your join request). */
  ROOM_INVITE: 'ROOM_INVITE',
  /** To the host: a friend asks for a seat in your private room. */
  ROOM_JOIN_REQUEST: 'ROOM_JOIN_REQUEST',
  /** To the requester: the host declined. */
  ROOM_REQUEST_DECLINED: 'ROOM_REQUEST_DECLINED',
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
