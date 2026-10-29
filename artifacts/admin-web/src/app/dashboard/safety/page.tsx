'use client';

import { useRouter } from 'next/navigation';
import { Copy, ExternalLink, MapPin, UserRound } from 'lucide-react';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { formatDate } from '@/lib/api';
import { copyText } from '@/lib/rider-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorAlert, PageHeader, RowActionsTrigger, StatusBadge, TableEmpty, TableSkeleton, TripBadge } from '@/components/page-header';

type SafetyAlert = {
  id: string;
  uid: string;
  riderName: string;
  kind: 'share_status' | 'emergency';
  location: { lat: number; lng: number; accuracyM: number | null } | null;
  validationState: string | null;
  roomId: string | null;
  shareToken: string;
  createdAt: string | null;
};

const COLUMNS = 6;
const mapUrl = (l: { lat: number; lng: number }) => `https://www.google.com/maps?q=${l.lat},${l.lng}`;

export default function SafetyPage() {
  const router = useRouter();
  const { data, error, loading, reload } = useAdminQuery<SafetyAlert[]>('/safety-alerts', 30_000);

  return (
    <div className="space-y-6">
      <PageHeader title="Safety Alerts" description="Trip shares and emergency alerts riders sent to their trusted contacts." />
      {error ? <ErrorAlert message={error} onRetry={() => void reload()} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
          <CardDescription>
            {data ? `${data.length} alert${data.length === 1 ? '' : 's'} (latest 200) · ${data.filter((a) => a.kind === 'emergency').length} emergencies` : 'Loading…'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Rider</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Trip state</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="w-12 pr-6 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableSkeleton columns={COLUMNS} />
              ) : !data || data.length === 0 ? (
                <TableEmpty columns={COLUMNS} message="No safety alerts yet." />
              ) : (
                data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="pl-6 font-medium">{a.riderName}</TableCell>
                    <TableCell>
                      {a.kind === 'emergency' ? <StatusBadge tone="destructive">Emergency</StatusBadge> : <StatusBadge tone="secondary">Shared trip</StatusBadge>}
                    </TableCell>
                    <TableCell>
                      <TripBadge state={a.validationState} />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{a.roomId ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{formatDate(a.createdAt)}</TableCell>
                    <TableCell className="pr-6 text-right">
                      <DropdownMenu>
                        <RowActionsTrigger label={`Actions for ${a.riderName}'s alert`} />
                        <DropdownMenuContent align="end" className="w-52">
                          {a.location ? (
                            <DropdownMenuItem onClick={() => window.open(mapUrl(a.location!), '_blank', 'noopener')}>
                              <MapPin className="mr-2 h-4 w-4" /> Open on map
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onClick={() => window.open(`/api/share/${a.shareToken}`, '_blank', 'noopener')}>
                            <ExternalLink className="mr-2 h-4 w-4" /> Open live trip page
                          </DropdownMenuItem>
                          {a.location ? (
                            <DropdownMenuItem onClick={() => void copyText(`${a.location!.lat}, ${a.location!.lng}`, 'Coordinates')}>
                              <Copy className="mr-2 h-4 w-4" /> Copy coordinates
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/riders/${a.uid}`)}>
                            <UserRound className="mr-2 h-4 w-4" /> View rider
                          </DropdownMenuItem>
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
    </div>
  );
}
