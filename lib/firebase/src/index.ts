export {
  getFirebaseAdmin,
  isFirebaseConfigured,
  resetFirebaseAdminForTests,
} from './admin';
export { getFirestore } from './firestore/client';
export {
  FirestoreCollections,
  TRUSTED_CONTACTS_SUBCOLLECTION,
  RIDES_SUBCOLLECTION,
  userDocPath,
  userAvatarStoragePrefix,
  type FirestoreCollectionName,
} from './firestore/collections';
export type {
  UserDoc,
  RideStyle,
  UserPreferencesDoc,
  ContactChannel,
  TrustedContactDoc,
  ShareLinkDoc,
  SafetyAlertDoc,
  ReportDoc,
  RideDoc,
} from './firestore/types';
export { getAuth, verifyIdToken, type DecodedIdToken } from './auth/verify';
export {
  createSignedDownloadUrl,
  createSignedUploadUrl,
  deleteStorageFile,
  getStorageBucket,
  getStorageFileContentType,
  resolveStorageBucketName,
  storageFileExists,
} from './storage/client';
