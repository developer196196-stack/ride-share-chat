'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Lock, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi, formatDate, VIBE_LABELS } from '@/lib/api';
import { copyText } from '@/lib/rider-actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog, ErrorAlert, initials, PageHeader, RowActionsTrigger, StatusBadge, TableEmpty, TableSkeleton } from '@/components/page-header';

type Member = { uid: string; displayName: string; photoUrl: string | null; isHost: boolean };
type Room = {
  roomId: string;
  vibe: string;
  hostUid: string | null;
  matching: 'auto' | 'manual';
  locked: boolean;
  createdAt: string;
  members: Member[];
};

const COLUMNS = 7;

function MemberAvatar({ m, size = 'h-7 w-7' }: { m: Member; size?: string }) {
  return (
    <Avatar className={`${size} border-2 border-background`}>
      {m.photoUrl ? <AvatarImage src={m.photoUrl} alt={m.displayName} /> : null}
      <AvatarFallback className="text-[10px]">{initials(m.displayName)}</AvatarFallback>
    </Avatar>
  );
}

export default function RoomsPage() {
  const { data, error, loading, reload } = useAdminQuery<Room[]>('/rooms', 10_000);
  const [viewing, setViewing] = useState<Room | null>(null);
  const [closing, setClosing] = useState<Room | null>(null);

  const close = async (room: Room) => {
    try {
      const res = await adminApi<{ removed: number }>(`/rooms/${room.roomId}/close`, { method: 'POST', body: {} });
      toast.success(`Room closed — ${res.removed} rider${res.removed === 1 ? '' : 's'} sent back to the room grid.`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not close the room.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Live Rooms" description="Every R.O.O.M. with riders in it right now. Refreshes every 10 seconds." />
      {error ? <ErrorAlert message={error} onRetry={() => void reload()} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Rooms</CardTitle>
          <CardDescription>
            {data ? `${data.length} live room${data.length === 1 ? '' : 's'} · ${data.reduce((a, r) => a + r.members.length, 0)} riders` : 'Loading…'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Room</TableHead>
                <TableHead>Mood</TableHead>
                <TableHead>Riders</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead className="w-12 pr-6 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableSkeleton columns={COLUMNS} rows={3} />
              ) : !data || data.length === 0 ? (
                <TableEmpty columns={COLUMNS} message="No live rooms right now." />
              ) : (
                data.map((room) => {
                  const host = room.members.find((m) => m.isHost);
                  return (
                    <TableRow key={room.roomId} className="cursor-pointer" onClick={() => setViewing(room)}>
                      <TableCell className="pl-6 font-mono font-medium">{room.roomId}</TableCell>
                      <TableCell>
                        <StatusBadge tone="info">{VIBE_LABELS[room.vibe] ?? room.vibe}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {room.members.slice(0, 5).map((m) => (
                              <MemberAvatar key={m.uid} m={m} />
                            ))}
                          </div>
                          <span className="text-sm text-muted-foreground">{room.members.length}</span>
                        </div>
                      </TableCell>
                      <TableCell>{host?.displayName ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {room.locked ? (
                            <StatusBadge tone="warning">
                              <Lock className="mr-1 h-3 w-3" /> Locked
                            </StatusBadge>
                          ) : null}
                          {room.matching === 'manual' ? <StatusBadge tone="warning">Manual</StatusBadge> : null}
                          {!room.locked && room.matching === 'auto' ? <StatusBadge tone="success">Open</StatusBadge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{formatDate(room.createdAt)}</TableCell>
                      <TableCell className="pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <RowActionsTrigger label={`Actions for ${room.roomId}`} />
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => setViewing(room)}>
                              <Users className="mr-2 h-4 w-4" /> View riders
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void copyText(room.roomId, 'Room ID')}>
                              <Copy className="mr-2 h-4 w-4" /> Copy room ID
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setClosing(room)}>
                              <XCircle className="mr-2 h-4 w-4" /> Close room
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={viewing != null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">{viewing?.roomId}</DialogTitle>
            <DialogDescription>
              {viewing ? `${VIBE_LABELS[viewing.vibe] ?? viewing.vibe} · ${viewing.members.length} rider${viewing.members.length === 1 ? '' : 's'}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y">
            {viewing?.members.map((m) => (
              <Link key={m.uid} href={`/dashboard/riders/${m.uid}`} className="flex items-center gap-3 py-2.5 hover:bg-accent rounded-md px-2">
                <MemberAvatar m={m} size="h-8 w-8" />
                <span className="font-medium flex-1">{m.displayName}</span>
                {m.isHost ? <StatusBadge tone="info">Host</StatusBadge> : null}
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={closing != null}
        onOpenChange={(open) => !open && setClosing(null)}
        title={`Close ${closing?.roomId ?? 'this room'}?`}
        description="Everyone in the room is removed and told a moderator closed it. Their rides continue, so they can join other rooms."
        confirmLabel="Close room"
        onConfirm={async () => {
          if (closing) await close(closing);
        }}
      />
    </div>
  );
}
