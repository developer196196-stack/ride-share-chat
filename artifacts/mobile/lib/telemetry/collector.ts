/**
 * Trip Validation telemetry collector.
 * Module 1: expo-location (GPS speed + mock flag) · Module 2: expo-sensors DeviceMotion at ~100 Hz
 * → on-device FFT · Module 3: native activity recognition. Sends one sample every 2 s before
 * verification and every 10 s inside a R.O.O.M. (WebSocket first, REST fallback).
 *
 * Battery saver: once the ride is VERIFIED, the car is moving above the entry speed and the OS
 * (motion coprocessor) reports "in vehicle", the accelerometer is switched off and GPS drops to a
 * low-power network position (kept only for live trip sharing). A short full-power check runs every
 * couple of minutes, and full power returns at once when the OS stops reporting "in vehicle" or the
 * ride leaves VERIFIED. Without OS activity recognition (Expo Go, web, permission denied) the
 * collector stays at full power.
 */
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import { getLocales } from 'expo-localization';
import { submitTelemetry, type TelemetrySample, type ValidationSnapshot } from '@workspace/api-client-react';
import { ActivityRecognition, type ActivityUpdate } from '@/modules/activity-recognition';
import { ClientEvents } from '@/lib/realtime/events';
import { emitWithAck, getRealtime } from '@/lib/realtime/socket';
import type { SimulatorScenario } from '@/stores/simulator.store';
import { analyzeVibration, VibrationConfig, type MotionSample } from './vibration-analyzer';
import { RideSimulator } from './simulator';

export type CollectorMode = 'pre_verification' | 'in_room';

/** full = precise GPS + accelerometer; saver = low-power position only, with periodic full checks. */
export type PowerMode = 'full' | 'saver';

export const POLLING_MS: Record<CollectorMode, number> = {
  pre_verification: 2_000,
  in_room: 10_000,
};

const GPS_FRESH_MS = 10_000;
const ACTIVITY_FRESH_MS = 2 * 60_000;
const MOTION_INTERVAL_MS = 10; // ≈100 Hz — needed to see the 10–25 Hz band.

/** Battery saver: a full-power check (precise GPS + vibration window) this often … */
const SAVER_CHECK_EVERY_MS = 2 * 60_000;
/** … lasting this long (GPS warm-up plus a full 3-second FFT window). */
const SAVER_CHECK_MS = 12_000;
/** OS "in vehicle" confidence needed to allow the saver. */
const SAVER_MIN_VEHICLE_CONFIDENCE = 60;
/** Low-power position interval while saving (live trip sharing only). */
const LOW_POWER_GPS_MS = 10_000;

type GpsLevel = 'high' | 'low';

type Options = {
  onSnapshot: (snapshot: ValidationSnapshot) => void;
  onError?: (message: string) => void;
  onPowerChange?: (mode: PowerMode) => void;
  getScenario: () => SimulatorScenario;
};

export class TelemetryCollector {
  private mode: CollectorMode = 'pre_verification';
  private timer: ReturnType<typeof setInterval> | null = null;
  private locationSub: Location.LocationSubscription | null = null;
  private motionSub: { remove: () => void } | null = null;
  private stopActivity: (() => void) | null = null;
  private lastFix: Location.LocationObject | null = null;
  /** Whether `lastFix` came from the low-power watcher. */
  private lastFixLowPower = false;
  private lastActivity: ActivityUpdate | null = null;
  private motion: MotionSample[] = [];
  private sending = false;
  private stopped = false;
  private gpsLevel: GpsLevel | null = null;
  /** Bumped on every GPS re-subscription so a slow older one is discarded. */
  private gpsGeneration = 0;
  private power: PowerMode = 'full';
  private lastSnapshot: ValidationSnapshot | null = null;
  private saverCheckUntil = 0;
  private lastSaverCheckAt = 0;
  private readonly simulator = new RideSimulator();
  private readonly language = getLocales()[0]?.languageTag ?? 'en';

  constructor(private readonly options: Options) {}

  async start(mode: CollectorMode): Promise<void> {
    this.mode = mode;
    this.stopped = false;
    await this.startSensors();
    this.schedule();
  }

  setMode(mode: CollectorMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.schedule();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.gpsGeneration += 1;
    this.locationSub?.remove();
    this.locationSub = null;
    this.gpsLevel = null;
    this.stopMotion();
    this.stopActivity?.();
    this.stopActivity = null;
    this.power = 'full';
  }

