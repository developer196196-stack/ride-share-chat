import type Redis from 'ioredis';

/**
 * Riders suspended from the admin panel. Firestore `users/{uid}.suspended` is the source of truth;
 * this Redis set is the fast check on every request and socket connection (synced on startup).
 * Suspension also disables the Firebase Auth account, so even without Redis a suspended rider is
 * locked out once their current ID token expires (at most 1 hour).
 */
export const SUSPENDED_SET = 'suspended';

export const SUSPENDED_MESSAGE = 'This account has been suspended. Contact support if you think this is a mistake.';

export async function isSuspended(redis: Redis | null, uid: string): Promise<boolean> {
  if (!redis) return false;
  try {
    return (await redis.sismember(SUSPENDED_SET, uid)) === 1;
  } catch {
    return false;
  }
}
