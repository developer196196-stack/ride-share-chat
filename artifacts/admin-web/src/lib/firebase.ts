import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

function requiredFirebaseEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required Firebase configuration: ${name}`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: requiredFirebaseEnv(
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  ),
  authDomain: requiredFirebaseEnv(
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  ),
  projectId: requiredFirebaseEnv(
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  ),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: requiredFirebaseEnv(
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  ),
  appId: requiredFirebaseEnv(
    'NEXT_PUBLIC_FIREBASE_APP_ID',
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  ),
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export { app };
