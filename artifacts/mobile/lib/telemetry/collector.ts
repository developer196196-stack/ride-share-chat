/**
 * Trip Validation telemetry collector.
 * Module 1: expo-location (GPS speed + mock flag) · Module 2: expo-sensors DeviceMotion at ~100 Hz
 * → on-device FFT · Module 3: native activity recognition. Sends one sample every 2 s before
 * verification and every 10 s inside a R.O.O.M. (WebSocket first, REST fallback).
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

export const POLLING_MS: Record<CollectorMode, number> = {
  pre_verification: 2_000,
  in_room: 10_000,
};

const GPS_FRESH_MS = 10_000;
const ACTIVITY_FRESH_MS = 2 * 60_000;
const MOTION_INTERVAL_MS = 10; // ≈100 Hz — needed to see the 10–25 Hz band.

type Options = {
  onSnapshot: (snapshot: ValidationSnapshot) => void;
  onError?: (message: string) => void;
  getScenario: () => SimulatorScenario;
};

export class TelemetryCollector {
  private mode: CollectorMode = 'pre_verification';
  private timer: ReturnType<typeof setInterval> | null = null;
  private locationSub: Location.LocationSubscription | null = null;
  private motionSub: { remove: () => void } | null = null;
  private stopActivity: (() => void) | null = null;
  private lastFix: Location.LocationObject | null = null;
  private lastActivity: ActivityUpdate | null = null;
  private motion: MotionSample[] = [];
  private sending = false;
  private readonly simulator = new RideSimulator();
  private readonly language = getLocales()[0]?.languageTag ?? 'en';

  constructor(private readonly options: Options) {}

  async start(mode: CollectorMode): Promise<void> {
    this.mode = mode;
    await this.startSensors();
    this.schedule();
  }

  setMode(mode: CollectorMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.schedule();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.locationSub?.remove();
    this.locationSub = null;
    this.motionSub?.remove();
    this.motionSub = null;
    this.stopActivity?.();
    this.stopActivity = null;
    this.motion = [];
  }

  private schedule(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => void this.tick(), POLLING_MS[this.mode]);
    void this.tick();
  }

  private async startSensors(): Promise<void> {
    // GPS
    if (!this.locationSub) {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        this.locationSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1_000, distanceInterval: 0 },
          (fix) => {
            this.lastFix = fix;
            this.simulator.seed(fix.coords.latitude, fix.coords.longitude);
          },
        );
      } else {
        this.options.onError?.('Location permission is required for trip validation.');
      }
    }

    // Accelerometer (linear, gravity removed when the OS provides it)
    if (!this.motionSub && Platform.OS !== 'web' && (await DeviceMotion.isAvailableAsync())) {
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

    // OS activity recognition (native module; no-op in Expo Go / web)
    if (!this.stopActivity && ActivityRecognition.isSupported()) {
      try {
        const permission = await ActivityRecognition.getPermissionsAsync();
        if (permission.granted) {
          this.stopActivity = await ActivityRecognition.start(5_000, (update) => {
            this.lastActivity = update;
          });
        }
      } catch {
        // Treated as "no data" by the engine.
      }
    }
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
    if (this.sending) return;
    const sample = this.buildSample();
    if (!sample) return;
    this.sending = true;
    try {
      const snapshot = getRealtime()?.connected
        ? await emitWithAck<ValidationSnapshot>(ClientEvents.TELEMETRY, sample)
        : await submitTelemetry(sample);
      this.options.onSnapshot(snapshot);
    } catch (error) {
      this.options.onError?.(error instanceof Error ? error.message : 'Telemetry failed');
    } finally {
      this.sending = false;
    }
  }
}
