'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Loader2, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { NAV, isActive, navFor } from '@/lib/nav';
import { cn, publicAsset } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';
import { initials } from '@/components/page-header';

/** Only the counts the sidebar shows (same /stats call the Overview page makes). */
type SidebarStats = { openReports: number; safetyAlerts24h: number; liveRooms: number };

function crumb(pathname: string): string {
  if (pathname.startsWith('/dashboard/riders/')) return 'rider management / rider';
  return (navFor(pathname)?.label ?? 'console').toLowerCase();
}

function ago(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

function Mark() {
  return (
    <div className="flex items-center gap-2.5">
      <Image src={publicAsset('/logo-mark.png')} alt="RideShare Chats logo" width={44} height={44} className="h-11 w-11 shrink-0 rounded-md bg-white object-contain p-0.5" priority />
      <div className="leading-none">
        <div className="font-display text-[15px] font-bold text-white">RideShare Chats</div>
        <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/45">Ops Console</div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const stats = useAdminQuery<SidebarStats>(user ? '/stats' : null, 30_000);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (stats.data) setSyncedAt(Date.now());
  }, [stats.data]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const page = pathname.startsWith('/dashboard/riders/') ? 'Rider' : (navFor(pathname)?.label ?? 'Console');
    document.title = `${page} · RideShare Chats Admin`;
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-muted-foreground" />
          <p className="eyebrow">Securing connection…</p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  const badge = (href: string): { value: number; loud: boolean } | null => {
    if (!stats.data) return null;
    if (href === '/dashboard/safety' && stats.data.safetyAlerts24h > 0) return { value: stats.data.safetyAlerts24h, loud: true };
    if (href === '/dashboard/reports' && stats.data.openReports > 0) return { value: stats.data.openReports, loud: true };
    if (href === '/dashboard/rooms' && stats.data.liveRooms > 0) return { value: stats.data.liveRooms, loud: false };
    return null;
  };
  const apiState = stats.loading && !stats.data ? 'checking' : stats.error ? 'unreachable' : 'connected';

  const nav = (
    <nav className="flex h-full flex-col overflow-y-auto bg-sidebar px-3 py-5">
      <div className="px-2">
        <Mark />
      </div>
      <div className="mt-8 px-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/35">Operations</div>
      <ul className="mt-2 space-y-0.5">
        {NAV.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;
          const count = badge(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] transition-colors',
                  active ? 'bg-sidebar-accent text-white' : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-white',
                )}
              >
                {active ? <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r bg-sidebar-primary" /> : null}
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-sidebar-primary' : 'text-white/40 group-hover:text-white/70')} />
                <span className="min-w-0 flex-1">{item.label}</span>
                {count ? (
                  <span
                    className={cn(
                      'tnum font-mono text-[10px]',
                      count.loud ? 'rounded bg-sidebar-primary px-1.5 font-semibold text-white' : 'text-white/45',
                    )}
                  >
                    {count.value}
                  </span>
                ) : (
                  <span className="font-mono text-[9.5px] text-white/20">{item.n}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto space-y-3 pt-6">
        <div className="space-y-1.5 rounded-md border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2 text-[11px] text-white/70">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                apiState === 'checking' ? 'bg-white/30' : apiState === 'connected' ? 'bg-emerald-400' : 'bg-sidebar-primary',
              )}
            />
            API {apiState}
          </div>
          {syncedAt ? <div className="font-mono text-[10px] text-white/40">Synced {ago(syncedAt, now)} / every 30s</div> : null}
        </div>

        <div className="flex items-center gap-2.5 rounded-md border border-white/10 bg-white/[0.03] p-2.5">
          <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[hsl(353_60%_42%)] to-[hsl(353_55%_26%)] text-[11px] font-bold text-white">
            {initials(user.displayName || user.email)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[12px] font-semibold text-white">{user.displayName || 'Administrator'}</div>
            <div className="truncate text-[10.5px] text-white/45">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground antialiased">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] lg:block">{nav}</aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[250px]">{nav}</div>
        </div>
      ) : null}

      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
          <button
            type="button"
            className="-ml-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
            console / <span className="text-foreground">{crumb(pathname)}</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
