import { Car, Check, MoreHorizontal, X } from "lucide-react";
import { useLocation } from "wouter";
import { Header, card, Button, BottomNav } from "@/components/shared";

export default function History() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-full flex-col pt-5">
      <div className="px-5 pb-8 flex-1 flex flex-col">
        <Header 
          title="Connections & Trips" 
          subtitle="Your verified in-transit network" 
          onBack={() => setLocation("/vibe")} 
          right={<MoreHorizontal className="text-slate-400 cursor-pointer" />} 
        />
        
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            ["28", "Peers met"], 
            ["142", "Transit logs"], 
            ["5.0", "Trust score"]
          ].map(([a, b]) => (
            <div className={`${card} p-3 text-center`} key={b}>
              <p className="text-xl font-black">{a}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{b}</p>
            </div>
          ))}
        </div>
        
        <p className="mt-6 text-xs font-black uppercase tracking-wider text-slate-500">Mutual peer requests (2)</p>
        
        <div className="mt-3 space-y-2">
          {["Maya · NY Transit", "Lucas · IL Transit"].map(x => (
            <div className={`${card} flex items-center justify-between p-4`} key={x}>
              <span className="text-sm font-black">{x}</span>
              <div className="flex gap-2">
                <button className="rounded-full bg-[#d7192b] p-2 text-white hover:bg-[#c41f36] transition-colors"><Check size={14} /></button>
                <button className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 transition-colors"><X size={14} /></button>
              </div>
            </div>
          ))}
        </div>
        
        <p className="mt-6 text-xs font-black uppercase tracking-wider text-slate-500">Past validated rides</p>
        
        <div className={`${card} mt-3 flex items-center justify-between p-4`}>
          <div>
            <p className="font-black">Downtown to LAX Airport</p>
            <p className="mt-1 text-xs text-slate-500">Today at 9:41 AM · 11.4 miles</p>
          </div>
          <b>24m 18s</b>
        </div>
        
        <div className="mt-auto pt-6">
          <Button onClick={() => setLocation("/vibe")}><Car size={17} /> Start New In-Transit Match</Button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
