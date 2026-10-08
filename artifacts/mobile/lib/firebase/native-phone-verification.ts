import { env } from '@/lib/config/env';

export type CaptchaTokenKind = 'enterprise' | 'v2';

const FAKE_TOKEN = 'NO_RECAPTCHA';

/** Direct Identity Toolkit call — mirrors Firebase JS SDK request shape for WebView tokens. */
export async function sendPhoneVerificationCodeNative(
  phoneNumber: string,
  token: string,
  tokenKind: CaptchaTokenKind,
): Promise<string> {
  const body: Record<string, string> = {
    phoneNumber,
    clientType: 'CLIENT_TYPE_WEB',
    recaptchaVersion: 'RECAPTCHA_ENTERPRISE',
  };

  if (tokenKind === 'enterprise') {
    body.captchaResponse = token;
  } else {
    body.captchaResponse = FAKE_TOKEN;
    body.recaptchaToken = token;
  }

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${encodeURIComponent(env.firebase.apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    sessionInfo?: string;
    error?: { message?: string; code?: number };
  };

  if (!res.ok || !json.sessionInfo) {
    const msg = json.error?.message ?? `sendVerificationCode HTTP ${res.status}`;
    const error = new Error(msg) as Error & { code?: string };
    error.code = res.status === 503 ? 'auth/error-code:-39' : undefined;
    throw error;
  }

  return json.sessionInfo;
}
