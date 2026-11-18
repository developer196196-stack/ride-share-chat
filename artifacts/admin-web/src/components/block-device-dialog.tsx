'use client';

import { useState } from 'react';
import { blockRiderDevices, setDeviceBlocked } from '@/lib/rider-actions';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/page-header';

/**
 * Block a phone: either every phone a rider has used (`rider`) or one phone (`device`).
 * Open while one of them is set.
 */
export function BlockDeviceDialog({
  rider,
  device,
  onOpenChange,
  onDone,
}: {
  rider?: { uid: string; displayName: string | null } | null;
  device?: { key: string; name: string | null; otherRiders: number } | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const open = rider != null || device != null;
  const name = rider?.displayName ?? 'this rider';
  const shared =
    device && device.otherRiders > 0
      ? ` ${device.otherRiders} other rider${device.otherRiders === 1 ? ' has' : 's have'} used this phone and will be blocked on it too.`
      : '';

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('');
        onOpenChange(next);
      }}
      title={device ? `Block ${device.name ?? 'this phone'}?` : `Block ${name}'s phone?`}
      description={
        device
          ? `No account can use the app on this phone until you unblock it. Anyone using it now is signed out and their ride ends.${shared}`
          : `Blocks every phone ${name} has used. No account can use the app on those phones until you unblock them, so a new account won't get round it. ${name} is signed out and their ride ends. Their account is not suspended.`
      }
      confirmLabel="Block"
      onConfirm={async () => {
        const why = reason.trim() || null;
        const ok = device
          ? await setDeviceBlocked(device.key, true, why)
          : rider
            ? (await blockRiderDevices(rider.uid, why)) != null
            : false;
        if (ok) {
          setReason('');
          onDone();
        }
      }}
    >
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (internal, optional)"
        maxLength={500}
      />
    </ConfirmDialog>
  );
}
