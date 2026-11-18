'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Car, Flag, Gauge, Radio, ShieldAlert, UserX, Users } from 'lucide-react';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { VIBE_GROUPS, VIBE_LABELS } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ErrorAlert, PageHeader, Panel, Stat } from '@/components/page-header';

type Stats = {
  totalRiders: number;
  newRiders7d: number;
  suspended: number;
  openReports: number;
  safetyAlerts24h: number;
  liveRooms: number;
  ridersInRooms: number;
  verifiedNow: number;
  onHold: number;
  validationOverrides: number;
  /** Testing overrides switched on for every rider. */
  testOverridesForAll?: ('desktop' | 'system')[];
  byVibe: { vibe: string; rooms: number; riders: number; openSeats: number }[];
};

export default function OverviewPage() {
  const { data, error, loading, reload } = useAdminQuery<Stats>('/stats', 15_000);
  const ready = !loading || data != null;

  const cards = [
    {
      title: 'Riders',
      value: data?.totalRiders,
      desc: `${data?.newRiders7d ?? 0} joined in the last 7 days`,
      icon: Users,
      href: '/dashboard/riders',
    },
    {
      title: 'Verified right now',
      value: data?.verifiedNow,
      desc: `${data?.onHold ?? 0} in traffic grace or post-ride`,
      icon: Car,
      href: '/dashboard/riders',
    },
    {
      title: 'Live rooms',
      value: data?.liveRooms,
      desc: `${data?.ridersInRooms ?? 0} riders in rooms`,
      icon: Radio,
      href: '/dashboard/rooms',
    },
    {
      title: 'Open reports',
      value: data?.openReports,
      desc: 'Waiting for review',
      icon: Flag,
      href: '/dashboard/reports',
      alert: (data?.openReports ?? 0) > 0,
    },
    {
      title: 'Safety alerts (24h)',
      value: data?.safetyAlerts24h,
      desc: 'Trip shares and emergencies',
      icon: ShieldAlert,
      href: '/dashboard/safety',
      alert: (data?.safetyAlerts24h ?? 0) > 0,
    },
    {
      title: 'Suspended riders',
      value: data?.suspended,
      desc: 'Blocked from the app',
      icon: UserX,
      href: '/dashboard/riders',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Live pulse of Rideshare Chats. Refreshes every 15 seconds." />
      {error ? <ErrorAlert message={error} onRetry={() => void reload()} /> : null}

      {data?.testOverridesForAll?.length ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {data.testOverridesForAll.map((k) => (k === 'desktop' ? 'Desktop' : 'System')).join(' and ')} override is on
            for all riders
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {data.testOverridesForAll.includes('desktop')
                ? 'Anyone can join rooms without really riding.'
                : 'Every trip ignores the phone’s in-vehicle reading.'}{' '}
              Use it for selected testers only, or switch it off before launch.
            </span>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/settings">Review overrides</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {data && data.validationOverrides > 0 ? (
        <Alert>
          <Gauge className="h-4 w-4" />
          <AlertTitle>Trip Validation is customised</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {data.validationOverrides} setting{data.validationOverrides === 1 ? ' is' : 's are'} changed from the
              production defaults in the admin panel.
            </span>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/settings">Review settings</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="rise grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="block rounded-lg transition-transform hover:-translate-y-0.5"
          >
            <Stat
              label={card.title}
              value={card.value ?? 0}
              hint={card.desc}
              icon={card.icon}
              accent={card.alert}
              loading={!ready}
            />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          eyebrow="Live"
          title="Rooms by category"
          description="Live rooms and riders for each room type, by group"
          bodyClassName="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          {data
            ? VIBE_GROUPS.map((group) => {
                const rows = group.vibes.map(
                  (vibe) => data.byVibe.find((r) => r.vibe === vibe) ?? { vibe, rooms: 0, riders: 0 },
                );
                const riders = rows.reduce((a, r) => a + r.riders, 0);
                return (
                  <div key={group.label} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">{group.label}</p>
                      <p className="tnum font-mono text-[10.5px] text-muted-foreground">
                        {riders} rider{riders === 1 ? '' : 's'}
                      </p>
                    </div>
                    {rows.map((row) => (
                      <div key={row.vibe} className="flex items-baseline justify-between gap-2 text-xs">
                        <span>{VIBE_LABELS[row.vibe] ?? row.vibe}</span>
                        <span className="tnum font-mono text-[10.5px] text-muted-foreground">
                          {row.rooms} room{row.rooms === 1 ? '' : 's'} · {row.riders} rider{row.riders === 1 ? '' : 's'}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })
            : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}
        </Panel>

        <Panel eyebrow="Shortcuts" title="Quick actions" description="Common admin tasks" bodyClassName="space-y-2">
          {[
            { href: '/dashboard/reports', label: 'Review open reports' },
            { href: '/dashboard/riders', label: 'Find a rider' },
            { href: '/dashboard/rooms', label: 'Watch live rooms' },
            { href: '/dashboard/settings', label: 'Trip Validation & Modes' },
          ].map(({ href, label }) => (
            <Button key={href} variant="outline" className="w-full justify-between" asChild>
              <Link href={href}>
                {label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ))}
        </Panel>
      </div>
    </div>
  );
}
