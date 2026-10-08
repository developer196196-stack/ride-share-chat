import React, { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Subscribes to Firebase Auth and keeps `auth.store` in sync.
 * Sign-in itself happens on the Authentication screen (phone OTP).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const previousUidRef = useRef<string | null | undefined>(undefined);
  const setUserFromFirebase = useAuthStore((s) => s.setUserFromFirebase);
  const setAuthReady = useAuthStore((s) => s.setAuthReady);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthReady(true);
      return;
    }

    return onAuthStateChanged(auth, (user) => {
      const nextUid = user?.uid ?? null;
      const previousUid = previousUidRef.current;
      // Switching accounts or signing out must not leak the previous rider's cached profile.
      if (previousUid != null && previousUid !== nextUid) {
        queryClient.clear();
      }
      previousUidRef.current = nextUid;
      setUserFromFirebase(user);
      setAuthReady(true);
    });
  }, [queryClient, setUserFromFirebase, setAuthReady]);

  return <>{children}</>;
}
