'use client';

import { Slider } from '@/components/ui/slider';
import { shownValue, type Setting, type SettingsDraft } from './validation-settings';

type Calib = {
  key: string;
  label: string;
  note: string;
  /** Slider range (may be narrower than the allowed range; the Advanced list takes any allowed value). */
  min: number;
  max: number;
  step: number;
  format: (v: number) => { value: string; unit: string };
};

const CALIBRATION: Calib[] = [
  {
    key: 'VALIDATION_ENTRY_MPH',
    label: 'Speed to verify',
    note: 'A ride counts as moving above this speed.',
    min: 0,
    max: 60,
    step: 1,
    format: (v) => ({ value: String(v), unit: 'mph' }),
  },
  {
    key: 'VALIDATION_VERIFIED_SCORE',
    label: 'Score to verify',
    note: 'GPS, vibration and in-vehicle signals combined (0–100).',
    min: 0,
    max: 100,
    step: 1,
    format: (v) => ({ value: String(v), unit: '/ 100' }),
  },
  {
    key: 'VALIDATION_VIBRATION_BAND_FLOOR',
    label: 'Vibration floor',
    note: 'Share of 10–25 Hz vehicle vibration that scores 0.',
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => ({ value: String(Math.round(v * 100)), unit: '%' }),
  },
  {
    key: 'VALIDATION_VIBRATION_BAND_CEIL',
    label: 'Vibration ceiling',
    note: 'Share of 10–25 Hz vehicle vibration that scores 100.',
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => ({ value: String(Math.round(v * 100)), unit: '%' }),
  },
];

const GRACE: Calib = {
  key: 'VALIDATION_GRACE_DURATION_SEC',
  label: 'Grace period',
  note: 'How long a stopped ride (traffic, a station) keeps its seat before it ends.',
  min: 30,
  max: 900,
  step: 10,
  format: (v) =>
    v >= 60 ? { value: (v / 60).toFixed(v % 60 === 0 ? 0 : 1), unit: 'min' } : { value: String(v), unit: 'sec' },
};

/** Console "Telemetry calibration matrix": the main thresholds as sliders. */
export function CalibrationPanel({
  settings,
  draft,
  setDraft,
}: {
  settings: Setting[];
  draft: SettingsDraft;
  setDraft: React.Dispatch<React.SetStateAction<SettingsDraft>>;
}) {
  const byKey = new Map(settings.map((s) => [s.key, s]));
  const num = (key: string) => {
    const s = byKey.get(key);
    return s ? Number(shownValue(s, draft)) : 0;
  };
  const set = (key: string, v: number) => {
    const s = byKey.get(key);
    if (!s) return;
    setDraft((d) => {
      const next = { ...d };
      // Back to the saved value = not a change.
      if (Number(s.value) === v) delete next[key];
      else next[key] = String(v);
      return next;
    });
  };

  const floor = num('VALIDATION_VIBRATION_BAND_FLOOR');
  const ceil = num('VALIDATION_VIBRATION_BAND_CEIL');
  const bandError = floor >= ceil ? 'The vibration floor must be below the ceiling.' : null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {CALIBRATION.map((c) => (
          <CalibSlider key={c.key} c={c} value={num(c.key)} edited={c.key in draft} onChange={(v) => set(c.key, v)} />
        ))}
      </div>
      <div className="rounded-md bg-secondary p-3">
        <div className="eyebrow mb-2">Vibration scoring band</div>
        <div className="relative h-3 rounded-full bg-card ring-1 ring-border">
          <div
            className="absolute inset-y-0 rounded-full bg-primary transition-all"
            style={{ left: `${floor * 100}%`, width: `${Math.max(0, ceil - floor) * 100}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>0%</span>
          <span>
            score 0 at {Math.round(floor * 100)}% → 100 at {Math.round(ceil * 100)}%
          </span>
          <span>100%</span>
        </div>
        {bandError ? <p className="mt-1.5 text-[11px] text-primary">{bandError}</p> : null}
      </div>
      <CalibSlider c={GRACE} value={num(GRACE.key)} edited={GRACE.key in draft} onChange={(v) => set(GRACE.key, v)} />
    </div>
  );
}

function CalibSlider({
  c,
  value,
  edited,
  onChange,
}: {
  c: Calib;
  value: number;
  edited: boolean;
  onChange: (v: number) => void;
}) {
  const shown = c.format(value);
  return (
    <div
      className={`rounded-md border p-3 transition-colors ${edited ? 'border-amber-500/40 bg-amber-500/5' : 'border-border'}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium">{c.label}</span>
        <span className="font-display tnum text-xl font-bold">
          {shown.value}
          <span className="ml-1 font-sans text-[11px] font-normal text-muted-foreground">{shown.unit}</span>
        </span>
      </div>
      <Slider
        className="mt-3"
        min={c.min}
        max={c.max}
        step={c.step}
        value={[Math.min(c.max, Math.max(c.min, value))]}
        // Round off floating-point noise from fractional steps (0.01).
        onValueChange={([v]) => onChange(Number(v!.toFixed(2)))}
        aria-label={c.label}
      />
      <div className="mt-1.5 text-[11px] text-muted-foreground">{c.note}</div>
    </div>
  );
}
