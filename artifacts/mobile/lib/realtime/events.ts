/**
 * WebSocket contract for `<api>/api/v1/room/stream` (Socket.IO).
 * Keep in sync with artifacts/api-nest/src/realtime/realtime.events.ts.
 */
import type { ChatMessage, RoomMember, ValidationSnapshot, ValidationState } from '@workspace/api-client-react';

export const ClientEvents = {
  TELEMETRY: 'TELEMETRY',
  CHAT_MESSAGE_SENT: 'CHAT_MESSAGE_SENT',
  SAFETY_ALERT_TRIGGERED: 'SAFETY_ALERT_TRIGGERED',
} as const;

export const ServerEvents = {
  VALIDATION_UPDATE: 'VALIDATION_UPDATE',
  VALIDATION_STATE_CHANGED: 'VALIDATION_STATE_CHANGED',
  CHAT_MESSAGE_TRANSLATED: 'CHAT_MESSAGE_TRANSLATED',
  ROOM_MEMBER_JOINED: 'ROOM_MEMBER_JOINED',
  ROOM_MEMBER_LEFT: 'ROOM_MEMBER_LEFT',
  SESSION_TERMINATED: 'SESSION_TERMINATED',
  AUTH_ERROR: 'AUTH_ERROR',
} as const;

export type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export type StateChangedPayload = ValidationSnapshot & { previousState: ValidationState };
export type MemberJoinedPayload = { roomId: string; member: RoomMember };
export type MemberLeftPayload = { roomId: string; uid: string };
export type SessionTerminatedPayload = { reason: string; message: string };
export type ChatPayload = ChatMessage;
