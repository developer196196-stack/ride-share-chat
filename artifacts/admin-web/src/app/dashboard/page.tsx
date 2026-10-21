'use client';

import Link from 'next/link';
import { ArrowRight, Car, Flag, Gauge, Radio, ShieldAlert, UserX, Users } from 'lucide-react';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { VIBE_LABELS } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ErrorAlert, PageHeader } from '@/components/page-header';

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
  byVibe: { vibe: string; rooms: number; riders: number; openSeats: number }[];
};

export default function OverviewPage() {
  const { data, error, loading, reload } = useAdminQuery<Stats>('/stats', 15_000);
  const ready = !loading || data != null;

  const cards = [
    { title: 'Riders', value: data?.totalRiders, desc: `${data?.newRiders7d ?? 0} joined in the last 7 days`, icon: Users, href: '/dashboard/riders' },
    { title: 'Verified right now', value: data?.verifiedNow, desc: `${data?.onHold ?? 0} in traffic grace or post-ride`, icon: Car, href: '/dashboard/riders' },
    { title: 'Live rooms', value: data?.liveRooms, desc: `${data?.ridersInRooms ?? 0} riders in rooms`, icon: Radio, href: '/dashboard/rooms' },
    { title: 'Open reports', value: data?.openReports, desc: 'Waiting for review', icon: Flag, href: '/dashboard/reports', alert: (data?.openReports ?? 0) > 0 },
    { title: 'Safety alerts (24h)', value: data?.safetyAlerts24h, desc: 'Trip shares and emergencies', icon: ShieldAlert, href: '/dashboard/safety', alert: (data?.safetyAlerts24h ?? 0) > 0 },
    { title: 'Suspended riders', value: data?.suspended, desc: 'Blocked from the app', icon: UserX, href: '/dashboard/riders' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Live pulse of Rideshare Chats. Refreshes every 15 seconds." />
      {error ? <ErrorAlert message={error} onRetry={() => void reload()} /> : null}

      {data && data.validationOverrides > 0 ? (
        <Alert>
          <Gauge className="h-4 w-4" />
          <AlertTitle>Trip Validation is customised</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {data.validationOverrides} setting{data.validationOverrides === 1 ? ' is' : 's are'} changed from the production defaults in the admin panel.
            </span>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/settings">Review settings</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className="block">
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${card.alert ? 'text-primary' : 'text-muted-foreground'}`} />
                </CardHeader>
                <CardContent>
                  {ready ? <div className="text-3xl font-bold">{card.value ?? 0}</div> : <Skeleton className="h-9 w-16" />}
                  <p className="text-xs text-muted-foreground mt-1">{card.desc}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Rooms by mood</CardTitle>
            <CardDescription>Live rooms and riders for each vibe</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(data?.byVibe ?? []).map((row) => (
              <div key={row.vibe} className="rounded-lg border p-3 space-y-1">
                <p className="text-sm font-semibold">{VIBE_LABELS[row.vibe] ?? row.vibe}</p>
                <p className="text-xs text-muted-foreground">
                  {row.rooms} room{row.rooms === 1 ? '' : 's'} · {row.riders} rider{row.riders === 1 ? '' : 's'}
                </p>
              </div>
            ))}
            {!data ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16" />) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Common admin tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { href: '/dashboard/reports', label: 'Review open reports' },
              { href: '/dashboard/riders', label: 'Find a rider' },
              { href: '/dashboard/rooms', label: 'Watch live rooms' },
              { href: '/dashboard/settings', label: 'Tune Trip Validation' },
            ].map(({ href, label }) => (
              <Button key={href} variant="outline" className="w-full justify-between" asChild>
                <Link href={href}>
                  {label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
