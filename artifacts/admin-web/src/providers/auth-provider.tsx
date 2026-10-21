'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { auth } from '../lib/firebase';
import { adminApi, ApiError } from '../lib/api';

type AuthContextType = {
  /** Signed in AND confirmed as an administrator by the API. */
  user: User | null;
  loading: boolean;
  /** Why the last sign-in was refused (e.g. not an administrator). */
  authError: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function signInMessage(err: unknown): string {
  const code = (err as { code?: string }).code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Wrong email or password.';
  }
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a minute and try again.';
  if (code.includes('operation-not-allowed')) return 'Email/password sign-in is not enabled in Firebase yet.';
  return err instanceof Error ? err.message : 'Sign-in failed.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Every Firebase session is checked against the admin API before the console opens.
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (usr) => {
      if (!usr) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        await adminApi('/me');
        setAuthError(null);
        setUser(usr);
      } catch (err) {
        setUser(null);
        setAuthError(
          err instanceof ApiError && err.code === 'ADMIN_REQUIRED'
            ? 'This account is not an administrator.'
            : err instanceof Error
              ? `Could not reach the admin API: ${err.message}`
              : 'Could not verify administrator access.',
        );
        await fbSignOut(auth).catch(() => undefined);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== '/login') router.replace('/login');
    if (user && (pathname === '/login' || pathname === '/')) router.replace('/dashboard');
  }, [user, loading, pathname, router]);

  const login = async (email: string, pass: string) => {
    setAuthError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onIdTokenChanged runs the admin check and finishes loading.
    } catch (err) {
      setAuthError(signInMessage(err));
      setLoading(false);
    }
  };

  const logout = async () => {
    await fbSignOut(auth);
    setUser(null);
    router.replace('/login');
  };

  return <AuthContext.Provider value={{ user, loading, authError, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
