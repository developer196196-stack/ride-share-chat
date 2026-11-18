'use client';

import { useState } from 'react';
import { deleteRider } from '@/lib/rider-actions';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/page-header';

const WORD = 'DELETE';

/** Delete a rider's account. The admin types DELETE to confirm; it can't be undone. */
export function DeleteRiderDialog({
  rider,
  onOpenChange,
  onDeleted,
}: {
  /** Open while set. */
  rider: { uid: string; displayName: string | null; phoneNumber: string | null } | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState('');
  const name = rider?.displayName ?? 'this rider';
  return (
    <ConfirmDialog
      open={rider != null}
      onOpenChange={(open) => {
        if (!open) setTyped('');
        onOpenChange(open);
      }}
      title={`Delete ${name}'s account?`}
      description={`This permanently deletes ${name}${rider?.phoneNumber ? ` (${rider.phoneNumber})` : ''}: their sign-in, profile, photo, ride history, trusted contacts and follows. Their ride ends and they are signed out. Reports and safety alerts are kept. This cannot be undone. To stop someone using the app but keep their account, use Suspend instead.`}
      confirmLabel="Delete account"
      confirmDisabled={typed.trim().toUpperCase() !== WORD}
      onConfirm={async () => {
        if (rider && (await deleteRider(rider.uid))) {
          setTyped('');
          onDeleted();
        }
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="confirm-delete" className="text-[11.5px] font-semibold text-foreground/80">
          Type <span className="font-mono text-primary">{WORD}</span> to confirm
        </label>
        <Input
          id="confirm-delete"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="font-mono"
        />
      </div>
    </ConfirmDialog>
  );
}
