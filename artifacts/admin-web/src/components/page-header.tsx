'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertCircle, AlertTriangle, Inbox, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { navFor } from '@/lib/nav';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { STATE_LABELS } from '@/lib/api';

/** Console page heading: section number, display title and a one-line description. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  const index = navFor(usePathname())?.n;
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="eyebrow flex items-center gap-2">
          {index ? <span className="text-primary">{index}</span> : null}
          <span className="h-px w-6 bg-border" />
          RideShare Chats Ops
        </div>
        <h1 className="font-display mt-1.5 text-[30px] font-bold leading-none text-foreground md:text-[36px]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Number tile: mono label, big display number, optional hint. `accent` adds the red edge. */
export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative h-full overflow-hidden rounded-lg border bg-card p-4 shadow-[0_1px_2px_hsl(222_40%_20%/.04)]',
        accent ? 'border-primary/30' : 'border-border',
      )}
    >
      {accent ? <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" /> : null}
      <div className="flex items-start justify-between gap-2">
        <div className="eyebrow">{label}</div>
        {Icon ? (
          <Icon className={cn('h-4 w-4 shrink-0', accent ? 'text-primary' : 'text-muted-foreground/60')} />
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-[30px] w-16" />
      ) : (
        <div className="font-display tnum mt-2 text-[30px] font-bold leading-none">{value}</div>
      )}
      {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

/** Console panel: a card with a header row (optional mono eyebrow, title, action) and a body. */
export function Panel({
  title,
  eyebrow,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  eyebrow?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn('rounded-lg border border-border bg-card shadow-[0_1px_2px_hsl(222_40%_20%/.04)]', className)}
    >
      {title || action ? (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {eyebrow ? <div className="eyebrow mb-0.5">{eyebrow}</div> : null}
            {title ? <h2 className="truncate text-[14px] font-semibold">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Dashed, grid-textured placeholder for an empty list. */
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="grid-bg flex flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card">
        <Inbox className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 text-sm font-semibold">{title}</div>
      {body ? <p className="mt-1 max-w-xs text-xs text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        <span>{message}</span>
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/** Skeleton rows while a table loads. */
export function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <TableRow key={r}>
          {Array.from({ length: columns }, (_, c) => (
            <TableCell key={c}>
              <Skeleton className="h-4 w-full max-w-[160px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** A single full-width message row inside a table (no results, empty list). */
export function TableEmpty({ columns, message }: { columns: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={columns} className="p-3">
        <div className="grid-bg rounded-md border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          {message}
        </div>
      </TableCell>
    </TableRow>
  );
}

type Tone = 'success' | 'warning' | 'destructive' | 'secondary' | 'info' | 'outline';

export function stateTone(state: string | null | undefined): Tone {
  if (state === 'VERIFIED') return 'success';
  if (state === 'GRACE' || state === 'POST_RIDE') return 'warning';
  if (state === 'TERMINATED') return 'destructive';
  return 'secondary';
}

export function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <Badge variant={tone} className="font-medium">
      {children}
    </Badge>
  );
}

export function TripBadge({ state }: { state: string | null | undefined }) {
  if (!state) return <span className="text-muted-foreground">—</span>;
  return <StatusBadge tone={stateTone(state)}>{STATE_LABELS[state] ?? state}</StatusBadge>;
}

/** "⋯" trigger for a row's actions DropdownMenu. */
export function RowActionsTrigger({ label }: { label: string }) {
  return (
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={label}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
  );
}

/**
 * Confirmation for destructive admin actions. `onConfirm` may be async; the dialog stays open with
 * the button disabled until it finishes.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = true,
  confirmDisabled = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  /** e.g. until the admin types a confirmation word. */
  confirmDisabled?: boolean;
  onConfirm: () => Promise<void> | void;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {destructive ? (
            <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-md bg-accent text-primary">
              <AlertTriangle className="h-4 w-4" />
            </div>
          ) : null}
          <AlertDialogTitle className="font-display text-xl">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button disabled={busy || confirmDisabled} onClick={() => void confirm()}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const AVATAR_HUES = [353, 222, 205, 30, 168, 270, 12];

/** Console avatar: rounded square, photo if there is one, otherwise initials on a colour picked from the name. */
export function RiderAvatar({
  name,
  seed,
  url,
  size = 32,
}: {
  name: string | null | undefined;
  seed: string;
  url?: string | null;
  size?: number;
}) {
  const hue = AVATAR_HUES[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_HUES.length];
  if (url) {
    // Rider photos come from any host, so a plain <img> rather than next/image.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? ''}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-md object-cover ring-1 ring-border"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg,hsl(${hue} 60% 42%),hsl(${hue} 55% 26%))`,
      }}
      className="font-display inline-flex shrink-0 items-center justify-center rounded-md font-bold text-white"
    >
      {initials(name)}
    </span>
  );
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(/[\s_.@-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
