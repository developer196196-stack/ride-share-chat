'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronRight,
  ChevronsUpDown,
  Gauge,
  LayoutDashboard,
  Loader2,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Toaster } from '@/components/ui/sonner';
import { ThemeToggle } from '@/components/theme-toggle';

const MENU = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Riders', href: '/dashboard/riders', icon: Users },
  { name: 'Trip Validation', href: '/dashboard/settings', icon: Gauge },
];

function breadcrumb(pathname: string): string {
  if (pathname.startsWith('/dashboard/riders/')) return 'Rider';
  return MENU.find((m) => m.href === pathname)?.name ?? 'Dashboard';
}

function initials(name?: string | null): string {
  if (!name) return 'AD';
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-2" />
          <p className="text-[10px] font-semibold tracking-wider uppercase">Securing connection…</p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen bg-background text-foreground font-sans antialiased overflow-hidden">
        <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
          <SidebarHeader className="border-b border-border/50 py-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild className="hover:bg-transparent">
                  <div className="flex items-center space-x-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/5">
                      <ShieldCheck className="h-5 w-5 stroke-[2]" />
                    </div>
                    <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                      <span className="font-semibold text-xs tracking-tight text-foreground">Rideshare Chats</span>
                      <span className="text-[9px] text-muted-foreground font-medium">Admin Console</span>
                    </div>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {MENU.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild tooltip={item.name} isActive={isActive}>
                          <Link href={item.href} className="flex items-center">
                            <Icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-border/50 py-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                      <Avatar className="h-7 w-7 rounded-lg">
                        <AvatarFallback className="rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold uppercase">
                          {initials(user.displayName || user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden">
                        <span className="truncate font-semibold text-foreground">{user.displayName || 'Administrator'}</span>
                        <span className="truncate text-[10px] text-muted-foreground">{user.email}</span>
                      </div>
                      <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="min-w-56" side="right" align="end" sideOffset={4}>
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void logout()} className="cursor-pointer text-xs gap-2.5 py-2">
                      <LogOut className="h-3.5 w-3.5" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col flex-1 overflow-hidden bg-background">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/40 backdrop-blur-md px-6 sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground hover:bg-accent" />
              <Separator orientation="vertical" className="h-4 bg-border" />
              <div className="flex items-center space-x-2 text-[11px] font-medium text-muted-foreground select-none">
                <span>Console</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground font-semibold">{breadcrumb(pathname)}</span>
              </div>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto p-6 w-full bg-background text-foreground">{children}</main>
        </SidebarInset>
      </div>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  );
}
