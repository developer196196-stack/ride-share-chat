'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Ban, Copy, Pencil, Phone, Power, RotateCcw, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { BlockDeviceDialog } from '@/components/block-device-dialog';
import { RiderTestingPanel, type RiderTestOverrides } from '@/components/trip-modes/rider-testing-panel';
import { DeleteRiderDialog } from '@/components/delete-rider-dialog';
import { RiderFormDialog } from '@/components/rider-form-dialog';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { formatDate, formatDuration, VIBE_LABELS } from '@/lib/api';
import { copyText, endRide, reinstateRider, setDeviceBlocked, suspendRider } from '@/lib/rider-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  ConfirmDialog,
  ErrorAlert,
  Panel,
  RiderAvatar,
  StatusBadge,
  TableEmpty,
  TripBadge,
} from '@/components/page-header';

type Device = {
  key: string;
  platform: 'ios' | 'android';
  name: string | null;
  lastSeenAt: string;
  otherRiders: number;
  blocked: boolean;
  blockedAt: string | null;
  blockedBy: string | null;
  blockedReason: string | null;
};

type ReportRow = {
  id: string;
  reason: string;
  source: string;
  status: string;
  details: string | null;
  createdAt: string | null;
};

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
  liveRoom: {
    roomId: string;
    vibe: string;
    isHost: boolean;
    memberCount: number;
    capacity: number;
  } | null;
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
  reportsAgainst: ReportRow[];
  reportsBy: ReportRow[];
  devices: Device[];
  testOverrides: RiderTestOverrides;
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
      <p className="eyebrow">{label}</p>
      <div className="text-[13px] font-medium">{children}</div>
    </div>
  );
}

