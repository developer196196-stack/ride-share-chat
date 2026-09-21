import { ArrowRight, Radio, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { Header, card, pill, Button } from "@/components/shared";
import { useLocalStorage } from "@/hooks/use-local-storage";

export default function Connect() {
  const [, setLocation] = useLocation();
  const [, setProvidersConnected] = useLocalStorage("rs_providers_connected", false);

  const handleNext = () => {
    setProvidersConnected(true);
    setLocation("/permissions");
  };

  return (
    <div className="flex min-h-full flex-col px-5 py-5">
      <Header 
        title="RS Chats" 
        onBack={() => setLocation("/profile")} 
        right={<span className="text-xs font-bold text-slate-500">Step 3/4</span>} 
      />
      
      <div className="mt-16">
        <span className={`${pill} border-red-200 bg-red-50 text-[#c41f36]`}>
          <Radio size={13} /> Platform webhook sync
        </span>
        <h2 className="mt-4 text-[29px] font-black tracking-[-0.06em]">Link your ride accounts</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Connect Uber or Lyft to auto-unlock video chat rooms the moment your driver starts your trip.</p>
        
        <div className={`${card} mt-6 border-2 border-emerald-400 p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black text-xs font-black text-white">Uber</div>
              <div>
                <p className="font-black">Uber Passenger API</p>
                <p className="text-xs font-semibold text-emerald-500">Connected &amp; Webhook Active</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">Linked</span>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 font-mono text-[10px] text-slate-400">OAuth Token: Active</div>
        </div>
        
        <div className={`${card} mt-3 flex items-center justify-between p-4`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500 text-[10px] font-black text-white">lyft</div>
            <div>
              <p className="font-black">Lyft Passenger API</p>
              <p className="text-xs text-slate-500">Auto-verify rides hailed on Lyft</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold cursor-pointer hover:bg-slate-200">Connect</span>
        </div>
        
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
          <ShieldCheck className="text-emerald-500 shrink-0" size={17} /> 
          We only read ride status timestamps and motion state.
        </div>
      </div>
      
      <div className="mt-auto pt-6">
        <Button onClick={handleNext}>Continue to Permissions <ArrowRight size={18} /></Button>
      </div>
    </div>
  );
}
