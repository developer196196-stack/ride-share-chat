import { HttpException, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { verifyIdToken } from '@workspace/firebase';
import { CreateSafetyAlertBody, SubmitTelemetryBody } from '@workspace/api-zod';
import { loadAppConfig } from '../config/configuration';
import { resolvePublicBaseUrl } from '../common/public-base-url';
import { ChatService } from '../chat/chat.service';
import { SafetyService } from '../safety/safety.service';
import { ValidationService } from '../validation/validation.service';
import type { TelemetrySample } from '../validation/validation.types';
import { ClientEvents } from './realtime.events';
import { RealtimeService } from './realtime.service';

type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

function corsOptions(): { origin: string[] | boolean; credentials: true } | undefined {
  const config = loadAppConfig();
  if (config.corsOrigins.length > 0) return { origin: config.corsOrigins, credentials: true };
  if (config.NODE_ENV === 'development') return { origin: true, credentials: true };
  return undefined;
}

function toAckError(error: unknown): Ack<never> {
  if (error instanceof HttpException) {
    const body = error.getResponse() as { code?: string; message?: string } | string;
    if (typeof body === 'object' && body) {
      return { ok: false, error: { code: body.code ?? 'ERROR', message: String(body.message ?? error.message) } };
    }
    return { ok: false, error: { code: 'ERROR', message: String(body) } };
  }
  return { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong.' } };
}

/**
 * `wss://<host>/api/v1/room/stream` — Socket.IO transport for telemetry, validation state,
 * chat/translation and safety events. Under /api so Replit's router reaches it.
 * Clients authenticate with `auth: { token: <Firebase ID token> }`.
 */
@WebSocketGateway({ path: '/api/v1/room/stream', cors: corsOptions() })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly realtime: RealtimeService,
    private readonly validation: ValidationService,
    private readonly chat: ChatService,
    private readonly safety: SafetyService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attach(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.emit('AUTH_ERROR', { message: 'Missing token' });
      client.disconnect(true);
      return;
    }
    try {
      const decoded = await verifyIdToken(token);
      client.data.uid = decoded.uid;
      await client.join(RealtimeService.userRoom(decoded.uid));
      // Send the current state straight away so the app can render without a REST call.
      client.emit('VALIDATION_UPDATE', await this.validation.getSnapshot(decoded.uid).catch(() => null));
    } catch (error) {
      this.logger.warn(`Socket rejected: ${error instanceof Error ? error.message : String(error)}`);
      client.emit('AUTH_ERROR', { message: 'Invalid or expired token' });
      client.disconnect(true);
    }
  }

  private uidOf(client: Socket): string | null {
    return (client.data.uid as string | undefined) ?? null;
  }

  @SubscribeMessage(ClientEvents.TELEMETRY)
  async telemetry(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const uid = this.uidOf(client);
    if (!uid) return toAckError(new Error('unauthenticated'));
    const parsed = SubmitTelemetryBody.safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid telemetry payload.' } };
    }
    try {
      const data = await this.validation.ingest(uid, parsed.data as TelemetrySample);
      return { ok: true, data } satisfies Ack<unknown>;
    } catch (error) {
      return toAckError(error);
    }
  }

  @SubscribeMessage(ClientEvents.CHAT_MESSAGE_SENT)
  async chatMessage(@ConnectedSocket() client: Socket, @MessageBody() body: { text?: unknown }) {
    const uid = this.uidOf(client);
    if (!uid) return toAckError(new Error('unauthenticated'));
    try {
      const data = await this.chat.send(uid, typeof body?.text === 'string' ? body.text : '');
      return { ok: true, data } satisfies Ack<unknown>;
    } catch (error) {
      return toAckError(error);
    }
  }

  @SubscribeMessage(ClientEvents.SAFETY_ALERT_TRIGGERED)
  async safetyAlert(@ConnectedSocket() client: Socket, @MessageBody() body: unknown) {
    const uid = this.uidOf(client);
    if (!uid) return toAckError(new Error('unauthenticated'));
    const parsed = CreateSafetyAlertBody.safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid safety alert payload.' } };
    }
    try {
      const baseUrl = resolvePublicBaseUrl(client.handshake.headers, client.handshake.secure ? 'https' : 'http');
      const data = await this.safety.createAlert(uid, parsed.data.kind, parsed.data.location ?? null, baseUrl);
      return { ok: true, data } satisfies Ack<unknown>;
    } catch (error) {
      return toAckError(error);
    }
  }
}
