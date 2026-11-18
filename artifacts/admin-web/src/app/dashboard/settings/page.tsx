'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminQuery } from '@/hooks/use-admin-query';
import { adminApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorAlert, PageHeader, Panel, StatusBadge } from '@/components/page-header';
import { CalibrationPanel } from '@/components/trip-modes/calibration-panel';
import { ModesTable } from '@/components/trip-modes/modes-table';
import {
  OverridesPanel,
  toOverridesDraft,
  type OverridesDraft,
  type OverridesResponse,
} from '@/components/trip-modes/overrides-panel';
import {
  catalogPayload,
  RoomTypesEditor,
  toDraft,
  type CatalogResponse,
  type Draft as CatalogDraft,
} from '@/components/trip-modes/room-types-editor';
import {
  AdvancedCalibration,
  settingsPayload,
  shownValue,
  type SettingsDraft,
  type SettingsResponse,
} from '@/components/trip-modes/validation-settings';

/**
 * Trip Validation & Modes (console section 04): testing overrides, the validation thresholds,
 * transit modes (min trip, max room, matching) and their room types — one page, one Save all.
 */
export default function TripValidationModesPage() {
  const settings = useAdminQuery<SettingsResponse>('/settings/validation');
  const catalog = useAdminQuery<CatalogResponse>('/settings/room-categories');
  const overrides = useAdminQuery<OverridesResponse>('/settings/test-overrides');

  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>({});
  const [catalogDraft, setCatalogDraft] = useState<CatalogDraft | null>(null);
  const [overridesDraft, setOverridesDraft] = useState<OverridesDraft | null>(null);
  const [saving, setSaving] = useState(false);

  // A fresh load replaces that part's draft.
  useEffect(() => setSettingsDraft({}), [settings.data]);
  useEffect(() => setCatalogDraft(catalog.data ? toDraft(catalog.data) : null), [catalog.data]);
  useEffect(() => setOverridesDraft(overrides.data ? toOverridesDraft(overrides.data) : null), [overrides.data]);

  // Opened from the old Room Categories link: scroll to the room types once they load.
  useEffect(() => {
    if (catalogDraft && window.location.hash === '#room-types') {
      document.getElementById('room-types')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [catalogDraft != null]); // eslint-disable-line react-hooks/exhaustive-deps

  const settingsDirty = Object.keys(settingsDraft).length;
  const catalogDirty = useMemo(
    () =>
      catalog.data != null &&
      catalogDraft != null &&
      JSON.stringify(toDraft(catalog.data)) !== JSON.stringify(catalogDraft),
    [catalog.data, catalogDraft],
  );
  const overridesDirty = useMemo(
    () =>
      overrides.data != null &&
      overridesDraft != null &&
      JSON.stringify(toOverridesDraft(overrides.data)) !== JSON.stringify(overridesDraft),
    [overrides.data, overridesDraft],
  );
  const dirtyParts = [
    settingsDirty > 0 ? `${settingsDirty} setting${settingsDirty === 1 ? '' : 's'}` : null,
    catalogDirty ? 'transit modes & room types' : null,
    overridesDirty ? 'overrides' : null,
  ].filter(Boolean) as string[];
  const dirty = dirtyParts.length > 0;

  const bandProblem = useMemo(() => {
    const list = settings.data?.settings ?? [];
    const val = (key: string) => {
      const s = list.find((x) => x.key === key);
      return s ? Number(shownValue(s, settingsDraft)) : null;
    };
    const floor = val('VALIDATION_VIBRATION_BAND_FLOOR');
    const ceil = val('VALIDATION_VIBRATION_BAND_CEIL');
    return floor != null && ceil != null && floor >= ceil ? 'The vibration floor must be below the ceiling.' : null;
  }, [settings.data, settingsDraft]);

  const discard = () => {
    setSettingsDraft({});
    if (catalog.data) setCatalogDraft(toDraft(catalog.data));
    if (overrides.data) setOverridesDraft(toOverridesDraft(overrides.data));
  };

  const saveAll = async () => {
    if (bandProblem) return void toast.error(bandProblem);
    const settingsBody =
      settingsDirty > 0 && settings.data ? settingsPayload(settingsDraft, settings.data.settings) : null;
    if (settingsBody && 'error' in settingsBody) return void toast.error(settingsBody.error);
    setSaving(true);
    const saved: string[] = [];
    try {
      if (settingsBody) {
        await adminApi('/settings/validation', { method: 'PUT', body: settingsBody });
        saved.push('validation settings');
        await settings.reload();
      }
      if (catalogDirty && catalogDraft) {
        await adminApi('/settings/room-categories', { method: 'PUT', body: catalogPayload(catalogDraft) });
        saved.push('transit modes');
        await catalog.reload();
      }
      if (overridesDirty && overridesDraft) {
        await adminApi('/settings/test-overrides', { method: 'PUT', body: overridesDraft });
        saved.push('overrides');
        await overrides.reload();
      }
      toast.success('Saved. Rides and rooms use the new settings within a minute, with no app update.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save.';
      toast.error(saved.length > 0 ? `Saved ${saved.join(' and ')}, but: ${message}` : message);
    } finally {
      setSaving(false);
    }
  };

  const changedFromDefault = settings.data?.settings.filter((s) => s.source === 'panel').length ?? 0;
  const globalOverrides = overrides.data
    ? (['desktop', 'system'] as const).filter((k) => overrides.data![k].scope === 'all')
    : [];
  const overrideNames = useMemo(
    () => Object.fromEntries((overrides.data?.riders ?? []).map((r) => [r.uid, r.displayName])),
    [overrides.data],
  );
  const error = settings.error ?? catalog.error ?? overrides.error;

  return (
    <TooltipProvider>
      <div className="space-y-5 pb-10">
        <PageHeader
          title="Trip Validation & Modes"
          description="How the app decides a rider is really in transit, testing overrides, and how each transit mode matches riders into rooms. Changes apply within a minute, with no app update."
          actions={
            changedFromDefault > 0 ? (
              <StatusBadge tone="info">{changedFromDefault} changed from default</StatusBadge>
            ) : undefined
          }
        />

        {/* Save bar, pinned under the top bar like the console. */}
        <div className="sticky top-12 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card/95 px-3 py-2 backdrop-blur">
          <div className="flex items-center gap-2 text-xs">
            {dirty ? (
              <>
                <span className="h-2 w-2 rounded-full bg-primary" />
                Unsaved: {dirtyParts.join(', ')}
              </>
            ) : (
              <span className="text-muted-foreground">All changes saved</span>
            )}
            {bandProblem ? <span className="text-primary">{bandProblem}</span> : null}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={!dirty || saving} onClick={discard}>
              <RotateCcw className="h-3.5 w-3.5" /> Discard
            </Button>
            <Button size="sm" disabled={!dirty || saving || bandProblem != null} onClick={() => void saveAll()}>
              <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save all'}
            </Button>
          </div>
        </div>

        {error ? (
          <ErrorAlert
            message={error}
            onRetry={() => void Promise.all([settings.reload(), catalog.reload(), overrides.reload()])}
          />
        ) : null}

        {globalOverrides.length > 0 ? (
          <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-accent px-4 py-3 text-[13px] text-accent-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>
                {globalOverrides.map((k) => (k === 'desktop' ? 'Desktop' : 'System')).join(' and ')} override is on for
                all riders.
              </strong>{' '}
              {globalOverrides.includes('desktop')
                ? 'Anyone can join rooms without really riding.'
                : 'Every trip ignores the phone’s in-vehicle reading.'}{' '}
              Switch it to selected riders or off before launch.
            </span>
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Panel
            eyebrow="Testing"
            title="Access and overrides"
            description="Let testers use the app without a real ride"
            action={
              overridesDraft && (overridesDraft.desktop.scope !== 'off' || overridesDraft.system.scope !== 'off') ? (
                <StatusBadge tone="warning">On</StatusBadge>
              ) : (
                <StatusBadge tone="secondary">Off</StatusBadge>
              )
            }
          >
            {overridesDraft ? (
              <OverridesPanel draft={overridesDraft} setDraft={setOverridesDraft} initialNames={overrideNames} />
            ) : (
              <Skeleton className="h-48 w-full" />
            )}
          </Panel>

          <Panel
            eyebrow="Trip validation engine"
            title="Calibration"
            description="The main thresholds. Every setting is under Advanced calibration below."
          >
            {settings.data ? (
              <CalibrationPanel settings={settings.data.settings} draft={settingsDraft} setDraft={setSettingsDraft} />
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </Panel>
        </div>

        <Panel
          eyebrow="Context-aware parameters"
          title="Transit modes"
          description="Each room group is a transit mode. Min trip and Max room are in minutes; 0 means off."
          bodyClassName="p-0"
        >
          {catalogDraft ? (
            <ModesTable draft={catalogDraft} setDraft={setCatalogDraft} />
          ) : (
            <Skeleton className="m-4 h-40" />
          )}
        </Panel>

        <section id="room-types" className="scroll-mt-28">
          <Panel
            eyebrow="Transit modes"
            title="Room types"
            description="The groups and room types riders pick from. Click a row to edit it."
          >
            {catalogDraft && catalog.data ? (
              <RoomTypesEditor data={catalog.data} draft={catalogDraft} setDraft={setCatalogDraft} />
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </Panel>
        </section>

        <Panel
          eyebrow="Trip validation engine"
          title="Advanced calibration"
          description="Every threshold the server uses, by section. Managed only here, never in .env."
          bodyClassName="p-0"
        >
          {settings.data ? (
            <AdvancedCalibration settings={settings.data.settings} draft={settingsDraft} setDraft={setSettingsDraft} />
          ) : (
            <Skeleton className="m-4 h-40" />
          )}
        </Panel>
      </div>
    </TooltipProvider>
  );
}
