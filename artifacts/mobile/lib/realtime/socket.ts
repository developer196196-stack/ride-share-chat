import { io, type Socket } from 'socket.io-client';
import { env } from '@/lib/config/env';
import { useAuthStore } from '@/stores/auth.store';
import type { Ack } from './events';

let socket: Socket | null = null;

/**
 * One Socket.IO connection per signed-in rider. The auth callback runs on every (re)connect,
 * so an expired Firebase ID token is refreshed automatically.
 */
export function connectRealtime(): Socket {
  if (socket) return socket;
  socket = io(env.apiUrl, {
    path: '/api/v1/room/stream',
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    auth: (cb) => {
      void useAuthStore
        .getState()
        .getIdToken()
        .then((token) => cb({ token }))
        .catch(() => cb({ token: null }));
    },
  });
  return socket;
}

export function disconnectRealtime(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

export function getRealtime(): Socket | null {
  return socket;
}

/** Emits with an acknowledgement; rejects on server error, timeout or no connection. */
export function emitWithAck<T>(event: string, payload: unknown, timeoutMs = 8_000): Promise<T> {
  const current = socket;
  if (!current?.connected) return Promise.reject(new Error('Not connected'));
  return new Promise<T>((resolve, reject) => {
    current.timeout(timeoutMs).emit(event, payload, (err: Error | null, ack: Ack<T>) => {
      if (err) return reject(new Error('Request timed out'));
      if (!ack?.ok) return reject(new Error(ack?.error?.message ?? 'Request failed'));
      resolve(ack.data);
    });
  });
}
