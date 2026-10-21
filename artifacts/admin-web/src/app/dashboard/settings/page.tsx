'use client';

import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ErrorAlert, PageHeader, StatusBadge } from '@/components/page-header';

type Setting = {
  key: string;
  group: string;
  label: string;
  help: string;
  kind: 'number' | 'boolean';
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  default: number | boolean;
  value: number | boolean;
  source: 'panel' | 'default';
};

type SettingsResponse = { settings: Setting[] };

/** Display order and one-line descriptions of the sections. */
const GROUPS: { name: string; description: string }[] = [
  { name: 'Speed', description: 'When a ride counts as moving or stopped.' },
  { name: 'Timing', description: 'Grace period, post-ride extension and other timers.' },
  { name: 'Score', description: 'The 0–100 score and how the three sensor modules are weighted.' },
  { name: 'Rooms', description: 'Room behaviour tied to riders’ trips.' },
  { name: 'Vibration', description: 'How phone vibration is read as a car (10–25 Hz band).' },
  { name: 'Ground truth', description: 'The phone’s in-vehicle detection and the Google Roads check.' },
  { name: 'Anti-spoofing', description: 'Fake GPS, teleporting and emulator protection.' },
  { name: 'Advanced scoring', description: 'Fine tuning — change only with real-ride data.' },
];

/** Draft entry: text for numbers (so fields can be cleared while typing), boolean, or null = reset. */
type Draft = Record<string, string | boolean | null>;

export default function ValidationSettingsPage() {
  const { data, error, loading, reload } = useAdminQuery<SettingsResponse>('/settings/validation');
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft({}), [data]);

  const byGroup = useMemo(() => {
    const map = new Map<string, Setting[]>();
    for (const s of data?.settings ?? []) map.set(s.group, [...(map.get(s.group) ?? []), s]);
    return GROUPS.filter((g) => map.has(g.name)).map((g) => ({ ...g, settings: map.get(g.name)! }));
  }, [data]);

  const changedCount = data?.settings.filter((s) => s.source === 'panel').length ?? 0;
  const dirtyCount = Object.keys(draft).length;

  const save = async () => {
    const values: Record<string, number | boolean | null> = {};
    for (const [key, raw] of Object.entries(draft)) {
      const meta = data?.settings.find((s) => s.key === key);
      if (raw === null || typeof raw === 'boolean') {
        values[key] = raw;
        continue;
      }
      const n = Number(raw);
      if (raw.trim() === '' || !Number.isFinite(n)) {
        toast.error(`${meta?.label ?? key}: enter a number.`);
        return;
      }
      values[key] = n;
    }
    setSaving(true);
    try {
      await adminApi('/settings/validation', { method: 'PUT', body: { values } });
      toast.success('Saved. Rides use the new settings straight away.');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-5xl pb-20">
        <PageHeader
          title="Trip Validation"
          description="Every threshold the server uses to verify rides. Managed only here — not in .env. Changes apply within a minute, with no app update or restart."
          actions={changedCount > 0 ? <StatusBadge tone="info">{changedCount} changed from default</StatusBadge> : undefined}
        />
        {error ? <ErrorAlert message={error} onRetry={() => void reload()} /> : null}
        {loading && !data ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-48 w-full" />) : null}

        {byGroup.map((group) => (
          <Card key={group.name}>
            <CardHeader>
              <CardTitle>{group.name}</CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {group.settings.map((s) => {
                const edited = s.key in draft;
                const raw = draft[s.key];
                const shownNumber = edited ? (raw === null ? String(s.default) : String(raw)) : String(s.value);
                const shownBool = edited ? (raw === null ? Boolean(s.default) : Boolean(raw)) : Boolean(s.value);
                const id = `setting-${s.key}`;
                return (
                  <div key={s.key} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor={id} className="text-sm font-medium">
                          {s.label}
                        </Label>
                        {edited ? (
                          <StatusBadge tone="warning">Unsaved</StatusBadge>
                        ) : s.source === 'panel' ? (
                          <StatusBadge tone="info">Changed</StatusBadge>
                        ) : (
                          <StatusBadge tone="outline">Default</StatusBadge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{s.help}</p>
                      <p className="text-xs text-muted-foreground">
                        Default {String(s.default)}
                        {s.unit ? ` ${s.unit}` : ''}
                        {s.min != null && s.max != null ? ` · allowed ${s.min}–${s.max}` : ''} · <span className="font-mono">{s.key}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.kind === 'boolean' ? (
                        <Switch id={id} checked={shownBool} onCheckedChange={(checked) => setDraft((d) => ({ ...d, [s.key]: checked }))} />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            id={id}
                            type="number"
                            inputMode="decimal"
                            value={shownNumber}
                            min={s.min}
                            max={s.max}
                            step={s.step}
                            onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                            className="w-28"
                          />
                          <span className="w-8 text-sm text-muted-foreground">{s.unit ?? ''}</span>
                        </div>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Reset ${s.label} to default`}
                            disabled={s.source !== 'panel' && !edited}
                            onClick={() =>
                              setDraft((d) => {
                                if (s.source === 'panel') return { ...d, [s.key]: null };
                                const next = { ...d };
                                delete next[s.key];
                                return next;
                              })
                            }
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reset to default</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}

        {dirtyCount > 0 ? (
          <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
            <Card className="shadow-lg">
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <span className="text-sm">
                  {dirtyCount} unsaved change{dirtyCount === 1 ? '' : 's'}
                </span>
                <Button variant="outline" size="sm" disabled={saving} onClick={() => setDraft({})}>
                  Discard
                </Button>
                <Button size="sm" disabled={saving} onClick={() => void save()}>
                  <Save className="mr-1.5 h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
