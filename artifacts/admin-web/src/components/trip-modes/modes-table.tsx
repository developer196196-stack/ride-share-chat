'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/page-header';
import type { Draft, DraftGroup, MatchingScope } from './room-types-editor';

const MATCHING: { value: MatchingScope; label: string; note: string }[] = [
  { value: 'global', label: 'Global', note: 'Anyone, anywhere' },
  { value: 'nationwide', label: 'Nationwide', note: 'Same country' },
  { value: 'local', label: 'Local', note: 'Nearby only' },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

/**
 * Console "Transit mode configuration": one row per room group (transit mode) with min trip,
 * max room time and matching. Edits the same draft as the room types below.
 */
export function ModesTable({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
}) {
  const update = (key: string, patch: Partial<DraftGroup>) =>
    setDraft((d) => d && { ...d, groups: d.groups.map((g) => (g.key === key ? { ...g, ...patch } : g)) });

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[13px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="eyebrow px-4 py-2 font-normal">Transit mode</th>
            <th className="eyebrow px-4 py-2 font-normal">Min trip</th>
            <th className="eyebrow px-4 py-2 font-normal">Max room</th>
            <th className="eyebrow px-4 py-2 font-normal">Matching</th>
          </tr>
        </thead>
        <tbody>
          {draft.groups.map((g) => {
            const types = draft.types.filter((t) => t.groupKey === g.key).length;
            return (
              <tr key={g.key} className="border-b border-border/70 align-top last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                    <span className="font-medium">{g.label || 'Untitled group'}</span>
                    {g.active ? null : <StatusBadge tone="outline">Hidden</StatusBadge>}
                  </div>
                  <div className="mt-0.5 pl-[18px] text-[11px] text-muted-foreground">
                    {types} room type{types === 1 ? '' : 's'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <MinutesInput
                    label={`Min trip for ${g.label}`}
                    value={g.minTripMinutes}
                    max={240}
                    onChange={(v) => update(g.key, { minTripMinutes: v })}
                  />
                  <Hint>
                    {g.minTripMinutes > 0 ? `Verified ${g.minTripMinutes} min before joining` : 'Join straight away'}
                  </Hint>
                </td>
                <td className="px-4 py-3">
                  <MinutesInput
                    label={`Max room time for ${g.label}`}
                    value={g.maxRoomMinutes}
                    max={1440}
                    onChange={(v) => update(g.key, { maxRoomMinutes: v })}
                  />
                  <Hint>{g.maxRoomMinutes > 0 ? `Room closes after ${g.maxRoomMinutes} min` : 'No time limit'}</Hint>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={g.matching} onValueChange={(v) => update(g.key, { matching: v as MatchingScope })}>
                      <SelectTrigger className="w-36" aria-label={`Matching for ${g.label}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MATCHING.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                            <span className="ml-1.5 text-xs text-muted-foreground">{m.note}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {g.matching === 'local' ? (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        within
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={500}
                          value={g.localRadiusMiles}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n)) update(g.key, { localRadiusMiles: clamp(n || 1, 1, 500) });
                          }}
                          aria-label={`Local radius for ${g.label} in miles`}
                          className="h-9 w-20 font-mono"
                        />
                        miles
                      </label>
                    ) : null}
                  </div>
                  <Hint>
                    {g.matching === 'local'
                      ? `Riders within ${g.localRadiusMiles} miles of where the room opened`
                      : g.matching === 'nationwide'
                        ? 'Riders in the same country (from their phone number)'
                        : 'Riders anywhere'}
                  </Hint>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MinutesInput({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(clamp(n, 0, max));
        }}
        aria-label={label}
        className="h-9 w-20 font-mono"
      />
      <span className="text-xs text-muted-foreground">min</span>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] text-muted-foreground">{children}</p>;
}
