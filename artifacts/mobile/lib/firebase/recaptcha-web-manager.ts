import { RecaptchaVerifier } from 'firebase/auth';

import { getFirebaseAuth } from '@/lib/firebase/client';



const RECAPTCHA_CONTAINER_ID = 'firebase-recaptcha-container';



type RecaptchaCallbacks = {

  onSolved?: () => void;

  onExpired?: () => void;

  onReady?: () => void;

  onError?: (message: string) => void;

};



let verifier: RecaptchaVerifier | null = null;

let widgetId: number | null = null;

let renderPromise: Promise<RecaptchaVerifier> | null = null;

let callbacks: RecaptchaCallbacks = {};



declare global {

  interface Window {

    grecaptcha?: {

      reset: (id?: number) => void;

    };

  }

}



/**

 * Official Firebase web phone auth pattern:

 * https://firebase.google.com/docs/auth/web/phone-auth

 * - render() once, store widgetId

 * - signInWithPhoneNumber(auth, phone, verifier) — do NOT call verify() first

 * - on error: grecaptcha.reset(widgetId)

 */

export async function ensureWebRecaptchaVerifier(

  nextCallbacks: RecaptchaCallbacks = {},

): Promise<RecaptchaVerifier> {

  callbacks = nextCallbacks;



  const auth = getFirebaseAuth();

  if (!auth) {

    throw new Error('Firebase Auth is not configured.');

  }



  if (verifier && widgetId !== null) {

    return verifier;

  }



  if (renderPromise) {

    return renderPromise;

  }



  renderPromise = (async () => {

    let container = document.getElementById(RECAPTCHA_CONTAINER_ID);

    if (!container) {

      container = document.createElement('div');

      container.id = RECAPTCHA_CONTAINER_ID;

      container.style.display = 'flex';

      container.style.justifyContent = 'center';

      container.style.width = '100%';

      container.style.minHeight = '78px';

    }



    container.innerHTML = '';



    const nextVerifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, {

      size: 'normal',

      callback: () => {

        callbacks.onSolved?.();

      },

      'expired-callback': () => {

        callbacks.onExpired?.();

      },

    });



    widgetId = await nextVerifier.render();

    verifier = nextVerifier;

    callbacks.onReady?.();

    return nextVerifier;

  })().catch((error) => {

    renderPromise = null;

    callbacks.onError?.('Could not load reCAPTCHA. Check authorized domains in Firebase.');

    throw error;

  });



  return renderPromise;

}



export function getWebRecaptchaVerifier(): RecaptchaVerifier | null {

  return verifier;

}



/** Official error recovery — reset widget so user can solve again. */

export function resetWebRecaptchaWidget(): void {

  if (widgetId !== null && window.grecaptcha) {

    try {

      window.grecaptcha.reset(widgetId);

    } catch {

      // fall through to full rebuild

    }

  }

  callbacks.onExpired?.();

}



export function rebuildWebRecaptchaVerifier(): void {

  if (verifier) {

    try {

      verifier.clear();

    } catch {

      // ignore cleanup errors

    }

  }

  verifier = null;

  widgetId = null;

  renderPromise = null;

  document.getElementById(RECAPTCHA_CONTAINER_ID)?.replaceChildren();

}



export function isLocalhostPhoneAuthBlocked(): boolean {

  if (typeof window === 'undefined') return false;

  return window.location.hostname === 'localhost';

}



export function getPhoneAuthWebOriginHint(): string | null {

  if (!isLocalhostPhoneAuthBlocked()) return null;



  const port = window.location.port || '8082';

  return `http://127.0.0.1:${port}`;

}



export { RECAPTCHA_CONTAINER_ID };