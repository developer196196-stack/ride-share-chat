'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Cpu, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/api';
import { Switch } from '@/components/ui/switch';
import { Panel, StatusBadge } from '@/components/page-header';

export type RiderTestOverrides = {
  desktop: boolean;
  system: boolean;
  desktopForAll: boolean;
  systemForAll: boolean;
};

const ROWS = [
  {
    kind: 'desktop' as const,
    title: 'Desktop override',
    icon: Monitor,
    note: 'Their trips count as verified without real movement (demos, emulators, app reviewers).',
  },
  {
    kind: 'system' as const,
    title: 'System override',
    icon: Cpu,
    note: 'Ignore their phone’s in-vehicle reading; GPS and vibration still decide.',
  },
];

/** Rider page: switch the Trip Validation testing overrides on for this rider only. */
export function RiderTestingPanel({
  uid,
  overrides,
  onChanged,
}: {
  uid: string;
  overrides: RiderTestOverrides;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const set = async (kind: 'desktop' | 'system', on: boolean) => {
    setBusy(true);
    try {
      await adminApi(`/users/${uid}/test-overrides`, { method: 'PUT', body: { [kind]: on } });
      toast.success(
        `${kind === 'desktop' ? 'Desktop' : 'System'} override ${on ? 'on' : 'off'} for this rider. It applies within 30 seconds.`,
      );
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the override.');
    } finally {
      setBusy(false);
    }
  };

  const anyOn = overrides.desktop || overrides.system;
  return (
    <Panel
      eyebrow="Testing"
      title="Trip Validation overrides"
      description="For testers only. Everyone else is unaffected."
      action={anyOn ? <StatusBadge tone="warning">On</StatusBadge> : <StatusBadge tone="secondary">Off</StatusBadge>}
      bodyClassName="space-y-2"
    >
      {ROWS.map(({ kind, title, icon: Icon, note }) => {
        const forAll = kind === 'desktop' ? overrides.desktopForAll : overrides.systemForAll;
        return (
          <label key={kind} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">
              <span className="block text-[13px] font-medium">{title}</span>
              <span className="text-[11.5px] text-muted-foreground">
                {forAll ? (
                  <>
                    On for all riders.{' '}
                    <Link href="/dashboard/settings" className="text-primary hover:underline">
                      Change in Trip Validation & Modes
                    </Link>
                  </>
                ) : (
                  note
                )}
              </span>
            </span>
            <Switch
              checked={overrides[kind]}
              disabled={busy || forAll}
              aria-label={`${title} for this rider`}
              onCheckedChange={(on) => void set(kind, on)}
            />
          </label>
        );
      })}
    </Panel>
  );
}
