import { ApiError } from '@workspace/api-client-react';

type ErrorBody = { code?: string; message?: string };

export function getApiErrorCode(error: unknown): string | undefined {
  if (error instanceof ApiError && error.data && typeof error.data === 'object') {
    return (error.data as ErrorBody).code;
  }
  return undefined;
}

/** User-facing message for an API/network failure. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) {
    switch (getApiErrorCode(error)) {
      case 'FIREBASE_UNAVAILABLE':
        return 'The server is not connected to Firebase yet. Set the FIREBASE_* variables for api-nest and restart it.';
      case 'STORAGE_UNAVAILABLE':
        return 'Photo uploads are not available right now. Check the server Storage bucket settings.';
      case 'AUTH_UNAUTHORIZED':
        return 'Your session has expired. Verify your phone number again.';
    }
    const body = error.data as ErrorBody | null;
    if (body?.message) return body.message;
    return error.message || fallback;
  }
  if (error instanceof TypeError && /network|fetch/i.test(error.message)) {
    return 'Cannot reach the server. Check that api-nest is running and EXPO_PUBLIC_API_URL is correct.';
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
