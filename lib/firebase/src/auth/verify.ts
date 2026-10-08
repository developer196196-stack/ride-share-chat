import type { Auth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getFirebaseAdmin } from '../admin';

export function getAuth(): Auth {
  return getFirebaseAdmin().auth();
}

/**
 * Verifies a Firebase ID token from the mobile client.
 * Throws if the token is invalid/expired or Admin is not configured.
 */
export async function verifyIdToken(
  idToken: string,
  checkRevoked = false,
): Promise<DecodedIdToken> {
  return getAuth().verifyIdToken(idToken, checkRevoked);
}

export type { DecodedIdToken };
