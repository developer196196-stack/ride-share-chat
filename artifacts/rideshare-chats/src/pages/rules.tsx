import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { Header, card, Button } from "@/components/shared";
import { useLocalStorage } from "@/hooks/use-local-storage";

export default function Rules() {
  const [, setLocation] = useLocation();
  const [, setHasCompletedOnboarding] = useLocalStorage("rs_completed_onboarding", false);

  const handleNext = () => {
    setHasCompletedOnboarding(true);
    setLocation("/auth");
  };

  return (
    <div className="flex min-h-full flex-col px-5 py-5">
      <Header 
        title="Rideshare Chats" 
        subtitle="Global community" 
        onBack={() => setLocation("/onboarding2")} 
        right={<span className="text-xs font-bold text-slate-400">2 of 2</span>} 
      />
      <div className={`${card} mt-8 overflow-hidden`}>
        <div className="h-36 bg-gradient-to-br from-slate-900 via-slate-700 to-[#d7192b] p-5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Live from Uber &amp; Lyft rides</p>
          <p className="mt-12 text-xl font-black">Verified rides only.<br />Real people moving together.</p>
        </div>
        <div className="p-5">
          <p className="text-sm leading-6 text-slate-500">Our Trip Validation Engine checks speed, micro-vibrations, and ride receipts so every room member is genuinely moving.</p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[["9", "Seat rooms"], ["5m", "Grace hold"], ["Now", "Fast escape"]].map(([a, b]) => (
              <div key={b} className="rounded-2xl bg-slate-50 p-3 text-center">
                <p className="text-lg font-black text-slate-900">{a}</p>
                <p className="text-[9px] font-bold text-slate-400">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-auto space-y-3 pt-6">
        <div className="flex justify-center gap-1.5 pb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="h-1.5 w-6 rounded-full bg-[#d7192b]" />
        </div>
        <Button secondary onClick={() => setLocation("/onboarding2")}>How It Works</Button>
        <Button onClick={handleNext}>Verify &amp; Enter Ride <ArrowRight size={18} /></Button>
        <p className="text-center text-[10px] text-slate-400">Real-time trip motion and video matchmaking permissions apply.</p>
      </div>
    </div>
  );
}
