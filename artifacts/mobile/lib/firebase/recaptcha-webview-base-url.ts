import { env } from '@/lib/config/env';

/**
 * Origin used by the native reCAPTCHA WebView (`source={{ html, baseUrl }}`).
 * Firebase provisions reCAPTCHA against authDomain — use https://{authDomain}/ as WebView origin.
 */
export function getRecaptchaWebViewBaseUrl(): string {
  return `https://${env.firebase.authDomain}/`;
}

/** Human-readable origin for error hints. */
export function getRecaptchaWebViewOriginHint(): string {
  try {
    return new URL(getRecaptchaWebViewBaseUrl()).origin;
  } catch {
    return getRecaptchaWebViewBaseUrl();
  }
}
