'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Cpu, Monitor, Plus, Search, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RiderAvatar } from '@/components/page-header';

export type OverrideKind = 'desktop' | 'system';
export type OverrideScope = 'off' | 'all' | 'riders';
export type OverrideSetting = { scope: OverrideScope; uids: string[] };
export type OverridesDraft = Record<OverrideKind, OverrideSetting>;
export type OverridesResponse = OverridesDraft & {
  updatedAt: string | null;
  updatedBy: string | null;
  riders: { uid: string; displayName: string }[];
};

export const toOverridesDraft = (o: OverridesResponse): OverridesDraft => ({
  desktop: { scope: o.desktop.scope, uids: [...o.desktop.uids] },
  system: { scope: o.system.scope, uids: [...o.system.uids] },
});

const KINDS: { kind: OverrideKind; title: string; icon: LucideIcon; note: string }[] = [
  {
    kind: 'desktop',
    title: 'Desktop override',
    icon: Monitor,
    note: 'Trips count as verified without real movement: no GPS speed, vibration, emulator or fake-GPS checks, and no time-out. For demos, emulators and app reviewers.',
  },
  {
    kind: 'system',
    title: 'System override',
    icon: Cpu,
    note: 'Ignores the phone’s own in-vehicle reading; trips are scored on GPS and vibration only. Riders still need to be moving. For phones with unreliable detection.',
  },
];

/** Console "Access and overrides": testing switches for everyone or chosen riders. */
export function OverridesPanel({
  draft,
  setDraft,
  initialNames,
}: {
  draft: OverridesDraft;
  setDraft: React.Dispatch<React.SetStateAction<OverridesDraft | null>>;
  initialNames: Record<string, string>;
}) {
  // Names of riders picked in this session, on top of the saved ones.
  const [picked, setNames] = useState<Record<string, string>>({});
  const names = { ...initialNames, ...picked };

  const update = (kind: OverrideKind, patch: Partial<OverrideSetting>) =>
    setDraft((d) => d && { ...d, [kind]: { ...d[kind], ...patch } });

  return (
    <div className="space-y-3">
      {KINDS.map(({ kind, title, icon: Icon, note }) => {
        const setting = draft[kind];
        const on = setting.scope !== 'off';
        return (
          <div
            key={kind}
            className={cn(
              'rounded-md border p-3 transition-colors',
              setting.scope === 'all'
                ? 'border-primary/50 bg-accent'
                : on
                  ? 'border-primary/30 bg-accent/50'
                  : 'border-border',
            )}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">
                <span className="block text-[13px] font-medium">{title}</span>
                <span className="text-[11.5px] text-muted-foreground">{note}</span>
              </span>
              <Switch
                checked={on}
                aria-label={title}
                // Switching on starts with chosen riders only, the safe choice.
                onCheckedChange={(v) => update(kind, { scope: v ? 'riders' : 'off' })}
              />
            </label>

            {on ? (
              <div className="mt-3 space-y-2.5 border-t border-border/70 pt-3">
                <div className="grid grid-cols-2 rounded-md border border-border bg-card p-0.5">
                  {(['riders', 'all'] as const).map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => update(kind, { scope })}
                      className={cn(
                        'rounded py-1.5 text-[11.5px] font-medium transition-colors',
                        setting.scope === scope
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {scope === 'riders' ? 'Selected riders' : 'All riders'}
                    </button>
                  ))}
                </div>

                {setting.scope === 'all' ? (
                  <p className="flex items-start gap-1.5 text-[11.5px] font-medium text-accent-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    On for everyone:{' '}
                    {kind === 'desktop'
                      ? 'anyone can join rooms without riding'
                      : 'every trip ignores the phone’s in-vehicle reading'}
                    . Turn this off before launch.
                  </p>
                ) : (
                  <RiderList
                    uids={setting.uids}
                    names={names}
                    onAdd={(uid, name) => {
                      setNames((n) => ({ ...n, [uid]: name }));
                      if (!setting.uids.includes(uid)) update(kind, { uids: [...setting.uids, uid] });
                    }}
                    onRemove={(uid) => update(kind, { uids: setting.uids.filter((u) => u !== uid) })}
                  />
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

type RiderHit = { uid: string; displayName: string | null; phoneNumber: string | null };

function RiderList({
  uids,
  names,
  onAdd,
  onRemove,
}: {
  uids: string[];
  names: Record<string, string>;
  onAdd: (uid: string, name: string) => void;
  onRemove: (uid: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  // Search after a short pause in typing.
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const hits = useAdminQuery<RiderHit[]>(query.length >= 2 ? `/users?search=${encodeURIComponent(query)}` : null);

  return (
    <div className="space-y-2">
      {uids.length === 0 ? (
        <p className="text-[11.5px] text-muted-foreground">No riders yet. Add the testers this applies to.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {uids.map((uid) => (
            <li
              key={uid}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-0.5 pl-0.5 pr-1.5 text-xs"
            >
              <RiderAvatar name={names[uid] ?? 'Rider'} seed={uid} size={20} />
              {names[uid] ?? 'Rider'}
              <button
                type="button"
                onClick={() => onRemove(uid)}
                aria-label={`Remove ${names[uid] ?? 'rider'}`}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="space-y-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
              placeholder="Search name, phone or rider ID"
              className="h-9 pl-8"
            />
          </div>
          {query.length >= 2 ? (
            <ul className="max-h-52 overflow-y-auto rounded-md border border-border bg-card">
              {hits.loading && !hits.data ? (
                <li className="px-3 py-2 text-xs text-muted-foreground">Searching…</li>
              ) : (hits.data ?? []).length === 0 ? (
                <li className="px-3 py-2 text-xs text-muted-foreground">No riders match.</li>
              ) : (
                (hits.data ?? []).slice(0, 8).map((r) => {
                  const picked = uids.includes(r.uid);
                  return (
                    <li key={r.uid}>
                      <button
                        type="button"
                        disabled={picked}
                        onClick={() => {
                          onAdd(r.uid, r.displayName ?? 'Rider');
                          setText('');
                          setAdding(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-secondary disabled:opacity-50"
                      >
                        <RiderAvatar name={r.displayName} seed={r.uid} size={22} />
                        <span className="flex-1 truncate font-medium">{r.displayName ?? 'Profile not finished'}</span>
                        <span className="font-mono text-[10.5px] text-muted-foreground">
                          {picked ? 'added' : (r.phoneNumber ?? '')}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Add rider
        </button>
      )}
    </div>
  );
}
