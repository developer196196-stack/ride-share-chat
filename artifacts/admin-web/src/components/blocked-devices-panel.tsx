'use client';

import Link from 'next/link';
import { ShieldCheck, Smartphone } from 'lucide-react';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { formatDate } from '@/lib/api';
import { setDeviceBlocked } from '@/lib/rider-actions';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorAlert, Panel, StatusBadge } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';

type BlockedDevice = {
  key: string;
  platform: 'ios' | 'android';
  name: string | null;
  lastSeenAt: string;
  blockedAt: string | null;
  blockedBy: string | null;
  blockedReason: string | null;
  /** Riders who used it and still have an account. */
  riders: { uid: string; displayName: string | null }[];
};

/**
 * Every blocked phone, with Unblock. Also lists phones whose riders were deleted: those show
 * under no rider any more, so this is the only place to unblock them.
 */
export function BlockedDevicesPanel() {
  const { data, error, loading, reload } = useAdminQuery<BlockedDevice[]>('/devices/blocked', 60_000);

  return (
    <Panel
      eyebrow="Moderation"
      title="Blocked devices"
      description={
        data
          ? `${data.length} phone${data.length === 1 ? '' : 's'} blocked. No account can use the app on a blocked phone.`
          : 'Phones blocked from the app'
      }
      bodyClassName="p-0"
    >
      {error ? (
        <div className="p-4">
          <ErrorAlert message={error} onRetry={() => void reload()} />
        </div>
      ) : loading && !data ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No blocked devices"
            body="Block a phone from a rider's page or the ⋯ menu in Rider Management."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((d) => (
            <li key={d.key} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-accent">
                  <Smartphone className="h-4 w-4 text-primary" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium">
                      {d.name ?? (d.platform === 'ios' ? 'iPhone' : 'Android phone')}
                    </span>
                    <StatusBadge tone="secondary">{d.platform === 'ios' ? 'iOS' : 'Android'}</StatusBadge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Blocked {formatDate(d.blockedAt)}
                    {d.blockedBy ? ` by ${d.blockedBy}` : ''}
                    {d.blockedReason ? ` — ${d.blockedReason}` : ''}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {d.riders.length > 0 ? (
                      <>
                        Used by{' '}
                        {d.riders.map((r, i) => (
                          <span key={r.uid}>
                            {i > 0 ? ', ' : ''}
                            <Link
                              href={`/dashboard/riders/${r.uid}`}
                              className="text-foreground underline-offset-2 hover:underline"
                            >
                              {r.displayName ?? 'Profile not finished'}
                            </Link>
                          </span>
                        ))}
                      </>
                    ) : (
                      'Rider account deleted'
                    )}
                    <span className="font-mono"> · last used {formatDate(d.lastSeenAt)}</span>
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={async () => {
                  if (await setDeviceBlocked(d.key, false)) await reload();
                }}
              >
                <ShieldCheck className="mr-1.5 h-4 w-4" /> Unblock
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
