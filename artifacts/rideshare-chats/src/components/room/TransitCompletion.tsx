import { CarFront, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import { BrandMark } from "@/components/shared";

export function TransitCompletion() {
  const [, setLocation] = useLocation();

  return (
    <section className="flex flex-1 flex-col items-center justify-center px-2 py-10 text-center" data-testid="screen-transit-completion">
      <BrandMark />
      <div className="mt-9 flex h-24 w-24 items-center justify-center rounded-[28px] bg-emerald-50 text-emerald-700">
        <CarFront size={42} aria-hidden="true" />
      </div>
      <span className="mt-7 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700">
        Ride complete
      </span>
      <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-slate-950">
        You have reached your drop-off destination.
      </h1>
      <p className="mt-4 max-w-xs text-sm leading-6 text-slate-600" data-testid="text-seat-backfilled">
        Your seat in this room will now be backfilled by another passenger.
      </p>
      <button
        type="button"
        onClick={() => setLocation("/vibe")}
        className="mt-10 flex h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-[#d7192b] text-sm font-extrabold text-white shadow-[0_10px_22px_rgba(215,25,43,0.2)]"
        data-testid="button-return-to-vibes"
      >
        <RotateCcw size={17} aria-hidden="true" />
        Back to rooms
      </button>
      <button
        type="button"
        onClick={() => setLocation("/summary")}
        className="mt-3 text-sm font-bold text-slate-500 underline underline-offset-4"
        data-testid="button-view-ride-summary"
      >
        View ride summary
      </button>
    </section>
  );
}