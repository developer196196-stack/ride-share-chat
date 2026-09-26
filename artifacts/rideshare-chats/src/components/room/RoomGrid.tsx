import { ArrowRight, ShieldCheck } from "lucide-react";
import { avatars } from "@/components/shared";

const seats = [["You", "CA", "YO"], ...avatars] as const;

export function RoomGrid({
  dimmed,
  onNext,
}: {
  dimmed: boolean;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div
        className={`grid grid-cols-3 gap-2 transition-opacity duration-300 ${dimmed ? "pointer-events-none opacity-40" : "opacity-100"}`}
        aria-label="Nine-seat rolling room video placeholders"
        aria-hidden={dimmed}
        data-testid="grid-room-seats"
      >
        {seats.map(([name, location, initials], index) => (
          <div
            key={name}
            className={`relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-[18px] border-2 shadow-sm ${
              index === 0 ? "border-[#d7192b] bg-gradient-to-br from-red-100 to-rose-200" : index === 1 ? "border-emerald-400 bg-gradient-to-br from-emerald-100 to-slate-200" : "border-white bg-gradient-to-br from-slate-200 to-slate-400"
            }`}
            data-testid={`seat-${index + 1}`}
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/80 text-sm font-black shadow-sm ${
              index === 0 ? "bg-[#d7192b] text-white" : "bg-slate-700 text-white"
            }`}>
              {initials}
            </div>
            <div className="absolute inset-x-1 bottom-1 flex items-center justify-between rounded-lg bg-slate-950/75 px-1.5 py-1 text-[9px] font-bold text-white">
              <span className="truncate">{name}</span>
              <span className="shrink-0 text-white/70">{location}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <ShieldCheck size={14} className="text-emerald-600" aria-hidden="true" />
        9-seat room preview · verified riders
      </p>
      <div className="sticky bottom-14 z-10 mt-auto bg-[#f8fafc]/95 pt-3 pb-2 backdrop-blur-sm">
        <button
          type="button"
          onClick={onNext}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-[#d7192b] text-sm font-extrabold text-white shadow-[0_10px_22px_rgba(215,25,43,0.2)] transition-transform hover:bg-[#bd1627] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d7192b]"
          data-testid="button-next-room"
        >
          Next · Instant Escape <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}