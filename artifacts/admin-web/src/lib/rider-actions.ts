import { toast } from 'sonner';
import { adminApi } from './api';

/** Suspend / reinstate with toasts; resolves to true on success. Shared by the tables and detail page. */
export async function suspendRider(uid: string, reason: string | null): Promise<boolean> {
  try {
    await adminApi(`/users/${uid}/suspend`, { method: 'POST', body: { reason } });
    toast.success('Rider suspended. They were signed out and removed from any room.');
    return true;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Could not suspend the rider.');
    return false;
  }
}

export async function reinstateRider(uid: string): Promise<boolean> {
  try {
    await adminApi(`/users/${uid}/reinstate`, { method: 'POST', body: {} });
    toast.success('Rider reinstated. They can sign in again.');
    return true;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Could not reinstate the rider.');
    return false;
  }
}

export async function copyText(text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied.`);
  } catch {
    toast.error(`Could not copy the ${what.toLowerCase()}.`);
  }
}
