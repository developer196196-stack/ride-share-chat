export const FirestoreCollections = {
  users: 'users',
  shareLinks: 'shareLinks',
  safetyAlerts: 'safetyAlerts',
  reports: 'reports',
} as const;

/** Subcollections of `users/{uid}`. */
export const TRUSTED_CONTACTS_SUBCOLLECTION = 'trustedContacts';
export const RIDES_SUBCOLLECTION = 'rides';
/** `users/{uid}/following/{target}` and the mirror `users/{target}/followers/{uid}`. */
export const FOLLOWING_SUBCOLLECTION = 'following';
export const FOLLOWERS_SUBCOLLECTION = 'followers';

export type FirestoreCollectionName = (typeof FirestoreCollections)[keyof typeof FirestoreCollections];

export function userDocPath(uid: string): string {
  return `${FirestoreCollections.users}/${uid}`;
}

/** Storage folder that holds a user's avatar uploads. */
export function userAvatarStoragePrefix(uid: string): string {
  return `users/${uid}/avatar/`;
}
