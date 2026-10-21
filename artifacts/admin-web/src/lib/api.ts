import { auth } from './firebase';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
  }
}

/**
 * Calls the admin API (`/api/v1/admin/*`, proxied to api-nest by next.config.ts) with the
 * signed-in admin's Firebase ID token. Throws ApiError with the server's message on failure.
 */
export async function adminApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ApiError('You are signed out.', 401, 'AUTH_UNAUTHORIZED');
  const token = await user.getIdToken();
  const res = await fetch(`${process.env.NEXT_PUBLIC_ADMIN_BASE_PATH ?? ""}/api/v1/admin${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const body = (data ?? {}) as { message?: string; code?: string };
    throw new ApiError(body.message ?? `Request failed (${res.status})`, res.status, body.code ?? null);
  }
  return data as T;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export const VIBE_LABELS: Record<string, string> = {
  party_mode: 'Party Mode',
  networking: 'Networking',
  deep_talks: 'Deep Talks',
  just_chilling: 'Just Chilling',
};

export const STATE_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  GRACE: 'Traffic grace',
  POST_RIDE: 'Post-ride',
  TERMINATED: 'Ended',
};
