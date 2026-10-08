export const FirestoreCollections = {
  users: 'users',
  shareLinks: 'shareLinks',
  safetyAlerts: 'safetyAlerts',
  reports: 'reports',
} as const;

/** Subcollections of `users/{uid}`. */
export const TRUSTED_CONTACTS_SUBCOLLECTION = 'trustedContacts';
export const RIDES_SUBCOLLECTION = 'rides';

export type FirestoreCollectionName = (typeof FirestoreCollections)[keyof typeof FirestoreCollections];

export function userDocPath(uid: string): string {
  return `${FirestoreCollections.users}/${uid}`;
}

/** Storage folder that holds a user's avatar uploads. */
export function userAvatarStoragePrefix(uid: string): string {
  return `users/${uid}/avatar/`;
}
