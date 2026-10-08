import {
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import { ApiError } from '@workspace/api-client-react';
import { useAuthStore } from '@/stores/auth.store';

function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function handleGlobalError(error: unknown): void {
  if (isApiError(error) && error.status === 401) {
    // Bootstrap runs right after sign-in; let the Authentication screen show and retry it.
    if (error.url.includes('/auth/bootstrap')) {
      return;
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
