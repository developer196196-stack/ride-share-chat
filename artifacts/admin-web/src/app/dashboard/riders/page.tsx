'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Ban,
  Copy,
  Pencil,
  Phone,
  Power,
  RotateCcw,
  Search,
  Smartphone,
  Trash2,
  UserPlus,
  UserRound,
} from 'lucide-react';
import { BlockDeviceDialog } from '@/components/block-device-dialog';
import { DeleteRiderDialog } from '@/components/delete-rider-dialog';
import { RiderFormDialog } from '@/components/rider-form-dialog';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { formatDate } from '@/lib/api';
import { copyText, endRide, reinstateRider, suspendRider } from '@/lib/rider-actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  ConfirmDialog,
  EmptyState,
  ErrorAlert,
  PageHeader,
  Panel,
  RiderAvatar,
  RowActionsTrigger,
  StatusBadge,
  TableSkeleton,
  TripBadge,
} from '@/components/page-header';

type Rider = {
  uid: string;
  displayName: string | null;
  phoneNumber: string | null;
  homeCity: string | null;
  rideStyle: string | null;
  incognitoDropoff: boolean;
  profileComplete: boolean;
  suspended: boolean;
  createdAt: string | null;
  validationState: string | null;
  roomId: string | null;
};

/** A ride or room is running, so Kill session has something to end. */
const isLive = (r: Rider) => r.roomId != null || (r.validationState != null && r.validationState !== 'TERMINATED');

type Filter = 'all' | 'active' | 'suspended' | 'in_room' | 'verified';
const COLUMNS = 7;

export default function RidersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [suspending, setSuspending] = useState<Rider | null>(null);
  const [reason, setReason] = useState('');
  // Add (null rider) or edit.
  const [form, setForm] = useState<{ rider: Rider | null } | null>(null);
  const [killing, setKilling] = useState<Rider | null>(null);
  const [deleting, setDeleting] = useState<Rider | null>(null);
  const [blockingDevice, setBlockingDevice] = useState<Rider | null>(null);
  const { data, error, loading, reload } = useAdminQuery<Rider[]>(
    `/users${applied ? `?search=${encodeURIComponent(applied)}` : ''}`,
    30_000,
  );

  const rows = useMemo(
    () =>
      (data ?? []).filter((r) => {
        if (filter === 'active') return !r.suspended;
        if (filter === 'suspended') return r.suspended;
        if (filter === 'in_room') return r.roomId != null;
        if (filter === 'verified') return r.validationState === 'VERIFIED';
        return true;
      }),
    [data, filter],
  );

  const filtered = applied !== '' || filter !== 'all';
  const clear = () => {
    setSearch('');
    setApplied('');
    setFilter('all');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rider Management"
        description="Every registered rider, their trip and room state, and manual overrides. Newest first (up to 500)."
        actions={
          <Button onClick={() => setForm({ rider: null })}>
            <UserPlus />
            Add rider
          </Button>
        }
      />
      <RiderFormDialog
        open={form != null}
        onOpenChange={(open) => !open && setForm(null)}
        rider={form?.rider}
        onSaved={() => void reload()}
      />
      {error ? <ErrorAlert message={error} onRetry={() => void reload()} /> : null}

      <Panel bodyClassName="p-0">
        {/* Filter bar */}
        <div className="flex flex-col gap-2 border-b border-border p-3 md:flex-row">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setApplied(search.trim());
            }}
            className="relative flex-1"
          >
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, city or rider ID, then press Enter"
              className="pl-8"
              aria-label="Search riders"
            />
          </form>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="w-full md:w-44" aria-label="Filter riders">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="verified">Verified now</SelectItem>
              <SelectItem value="in_room">In a room</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data && rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={filtered ? 'No riders match' : 'No riders yet'}
              body={
                filtered
                  ? 'Loosen the filter or clear your search.'
                  : 'Riders show up here once they sign up in the app.'
              }
              action={
                filtered ? (
                  <Button variant="outline" size="sm" onClick={clear}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Rider</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Trip</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-12 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableSkeleton columns={COLUMNS} />
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={r.uid}
                    onClick={() => router.push(`/dashboard/riders/${r.uid}`)}
                    className="group cursor-pointer border-border/70 hover:bg-accent/50"
                  >
                    <TableCell>
                      <Link
                        href={`/dashboard/riders/${r.uid}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2.5"
                      >
                        <RiderAvatar name={r.displayName} seed={r.uid} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {r.displayName ?? <span className="text-muted-foreground">Profile not finished</span>}
                          </p>
                          <p className="max-w-[180px] truncate font-mono text-[10.5px] text-muted-foreground">
                            {r.uid}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.phoneNumber ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {r.homeCity ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <TripBadge state={r.validationState} />
                        {r.roomId ? <StatusBadge tone="info">In a room</StatusBadge> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.suspended ? (
                        <StatusBadge tone="destructive">Suspended</StatusBadge>
                      ) : (
                        <StatusBadge tone="success">Active</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <RowActionsTrigger label={`Actions for ${r.displayName ?? 'rider'}`} />
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Rider</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/riders/${r.uid}`)}>
                            <UserRound className="mr-2 h-4 w-4" /> View profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setForm({ rider: r })}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void copyText(r.uid, 'Rider ID')}>
                            <Copy className="mr-2 h-4 w-4" /> Copy rider ID
                          </DropdownMenuItem>
                          {r.phoneNumber ? (
                            <DropdownMenuItem onClick={() => void copyText(r.phoneNumber!, 'Phone number')}>
                              <Phone className="mr-2 h-4 w-4" /> Copy phone
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled={!isLive(r)} onClick={() => setKilling(r)}>
                            <Power className="mr-2 h-4 w-4" /> Kill session
                          </DropdownMenuItem>
                          {r.suspended ? (
                            <DropdownMenuItem
                              onClick={async () => {
                                if (await reinstateRider(r.uid)) await reload();
                              }}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" /> Reinstate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setSuspending(r)}
                            >
                              <Ban className="mr-2 h-4 w-4" /> Suspend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setBlockingDevice(r)}>
                            <Smartphone className="mr-2 h-4 w-4" /> Block device
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleting(r)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        <div className="border-t border-border px-3 py-2 font-mono text-[10.5px] text-muted-foreground">
          {data ? `${rows.length} of ${data.length} riders` : 'Loading riders…'}
        </div>
      </Panel>

      <ConfirmDialog
        open={suspending != null}
        onOpenChange={(open) => {
          if (!open) {
            setSuspending(null);
            setReason('');
          }
        }}
        title={`Suspend ${suspending?.displayName ?? 'this rider'}?`}
        description="They are signed out, removed from any room, their ride ends, and they can't use the app until you reinstate them."
        confirmLabel="Suspend rider"
        onConfirm={async () => {
          if (suspending && (await suspendRider(suspending.uid, reason.trim() || null))) await reload();
        }}
      >
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (internal, optional)"
          maxLength={500}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={killing != null}
        onOpenChange={(open) => !open && setKilling(null)}
        title={`Kill ${killing?.displayName ?? 'this rider'}'s session?`}
        description="Their current ride ends and they leave any room. They are not suspended and can start a new ride straight away."
        confirmLabel="Kill session"
        onConfirm={async () => {
          if (killing && (await endRide(killing.uid))) await reload();
        }}
      />

      <BlockDeviceDialog
        rider={blockingDevice}
        onOpenChange={(open) => !open && setBlockingDevice(null)}
        onDone={() => void reload()}
      />

      <DeleteRiderDialog
        rider={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={() => void reload()}
      />
    </div>
  );
}
