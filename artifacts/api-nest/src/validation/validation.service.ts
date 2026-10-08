import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { loadAppConfig } from '../config/configuration';
import { requireRedis } from '../common/service-unavailable';
import { validationError } from '../common/zod-parse';
import { REDIS } from '../redis/redis.module';
import { RealtimeService } from '../realtime/realtime.service';
import { ServerEvents } from '../realtime/realtime.events';
import { relaxedValidationOverrides, ValidationConfig as C } from './validation.config';
import {
  applyRoadCheck,
  createInitialState,
  needsRoadCheck,
  reduceSample,
  sweepState,
  toSnapshot,
  type ReduceResult,
} from './validation.engine';
import { RoadMatcher } from './road-matcher';
import type { EngineState, TelemetrySample, TerminationReason, ValidationSnapshot } from './validation.types';

const STATE_TTL_SEC = 6 * 60 * 60;
const LOCATION_TTL_SEC = 60 * 60;
const SWEEP_INTERVAL_MS = 5_000;

const keys = {
  state: (uid: string) => `val:${uid}`,
  location: (uid: string) => `loc:${uid}`,
  langHint: (uid: string) => `lang:hint:${uid}`,
  graceDeadlines: 'val:grace',
  lastSeen: 'val:seen',
  sweepLock: 'lock:val:sweep',
};

export type LatestLocation = {
  lat: number;
  lng: number;
  accuracyM: number;
  speedMph: number;
  updatedAt: number;
};

export type TerminationListener = (uid: string, reason: TerminationReason) => void | Promise<void>;

const TERMINATION_MESSAGES: Record<TerminationReason, string> = {
  spoof_detected: 'Location spoofing was detected, so this session was ended.',
  exited_vehicle: 'It looks like you left the vehicle, so your R.O.O.M. session ended.',
  grace_expired: 'Your vehicle stayed stopped for more than 5 minutes, so the session ended.',
  signal_lost: 'We lost your trip signal.',
  user_ended: 'You ended the session.',
};

export function terminationMessage(reason: TerminationReason): string {
  return TERMINATION_MESSAGES[reason];
}

