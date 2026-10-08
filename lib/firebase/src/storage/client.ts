import type admin from 'firebase-admin';
import { getFirebaseAdmin, isFirebaseConfigured } from '../admin';

const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
const DOWNLOAD_URL_TTL_MS = 60 * 60 * 1000;

type StorageBucket = ReturnType<admin.storage.Storage['bucket']>;
type StorageFile = ReturnType<StorageBucket['file']>;

export function resolveStorageBucketName(): string | undefined {
  const explicit = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (explicit) {
    return explicit;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  return projectId ? `${projectId}.firebasestorage.app` : undefined;
}

/** Returns the default Storage bucket, or null when Firebase Admin is not configured. */
export function getStorageBucket(): StorageBucket | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  const firebaseAdmin = getFirebaseAdmin();
  const bucketName = resolveStorageBucketName();
  return bucketName
    ? firebaseAdmin.storage().bucket(bucketName)
    : firebaseAdmin.storage().bucket();
}

export function getStorageFile(storagePath: string): StorageFile | null {
  const bucket = getStorageBucket();
  if (!bucket) {
    return null;
  }
  return bucket.file(storagePath);
}

export async function storageFileExists(storagePath: string): Promise<boolean> {
  const file = getStorageFile(storagePath);
  if (!file) {
    return false;
  }
  const [exists] = await file.exists();
  return exists;
}

export async function createSignedUploadUrl(
  storagePath: string,
  contentType: string,
): Promise<{ uploadUrl: string; expiresAt: Date }> {
  const file = getStorageFile(storagePath);
  if (!file) {
    throw new Error('Firebase Storage is not configured.');
  }

  const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_MS);
  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: expiresAt,
    contentType,
  });

  return { uploadUrl, expiresAt };
}

export async function createSignedDownloadUrl(storagePath: string): Promise<string> {
  const file = getStorageFile(storagePath);
  if (!file) {
    throw new Error('Firebase Storage is not configured.');
  }

  const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_MS);
  const [downloadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: expiresAt,
  });

  return downloadUrl;
}

export async function getStorageFileContentType(storagePath: string): Promise<string | null> {
  const file = getStorageFile(storagePath);
  if (!file) {
    return null;
  }

  const [metadata] = await file.getMetadata();
  const contentType = metadata.contentType;
  return typeof contentType === 'string' ? contentType : null;
}

/** Best-effort delete; ignores missing objects. */
export async function deleteStorageFile(storagePath: string): Promise<void> {
  const file = getStorageFile(storagePath);
  if (!file) {
    return;
  }

  await file.delete({ ignoreNotFound: true });
}
