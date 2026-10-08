import admin from 'firebase-admin';

let firebaseApp: admin.app.App | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID?.trim() &&
      process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
      process.env.FIREBASE_PRIVATE_KEY?.trim(),
  );
}

/**
 * Returns the Firebase Admin app, initializing on first call.
 * Throws when required env vars are missing.
 */
export function getFirebaseAdmin(): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
    );
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');
  const projectId = process.env.FIREBASE_PROJECT_ID!.trim();
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    `${projectId}.firebasestorage.app`;

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!.trim(),
      privateKey,
    }),
    storageBucket,
  });

  return firebaseApp;
}

/** Resets the cached app — for tests only. */
export function resetFirebaseAdminForTests(): void {
  firebaseApp = null;
}
