import AsyncStorage from '@react-native-async-storage/async-storage';
import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth, initializeAuth, type Persistence } from 'firebase/auth';
import { Platform } from 'react-native';
import { env } from '@/lib/config/env';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function getNativePersistence(): Persistence | undefined {
  if (Platform.OS === 'web') {
    return undefined;
  }

  // The RN build of firebase/auth exposes this helper; the web bundle does not
  // (metro.config.js adds the "react-native" export condition so native gets it).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const authRn = require('firebase/auth') as {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
  };

  if (!authRn.getReactNativePersistence) {
    console.error(
      '[firebase/client] getReactNativePersistence is unavailable — the session will NOT survive an app restart.',
    );
    return undefined;
  }

  return authRn.getReactNativePersistence(AsyncStorage);
}

function createFirebaseApp(): FirebaseApp | null {
  if (!env.firebase.configured) {
    return null;
  }
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp({
    apiKey: env.firebase.apiKey,
    authDomain: env.firebase.authDomain,
    projectId: env.firebase.projectId,
    messagingSenderId: env.firebase.messagingSenderId,
    appId: env.firebase.appId,
  });
}

function createAuth(firebaseApp: FirebaseApp): Auth {
  const persistence = getNativePersistence();
  if (!persistence) {
    return getAuth(firebaseApp);
  }
  try {
    return initializeAuth(firebaseApp, { persistence });
  } catch (err) {
    // Hot reload: auth was already initialized — the existing instance is reused.
    console.warn('[firebase/client] initializeAuth threw, falling back to getAuth():', err);
    return getAuth(firebaseApp);
  }
}

/** Returns the Firebase app, or null when EXPO_PUBLIC_FIREBASE_* env is incomplete. */
export function getFirebaseApp(): FirebaseApp | null {
  if (!app) {
    app = createFirebaseApp();
  }
  return app;
}

/** Returns Firebase Auth, or null when client env is incomplete. */
export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    return null;
  }
  if (!auth) {
    auth = createAuth(firebaseApp);
  }
  return auth;
}

export function isFirebaseClientConfigured(): boolean {
  return env.firebase.configured;
}
