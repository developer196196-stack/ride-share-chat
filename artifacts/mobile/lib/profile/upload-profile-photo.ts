import {
  createProfilePhotoUpload,
  type ProfilePhotoUploadRequestContentType,
} from '@workspace/api-client-react';
import { putFile } from './put-file';

const SUPPORTED_TYPES: ProfilePhotoUploadRequestContentType[] = ['image/jpeg', 'image/png', 'image/webp'];

function resolveContentType(mimeType: string | null | undefined): ProfilePhotoUploadRequestContentType {
  const normalized = mimeType?.toLowerCase();
  return SUPPORTED_TYPES.find((t) => t === normalized) ?? 'image/jpeg';
}

/** Maps Google Cloud Storage's XML error (`<Code>…</Code>`) to an actionable message. */
function describeStorageError(status: number, body: string): string {
  const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1];
  switch (code) {
    case 'AccessDenied':
      return 'Storage denied the upload. Give the API service account the "Storage Admin" role in Google Cloud IAM.';
    case 'NoSuchBucket':
      return 'The Storage bucket does not exist. Open Firebase → Storage → Get started, and check FIREBASE_STORAGE_BUCKET.';
    case 'SignatureDoesNotMatch':
      return 'The upload link signature was rejected. Check FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY belong to the same service account.';
    case 'ExpiredToken':
      return 'The upload link expired. Pick the photo again.';
    default:
      return `Photo upload failed (HTTP ${status}${code ? ` ${code}` : ''}). Please try again.`;
  }
}

/**
 * Uploads a picked image to Firebase Storage through a signed URL from the API.
 * Returns the storage path to send as `photoStoragePath` when saving the profile.
 */
export async function uploadProfilePhoto(localUri: string, mimeType?: string | null): Promise<string> {
  const contentType = resolveContentType(mimeType);
  const { uploadUrl, storagePath } = await createProfilePhotoUpload({ contentType });

  const { status, body } = await putFile(uploadUrl, localUri, contentType);
  if (status < 200 || status >= 300) {
    if (__DEV__) {
      console.warn('[profile-photo] Storage PUT failed', status, body.slice(0, 500));
    }
    throw new Error(describeStorageError(status, body));
  }

  return storagePath;
}
