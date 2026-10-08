import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Replit artifact default port; local Nest uses PORT=5001 — see EXPO_PUBLIC_API_URL. */
const REPLIT_DEFAULT_API_PORT = 8080;
const LOCAL_NEST_DEFAULT_PORT = 5001;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function parsePortFromUrl(url: string): number | null {
  try {
    const parsed = new URL(url.includes('://') ? url : `http://${url}`);
    if (parsed.port) return Number(parsed.port);
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return null;
  }
}

function isLoopbackHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/** Metro host (Expo Go or dev build), e.g. 192.168.1.12:8081 → reuse the same LAN IP for the API. */
function getExpoLanHost(): string | null {
  const hostUri = Constants.expoGoConfig?.debuggerHost ?? Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0]?.trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

function resolveDevApiUrl(explicit: string | undefined): string {
  const explicitPort = explicit ? parsePortFromUrl(explicit) : null;
  const port =
    explicitPort && explicitPort !== 80 && explicitPort !== 443 ? explicitPort : LOCAL_NEST_DEFAULT_PORT;

  // Android emulator reaches the host machine at 10.0.2.2.
  if (Platform.OS === 'android' && !Constants.isDevice) {
    return `http://10.0.2.2:${port}`;
  }

  // Physical phone via Expo Go: localhost would be the phone itself — use Metro's LAN IP.
  if (Platform.OS !== 'web') {
    const lanHost = getExpoLanHost();
    if (lanHost) return `http://${lanHost}:${port}`;
  }

  return explicit ? stripTrailingSlash(explicit) : `http://localhost:${port}`;
}

function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();

  // Replit injects EXPO_PUBLIC_DOMAIN (scripts/dev.js); the API is served on the same domain under /api.
  const domain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (domain) {
    return `https://${stripTrailingSlash(domain.replace(/^https?:\/\//, ''))}`;
  }

  // Non-loopback explicit URL (staging, production, ngrok…) is used as-is.
  if (explicit && !isLoopbackHost(explicit)) {
    return stripTrailingSlash(explicit);
  }

  if (__DEV__) {
    return resolveDevApiUrl(explicit);
  }

  return explicit ? stripTrailingSlash(explicit) : `http://localhost:${REPLIT_DEFAULT_API_PORT}`;
}

function resolveFirebaseConfig() {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim() ?? '';
  const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? '';
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? '';
  const messagingSenderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '';
  const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID?.trim() ?? '';

  return {
    configured: Boolean(apiKey && authDomain && projectId && messagingSenderId && appId),
    apiKey,
    authDomain,
    projectId,
    messagingSenderId,
    appId,
  } as const;
}

/** SMS resend cooldown on the Authentication screen. */
function resolveOtpResendSeconds(): number {
  const value = Number(process.env.EXPO_PUBLIC_OTP_RESEND_SECONDS?.trim());
  return Number.isFinite(value) && value > 0 ? value : 60;
}

function isTruthyFlag(value?: string): boolean {
  const v = value?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export const env = {
  /** NestJS API origin (no trailing slash, no /api). */
  apiUrl: resolveApiUrl(),
  firebase: resolveFirebaseConfig(),
  otpResendSeconds: resolveOtpResendSeconds(),
  /** Sleek screen catalogue at `/` — dev builds only, when EXPO_PUBLIC_SHOW_SLEEK_SCREENS is truthy. */
  showSleekScreens: __DEV__ && isTruthyFlag(process.env.EXPO_PUBLIC_SHOW_SLEEK_SCREENS),
  /**
   * Ride simulator on the Trip Validation screen — dev builds only. The API must also run with
   * VALIDATION_ALLOW_SIMULATED=true (it is always rejected in production).
   */
  allowSimulatedRide: __DEV__ && isTruthyFlag(process.env.EXPO_PUBLIC_ALLOW_SIMULATED_RIDE),
} as const;