  private schedule(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => void this.tick(), POLLING_MS[this.mode]);
    void this.tick();
  }

  private async startSensors(): Promise<void> {
    await this.setGps('high');
    await this.startMotion();

    // OS activity recognition (native module; no-op in Expo Go / web). Runs on the low-power
    // motion coprocessor and decides when the battery saver may switch the other sensors down.
    if (!this.stopActivity && ActivityRecognition.isSupported()) {
      try {
        const permission = await ActivityRecognition.getPermissionsAsync();
        if (permission.granted) {
          this.stopActivity = await ActivityRecognition.start(5_000, (update) => {
            this.lastActivity = update;
            this.updatePower();
          });
        }
      } catch {
        // Treated as "no data" by the engine.
      }
    }
  }

  /** Precise GPS every second (validation) or a low-power network position (battery saver). */
  private async setGps(level: GpsLevel): Promise<void> {
    if (this.gpsLevel === level && this.locationSub) return;
    const generation = ++this.gpsGeneration;
    this.gpsLevel = level;
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      this.options.onError?.('Location permission is required for trip validation.');
      return;
    }
    const options: Location.LocationOptions =
      level === 'high'
        ? { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1_000, distanceInterval: 0 }
        : { accuracy: Location.Accuracy.Balanced, timeInterval: LOW_POWER_GPS_MS, distanceInterval: 0 };
    const sub = await Location.watchPositionAsync(options, (fix) => {
      this.lastFix = fix;
      this.lastFixLowPower = level === 'low';
      this.simulator.seed(fix.coords.latitude, fix.coords.longitude);
    });
    // stop() or a newer level arrived while subscribing.
    if (generation !== this.gpsGeneration || this.stopped) {
      sub.remove();
      return;
    }
    this.locationSub?.remove();
    this.locationSub = sub;
  }

  /** Accelerometer (linear, gravity removed when the OS provides it). */
  private async startMotion(): Promise<void> {
    if (this.motionSub || Platform.OS === 'web' || !(await DeviceMotion.isAvailableAsync())) return;
    // Re-check after the await: stop(), the saver or a parallel call may have run meanwhile.
    if (this.stopped || this.motionSub || this.power === 'saver') return;
    DeviceMotion.setUpdateInterval(MOTION_INTERVAL_MS);
    this.motionSub = DeviceMotion.addListener((event) => {
      const a = event.acceleration ?? event.accelerationIncludingGravity;
      if (!a) return;
      const t = Date.now();
      this.motion.push({ x: a.x, y: a.y, z: a.z, t });
      const cutoff = t - VibrationConfig.windowMs;
      while (this.motion.length > 0 && this.motion[0]!.t < cutoff) this.motion.shift();
    });
  }

  private stopMotion(): void {
    this.motionSub?.remove();
    this.motionSub = null;
    this.motion = [];
  }

  /** The saver is only safe while a verified ride is clearly under way. */
  private canSave(now: number): boolean {
    if (this.options.getScenario() !== 'off' || !this.stopActivity) return false;
    const snapshot = this.lastSnapshot;
    if (snapshot?.state !== 'VERIFIED' || !snapshot.checks.gpsSpeedLock) return false;
    const activity = this.lastActivity;
    return (
      activity != null &&
      now - activity.timestamp < ACTIVITY_FRESH_MS &&
      activity.type === 'in_vehicle' &&
      activity.confidence >= SAVER_MIN_VEHICLE_CONFIDENCE
    );
  }

  /** Switches between full power and the battery saver (see the file header). */
  private updatePower(): void {
    if (this.stopped) return;
    const now = Date.now();
    let next: PowerMode = 'full';
    if (this.canSave(now)) {
      if (this.power === 'full' && now >= this.saverCheckUntil) {
        // Entering the saver: the first periodic check is a full interval away.
        this.lastSaverCheckAt = now;
      } else if (now - this.lastSaverCheckAt >= SAVER_CHECK_EVERY_MS) {
        this.lastSaverCheckAt = now;
        this.saverCheckUntil = now + SAVER_CHECK_MS;
      }
      next = now < this.saverCheckUntil ? 'full' : 'saver';
    } else {
      this.saverCheckUntil = 0;
    }
    if (next === this.power) return;
    this.power = next;
    if (next === 'full') {
      void this.setGps('high');
      void this.startMotion();
    } else {
      void this.setGps('low');
      this.stopMotion();
    }
    this.options.onPowerChange?.(next);
  }

  private buildSample(): TelemetrySample | null {
    const scenario = this.options.getScenario();
    if (scenario !== 'off') {
      return { ...this.simulator.next(scenario), preferredLanguage: this.language };
    }

    const now = Date.now();
    const sample: TelemetrySample = { preferredLanguage: this.language };
    const fix = this.lastFix;
    if (fix && now - fix.timestamp < GPS_FRESH_MS) {
      sample.gps = {
        lat: fix.coords.latitude,
        lng: fix.coords.longitude,
        speedMps: fix.coords.speed != null && fix.coords.speed >= 0 ? fix.coords.speed : null,
        accuracyM: fix.coords.accuracy ?? 999,
        timestamp: fix.timestamp,
        isMock: Boolean(fix.mocked),
        ...(this.lastFixLowPower ? { lowPower: true } : {}),
      };
    }
    const vibration = analyzeVibration(this.motion);
    if (vibration) sample.vibration = vibration;
    const activity = this.lastActivity ?? ActivityRecognition.getLatest();
    if (activity && now - activity.timestamp < ACTIVITY_FRESH_MS) {
      sample.activity = { type: activity.type, confidence: activity.confidence };
    }
    // Emulators are only rejected in production builds, so development stays testable.
    if (!__DEV__ && !Device.isDevice) sample.device = { isEmulator: true };

    return sample.gps || sample.vibration || sample.activity ? sample : null;
  }

  private async tick(): Promise<void> {
    this.updatePower();
    if (this.sending) return;
    const sample = this.buildSample();
    if (!sample) return;
    this.sending = true;
    try {
      const snapshot = getRealtime()?.connected
        ? await emitWithAck<ValidationSnapshot>(ClientEvents.TELEMETRY, sample)
        : await submitTelemetry(sample);
      this.lastSnapshot = snapshot;
      this.options.onSnapshot(snapshot);
    } catch (error) {
      this.options.onError?.(error instanceof Error ? error.message : 'Telemetry failed');
    } finally {
      this.sending = false;
    }
  }
}
