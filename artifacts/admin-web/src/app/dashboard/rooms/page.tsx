'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Copy, Lock, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi, VIBE_LABELS } from '@/lib/api';
import { copyText } from '@/lib/rider-actions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ConfirmDialog,
  EmptyState,
  ErrorAlert,
  PageHeader,
  Panel,
  RiderAvatar,
  StatusBadge,
} from '@/components/page-header';

type Member = { uid: string; displayName: string; photoUrl: string | null; isHost: boolean };
type Room = {
  roomId: string;
  vibe: string;
  hostUid: string | null;
  matching: 'auto' | 'manual';
  locked: boolean;
  createdAt: string;
  /** Transit mode time limit (Max room); null = no limit. */
  closesAt: string | null;
  members: Member[];
};
type Catalog = {
  groups: { id: string; label: string; color: string; active: boolean; maxRoomMinutes: number }[];
  types: { id: string; groupId: string; label: string; active: boolean }[];
};

/** "07:42" or "1:07:42". */
function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export default function LiveRoomsPage() {
  const { data, error, loading, reload } = useAdminQuery<Room[]>('/rooms', 10_000);
  const catalog = useAdminQuery<Catalog>('/settings/room-categories');
  const now = useNow(1_000);
  const [topic, setTopic] = useState('all');
  const [viewing, setViewing] = useState<Room | null>(null);
  const [closing, setClosing] = useState<Room | null>(null);

  const typeLabel = (id: string) => catalog.data?.types.find((t) => t.id === id)?.label ?? VIBE_LABELS[id] ?? id;
  const modeOf = (id: string) => {
    const groupId = catalog.data?.types.find((t) => t.id === id)?.groupId;
    return catalog.data?.groups.find((g) => g.id === groupId) ?? null;
  };

  const liveByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of data ?? []) map.set(r.vibe, (map.get(r.vibe) ?? 0) + 1);
    return map;
  }, [data]);
  // Chips: every visible room type, plus any type that has live rooms while hidden.
  const topics = (catalog.data?.types ?? []).filter((t) => t.active || liveByType.has(t.id));
  const rooms = (data ?? []).filter((r) => topic === 'all' || r.vibe === topic);
  const riders = (data ?? []).reduce((a, r) => a + r.members.length, 0);

  const close = async (room: Room) => {
    try {
      const res = await adminApi<{ removed: number }>(`/rooms/${room.roomId}/close`, { method: 'POST', body: {} });
      toast.success(`Room closed — ${res.removed} rider${res.removed === 1 ? '' : 's'} sent back to the room grid.`);
      setViewing(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not close the room.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live R.O.O.M.s"
        description="Riders on open mics right now. Rooms with a transit mode time limit count down to closing. Refreshes every 10 seconds."
      />
      {error ? <ErrorAlert message={error} onRetry={() => void reload()} /> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {/* Topic filter */}
          <div className="flex flex-wrap gap-1.5">
            {[{ id: 'all', label: 'All topics' }, ...topics].map((t) => {
              const count = t.id === 'all' ? (data?.length ?? 0) : (liveByType.get(t.id) ?? 0);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTopic(t.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    topic === t.id
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                  {count > 0 ? <span className="tnum ml-1.5 font-mono text-[10px] opacity-70">{count}</span> : null}
                </button>
              );
            })}
          </div>

          {loading && !data ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <EmptyState
              title={topic === 'all' ? 'No live rooms right now' : 'No rooms in this topic'}
              body={
                topic === 'all'
                  ? 'Rooms appear here as soon as riders host or join one.'
                  : 'Pick another topic, or All topics.'
              }
            />
          ) : (
            <div className="rise grid gap-3 md:grid-cols-2">
              {rooms.map((room) => (
                <RoomCard
                  key={room.roomId}
                  room={room}
                  now={now}
                  label={typeLabel(room.vibe)}
                  mode={modeOf(room.vibe)}
                  onOpen={() => setViewing(room)}
                  onClose={() => setClosing(room)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <Panel eyebrow="Right now" title="Live summary">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Rooms', value: data?.length ?? 0 },
                { label: 'Riders', value: riders },
                { label: 'Open seats', value: (data ?? []).reduce((a, r) => a + Math.max(0, 6 - r.members.length), 0) },
              ].map((s) => (
                <div key={s.label} className="rounded-md bg-secondary px-2 py-3">
                  <div className="font-display tnum text-2xl font-bold leading-none">{data ? s.value : '–'}</div>
                  <div className="eyebrow mt-1.5">{s.label}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            eyebrow="Topics"
            title="R.O.O.M. categories"
            action={
              <Link
                href="/dashboard/settings#room-types"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Manage <ArrowRight className="h-3 w-3" />
              </Link>
            }
            bodyClassName="p-2"
          >
            {catalog.data ? (
              <div className="space-y-2">
                {catalog.data.groups.map((g) => {
                  const types = catalog.data!.types.filter(
                    (t) => t.groupId === g.id && (t.active || liveByType.has(t.id)),
                  );
                  if (types.length === 0) return null;
                  return (
                    <div key={g.id}>
                      <div className="flex items-center gap-2 px-2 pb-1 pt-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                        <span className="eyebrow">{g.label}</span>
                      </div>
                      <ul>
                        {types.map((t) => {
                          const live = liveByType.get(t.id) ?? 0;
                          return (
                            <li key={t.id}>
                              <button
                                type="button"
                                onClick={() => setTopic(t.id)}
                                className={cn(
                                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-secondary',
                                  topic === t.id && 'bg-secondary',
                                )}
                              >
                                <span className={cn('flex-1', !t.active && 'text-muted-foreground')}>{t.label}</span>
                                {!t.active ? <StatusBadge tone="outline">Hidden</StatusBadge> : null}
                                <span
                                  className={cn(
                                    'tnum font-mono text-[10.5px]',
                                    live > 0 ? 'text-primary' : 'text-muted-foreground',
                                  )}
                                >
                                  {live} live
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Skeleton className="m-2 h-60" />
            )}
          </Panel>
        </div>
      </div>

      {/* Riders in a room */}
      <Dialog open={viewing != null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{viewing ? typeLabel(viewing.vibe) : ''}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {viewing
                ? `${viewing.roomId} · ${viewing.members.length} rider${viewing.members.length === 1 ? '' : 's'}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-border">
            {viewing?.members.map((m) => (
              <Link
                key={m.uid}
                href={`/dashboard/riders/${m.uid}`}
                className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-secondary"
              >
                <RiderAvatar name={m.displayName} seed={m.uid} url={m.photoUrl} size={32} />
                <span className="flex-1 font-medium">{m.displayName}</span>
                {m.isHost ? <StatusBadge tone="info">Host</StatusBadge> : null}
              </Link>
            ))}
          </div>
          <div className="flex justify-between gap-2 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={() => viewing && void copyText(viewing.roomId, 'Room ID')}>
              <Copy className="h-3.5 w-3.5" /> Copy room ID
            </Button>
            <Button variant="destructive" size="sm" onClick={() => viewing && setClosing(viewing)}>
              <XCircle className="h-3.5 w-3.5" /> Close room
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={closing != null}
        onOpenChange={(open) => !open && setClosing(null)}
        title={`Close ${closing ? typeLabel(closing.vibe) : 'this room'}?`}
        description={`All ${closing?.members.length ?? ''} riders are removed and told a moderator closed it. Their rides continue, so they can join other rooms.`}
        confirmLabel="Close room"
        onConfirm={async () => {
          if (closing) await close(closing);
        }}
      />
    </div>
  );
}

function RoomCard({
  room,
  now,
  label,
  mode,
  onOpen,
  onClose,
}: {
  room: Room;
  now: number;
  label: string;
  mode: Catalog['groups'][number] | null;
  onOpen: () => void;
  onClose: () => void;
}) {
  const host = room.members.find((m) => m.isHost);
  const opened = Date.parse(room.createdAt);
  const closes = room.closesAt ? Date.parse(room.closesAt) : null;
  const left = closes != null ? closes - now : null;
  const pct =
    closes != null && closes > opened ? Math.max(0, Math.min(100, ((closes - now) / (closes - opened)) * 100)) : null;
  const endingSoon = left != null && left <= 2 * 60_000;

  return (
    <article
      onClick={onOpen}
      className="cursor-pointer rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-[0_8px_24px_-12px_hsl(222_40%_20%/.25)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone="destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> Live
            </StatusBadge>
            {room.locked ? (
              <StatusBadge tone="warning">
                <Lock className="h-3 w-3" /> Locked
              </StatusBadge>
            ) : null}
            {room.matching === 'manual' ? <StatusBadge tone="warning">Manual</StatusBadge> : null}
            <span className="font-mono text-[10.5px] text-muted-foreground">{room.roomId}</span>
          </div>
          <h3 className="font-display mt-1.5 truncate text-lg font-bold">{label}</h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {mode ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: mode.color }} /> : null}
            {mode?.label ?? 'Room'}
          </div>
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          Close
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex -space-x-1.5">
          {room.members.slice(0, 5).map((m) => (
            <span key={m.uid} className="rounded-md ring-2 ring-card">
              <RiderAvatar name={m.displayName} seed={m.uid} url={m.photoUrl} size={24} />
            </span>
          ))}
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {room.members.length}/6
        </span>
        {host ? (
          <span className="ml-auto truncate text-[11px] text-muted-foreground">host {host.displayName}</span>
        ) : null}
      </div>

      <div className="mt-3">
        {left != null && pct != null ? (
          <>
            <div className="flex justify-between font-mono text-[10.5px]">
              <span className="text-muted-foreground">Closes in · {mode?.maxRoomMinutes ?? ''} min limit</span>
              <span className={cn('tnum', endingSoon && 'font-semibold text-primary')}>
                {left > 0 ? clock(left) : 'closing…'}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-1000 ease-linear',
                  endingSoon ? 'bg-primary' : 'bg-foreground',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : (
          <div className="flex justify-between font-mono text-[10.5px] text-muted-foreground">
            <span>Open for · no time limit</span>
            <span className="tnum text-foreground">{clock(now - opened)}</span>
          </div>
        )}
      </div>
    </article>
  );
}
