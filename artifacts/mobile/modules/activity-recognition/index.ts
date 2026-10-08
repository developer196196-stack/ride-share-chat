/**
 * Native in-vehicle detection (Trip Validation Module 3).
 * Android: Google Play Services Activity Recognition · iOS: Core Motion (CMMotionActivityManager).
 * Returns a no-op implementation where the native module isn't compiled in (Expo Go, web),
 * so the engine simply treats OS activity as "no data".
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type EventSubscription = { remove(): void };

export type NativeActivityType =
  | 'in_vehicle'
  | 'on_bicycle'
  | 'on_foot'
  | 'walking'
  | 'running'
  | 'still'
  | 'unknown';

export type ActivityUpdate = {
  type: NativeActivityType;
  /** 0–100 */
  confidence: number;
  timestamp: number;
};

export type ActivityPermission = { granted: boolean; status: 'granted' | 'denied' | 'undetermined'; canAskAgain: boolean };

type NativeModuleShape = {
  isAvailable(): boolean;
  getPermissionsAsync(): Promise<ActivityPermission>;
  requestPermissionsAsync(): Promise<ActivityPermission>;
  startAsync(intervalMs: number): Promise<void>;
  stop(): void;
  getLatest(): ActivityUpdate | null;
  addListener(event: 'onActivity', listener: (update: ActivityUpdate) => void): EventSubscription;
};

const native = Platform.OS === 'web' ? null : requireOptionalNativeModule<NativeModuleShape>('ActivityRecognition');

const UNAVAILABLE: ActivityPermission = { granted: false, status: 'denied', canAskAgain: false };

export const ActivityRecognition = {
  /** True only in a development/production build that includes the native module. */
  isSupported(): boolean {
    try {
      return Boolean(native?.isAvailable());
    } catch {
      return false;
    }
  },
  getPermissionsAsync(): Promise<ActivityPermission> {
    return native ? native.getPermissionsAsync() : Promise.resolve(UNAVAILABLE);
  },
  requestPermissionsAsync(): Promise<ActivityPermission> {
    return native ? native.requestPermissionsAsync() : Promise.resolve(UNAVAILABLE);
  },
  async start(intervalMs: number, onUpdate: (update: ActivityUpdate) => void): Promise<() => void> {
    if (!native || !this.isSupported()) return () => undefined;
    const subscription = native.addListener('onActivity', onUpdate);
    try {
      await native.startAsync(intervalMs);
    } catch (error) {
      subscription.remove();
      throw error;
    }
    return () => {
      subscription.remove();
      native.stop();
    };
  },
  getLatest(): ActivityUpdate | null {
    return native?.getLatest() ?? null;
  },
};
