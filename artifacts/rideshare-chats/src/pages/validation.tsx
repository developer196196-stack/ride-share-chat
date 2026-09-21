import { ArrowRight, CircleHelp, Check, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import { Header, card, Button } from "@/components/shared";

export default function Validation() {
  const [, setLocation] = useLocation();

  const handleNext = () => {
    setLocation("/vibe");
  };

  return (
    <div className="flex min-h-full flex-col px-5 py-5">
      <Header 
        title="Trip Validation" 
        subtitle="Step 1 of 3" 
        onBack={() => setLocation("/permissions")} 
        right={<CircleHelp className="text-slate-400 cursor-pointer hover:text-slate-600" size={20} />} 
      />
      
      <div className={`${card} mt-7 bg-gradient-to-br from-white to-red-50 p-5`}>
        <div className="flex justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live sensor telemetry</p>
            <p className="mt-2 text-lg font-black">Transit detected</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-600 self-start">Active ride</span>
        </div>
        
        <div className="relative mx-auto my-6 flex h-48 w-48 items-center justify-center rounded-full border-[13px] border-r-[#d7192b] border-t-[#d7192b] border-l-slate-200 border-b-slate-200">
          <div className="text-center">
            <p className="text-5xl font-black">42</p>
            <p className="text-[10px] font-bold tracking-widest text-slate-400">MPH</p>
          </div>
        </div>
        
        <div className="flex items-end justify-center gap-1">
          {[18, 31, 45, 26, 38, 52, 30].map((h, i) => (
            <span key={i} className="w-2 rounded-t bg-[#d7192b] transition-all duration-700" style={{ height: h }} />
          ))}
        </div>
        
        <p className="mt-4 text-center text-xs text-slate-500">Accelerometer micro-vibrations match in-cabin vehicle motion</p>
      </div>
      
      <div className="mt-5">
        <div className="flex justify-between text-xs font-bold">
          <span>Verification checklist</span>
          <span className="text-[#d7192b]">2 of 3 complete</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full w-2/3 rounded-full bg-[#d7192b]" />
        </div>
        
        <div className={`${card} mt-4 divide-y divide-slate-100`}>
          {["GPS speed lock", "Ride platform webhook", "Vibration telemetry"].map((x, i) => (
            <div className="flex items-center justify-between p-4" key={x}>
              <span className="text-sm font-bold">{x}</span>
              {i < 2 ? <Check className="text-emerald-500" size={18} /> : <RotateCcw className="text-[#d7192b] animate-spin-slow" size={16} />}
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-auto pt-6">
        <Button onClick={handleNext}>Choose Your Vibe <ArrowRight size={18} /></Button>
      </div>
    </div>
  );
}