/** Persists engine state in Redis, runs road checks and time-based transitions, and pushes updates. */
@Injectable()
export class ValidationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ValidationService.name);
  private readonly allowSimulated = loadAppConfig().allowSimulatedTelemetry;
  private readonly listeners: TerminationListener[] = [];
  /** Serialises samples per rider so concurrent requests never lose an update. */
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly roadChecksInFlight = new Set<string>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(REDIS) private readonly redis: Redis | null,
    private readonly realtime: RealtimeService,
    private readonly roads: RoadMatcher,
  ) {}

  onModuleInit(): void {
    const relaxed = relaxedValidationOverrides();
    if (relaxed.length > 0) {
      this.logger.warn(
        `Trip Validation is using NON-PRODUCTION thresholds (${relaxed.join(', ')}). Remove these VALIDATION_* overrides before launch.`,
      );
    }
    if (this.redis) {
      this.sweepTimer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    }
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  /** Rooms register here so a TERMINATED rider is removed from video immediately. */
  onTerminated(listener: TerminationListener): void {
    this.listeners.push(listener);
  }

  private serial<T>(uid: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(uid) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    this.queues.set(uid, next);
    void next.finally(() => {
      if (this.queues.get(uid) === next) this.queues.delete(uid);
    });
    return next;
  }

  private async load(uid: string): Promise<EngineState | null> {
    const raw = await requireRedis(this.redis).get(keys.state(uid));
    return raw ? (JSON.parse(raw) as EngineState) : null;
  }

  private async save(uid: string, state: EngineState): Promise<void> {
    const redis = requireRedis(this.redis);
    const pipeline = redis.multi();
    pipeline.set(keys.state(uid), JSON.stringify(state), 'EX', STATE_TTL_SEC);
    if (state.state === 'GRACE' && state.graceDeadline) {
      pipeline.zadd(keys.graceDeadlines, state.graceDeadline, uid);
    } else {
      pipeline.zrem(keys.graceDeadlines, uid);
    }
    if (state.state === 'VERIFIED' && state.lastSampleAt) {
      pipeline.zadd(keys.lastSeen, state.lastSampleAt, uid);
    } else {
      pipeline.zrem(keys.lastSeen, uid);
    }
    await pipeline.exec();
  }

  async getState(uid: string): Promise<EngineState> {
    return (await this.load(uid)) ?? createInitialState(Date.now());
  }

  async getSnapshot(uid: string): Promise<ValidationSnapshot> {
    return toSnapshot(await this.getState(uid), Date.now());
  }

  async getLatestLocation(uid: string): Promise<LatestLocation | null> {
    const raw = await requireRedis(this.redis).get(keys.location(uid));
    return raw ? (JSON.parse(raw) as LatestLocation) : null;
  }

  async getLanguageHint(uid: string): Promise<string | null> {
    return requireRedis(this.redis).get(keys.langHint(uid));
  }

  async ingest(uid: string, sample: TelemetrySample): Promise<ValidationSnapshot> {
    if (sample.simulated && !this.allowSimulated) {
      validationError('Simulated telemetry is not accepted by this server.', { field: 'simulated' });
    }
    return this.serial(uid, async () => {
      const now = Date.now();
      const prev = (await this.load(uid)) ?? createInitialState(now);
      const result = reduceSample(prev, sample, now, { allowSimulated: this.allowSimulated });
      await this.save(uid, result.next);

      const redis = requireRedis(this.redis);
      if (sample.gps) {
        const location: LatestLocation = {
          lat: sample.gps.lat,
          lng: sample.gps.lng,
          accuracyM: sample.gps.accuracyM,
          speedMph: toSnapshot(result.next, now).speedMph,
          updatedAt: now,
        };
        await redis.set(keys.location(uid), JSON.stringify(location), 'EX', LOCATION_TTL_SEC);
      }
      if (sample.preferredLanguage) {
        await redis.set(keys.langHint(uid), sample.preferredLanguage, 'EX', STATE_TTL_SEC);
      }

      await this.publish(uid, result);
      // Simulated rides use synthetic coordinates that are not on real roads.
      const simulated = sample.simulated === true && this.allowSimulated;
      if (!simulated && needsRoadCheck(result.next, now)) void this.runRoadCheck(uid);
      return toSnapshot(result.next, now);
    });
  }

  /** Starts a fresh validation session (PENDING). */
  async reset(uid: string): Promise<ValidationSnapshot> {
    return this.serial(uid, async () => {
      const now = Date.now();
      const prev = await this.load(uid);
      const next = createInitialState(now);
      await this.save(uid, next);
      await this.publish(uid, { next, previousState: prev?.state ?? 'PENDING', stateChanged: prev?.state !== 'PENDING' });
      return toSnapshot(next, now);
    });
  }

  /** Ends the session on the rider's request (e.g. hanging up). */
  async end(uid: string): Promise<EngineState> {
    return this.serial(uid, async () => {
      const now = Date.now();
      const prev = (await this.load(uid)) ?? createInitialState(now);
      if (prev.state === 'TERMINATED') return prev;
      const next: EngineState = {
        ...prev,
        state: 'TERMINATED',
        terminationReason: 'user_ended',
        graceDeadline: null,
        graceStartedAt: null,
        stats:
          prev.state === 'GRACE' && prev.graceStartedAt
            ? { ...prev.stats, graceMs: prev.stats.graceMs + (now - prev.graceStartedAt) }
            : prev.stats,
        updatedAt: now,
      };
      await this.save(uid, next);
      // Rider-initiated: no SESSION_TERMINATED push, the app already knows.
      this.realtime.emitToUser(uid, ServerEvents.VALIDATION_UPDATE, toSnapshot(next, now));
      return prev;
    });
  }

  private async publish(uid: string, result: ReduceResult): Promise<void> {
    const now = Date.now();
    const snapshot = toSnapshot(result.next, now);
    this.realtime.emitToUser(uid, ServerEvents.VALIDATION_UPDATE, snapshot);
    if (!result.stateChanged) return;

    this.realtime.emitToUser(uid, ServerEvents.VALIDATION_STATE_CHANGED, {
      ...snapshot,
      previousState: result.previousState,
    });
    if (result.next.state === 'TERMINATED' && result.next.terminationReason) {
      const reason = result.next.terminationReason;
      this.logger.log(`Rider ${uid} TERMINATED (${reason})`);
      this.realtime.emitToUser(uid, ServerEvents.SESSION_TERMINATED, {
        reason,
        message: terminationMessage(reason),
      });
      for (const listener of this.listeners) {
        try {
          await listener(uid, reason);
        } catch (error) {
          this.logger.error(`Termination listener failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  private async runRoadCheck(uid: string): Promise<void> {
    if (!this.roads.configured || this.roadChecksInFlight.has(uid)) return;
    this.roadChecksInFlight.add(uid);
    try {
      const snapshotFixes = (await this.load(uid))?.recentFixes ?? [];
      const road = await this.roads.check(snapshotFixes, Date.now());
      if (!road) return;
      await this.serial(uid, async () => {
        const latest = await this.load(uid);
        if (!latest) return;
        const next = applyRoadCheck(latest, road);
        await this.save(uid, next);
        this.realtime.emitToUser(uid, ServerEvents.VALIDATION_UPDATE, toSnapshot(next, Date.now()));
      });
    } finally {
      this.roadChecksInFlight.delete(uid);
    }
  }

  /** Grace expiry and lost-signal handling for riders who stopped sending telemetry. */
  private async sweep(): Promise<void> {
    const redis = this.redis;
    if (!redis) return;
    try {
      // One instance sweeps at a time.
      const locked = await redis.set(keys.sweepLock, '1', 'PX', SWEEP_INTERVAL_MS - 500, 'NX');
      if (!locked) return;
      const now = Date.now();
      const expired = await redis.zrangebyscore(keys.graceDeadlines, '-inf', now);
      const silent = await redis.zrangebyscore(keys.lastSeen, '-inf', now - C.signalLostMs);
      for (const uid of new Set([...expired, ...silent])) {
        await this.serial(uid, async () => {
          const prev = await this.load(uid);
          if (!prev) {
            await redis.zrem(keys.graceDeadlines, uid);
            await redis.zrem(keys.lastSeen, uid);
            return;
          }
          const result = sweepState(prev, Date.now());
          await this.save(uid, result.next);
          if (result.stateChanged) await this.publish(uid, result);
        });
      }
    } catch (error) {
      this.logger.warn(`Sweep failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
