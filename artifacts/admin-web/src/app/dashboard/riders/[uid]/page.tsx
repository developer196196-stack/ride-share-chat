'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Ban, Copy, Phone } from 'lucide-react';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { formatDate, formatDuration, VIBE_LABELS } from '@/lib/api';
import { copyText } from '@/lib/rider-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorAlert, initials, StatusBadge, TableEmpty, TripBadge } from '@/components/page-header';

type RiderDetail = {
  uid: string;
  displayName: string | null;
  phoneNumber: string | null;
  countryCode: string | null;
  homeCity: string | null;
  rideStyle: string | null;
  incognitoDropoff: boolean;
  photoUrl: string | null;
  profileComplete: boolean;
  preferences: { nativeLanguage: string; autoTranslate: boolean } | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  suspended: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  followerCount: number;
  followingCount: number;
  validation: { state: string; score: number; speedMph: number } | null;
  liveRoom: { roomId: string; vibe: string; isHost: boolean; memberCount: number; capacity: number } | null;
  rides: {
    id: string;
    startedAt: string | null;
    endedAt: string | null;
    durationSec: number;
    roomDurationSec: number;
    distanceMiles: number;
    peersMet: number;
    graceCount: number;
    vibe: string | null;
    endReason: string;
  }[];
};

const END_REASONS: Record<string, string> = {
  user_ended: 'Rider ended',
  exited_vehicle: 'Left the vehicle',
  grace_expired: 'Stopped too long',
  spoof_detected: 'Spoofing detected',
  signal_lost: 'Signal lost',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

export default function RiderDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const { data, error, loading, reload } = useAdminQuery<RiderDetail>(`/users/${uid}`, 20_000);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }
  if (!data) return <ErrorAlert message={error ?? 'Rider not found.'} onRetry={() => void reload()} />;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/dashboard/riders">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> All riders
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {data.photoUrl ? <AvatarImage src={data.photoUrl} alt={data.displayName ?? ''} /> : null}
            <AvatarFallback className="text-lg">{initials(data.displayName)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{data.displayName ?? 'Profile not finished'}</h1>
            <div className="flex flex-wrap gap-1.5">
              {data.suspended ? <StatusBadge tone="destructive">Suspended</StatusBadge> : <StatusBadge tone="success">Active</StatusBadge>}
              {data.profileComplete ? null : <StatusBadge tone="secondary">Profile incomplete</StatusBadge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void copyText(data.uid, 'Rider ID')}>
            <Copy className="mr-1.5 h-4 w-4" /> Copy ID
          </Button>
          {data.phoneNumber ? (
            <Button variant="outline" size="sm" onClick={() => void copyText(data.phoneNumber!, 'Phone number')}>
              <Phone className="mr-1.5 h-4 w-4" /> Copy phone
            </Button>
          ) : null}
        </div>
      </div>

      {data.suspended ? (
        <Alert variant="destructive">
          <Ban className="h-4 w-4" />
          <AlertTitle>Suspended {formatDate(data.suspendedAt)}</AlertTitle>
          <AlertDescription>{data.suspendedReason ?? 'No reason given.'}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>What the rider entered and how they use the app</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <Field label="Phone">{data.phoneNumber ?? '—'}</Field>
            <Field label="Home city">{data.homeCity ?? '—'}</Field>
            <Field label="Ride style">{data.rideStyle ?? '—'}</Field>
            <Field label="Language">{data.preferences ? `${data.preferences.nativeLanguage}${data.preferences.autoTranslate ? ' · auto-translate' : ''}` : '—'}</Field>
            <Field label="Incognito drop-off">{data.incognitoDropoff ? 'On' : 'Off'}</Field>
            <Field label="Followers / following">
              {data.followerCount} / {data.followingCount}
            </Field>
            <Field label="Joined">{formatDate(data.createdAt)}</Field>
            <Field label="Last sign-in">{formatDate(data.lastSignInAt)}</Field>
            <Field label="Rider ID">
              <span className="font-mono text-xs break-all">{data.uid}</span>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Right now</CardTitle>
            <CardDescription>Live trip and room</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Trip">
              {data.validation ? (
                <div className="flex flex-wrap items-center gap-2">
                  <TripBadge state={data.validation.state} />
                  <span className="text-muted-foreground font-normal">
                    score {data.validation.score} · {data.validation.speedMph} mph
                  </span>
                </div>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Room">
              {data.liveRoom ? (
                <div className="space-y-1">
                  <p className="font-mono">{data.liveRoom.roomId}</p>
                  <p className="text-muted-foreground font-normal">
                    {VIBE_LABELS[data.liveRoom.vibe] ?? data.liveRoom.vibe} · {data.liveRoom.memberCount}/{data.liveRoom.capacity}
                    {data.liveRoom.isHost ? ' · hosting' : ''}
                  </p>
                </div>
              ) : (
                'Not in a room'
              )}
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent rides</CardTitle>
          <CardDescription>Last 20 validated rides</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Ended</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>In rooms</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Riders met</TableHead>
                <TableHead>Grace stops</TableHead>
                <TableHead>Mood</TableHead>
                <TableHead className="pr-6">End reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rides.length === 0 ? (
                <TableEmpty columns={8} message="No rides yet." />
              ) : (
                data.rides.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-6 text-muted-foreground whitespace-nowrap">{formatDate(r.endedAt)}</TableCell>
                    <TableCell>{formatDuration(r.durationSec)}</TableCell>
                    <TableCell>{formatDuration(r.roomDurationSec)}</TableCell>
                    <TableCell>{r.distanceMiles} mi</TableCell>
                    <TableCell>{r.peersMet}</TableCell>
                    <TableCell>{r.graceCount}</TableCell>
                    <TableCell>{r.vibe ? (VIBE_LABELS[r.vibe] ?? r.vibe) : '—'}</TableCell>
                    <TableCell className="pr-6">{END_REASONS[r.endReason] ?? r.endReason}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
