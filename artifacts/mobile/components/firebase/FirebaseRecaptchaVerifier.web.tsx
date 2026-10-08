import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { RecaptchaVerifier } from 'firebase/auth';
import {
  ensureWebRecaptchaVerifier,
  getWebRecaptchaVerifier,
  RECAPTCHA_CONTAINER_ID,
  rebuildWebRecaptchaVerifier,
} from '@/lib/firebase/recaptcha-web-manager';
import type {
  FirebaseRecaptchaVerifierHandle,
  FirebaseRecaptchaVerifierProps,
} from './firebase-recaptcha.types';
import { colors } from '@/constants/colors';
import { isFirebaseClientConfigured } from '@/lib/firebase/client';

export type { FirebaseRecaptchaVerifierHandle, FirebaseRecaptchaVerifierProps };

/**
 * Web-only reCAPTCHA v2 for Firebase Phone Auth (official Firebase guide pattern).
 */
export const FirebaseRecaptchaVerifier = forwardRef<
  FirebaseRecaptchaVerifierHandle,
  FirebaseRecaptchaVerifierProps
>(function FirebaseRecaptchaVerifierWeb({ onReadyChange, onSolvedChange }, ref) {
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const [ready, setReady] = useState(false);
  const [solved, setSolved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onReadyChange?.(ready);
  }, [ready, onReadyChange]);

  useEffect(() => {
    onSolvedChange?.(solved);
  }, [solved, onSolvedChange]);

  const configured = isFirebaseClientConfigured();

  useEffect(() => {
    // The Authentication screen shows its own "Firebase is not configured" notice.
    if (!configured) return;
    let active = true;
    setReady(false);
    setSolved(false);
    setError(null);

    void ensureWebRecaptchaVerifier({
      onReady: () => {
        if (!active) return;
        verifierRef.current = getWebRecaptchaVerifier();
        setReady(true);
      },
      onSolved: () => {
        if (active) setSolved(true);
      },
      onExpired: () => {
        if (active) setSolved(false);
      },
      onError: (message) => {
        if (active) setError(message);
      },
    })
      .then((nextVerifier) => {
        if (!active) return;
        verifierRef.current = nextVerifier;
      })
      .catch((renderError) => {
        console.error('[FirebaseRecaptchaVerifier] render failed:', renderError);
      });

    return () => {
      active = false;
      verifierRef.current = null;
      setReady(false);
      setSolved(false);
    };
  }, [configured]);

  useImperativeHandle(
    ref,
    () => (getWebRecaptchaVerifier() ?? verifierRef.current) as FirebaseRecaptchaVerifierHandle,
    [ready, solved],
  );

  if (!configured) {
    return null;
  }

  return (
    <div style={{ width: '100%', marginTop: 8, marginBottom: 8 }}>
      <p
        style={{
          fontSize: 12,
          color: colors.mutedForeground,
          textAlign: 'center',
          marginBottom: 8,
          fontFamily: 'DMSans_400Regular, system-ui, sans-serif',
        }}
      >
        Complete the security check below, then tap Send Code.
      </p>
      <div id={RECAPTCHA_CONTAINER_ID} style={{ minHeight: 78, width: '100%' }} />
      {!ready && !error ? (
        <p style={{ fontSize: 12, color: colors.slate400, textAlign: 'center', marginTop: 8 }}>
          Loading reCAPTCHA…
        </p>
      ) : null}
      {ready && !solved ? (
        <p style={{ fontSize: 12, color: colors.chart3, textAlign: 'center', marginTop: 8 }}>
          Check the box above before sending.
        </p>
      ) : null}
      {error ? (
        <p style={{ fontSize: 12, color: colors.destructive, textAlign: 'center', marginTop: 8 }}>{error}</p>
      ) : null}
    </div>
  );
});

export function resetFirebaseRecaptchaVerifier(): void {
  rebuildWebRecaptchaVerifier();
}
