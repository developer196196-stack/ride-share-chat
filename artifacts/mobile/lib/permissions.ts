/** OS permissions used by Trip Validation and R.O.O.M.s. */
import { Platform } from 'react-native';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import { ActivityRecognition } from '@/modules/activity-recognition';

export type PermissionKey = 'media' | 'location' | 'motion';

export type PermissionStatusMap = Record<PermissionKey, boolean>;

async function safe(fn: () => Promise<boolean>): Promise<boolean> {
  try {
    return await fn();
  } catch {
    return false;
  }
}

export async function getPermissionStatus(): Promise<PermissionStatusMap> {
  const [camera, mic, location, motion] = await Promise.all([
    safe(async () => (await Camera.getCameraPermissionsAsync()).granted),
    safe(async () => (await Camera.getMicrophonePermissionsAsync()).granted),
    safe(async () => (await Location.getForegroundPermissionsAsync()).granted),
    safe(async () => {
      // Android needs no motion permission for the accelerometer; iOS does.
      const sensors = Platform.OS === 'ios' ? (await DeviceMotion.getPermissionsAsync()).granted : true;
      const activity = ActivityRecognition.isSupported() ? (await ActivityRecognition.getPermissionsAsync()).granted : true;
      return sensors && activity;
    }),
  ]);
  return { media: camera && mic, location, motion };
}

export async function requestPermission(key: PermissionKey): Promise<boolean> {
  switch (key) {
    case 'media': {
      const camera = await safe(async () => (await Camera.requestCameraPermissionsAsync()).granted);
      const mic = await safe(async () => (await Camera.requestMicrophonePermissionsAsync()).granted);
      return camera && mic;
    }
    case 'location':
      return safe(async () => (await Location.requestForegroundPermissionsAsync()).granted);
    case 'motion': {
      const sensors =
        Platform.OS === 'ios' ? await safe(async () => (await DeviceMotion.requestPermissionsAsync()).granted) : true;
      const activity = ActivityRecognition.isSupported()
        ? await safe(async () => (await ActivityRecognition.requestPermissionsAsync()).granted)
        : true;
      return sensors && activity;
    }
  }
}
