import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  /** Firebase's own timestamp of the last real sign-in (OTP/email link/Google); unset by token refreshes. */
  lastSignInTime: string | null;
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  /** Supplies Firebase ID token for API requests; null when signed out. */
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  setUserFromFirebase: (user: User | null) => void;
  setAuthReady: (ready: boolean) => void;
  setUser: (user: AuthUser | null) => void;
  signOut: () => Promise<void>;
};

function mapUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    phoneNumber: user.phoneNumber,
    emailVerified: user.emailVerified,
    lastSignInTime: user.metadata.lastSignInTime ?? null,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isAuthReady: false,

  getIdToken: async (forceRefresh = false) => {
    const auth = getFirebaseAuth();
    const current = auth?.currentUser;
    if (!current) return null;
    return current.getIdToken(forceRefresh);
  },

  setUserFromFirebase: (firebaseUser) => {
    const user = mapUser(firebaseUser);
    set({ user, isAuthenticated: user != null });
  },

  setAuthReady: (ready) => set({ isAuthReady: ready }),

  setUser: (user) => set({ user, isAuthenticated: user != null }),

  signOut: async () => {
    const auth = getFirebaseAuth();
    if (auth) {
      await firebaseSignOut(auth);
    }
    set({ user: null, isAuthenticated: false });
  },
}));
