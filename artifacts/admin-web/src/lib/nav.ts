import { Flag, Gauge, LayoutGrid, Radio, ShieldAlert, Users, type LucideIcon } from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon; n: string };

/** Sidebar sections, numbered like the client's RideShare Console. */
export const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutGrid, n: '01' },
  { href: '/dashboard/riders', label: 'Rider Management', icon: Users, n: '02' },
  // Room Categories now lives here (room types section); /dashboard/categories redirects.
  { href: '/dashboard/settings', label: 'Trip Validation & Modes', icon: Gauge, n: '03' },
  { href: '/dashboard/rooms', label: 'Live R.O.O.M.s', icon: Radio, n: '04' },
  { href: '/dashboard/safety', label: 'Safety Alerts', icon: ShieldAlert, n: '05' },
  { href: '/dashboard/reports', label: 'Reports', icon: Flag, n: '06' },
];

export function isActive(item: NavItem, pathname: string): boolean {
  return item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
}

export function navFor(pathname: string): NavItem | undefined {
  return NAV.find((item) => isActive(item, pathname));
}
