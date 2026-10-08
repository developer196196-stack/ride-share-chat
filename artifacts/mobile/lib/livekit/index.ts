/**
 * Lazy access to the LiveKit React Native SDK. Its native WebRTC module only exists in a
 * development/production build, so Expo Go and web get `null` instead of a crash.
 */
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

type LiveKitRN = typeof import('@livekit/react-native');
type LiveKitClient = typeof import('livekit-client');

let cached: { rn: LiveKitRN; client: LiveKitClient } | null | undefined;

export function isWebRtcAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return Boolean(TurboModuleRegistry.get('WebRTCModule') ?? NativeModules.WebRTCModule);
  } catch {
    return Boolean(NativeModules.WebRTCModule);
  }
}

export function getLiveKit(): { rn: LiveKitRN; client: LiveKitClient } | null {
  if (cached !== undefined) return cached;
  if (!isWebRtcAvailable()) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('@livekit/react-native') as LiveKitRN;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const client = require('livekit-client') as LiveKitClient;
    rn.registerGlobals();
    cached = { rn, client };
  } catch (error) {
    console.warn('[livekit] unavailable:', error);
    cached = null;
  }
  return cached;
}
