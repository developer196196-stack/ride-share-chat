'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, CheckCircle2, Eye, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi, formatDate } from '@/lib/api';
import { suspendRider } from '@/lib/rider-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog, ErrorAlert, PageHeader, RowActionsTrigger, StatusBadge, TableEmpty, TableSkeleton } from '@/components/page-header';

type Report = {
  id: string;
  source: 'rider_report' | 'host_flag';
  reason: string;
  details: string | null;
  status: 'open' | 'reviewed';
  roomId: string | null;
  reporterUid: string;
  reporterName: string | null;
  reportedUid: string | null;
  reportedName: string | null;
  recentMessages: { senderId: string; text: string; sentAt: string }[];
  createdAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
};

type Filter = 'open' | 'reviewed' | 'all';
const COLUMNS = 7;
const reasonLabel = (reason: string) => reason.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function ReportDetailsDialog({ report, onClose, onReviewed }: { report: Report | null; onClose: () => void; onReviewed: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!report) return null;

  const review = async () => {
    setBusy(true);
    try {
      await adminApi(`/reports/${report.id}/review`, { method: 'POST', body: { note: note.trim() || null } });
      toast.success('Report marked as reviewed.');
      setNote('');
      onReviewed();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the report.');
    } finally {
      setBusy(false);
    }
  };

  const speaker = (uid: string) => {
    if (uid === report.reportedUid) return report.reportedName ?? 'Reported rider';
    if (uid === report.reporterUid) return report.reporterName ?? 'Reporter';
    return 'Rider';
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{reasonLabel(report.reason)}</DialogTitle>
          <DialogDescription>
            {report.source === 'host_flag' ? 'Silent flag from the room host' : 'Rider report'} · {formatDate(report.createdAt)}
            {report.roomId ? ` · ${report.roomId}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Reported</p>
              <p className="font-medium">{report.reportedName ?? 'The room'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reported by</p>
              <p className="font-medium">{report.reporterName ?? report.reporterUid}</p>
            </div>
          </div>
          {report.details ? <p className="rounded-md bg-muted p-3">{report.details}</p> : null}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Room chat before the report</p>
            {report.recentMessages.length === 0 ? (
              <p className="text-muted-foreground">No chat messages.</p>
            ) : (
              <div className="rounded-md border p-3 space-y-1.5 max-h-60 overflow-y-auto">
                {report.recentMessages.map((m, i) => (
                  <p key={i}>
                    <span className={m.senderId === report.reportedUid ? 'font-semibold text-primary' : 'font-semibold'}>{speaker(m.senderId)}:</span> {m.text}
                  </p>
                ))}
              </div>
            )}
          </div>
          {report.status === 'open' ? (
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Review note (optional)" maxLength={1000} />
          ) : (
            <p className="text-muted-foreground">
              Reviewed {formatDate(report.reviewedAt)}
              {report.reviewedBy ? ` by ${report.reviewedBy}` : ''}
              {report.reviewNote ? ` — ${report.reviewNote}` : ''}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {report.reportedUid ? (
            <Button variant="outline" asChild>
              <Link href={`/dashboard/riders/${report.reportedUid}`}>Open reported rider</Link>
            </Button>
          ) : null}
          {report.status === 'open' ? (
            <Button disabled={busy} onClick={() => void review()}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> {busy ? 'Saving…' : 'Mark reviewed'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('open');
  const [viewing, setViewing] = useState<Report | null>(null);
  const [suspending, setSuspending] = useState<Report | null>(null);
  const { data, error, loading, reload } = useAdminQuery<Report[]>(`/reports?status=${filter}`, 30_000);

  const quickReview = async (r: Report) => {
    try {
      await adminApi(`/reports/${r.id}/review`, { method: 'POST', body: {} });
      toast.success('Report marked as reviewed.');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the report.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Rider reports and silent host flags, with the room chat for context." />
      {error ? <ErrorAlert message={error} onRetry={() => void reload()} /> : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>Trust &amp; Safety queue</CardTitle>
            <CardDescription>{data ? `${data.length} ${filter === 'all' ? 'reports' : filter}` : 'Loading…'}</CardDescription>
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Reported</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Reported by</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 pr-6 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableSkeleton columns={COLUMNS} />
              ) : !data || data.length === 0 ? (
                <TableEmpty columns={COLUMNS} message={filter === 'open' ? 'No open reports. 🎉' : 'No reports here.'} />
              ) : (
                data.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setViewing(r)}>
                    <TableCell className="pl-6 font-medium">{r.reportedName ?? <span className="text-muted-foreground">The room</span>}</TableCell>
                    <TableCell>
                      <p>{reasonLabel(r.reason)}</p>
                      {r.details ? <p className="text-xs text-muted-foreground truncate max-w-[220px]">{r.details}</p> : null}
                    </TableCell>
                    <TableCell>
                      {r.source === 'host_flag' ? <StatusBadge tone="info">Host flag</StatusBadge> : <StatusBadge tone="secondary">Rider report</StatusBadge>}
                    </TableCell>
                    <TableCell>{r.reporterName ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{formatDate(r.createdAt)}</TableCell>
                    <TableCell>{r.status === 'open' ? <StatusBadge tone="warning">Open</StatusBadge> : <StatusBadge tone="success">Reviewed</StatusBadge>}</TableCell>
                    <TableCell className="pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <RowActionsTrigger label="Report actions" />
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => setViewing(r)}>
                            <Eye className="mr-2 h-4 w-4" /> View details &amp; chat
                          </DropdownMenuItem>
                          {r.status === 'open' ? (
                            <DropdownMenuItem onClick={() => void quickReview(r)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Mark reviewed
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          {r.reportedUid ? (
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/riders/${r.reportedUid}`)}>
                              <UserRound className="mr-2 h-4 w-4" /> Open reported rider
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/riders/${r.reporterUid}`)}>
                            <UserRound className="mr-2 h-4 w-4" /> Open reporter
                          </DropdownMenuItem>
                          {r.reportedUid ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setSuspending(r)}>
                                <Ban className="mr-2 h-4 w-4" /> Suspend reported rider
                              </DropdownMenuItem>
                            </>
                          ) : null}
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

      <ReportDetailsDialog report={viewing} onClose={() => setViewing(null)} onReviewed={() => void reload()} />
      <ConfirmDialog
        open={suspending != null}
        onOpenChange={(open) => !open && setSuspending(null)}
        title={`Suspend ${suspending?.reportedName ?? 'this rider'}?`}
        description="They are signed out, removed from any room, their ride ends, and they can't use the app until you reinstate them. The report stays open until you review it."
        confirmLabel="Suspend rider"
        onConfirm={async () => {
          if (suspending?.reportedUid) await suspendRider(suspending.reportedUid, `Report: ${reasonLabel(suspending.reason)}`);
        }}
      />
    </div>
  );
}
