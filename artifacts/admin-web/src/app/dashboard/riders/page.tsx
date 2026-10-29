'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, Copy, Phone, RotateCcw, Search, UserRound } from 'lucide-react';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { formatDate } from '@/lib/api';
import { copyText, reinstateRider, suspendRider } from '@/lib/rider-actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  ConfirmDialog,
  ErrorAlert,
  initials,
  PageHeader,
  RowActionsTrigger,
  StatusBadge,
  TableEmpty,
  TableSkeleton,
  TripBadge,
} from '@/components/page-header';

type Rider = {
  uid: string;
  displayName: string | null;
  phoneNumber: string | null;
  homeCity: string | null;
  rideStyle: string | null;
  profileComplete: boolean;
  suspended: boolean;
  createdAt: string | null;
  validationState: string | null;
  roomId: string | null;
};

type Filter = 'all' | 'active' | 'suspended' | 'in_room' | 'verified';
const COLUMNS = 7;

export default function RidersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [suspending, setSuspending] = useState<Rider | null>(null);
  const [reason, setReason] = useState('');
  const { data, error, loading, reload } = useAdminQuery<Rider[]>(`/users${applied ? `?search=${encodeURIComponent(applied)}` : ''}`, 30_000);

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

  return (
    <div className="space-y-6">
      <PageHeader title="Riders" description="Everyone who signed up, newest first (up to 500)." />
      {error ? <ErrorAlert message={error} onRetry={() => void reload()} /> : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>All riders</CardTitle>
            <CardDescription>
              {data ? `${rows.length} of ${data.length} shown` : 'Loading…'} · search by name, phone, city or ID
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setApplied(search.trim());
              }}
              className="relative"
            >
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search riders…" className="pl-8 w-full sm:w-64" />
            </form>
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All riders</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="verified">Verified now</SelectItem>
                <SelectItem value="in_room">In a room</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Rider</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Trip</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-12 pr-6 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableSkeleton columns={COLUMNS} />
              ) : rows.length === 0 ? (
                <TableEmpty columns={COLUMNS} message={applied || filter !== 'all' ? 'No riders match.' : 'No riders yet.'} />
              ) : (
                rows.map((r) => (
                  <TableRow key={r.uid}>
                    <TableCell className="pl-6">
                      <Link href={`/dashboard/riders/${r.uid}`} className="flex items-center gap-3 group">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{initials(r.displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium group-hover:underline underline-offset-2 truncate">
                            {r.displayName ?? <span className="text-muted-foreground">Profile not finished</span>}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">{r.uid}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{r.phoneNumber ?? '—'}</TableCell>
                    <TableCell>{r.homeCity ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <TripBadge state={r.validationState} />
                        {r.roomId ? <StatusBadge tone="info">In a room</StatusBadge> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.suspended ? <StatusBadge tone="destructive">Suspended</StatusBadge> : <StatusBadge tone="success">Active</StatusBadge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{formatDate(r.createdAt)}</TableCell>
                    <TableCell className="pr-6 text-right">
                      <DropdownMenu>
                        <RowActionsTrigger label={`Actions for ${r.displayName ?? 'rider'}`} />
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Rider</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/riders/${r.uid}`)}>
                            <UserRound className="mr-2 h-4 w-4" /> View profile
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
                          {r.suspended ? (
                            <DropdownMenuItem onClick={async () => { if (await reinstateRider(r.uid)) await reload(); }}>
                              <RotateCcw className="mr-2 h-4 w-4" /> Reinstate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setSuspending(r)}>
                              <Ban className="mr-2 h-4 w-4" /> Suspend
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (internal, optional)" maxLength={500} />
      </ConfirmDialog>
    </div>
  );
}
