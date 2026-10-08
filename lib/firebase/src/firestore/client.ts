import type { Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../admin';

export function getFirestore(): Firestore {
  return getFirebaseAdmin().firestore();
}
