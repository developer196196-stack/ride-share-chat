import { RotateCcw, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { pill, card, Button } from "@/components/shared";

export default function Match() {
  const [, setLocation] = useLocation();

  // In a real app this would transition automatically to /room when a match is found
  // For the prototype we just stay here or they can cancel

  return (
    <div className="flex min-h-full flex-col items-center justify-center text-center px-5 py-10">
      <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-red-200 bg-red-50 text-[#d7192b] shadow-[0_0_0_18px_rgba(215,25,43,0.05)] animate-pulse">
        <RotateCcw size={42} className="animate-spin-slow" />
      </div>
      
      <span className={`${pill} mt-10 border-slate-200 bg-slate-50 text-slate-500`}>
        <ShieldCheck size={13} /> Previous room temporarily blacklisted
      </span>
      
      <h2 className="mt-5 text-2xl font-black">Matching next room...</h2>
      <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
        Finding 8 other verified in-transit commuters who match your <b className="text-[#d7192b]">Party Mode</b> vibe.
      </p>
      
      <div className={`${card} mt-6 w-full p-5 text-left`}>
        {[
          ["Speed telemetry", "38.4 MPH Verified"], 
          ["Queue match time", "< 3.2s avg"], 
          ["Rolling region", "California Metro Corridor"]
        ].map(([a, b]) => (
          <div className="mb-3 flex justify-between text-xs last:mb-0" key={a}>
            <span className="text-slate-500">{a}</span>
            <b>{b}</b>
          </div>
        ))}
      </div>
      
      <div className="mt-auto w-full pt-6">
        <Button onClick={() => setLocation("/room")}>Simulate Found Match (Dev)</Button>
        <div className="mt-3">
          <Button secondary onClick={() => setLocation("/vibe")}>Change Vibe / Cancel Search</Button>
        </div>
      </div>
    </div>
  );
}
