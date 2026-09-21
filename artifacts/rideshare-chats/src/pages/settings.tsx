import { Check } from "lucide-react";
import { useLocation } from "wouter";
import { Header, card, Button, BottomNav } from "@/components/shared";

export default function SettingsScreen() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-full flex-col pt-5">
      <div className="px-5 pb-8 flex-1 flex flex-col">
        <Header 
          title="Trust & Settings" 
          subtitle="Privacy, security & ride webhooks" 
          onBack={() => setLocation("/vibe")} 
          right={<span className="rounded-full bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-600">Verified user</span>} 
        />
        
        <div className={`${card} mt-5 flex items-center gap-3 p-4`}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#d7192b] bg-slate-300 text-lg font-black text-white shadow-sm">
            FS
          </div>
          <div>
            <p className="font-black">floatersondemand</p>
            <p className="text-xs text-slate-500">Los Angeles Metro · CA</p>
            <p className="mt-1 text-[10px] font-bold text-emerald-500">● Liveness verified passenger</p>
          </div>
        </div>
        
        <p className="mt-6 text-xs font-black uppercase tracking-wider text-slate-500">Privacy &amp; transit shields</p>
        
        <div className={`${card} mt-3 divide-y divide-slate-100`}>
          {["Incognito Drop-off Shield", "Anonymize Phone Hash"].map(x => (
            <div className="flex items-center justify-between p-4" key={x}>
              <div>
                <p className="text-sm font-black">{x}</p>
                <p className="mt-1 text-xs text-slate-500">Enabled for every active room.</p>
              </div>
              <div className="rounded bg-[#d7192b] p-1 text-white shadow-sm">
                <Check size={14} />
              </div>
            </div>
          ))}
        </div>
        
        <p className="mt-6 text-xs font-black uppercase tracking-wider text-slate-500">Linked ride providers</p>
        
        <div className={`${card} mt-3 divide-y divide-slate-100`}>
          {["Uber Passenger API", "Lyft Passenger API"].map(x => (
            <div className="flex items-center justify-between p-4" key={x}>
              <div>
                <p className="text-sm font-black">{x}</p>
                <p className="text-xs font-bold text-emerald-500">OAuth2 token active</p>
              </div>
              <button className="rounded-full border border-red-200 px-3 py-2 text-xs font-bold text-[#d7192b] hover:bg-red-50 transition-colors">
                Revoke
              </button>
            </div>
          ))}
        </div>
        
        <div className="mt-auto pt-6">
          <Button secondary onClick={() => setLocation("/vibe")}>Back to Flow</Button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
