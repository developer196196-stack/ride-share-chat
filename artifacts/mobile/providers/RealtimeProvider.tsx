import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPreferencesQueryOptions, type ValidationSnapshot } from '@workspace/api-client-react';
import {
  ServerEvents,
  type ChatPayload,
  type HostChangedPayload,
  type JoinRequestPayload,
  type RoomInvitePayload,
  type ModerationNoticePayload,
  type RoomSettingsPayload,
  type MemberJoinedPayload,
  type MemberLeftPayload,
  type SessionTerminatedPayload,
  type StateChangedPayload,
} from '@/lib/realtime/events';
import { connectRealtime, disconnectRealtime } from '@/lib/realtime/socket';
import { useAuthStore } from '@/stores/auth.store';
import { useTripStore } from '@/stores/trip.store';

/** Keeps one WebSocket open while signed in and mirrors server events into the trip store. */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  useEffect(() => {
    const trip = useTripStore.getState();
    if (!isAuthenticated) {
      disconnectRealtime();
      trip.setConnected(false);
      return;
    }

    const socket = connectRealtime();
    socket.on('connect', () => useTripStore.getState().setConnected(true));
    socket.on('disconnect', () => useTripStore.getState().setConnected(false));
    socket.on(ServerEvents.VALIDATION_UPDATE, (snapshot: ValidationSnapshot | null) => {
      if (snapshot) useTripStore.getState().setSnapshot(snapshot);
    });
    socket.on(ServerEvents.VALIDATION_STATE_CHANGED, (payload: StateChangedPayload) => {
      const store = useTripStore.getState();
      store.setSnapshot(payload);
      if (payload.state === 'VERIFIED' && payload.previousState === 'PENDING') {
        void queryClient
          .fetchQuery(getGetPreferencesQueryOptions())
          .then((prefs) => {
            if (prefs.promptShareOnVerified) useTripStore.getState().setSharePromptPending(true);
          })
          .catch(() => undefined);
      }
    });
    socket.on(ServerEvents.SESSION_TERMINATED, (payload: SessionTerminatedPayload) => {
      useTripStore.getState().setTermination({ ...payload, at: Date.now() });
    });
    socket.on(ServerEvents.ROOM_MEMBER_JOINED, (payload: MemberJoinedPayload) => {
      useTripStore.getState().addMember(payload.roomId, payload.member);
    });
    socket.on(ServerEvents.ROOM_MEMBER_LEFT, (payload: MemberLeftPayload) => {
      useTripStore.getState().removeMember(payload.roomId, payload.uid);
    });
    socket.on(ServerEvents.ROOM_HOST_CHANGED, (payload: HostChangedPayload) => {
      useTripStore.getState().setHost(payload.roomId, payload.hostUid);
    });
    socket.on(ServerEvents.ROOM_SETTINGS_CHANGED, ({ roomId, ...settings }: RoomSettingsPayload) => {
      useTripStore.getState().setRoomSettings(roomId, settings);
    });
    socket.on(ServerEvents.ROOM_EJECTED, (payload: ModerationNoticePayload) => {
      const store = useTripStore.getState();
      // The ride goes on; the active room screen sends the rider back to the Discovery Grid.
      if (store.room?.roomId === payload.roomId) store.setRoom(null);
      store.setNotice({ message: payload.message, tone: 'warning' });
    });
    socket.on(ServerEvents.FORCE_MUTED, (payload: ModerationNoticePayload) => {
      const store = useTripStore.getState();
      if (store.room?.roomId !== payload.roomId) return;
      store.setForceMutedAt(Date.now());
      store.setNotice({ message: payload.message, tone: 'warning' });
    });
    socket.on(ServerEvents.ROOM_INVITE, (payload: RoomInvitePayload) => {
      if (useTripStore.getState().room?.roomId === payload.roomId) return;
      useTripStore.getState().setInvite(payload);
    });
    socket.on(ServerEvents.ROOM_JOIN_REQUEST, (payload: JoinRequestPayload) => {
      const store = useTripStore.getState();
      if (store.room?.roomId !== payload.roomId) return;
      store.setNewRequests((n) => n + 1);
      store.setNotice({ message: `${payload.requester.displayName} asked to join your room.` });
    });
    socket.on(ServerEvents.ROOM_REQUEST_DECLINED, (payload: ModerationNoticePayload) => {
      useTripStore.getState().setNotice({ message: payload.message, tone: 'warning' });
    });
    socket.on(ServerEvents.CHAT_MESSAGE_TRANSLATED, (message: ChatPayload) => {
      useTripStore.getState().addMessage(message);
    });

    return () => {
      disconnectRealtime();
      useTripStore.getState().setConnected(false);
    };
  }, [isAuthenticated, queryClient]);

  return <>{children}</>;
}
