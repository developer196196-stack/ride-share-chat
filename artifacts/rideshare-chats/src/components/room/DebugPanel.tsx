import { Activity, Play, Timer, XCircle } from "lucide-react";
import type { TransitPayload, TransitState } from "@/hooks/useTransitState";

const simulations: {
  label: string;
  payload: TransitPayload;
  icon: typeof Activity;
  testId: string;
}[] = [
  {
    label: "Simulate Red Light (Speed < 15mph)",
    payload: { type: "SENSOR_UPDATE", speedMph: 8 },
    icon: Timer,
    testId: "button-simulate-red-light",
  },
  {
    label: "Simulate Speed 15mph (Threshold)",
    payload: { type: "SENSOR_UPDATE", speedMph: 15 },
    icon: Activity,
    testId: "button-simulate-speed-threshold",
  },
  {
    label: "Simulate Speed 20mph (Above Threshold)",
    payload: { type: "SENSOR_UPDATE", speedMph: 20 },
    icon: Activity,
    testId: "button-simulate-speed-above-threshold",
  },
  {
    label: "Simulate Motion Resumed",
    payload: { type: "MOTION_RESUMED" },
    icon: Play,
    testId: "button-simulate-motion-resumed",
  },
  {
    label: "Simulate Ride End (Timer Expired)",
    payload: { type: "RIDE_END", reason: "TIMER_EXPIRED" },
    icon: XCircle,
    testId: "button-simulate-ride-end",
  },
];

export function DebugPanel({
  transitState,
  onPayload,
}: {
  transitState: TransitState;
  onPayload: (payload: TransitPayload) => void;
}) {
  return (
    <section className="relative z-30 rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm" aria-label="Sensor simulator" data-testid="panel-sensor-simulator">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
          <Activity size={14} className="text-[#d7192b]" />
          Developer · Sensor payloads
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[9px] font-bold text-slate-600" data-testid="status-transit-state">
          {transitState}
        </span>
      </div>
      <div className="grid gap-1.5">
        {simulations.map(({ label, payload, icon: Icon, testId }) => (
          <button
            key={testId}
            type="button"
            onClick={() => onPayload(payload)}
            className="flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] font-bold text-slate-700 transition-colors hover:border-[#d7192b]/40 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d7192b]"
            data-testid={testId}
          >
            <Icon size={14} className="shrink-0 text-[#d7192b]" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}