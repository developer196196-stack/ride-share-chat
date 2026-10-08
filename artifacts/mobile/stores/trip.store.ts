import { create } from 'zustand';
import type {
  ChatMessage,
  RideSummary,
  RoomMember,
  RoomSession,
  ValidationSnapshot,
} from '@workspace/api-client-react';

export type Termination = { reason: string; message: string; at: number };

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

  setActive: (active: boolean) => void;
  setConnected: (connected: boolean) => void;
  setSnapshot: (snapshot: ValidationSnapshot) => void;
  setRoom: (room: RoomSession | null) => void;
  addMember: (roomId: string, member: RoomMember) => void;
  removeMember: (roomId: string, uid: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setSummary: (summary: RideSummary | null) => void;
  setTermination: (termination: Termination | null) => void;
  setSharePromptPending: (pending: boolean) => void;
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
};

export const useTripStore = create<TripState>((set) => ({
  ...initial,
  setActive: (active) => set({ active }),
  setConnected: (connected) => set({ connected }),
  setSnapshot: (snapshot) => set({ snapshot }),
  setRoom: (room) => set((s) => ({ room, messages: room?.roomId === s.room?.roomId ? s.messages : [] })),
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
  reset: () => set({ ...initial }),
}));
