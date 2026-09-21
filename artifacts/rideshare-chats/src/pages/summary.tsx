import { RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import { BrandMark, card, Button } from "@/components/shared";

export default function Summary() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-full flex-col px-5 py-8">
      <div className="text-center flex flex-col items-center">
        <BrandMark />
        <h2 className="mt-4 text-2xl font-black">Ride session completed</h2>
        <p className="mt-2 text-sm text-slate-500">Trip ended · You safely disconnected from the room.</p>
      </div>
      
      <div className="mt-7 grid grid-cols-2 gap-3">
        <div className={`${card} p-4`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Chat duration</p>
          <p className="mt-2 text-2xl font-black">24m 18s</p>
          <p className="mt-1 text-xs font-bold text-emerald-500">9 passengers met</p>
        </div>
        <div className={`${card} p-4`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Validated distance</p>
          <p className="mt-2 text-2xl font-black">11.4 mi</p>
          <p className="mt-1 text-xs text-slate-500">Avg 34.2 MPH</p>
        </div>
      </div>
      
      <div className={`${card} mt-4 p-5`}>
        <h3 className="font-black">Trip validation telemetry</h3>
        {[
          ["Active transit duration", "96.8% of session"], 
          ["Traffic grace periods", "2 times (4m 12s)"], 
          ["Ride provider status", "Uber Verified"], 
          ["Vibe category", "Party Mode"]
        ].map(([a, b]) => (
          <div className="mt-4 flex justify-between text-xs" key={a}>
            <span className="text-slate-500">{a}</span>
            <b>{b}</b>
          </div>
        ))}
      </div>
      
      <div className={`${card} mt-4 p-5`}>
        <h3 className="font-black">How was your room experience?</h3>
        <p className="mt-2 text-xs text-slate-500">Your rating helps improve room matching quality and community safety.</p>
        <div className="mt-4 flex justify-between text-sm font-bold text-slate-600">
          <span className="cursor-pointer hover:text-[#d7192b] transition-colors">Low</span>
          <span className="cursor-pointer hover:text-[#d7192b] transition-colors">Good</span>
          <span className="cursor-pointer hover:text-[#d7192b] transition-colors">Great</span>
          <span className="cursor-pointer hover:text-[#d7192b] transition-colors">Best</span>
        </div>
      </div>
      
      <div className="mt-auto space-y-2 pt-6">
        <Button onClick={() => setLocation("/vibe")}><RotateCcw size={17} /> Reconnect / New Matchmaking</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button secondary onClick={() => setLocation("/history")}>Connections &amp; Trips</Button>
          <Button secondary onClick={() => setLocation("/settings")}>Trust Center</Button>
        </div>
      </div>
    </div>
  );
}
