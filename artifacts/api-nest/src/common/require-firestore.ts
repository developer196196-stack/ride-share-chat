import type { Firestore } from 'firebase-admin/firestore';
import { unavailable } from './service-unavailable';

/** Returns Firestore or throws a 503 when Firebase Admin is not configured. */
export function requireFirestore(firestore: Firestore | null): Firestore {
  if (!firestore) {
    unavailable('FIREBASE_UNAVAILABLE', 'Firebase Admin is not configured on this server.');
  }
  return firestore;
}
