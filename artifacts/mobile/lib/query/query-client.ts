import {
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { Alert } from 'react-native';
import { ApiError } from '@workspace/api-client-react';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api/error-message';
import { useAuthStore } from '@/stores/auth.store';

function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Refusals that mean this rider can't use the app on this phone until an admin lifts them. */
const LOCKED_OUT = new Set(['DEVICE_BLOCKED', 'ACCOUNT_SUSPENDED']);
let lockedOutAlertShown = false;

function handleGlobalError(error: unknown): void {
  if (!isApiError(error)) return;
  // Bootstrap runs right after sign-in; the Authentication screen shows its error and can retry.
  if (error.url.includes('/auth/bootstrap')) return;
  if (error.status === 401) {
    useAuthStore.getState().signOut().catch(() => undefined);
    return;
  }
  const code = getApiErrorCode(error);
  if (error.status === 403 && code && LOCKED_OUT.has(code)) {
    if (!lockedOutAlertShown) {
      lockedOutAlertShown = true;
      Alert.alert('Signed out', getApiErrorMessage(error), [{ text: 'OK', onPress: () => (lockedOutAlertShown = false) }]);
    }
    useAuthStore.getState().signOut().catch(() => undefined);
  }
}

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleGlobalError }),
    mutationCache: new MutationCache({ onError: handleGlobalError }),
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
