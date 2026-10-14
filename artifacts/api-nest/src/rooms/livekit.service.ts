import { Injectable, Logger } from '@nestjs/common';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { loadAppConfig } from '../config/configuration';

export type LiveKitConnection = { url: string; token: string };

/** Issues R.O.O.M. video passes, removes participants and applies host moderation. */
@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private readonly config = loadAppConfig();
  private readonly rooms: RoomServiceClient | null;

  constructor() {
    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, livekitConfigured } = this.config;
    this.rooms = livekitConfigured
      ? new RoomServiceClient(toHttpUrl(LIVEKIT_URL!), LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
      : null;
    if (!livekitConfigured) {
      this.logger.warn('LIVEKIT_* is not set — R.O.O.M.s work without video.');
    }
  }

  get configured(): boolean {
    return this.config.livekitConfigured;
  }

  /** Video pass for one R.O.O.M.; chat goes through our WebSocket, so data publishing is off. */
  async connectionFor(
    roomId: string,
    uid: string,
    displayName: string,
  ): Promise<LiveKitConnection | null> {
    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = this.config;
    if (!this.configured) return null;
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: uid,
      name: displayName,
      ttl: '15m',
    });
    token.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });
    return { url: LIVEKIT_URL!, token: await token.toJwt() };
  }

  /**
   * Host force-mute: mutes the rider's published microphone on the server, so it holds even if
   * the app ignores the FORCE_MUTED notice. Best effort — they may not be publishing audio.
   */
  async muteMicrophone(roomId: string, uid: string): Promise<boolean> {
    if (!this.rooms) return false;
    try {
      const participant = await this.rooms.getParticipant(roomId, uid);
      const mic = participant.tracks.find((t) => t.source === TrackSource.MICROPHONE);
      if (!mic) return false;
      await this.rooms.mutePublishedTrack(roomId, uid, mic.sid, true);
      return true;
    } catch (error) {
      this.logger.debug(`mutePublishedTrack(${roomId}, ${uid}) skipped: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /** Best effort — the participant may already have disconnected. */
  async remove(roomId: string, uid: string): Promise<void> {
    if (!this.rooms) return;
    try {
      await this.rooms.removeParticipant(roomId, uid);
    } catch (error) {
      this.logger.debug(`removeParticipant(${roomId}, ${uid}) skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function toHttpUrl(url: string): string {
  return url.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
}
