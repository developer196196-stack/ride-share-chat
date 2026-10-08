import type { ApplicationVerifier, RecaptchaVerifier } from 'firebase/auth';
import type { CaptchaTokenKind } from '@/lib/firebase/native-phone-verification';

export type NativeCaptchaMeta = {
  tokenKind: CaptchaTokenKind;
};

/** Native WebView verifier — exposes captcha metadata for direct REST SMS send. */
export type NativeFirebaseRecaptchaVerifierHandle = ApplicationVerifier & {
  type: 'recaptcha';
  _reset: () => void;
  getLastCaptchaMeta: () => NativeCaptchaMeta | null;
};

/** Passed to signInWithPhoneNumber — must be RecaptchaVerifier (web) or ApplicationVerifier + _reset (native). */
export type FirebaseRecaptchaVerifierHandle =
  | RecaptchaVerifier
  | NativeFirebaseRecaptchaVerifierHandle;

export type FirebaseRecaptchaVerifierProps = {
  onReadyChange?: (ready: boolean) => void;
  onSolvedChange?: (solved: boolean) => void;
};

export function isRecaptchaVerifierReady(
  verifier: FirebaseRecaptchaVerifierHandle | null | undefined,
): verifier is FirebaseRecaptchaVerifierHandle {
  if (!verifier) return false;

  // Web: real Firebase RecaptchaVerifier instance
  if ('clear' in verifier && typeof verifier.verify === 'function') {
    return true;
  }

  // Native WebView wrapper
  const wrapped = verifier as NativeFirebaseRecaptchaVerifierHandle;
  return (
    wrapped.type === 'recaptcha' &&
    typeof wrapped.verify === 'function' &&
    typeof wrapped._reset === 'function' &&
    typeof wrapped.getLastCaptchaMeta === 'function'
  );
}

export function isNativeRecaptchaVerifier(
  verifier: FirebaseRecaptchaVerifierHandle,
): verifier is NativeFirebaseRecaptchaVerifierHandle {
  return isRecaptchaVerifierReady(verifier) && 'getLastCaptchaMeta' in verifier;
}
