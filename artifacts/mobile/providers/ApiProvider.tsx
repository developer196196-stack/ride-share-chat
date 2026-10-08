import type { ReactNode } from 'react';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { env } from '@/lib/config/env';
import { useAuthStore } from '@/stores/auth.store';

type ApiProviderProps = {
  children: ReactNode;
};

function bindApiClient(): void {
  setBaseUrl(env.apiUrl);
  setAuthTokenGetter(() => useAuthStore.getState().getIdToken());
}

let didLogBaseUrl = false;

/**
 * Wires the Orval HTTP client to runtime config (base URL + auth token).
 * Bind on render so the first child fetch has a URL — do not clear on unmount
 * (React Strict Mode would wipe the client between the double-mount).
 */
export function ApiProvider({ children }: ApiProviderProps) {
  bindApiClient();

  if (__DEV__ && !didLogBaseUrl) {
    didLogBaseUrl = true;
    console.info(`[api] base URL → ${env.apiUrl}`);
  }

  return <>{children}</>;
}
