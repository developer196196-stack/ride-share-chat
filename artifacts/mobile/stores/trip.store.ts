import { create } from 'zustand';
import type {
  ChatMessage,
  RideSummary,
  RoomMatching,
  RoomMember,
  RoomSession,
  ValidationSnapshot,
  Vibe,
} from '@workspace/api-client-react';

export type Termination = { reason: string; message: string; at: number };
/** Short app-wide notice (NoticeToast). */
export type Notice = { message: string; tone: 'info' | 'warning'; at: number };
/** A host invited this rider (or accepted their join request). */
export type RoomInvite = {
  roomId: string;
  vibe: Vibe;
  from: { uid: string; displayName: string; photoUrl: string | null };
  viaRequest: boolean;
  expiresAt: string;
};

type TripState = {
  /** Telemetry collection runs while a trip is active (validation → room → summary). */
  active: boolean;
  connected: boolean;
  snapshot: ValidationSnapshot | null;
  room: RoomSession | null;
  messages: ChatMessage[];
  summary: RideSummary | null;
  termination: Termination | null;
  /** Shown once when the rider becomes VERIFIED and "prompt me to share" is on. */
  sharePromptPending: boolean;
  /** Telemetry battery saver is on (accelerometer off, low-power position). */
  powerSaver: boolean;
  notice: Notice | null;
  /** Set when the host force-mutes this rider; the video room turns the local mic off. */
  forceMutedAt: number | null;
  invite: RoomInvite | null;
  /** Host: join requests that arrived since the requests sheet was last opened. */
  newRequests: number;

  setActive: (active: boolean) => void;
  setConnected: (connected: boolean) => void;
  setSnapshot: (snapshot: ValidationSnapshot) => void;
  setRoom: (room: RoomSession | null) => void;
  addMember: (roomId: string, member: RoomMember) => void;
  removeMember: (roomId: string, uid: string) => void;
  setHost: (roomId: string, hostUid: string) => void;
  setRoomSettings: (roomId: string, settings: { vibe: Vibe; matching: RoomMatching; locked: boolean }) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setSummary: (summary: RideSummary | null) => void;
  setTermination: (termination: Termination | null) => void;
  setSharePromptPending: (pending: boolean) => void;
  setPowerSaver: (on: boolean) => void;
  setNotice: (notice: { message: string; tone?: Notice['tone'] } | null) => void;
  setForceMutedAt: (at: number | null) => void;
  setInvite: (invite: RoomInvite | null) => void;
  setNewRequests: (count: number | ((current: number) => number)) => void;
  reset: () => void;
};

const initial = {
  active: false,
  connected: false,
  snapshot: null,
  room: null,
  messages: [],
  summary: null,
  termination: null,
  sharePromptPending: false,
  powerSaver: false,
  notice: null,
  forceMutedAt: null,
  invite: null,
  newRequests: 0,
};

export const useTripStore = create<TripState>((set) => ({
  ...initial,
  setActive: (active) => set({ active }),
  setConnected: (connected) => set({ connected }),
  setSnapshot: (snapshot) => set({ snapshot }),
  setRoom: (room) =>
    set((s) => {
      const same = room?.roomId === s.room?.roomId;
      return { room, messages: same ? s.messages : [], newRequests: same ? s.newRequests : 0 };
    }),
  addMember: (roomId, member) =>
    set((s) => {
      if (!s.room || s.room.roomId !== roomId || s.room.members.some((m) => m.uid === member.uid)) return s;
      return { room: { ...s.room, members: [...s.room.members, member] } };
    }),
  removeMember: (roomId, uid) =>
    set((s) => {
      if (!s.room || s.room.roomId !== roomId) return s;
      return { room: { ...s.room, members: s.room.members.filter((m) => m.uid !== uid) } };
    }),
  setHost: (roomId, hostUid) =>
    set((s) => {
      if (!s.room || s.room.roomId !== roomId) return s;
      const members = s.room.members.map((m) => ({ ...m, isHost: m.uid === hostUid }));
      return { room: { ...s.room, hostUid, members } };
    }),
  setRoomSettings: (roomId, settings) =>
    set((s) => (s.room && s.room.roomId === roomId ? { room: { ...s.room, ...settings } } : s)),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((s) => {
      if (s.room && message.roomId !== s.room.roomId) return s;
      if (s.messages.some((m) => m.id === message.id)) return s;
      return { messages: [...s.messages, message].slice(-100) };
    }),
  setSummary: (summary) => set({ summary }),
  setTermination: (termination) => set({ termination }),
  setSharePromptPending: (sharePromptPending) => set({ sharePromptPending }),
  setPowerSaver: (powerSaver) => set({ powerSaver }),
  setNotice: (notice) => set({ notice: notice ? { tone: 'info', ...notice, at: Date.now() } : null }),
  setForceMutedAt: (forceMutedAt) => set({ forceMutedAt }),
  setInvite: (invite) => set({ invite }),
  setNewRequests: (count) =>
    set((s) => ({ newRequests: Math.max(0, typeof count === 'function' ? count(s.newRequests) : count) })),
  reset: () => set({ ...initial }),
}));