function ReportsTable({ rows, empty }: { rows: ReportRow[]; empty: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>When</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableEmpty columns={4} message={empty} />
        ) : (
          rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                {formatDate(r.createdAt)}
              </TableCell>
              <TableCell>
                {r.reason.replace(/_/g, ' ')}
                {r.details ? <span className="text-muted-foreground"> — {r.details}</span> : null}
              </TableCell>
              <TableCell>
                {r.source === 'host_flag' ? (
                  <StatusBadge tone="info">Host flag</StatusBadge>
                ) : (
                  <StatusBadge tone="secondary">Rider report</StatusBadge>
                )}
              </TableCell>
              <TableCell>
                {r.status === 'open' ? (
                  <StatusBadge tone="warning">Open</StatusBadge>
                ) : (
                  <StatusBadge tone="success">Reviewed</StatusBadge>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export default function RiderDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const { data, error, loading, reload } = useAdminQuery<RiderDetail>(`/users/${uid}`, 20_000);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [killing, setKilling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // 'all' = every phone of this rider; otherwise one device.
  const [blocking, setBlocking] = useState<'all' | Device | null>(null);
  const router = useRouter();

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
  const live = data.liveRoom != null || (data.validation != null && data.validation.state !== 'TERMINATED');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="eyebrow flex items-center gap-2">
            <span className="text-primary">02</span>
            <span className="h-px w-6 bg-border" />
            <Link
              href="/dashboard/riders"
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Rider Management
            </Link>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <RiderAvatar name={data.displayName} seed={data.uid} url={data.photoUrl} size={56} />
            <div className="min-w-0 space-y-2">
              <h1 className="font-display truncate text-[30px] font-bold leading-none md:text-[36px]">
                {data.displayName ?? 'Profile not finished'}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5">
                {data.suspended ? (
                  <StatusBadge tone="destructive">Suspended</StatusBadge>
                ) : (
                  <StatusBadge tone="success">Active</StatusBadge>
                )}
                {data.profileComplete ? null : <StatusBadge tone="secondary">Profile incomplete</StatusBadge>}
                <span className="font-mono text-[10.5px] text-muted-foreground">ID {data.uid}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 h-4 w-4" /> Edit profile
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!live}
            title={live ? undefined : 'No ride or room running'}
            onClick={() => setKilling(true)}
          >
            <Power className="mr-1.5 h-4 w-4" /> Kill session
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBlocking('all')}>
            <Smartphone className="mr-1.5 h-4 w-4" /> Block device
          </Button>
          <Button variant="outline" size="sm" onClick={() => void copyText(data.uid, 'Rider ID')}>
            <Copy className="mr-1.5 h-4 w-4" /> Copy ID
          </Button>
          {data.phoneNumber ? (
            <Button variant="outline" size="sm" onClick={() => void copyText(data.phoneNumber!, 'Phone number')}>
              <Phone className="mr-1.5 h-4 w-4" /> Copy phone
            </Button>
          ) : null}
          {data.suspended ? (
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                if (await reinstateRider(data.uid)) await reload();
                setBusy(false);
              }}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reinstate
            </Button>
          ) : (
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
              <Ban className="mr-1.5 h-4 w-4" /> Suspend
            </Button>
          )}
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
        <Panel
          className="lg:col-span-2"
          eyebrow="Profile"
          title="About this rider"
          description="What the rider entered and how they use the app"
          bodyClassName="grid grid-cols-2 gap-5 md:grid-cols-3"
        >
          <Field label="Phone">{data.phoneNumber ?? '—'}</Field>
          <Field label="Home city">{data.homeCity ?? '—'}</Field>
          <Field label="Ride style">{data.rideStyle ?? '—'}</Field>
          <Field label="Language">
            {data.preferences
              ? `${data.preferences.nativeLanguage}${data.preferences.autoTranslate ? ' · auto-translate' : ''}`
              : '—'}
          </Field>
          <Field label="Incognito drop-off">{data.incognitoDropoff ? 'On' : 'Off'}</Field>
          <Field label="Followers / following">
            {data.followerCount} / {data.followingCount}
          </Field>
          <Field label="Joined">{formatDate(data.createdAt)}</Field>
          <Field label="Last sign-in">{formatDate(data.lastSignInAt)}</Field>
          <Field label="Rider ID">
            <span className="font-mono text-xs break-all">{data.uid}</span>
          </Field>
        </Panel>

        <Panel eyebrow="Live" title="Right now" description="Live trip and room" bodyClassName="space-y-4">
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
                  {VIBE_LABELS[data.liveRoom.vibe] ?? data.liveRoom.vibe} · {data.liveRoom.memberCount}/
                  {data.liveRoom.capacity}
                  {data.liveRoom.isHost ? ' · hosting' : ''}
                </p>
                <Button variant="link" size="sm" className="px-0 h-auto" asChild>
                  <Link href="/dashboard/rooms">Open Live Rooms</Link>
                </Button>
              </div>
            ) : (
              'Not in a room'
            )}
          </Field>
        </Panel>
      </div>

      <Panel eyebrow="History" title="Recent rides" description="Last 20 validated rides" bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Ended</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>In rooms</TableHead>
              <TableHead>Distance</TableHead>
              <TableHead>Riders met</TableHead>
              <TableHead>Grace stops</TableHead>
              <TableHead>Room type</TableHead>
              <TableHead>End reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rides.length === 0 ? (
              <TableEmpty columns={8} message="No rides yet." />
            ) : (
              data.rides.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                    {formatDate(r.endedAt)}
                  </TableCell>
                  <TableCell className="tnum">{formatDuration(r.durationSec)}</TableCell>
                  <TableCell className="tnum">{formatDuration(r.roomDurationSec)}</TableCell>
                  <TableCell className="tnum">{r.distanceMiles} mi</TableCell>
                  <TableCell className="tnum">{r.peersMet}</TableCell>
                  <TableCell className="tnum">{r.graceCount}</TableCell>
                  <TableCell className="text-xs">{r.vibe ? (VIBE_LABELS[r.vibe] ?? r.vibe) : '—'}</TableCell>
                  <TableCell className="text-xs">{END_REASONS[r.endReason] ?? r.endReason}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Panel>

      {data.testOverrides ? (
        <RiderTestingPanel uid={data.uid} overrides={data.testOverrides} onChanged={() => void reload()} />
      ) : null}

      <Panel
        eyebrow="Devices"
        title="Phones"
        description="Phones this rider has used the app on. A blocked phone can't be used with any account."
        bodyClassName="p-0"
      >
        {data.devices.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            No phones recorded yet. A phone is recorded the next time the rider uses the app (app version with device
            blocking).
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.devices.map((d) => (
              <li key={d.key} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium">
                        {d.name ?? (d.platform === 'ios' ? 'iPhone' : 'Android phone')}
                      </span>
                      <StatusBadge tone="secondary">{d.platform === 'ios' ? 'iOS' : 'Android'}</StatusBadge>
                      {d.blocked ? <StatusBadge tone="destructive">Blocked</StatusBadge> : null}
                    </div>
                    <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                      Last used {formatDate(d.lastSeenAt)}
                      {d.otherRiders > 0
                        ? ` · also used by ${d.otherRiders} other rider${d.otherRiders === 1 ? '' : 's'}`
                        : ''}
                    </p>
                    {d.blocked ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Blocked {formatDate(d.blockedAt)}
                        {d.blockedBy ? ` by ${d.blockedBy}` : ''}
                        {d.blockedReason ? ` — ${d.blockedReason}` : ''}
                      </p>
                    ) : null}
                  </div>
                </div>
                {d.blocked ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (await setDeviceBlocked(d.key, false)) await reload();
                    }}
                  >
                    <ShieldCheck className="mr-1.5 h-4 w-4" /> Unblock
                  </Button>
                ) : (
                  <Button variant="destructive" size="sm" onClick={() => setBlocking(d)}>
                    <Ban className="mr-1.5 h-4 w-4" /> Block
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <BlockDeviceDialog
        rider={blocking === 'all' ? data : null}
        device={blocking !== 'all' ? blocking : null}
        onOpenChange={(open) => !open && setBlocking(null)}
        onDone={() => void reload()}
      />

      <Card>
        <Tabs defaultValue="against">
          <CardHeader className="flex flex-col gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="eyebrow mb-0.5">Moderation</div>
              <CardTitle>Reports</CardTitle>
              <CardDescription className="mt-0.5">Reports about this rider and reports they made</CardDescription>
            </div>
            <TabsList>
              <TabsTrigger value="against">Against ({data.reportsAgainst.length})</TabsTrigger>
              <TabsTrigger value="by">Made ({data.reportsBy.length})</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="p-0">
            <TabsContent value="against" className="m-0">
              <ReportsTable rows={data.reportsAgainst} empty="No one has reported this rider." />
            </TabsContent>
            <TabsContent value="by" className="m-0">
              <ReportsTable rows={data.reportsBy} empty="This rider hasn't reported anyone." />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <section className="rounded-lg border border-primary/30 bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="eyebrow mb-0.5 text-primary">Danger zone</div>
            <h2 className="text-[14px] font-semibold">Delete account</h2>
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
              Permanently removes their sign-in, profile, photo, ride history, trusted contacts and follows. Unlike Kill
              session or Suspend, this cannot be undone. Reports and safety alerts are kept.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete account
          </Button>
        </div>
      </section>

      <RiderFormDialog open={editing} onOpenChange={setEditing} rider={data} onSaved={() => void reload()} />

      <ConfirmDialog
        open={killing}
        onOpenChange={setKilling}
        title={`Kill ${data.displayName ?? 'this rider'}'s session?`}
        description="Their current ride ends and they leave any room. They are not suspended and can start a new ride straight away."
        confirmLabel="Kill session"
        onConfirm={async () => {
          if (await endRide(data.uid)) await reload();
        }}
      />

      <DeleteRiderDialog
        rider={deleting ? data : null}
        onOpenChange={setDeleting}
        onDeleted={() => router.replace('/dashboard/riders')}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setReason('');
        }}
        title={`Suspend ${data.displayName ?? 'this rider'}?`}
        description="They are signed out, removed from any room, their ride ends, and they can't use the app until you reinstate them."
        confirmLabel="Suspend rider"
        onConfirm={async () => {
          if (await suspendRider(data.uid, reason.trim() || null)) await reload();
        }}
      >
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (internal, optional)"
          maxLength={500}
        />
      </ConfirmDialog>
    </div>
  );
}
