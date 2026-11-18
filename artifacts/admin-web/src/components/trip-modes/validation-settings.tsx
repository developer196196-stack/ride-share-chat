'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/page-header';

export type Setting = {
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

export type SettingsResponse = { settings: Setting[] };

/** Draft entry: text for numbers (so fields can be cleared while typing), boolean, or null = reset. */
export type SettingsDraft = Record<string, string | boolean | null>;

/** Display order and one-line descriptions of the sections. */
const GROUPS: { name: string; description: string }[] = [
  { name: 'Speed', description: 'When a ride counts as moving or stopped.' },
  { name: 'Timing', description: 'Grace period, post-ride extension and other timers.' },
  { name: 'Score', description: 'The 0–100 score and how the three sensor modules are weighted.' },
  { name: 'Rooms', description: 'Room behaviour tied to riders’ trips.' },
  { name: 'Vibration', description: 'How phone vibration is read as a vehicle (10–25 Hz band).' },
  { name: 'Ground truth', description: 'The phone’s in-vehicle detection and the Google Roads check.' },
  { name: 'Anti-spoofing', description: 'Fake GPS, teleporting and emulator protection.' },
  { name: 'Advanced scoring', description: 'Fine tuning — change only with real-ride data.' },
];

/** The value shown for a setting: the draft if edited (null = back to default), else the saved value. */
export function shownValue(s: Setting, draft: SettingsDraft): string | boolean {
  if (!(s.key in draft)) return s.kind === 'boolean' ? Boolean(s.value) : String(s.value);
  const raw = draft[s.key];
  if (raw === null) return s.kind === 'boolean' ? Boolean(s.default) : String(s.default);
  return raw as string | boolean;
}

/** PUT /settings/validation body, or the first problem to show. */
export function settingsPayload(
  draft: SettingsDraft,
  settings: Setting[],
): { values: Record<string, number | boolean | null> } | { error: string } {
  const values: Record<string, number | boolean | null> = {};
  for (const [key, raw] of Object.entries(draft)) {
    const meta = settings.find((s) => s.key === key);
    if (raw === null || typeof raw === 'boolean') {
      values[key] = raw;
      continue;
    }
    const n = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(n)) return { error: `${meta?.label ?? key}: enter a number.` };
    values[key] = n;
  }
  return { values };
}

/** All 33 settings in their groups (closed by default; the sliders above cover the main ones). */
export function AdvancedCalibration({
  settings,
  draft,
  setDraft,
}: {
  settings: Setting[];
  draft: SettingsDraft;
  setDraft: React.Dispatch<React.SetStateAction<SettingsDraft>>;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const byGroup = useMemo(() => {
    const map = new Map<string, Setting[]>();
    for (const s of settings) map.set(s.group, [...(map.get(s.group) ?? []), s]);
    return GROUPS.filter((g) => map.has(g.name)).map((g) => ({ ...g, settings: map.get(g.name)! }));
  }, [settings]);

  return (
    <div className="divide-y divide-border">
      {byGroup.map((group) => {
        const isOpen = open.has(group.name);
        const edited = group.settings.filter((s) => s.key in draft).length;
        const changed = group.settings.filter((s) => s.source === 'panel').length;
        return (
          <div key={group.name}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() =>
                setOpen((o) => {
                  const next = new Set(o);
                  if (next.has(group.name)) next.delete(group.name);
                  else next.add(group.name);
                  return next;
                })
              }
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60"
            >
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{group.name}</div>
                <div className="text-xs text-muted-foreground">{group.description}</div>
              </div>
              <span className="font-mono text-[10.5px] text-muted-foreground">{group.settings.length} settings</span>
              {edited > 0 ? <StatusBadge tone="warning">{edited} unsaved</StatusBadge> : null}
              {edited === 0 && changed > 0 ? <StatusBadge tone="info">{changed} changed</StatusBadge> : null}
            </button>
            {isOpen ? (
              <div className="divide-y divide-border border-t border-border bg-secondary/20">
                {group.settings.map((s) => (
                  <SettingRow key={s.key} s={s} draft={draft} setDraft={setDraft} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SettingRow({
  s,
  draft,
  setDraft,
}: {
  s: Setting;
  draft: SettingsDraft;
  setDraft: React.Dispatch<React.SetStateAction<SettingsDraft>>;
}) {
  const edited = s.key in draft;
  const value = shownValue(s, draft);
  const id = `setting-${s.key}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 pl-11">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id} className="text-[13px] font-medium">
            {s.label}
          </Label>
          {edited ? (
            <StatusBadge tone="warning">Unsaved</StatusBadge>
          ) : s.source === 'panel' ? (
            <StatusBadge tone="info">Changed</StatusBadge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{s.help}</p>
        <p className="font-mono text-[10.5px] text-muted-foreground">
          Default {String(s.default)}
          {s.unit ? ` ${s.unit}` : ''}
          {s.min != null && s.max != null ? ` · ${s.min}–${s.max}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {s.kind === 'boolean' ? (
          <Switch
            id={id}
            checked={value as boolean}
            onCheckedChange={(checked) => setDraft((d) => ({ ...d, [s.key]: checked }))}
          />
        ) : (
          <div className="flex items-center gap-2">
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              value={value as string}
              min={s.min}
              max={s.max}
              step={s.step}
              onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
              className="w-24 font-mono"
            />
            <span className="w-8 text-xs text-muted-foreground">{s.unit ?? ''}</span>
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
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
}
