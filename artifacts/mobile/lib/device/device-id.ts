/**
 * A stable ID for this phone, sent to the API with every request (`x-device-id`) so the admin
 * panel can block a device, not just an account.
 *
 * - Android: the Android ID (expo-application). Survives reinstalling the app; changes on a
 *   factory reset.
 * - iOS: a random ID kept in the Keychain (expo-secure-store, this device only). The Keychain
 *   normally survives deleting and reinstalling the app.
 *
 * Builds made before these native modules were added simply send no device ID.
 */
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { requireOptionalNativeModule } from 'expo';
import type * as ApplicationModule from 'expo-application';
import type * as SecureStoreModule from 'expo-secure-store';

export type DeviceIdentity = { id: string; name: string | null };

const KEYCHAIN_KEY = 'rideshare.device-id';

function randomId(): string {
  let out = '';
  for (let i = 0; i < 32; i += 1) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

async function androidId(): Promise<string | null> {
  if (!requireOptionalNativeModule('ExpoApplication')) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Application = require('expo-application') as typeof ApplicationModule;
  const id = Application.getAndroidId();
  return id ? `android:${id}` : null;
}

async function iosId(): Promise<string | null> {
  if (!requireOptionalNativeModule('ExpoSecureStore')) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SecureStore = require('expo-secure-store') as typeof SecureStoreModule;
  const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
  let id = await SecureStore.getItemAsync(KEYCHAIN_KEY, options);
  if (!id) {
    id = randomId();
    await SecureStore.setItemAsync(KEYCHAIN_KEY, id, options);
  }
  return `ios:${id}`;
}

let pending: Promise<DeviceIdentity | null> | null = null;

/** Resolves once per app run; null on web, simulators without the modules, or on failure. */
export function getDeviceIdentity(): Promise<DeviceIdentity | null> {
  pending ??= (async () => {
    try {
      const id = Platform.OS === 'android' ? await androidId() : Platform.OS === 'ios' ? await iosId() : null;
      if (!id) {
        if (__DEV__ && (Platform.OS === 'android' || Platform.OS === 'ios')) {
          console.warn(
            `[device] No device ID: this build doesn't include ${Platform.OS === 'ios' ? 'expo-secure-store' : 'expo-application'}. Make a new build so the phone shows in the admin and can be blocked.`,
          );
        }
        return null;
      }
      const name = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || null;
      return { id, name };
    } catch (err) {
      if (__DEV__) console.warn('[device] could not read the device ID', err);
      return null;
    }
  })();
  return pending;
}

/** Request headers for the API (empty until the ID is known). */
export function deviceHeaders(identity: DeviceIdentity | null): Record<string, string> {
  if (!identity) return {};
  return {
    'x-device-id': identity.id,
    // Header values must be plain ASCII.
    ...(identity.name ? { 'x-device-name': identity.name.replace(/[^\x20-\x7E]/g, '').slice(0, 80) } : {}),
  };
}
