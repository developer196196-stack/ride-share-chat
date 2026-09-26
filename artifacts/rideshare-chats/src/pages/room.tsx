import { ShieldCheck, Timer } from "lucide-react";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/shared";
import { DebugPanel } from "@/components/room/DebugPanel";
import { RoomGrid } from "@/components/room/RoomGrid";
import { TransitCompletion } from "@/components/room/TransitCompletion";
import { useTransitState } from "@/hooks/useTransitState";

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function Room() {
  const [, setLocation] = useLocation();
  const { transitState, secondsRemaining, dispatchPayload } = useTransitState();
  const isGrace = transitState === "GRACE_PERIOD_PENDING";

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#f8fafc] sm:min-h-[796px]" data-testid="screen-rolling-room">
      <div className="relative flex flex-1 flex-col px-5 pb-5 pt-5">
        <DebugPanel transitState={transitState} onPayload={dispatchPayload} />

        {transitState === "DISCONNECTED" ? (
          <TransitCompletion />
        ) : (
          <>
            <div className="mb-4 mt-5 flex items-center justify-between gap-2">
              <div>
                <span className="rounded-full bg-[#d7192b] px-3 py-1.5 text-[10px] font-black text-white">Party Mode</span>
                <h1 className="mt-3 text-xl font-black tracking-tight text-slate-950">Rolling Room</h1>
              </div>
              <button
                type="button"
                onClick={() => setLocation("/report")}
                className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700"
                data-testid="button-report-room"
              >
                <ShieldCheck size={14} className="text-[#d7192b]" aria-hidden="true" /> Report
              </button>
            </div>

            <RoomGrid dimmed={isGrace} onNext={() => setLocation("/match")} />

            {isGrace && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
                <section
                  role="dialog"
                  aria-labelledby="traffic-grace-title"
                  className="pointer-events-auto w-full rounded-[28px] border border-amber-100 bg-white p-6 text-center shadow-[0_25px_70px_rgba(15,23,42,0.25)]"
                  data-testid="modal-traffic-grace"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                    <Timer size={27} aria-hidden="true" />
                  </div>
                  <h2 id="traffic-grace-title" className="mt-5 text-xl font-black text-slate-950">
                    Traffic Grace Period Active
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Your room is paused while we wait for your ride to move again.
                  </p>
                  <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">Time remaining</p>
                    <p className="mt-1 font-mono text-4xl font-black tabular-nums text-amber-700" role="timer" data-testid="timer-grace">
                      {formatTime(secondsRemaining)}
                    </p>
                  </div>
                  <p className="mt-4 text-xs text-slate-500">
                    Use “Simulate Motion Resumed” above to return to the room.
                  </p>
                </section>
              </div>
            )}
          </>
        )}
      </div>
      {transitState !== "DISCONNECTED" && <BottomNav />}
    </main>
  );
}