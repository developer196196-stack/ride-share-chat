import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/**
 * Thin emitter shared by feature services. The gateway hands over its Socket.IO server
 * on init, so services can push events without depending on the gateway (which itself
 * depends on those services to handle incoming events).
 */
@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  attach(server: Server): void {
    this.server = server;
  }

  /** Socket.IO room that every connection of `uid` joins. */
  static userRoom(uid: string): string {
    return `user:${uid}`;
  }

  isUserConnected(uid: string): boolean {
    const room = this.server?.sockets.adapter.rooms.get(RealtimeService.userRoom(uid));
    return Boolean(room && room.size > 0);
  }

  emitToUser(uid: string, event: string, payload: unknown): void {
    this.server?.to(RealtimeService.userRoom(uid)).emit(event, payload);
  }

  emitToUsers(uids: string[], event: string, payload: unknown): void {
    if (!this.server || uids.length === 0) return;
    this.server.to(uids.map((uid) => RealtimeService.userRoom(uid))).emit(event, payload);
  }
}
