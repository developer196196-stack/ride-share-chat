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

/** "Kill session": ends the rider's current ride and takes them out of any room. */
export async function endRide(uid: string): Promise<boolean> {
  try {
    await adminApi(`/users/${uid}/end-ride`, { method: 'POST', body: {} });
    toast.success('Session killed. Their ride ended and they left any room.');
    return true;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Could not end the ride.');
    return false;
  }
}

export async function deleteRider(uid: string): Promise<boolean> {
  try {
    await adminApi(`/users/${uid}`, { method: 'DELETE' });
    toast.success('Rider account deleted.');
    return true;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Could not delete the rider.');
    return false;
  }
}

/** "Block device": every phone the rider has used. Resolves to how many were blocked, or null on failure. */
export async function blockRiderDevices(uid: string, reason: string | null): Promise<number | null> {
  try {
    const { blocked } = await adminApi<{ blocked: number }>(`/users/${uid}/block-devices`, {
      method: 'POST',
      body: { reason },
    });
    if (blocked === 0)
      toast.info('No unblocked phones on record for this rider yet. Phones are recorded when they use the app.');
    else
      toast.success(
        `${blocked} phone${blocked === 1 ? '' : 's'} blocked. Anyone using ${blocked === 1 ? 'it' : 'them'} was signed out.`,
      );
    return blocked;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Could not block the device.');
    return null;
  }
}

export async function setDeviceBlocked(key: string, blocked: boolean, reason: string | null = null): Promise<boolean> {
  try {
    await adminApi(`/devices/${key}/${blocked ? 'block' : 'unblock'}`, {
      method: 'POST',
      body: blocked ? { reason } : {},
    });
    toast.success(blocked ? 'Phone blocked. Anyone using it was signed out.' : 'Phone unblocked.');
    return true;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Could not update the device.');
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
