import type { ReactNode } from 'react';
import { setAuthTokenGetter, setBaseUrl, setDefaultHeaders } from '@workspace/api-client-react';
import { env } from '@/lib/config/env';
import { deviceHeaders, getDeviceIdentity } from '@/lib/device/device-id';
import { useAuthStore } from '@/stores/auth.store';

type ApiProviderProps = {
  children: ReactNode;
};

function bindApiClient(): void {
  setBaseUrl(env.apiUrl);
  setAuthTokenGetter(async () => {
    // The device ID goes with every signed-in request so a blocked phone is refused.
    setDefaultHeaders(deviceHeaders(await getDeviceIdentity()));
    return useAuthStore.getState().getIdToken();
  });
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
