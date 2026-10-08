import type { User } from 'firebase/auth';
import {
  PhoneAuthProvider,
  signInWithCredential,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';
import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import {
  isNativeRecaptchaVerifier,
  isRecaptchaVerifierReady,
  type FirebaseRecaptchaVerifierHandle,
} from '@/components/firebase/firebase-recaptcha.types';
import { getFirebaseAuth, isFirebaseClientConfigured } from '@/lib/firebase/client';
import { getFirebaseErrorCode } from '@/lib/firebase/errors';
import { sendPhoneVerificationCodeNative } from '@/lib/firebase/native-phone-verification';
import { resetWebRecaptchaWidget } from '@/lib/firebase/recaptcha-web-manager';

const SEND_CODE_TIMEOUT_MS = 30_000;

/** User-facing copy for Firebase phone-auth failures. */
export function mapFirebasePhoneAuthError(error: unknown): string {
  switch (getFirebaseErrorCode(error)) {
    case 'auth/invalid-verification-code':
      return 'Incorrect verification code. Check the SMS and try again.';
    case 'auth/code-expired':
    case 'auth/session-expired':
      return 'This code has expired. Tap Resend to get a new one.';
    case 'auth/too-many-requests':
      return 'Too many attempts from this device or number. Wait a few minutes before trying again.';
    case 'auth/invalid-phone-number':
    case 'auth/missing-phone-number':
      return 'Enter a valid mobile number for the selected country.';
    case 'auth/quota-exceeded':
      return 'SMS quota exceeded. Try again later.';
    case 'auth/captcha-check-failed':
    case 'auth/invalid-app-credential':
    case 'auth/missing-app-credential':
      return 'Security check failed. Complete the reCAPTCHA again, then resend.';
    case 'auth/operation-not-allowed':
      return 'SMS sign-in is not enabled for this region. Enable Phone in Firebase → Authentication → Sign-in method and allow the region under SMS region policy.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Phone verification failed. Please try again.';
  }
}

function isRecaptchaCredentialError(error: unknown): boolean {
  const code = getFirebaseErrorCode(error);
  return code === 'auth/invalid-app-credential' || code === 'auth/missing-app-credential';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Firebase SDK phone calls have no timeout — race them so the UI never hangs. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Network request timed out after ${Math.round(ms / 1000)}s while sending the code. Check your connection and try again.`,
        ),
      );
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function resolveRecaptchaVerifier(
  recaptchaRef: React.RefObject<FirebaseRecaptchaVerifierHandle | null>,
): Promise<FirebaseRecaptchaVerifierHandle> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const verifier = recaptchaRef.current;
    if (isRecaptchaVerifierReady(verifier)) {
      return verifier;
    }
    await delay(100);
  }
  throw new Error(
    'Phone verification is not ready. Check the EXPO_PUBLIC_FIREBASE_* env vars and reload. On web, complete the reCAPTCHA first.',
  );
}

/**
 * Firebase phone sign-in for Expo:
 * - native: reCAPTCHA WebView token → Identity Toolkit REST → verificationId (works in Expo Go)
 * - web: RecaptchaVerifier + signInWithPhoneNumber
 */
export function useFirebasePhoneAuth(
  recaptchaRef: React.RefObject<FirebaseRecaptchaVerifierHandle | null>,
) {
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const verificationIdRef = useRef<string | null>(null);

  const sendCode = useCallback(
    async (e164: string): Promise<void> => {
      const auth = getFirebaseAuth();
      if (!auth || !isFirebaseClientConfigured()) {
        throw new Error('Firebase Auth is not configured. Set the EXPO_PUBLIC_FIREBASE_* variables.');
      }

      const verifier = await resolveRecaptchaVerifier(recaptchaRef);
      confirmationRef.current = null;
      verificationIdRef.current = null;

      try {
        if (Platform.OS !== 'web') {
          if (!isNativeRecaptchaVerifier(verifier)) {
            throw new Error('Native reCAPTCHA verifier is not available.');
          }
          const token = await verifier.verify();
          const tokenKind = verifier.getLastCaptchaMeta()?.tokenKind ?? 'v2';
          verificationIdRef.current = await withTimeout(
            sendPhoneVerificationCodeNative(e164, token, tokenKind),
            SEND_CODE_TIMEOUT_MS,
          );
          verifier._reset();
        } else {
          confirmationRef.current = await withTimeout(
            signInWithPhoneNumber(auth, e164, verifier),
            SEND_CODE_TIMEOUT_MS,
          );
        }
      } catch (error) {
        if (Platform.OS === 'web' && isRecaptchaCredentialError(error)) {
          resetWebRecaptchaWidget();
        }
        if (__DEV__) {
          console.warn('[phone-auth] sendCode failed', error);
        }
        throw error;
      }
    },
    [recaptchaRef],
  );

  const verifyCode = useCallback(async (smsCode: string): Promise<User> => {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Firebase Auth is not configured.');
    }

    if (verificationIdRef.current) {
      const credential = PhoneAuthProvider.credential(verificationIdRef.current, smsCode);
      const result = await signInWithCredential(auth, credential);
      return result.user;
    }

    if (!confirmationRef.current) {
      throw new Error('Request a verification code first.');
    }
    const result = await confirmationRef.current.confirm(smsCode);
    return result.user;
  }, []);

  const reset = useCallback(() => {
    confirmationRef.current = null;
    verificationIdRef.current = null;
  }, []);

  return { sendCode, verifyCode, reset };
}
