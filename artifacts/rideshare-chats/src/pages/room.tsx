import { useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronRight, Mic, ShieldCheck, Video, X } from "lucide-react";
import { useLocation } from "wouter";
import { card, avatars, Button, BottomNav } from "@/components/shared";

export default function Room() {
  const [, setLocation] = useLocation();
  const [showReport, setShowReport] = useState(false);

  return (
    <div className="flex min-h-full flex-col pt-5">
      <div className="flex min-h-full flex-col px-5 relative pb-20">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-[#d7192b] px-3 py-2 text-xs font-black text-white shadow-sm">Party Mode</span>
          <button 
            onClick={() => setLocation("/grace")} 
            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-600 transition-colors hover:bg-amber-100"
          >
            Grace: 03:42
          </button>
          <button 
            onClick={() => setLocation("/match")} 
            className="rounded-full bg-[#d7192b] px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-[#c41f36]"
          >
            Next Room <ArrowRight className="ml-1 inline" size={13} />
          </button>
        </div>
        
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[["You", "CA"], ...avatars].map(([name, loc], i) => (
            <div 
              className={`relative aspect-[0.82] overflow-hidden rounded-[17px] border-2 ${
                i === 0 ? "border-red-400" : i === 1 ? "border-emerald-400" : "border-white"
              } bg-gradient-to-br ${
                i % 2 ? "from-slate-300 to-slate-500" : "from-amber-200 to-slate-500"
              } p-2 shadow-sm`} 
              key={name}
            >
              <div className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-1 text-[9px] font-bold text-white backdrop-blur-sm">
                {name} ({loc})
              </div>
            </div>
          ))}
        </div>
        
        <div className={`${card} mt-4 p-4 text-xs leading-5 text-slate-500`}>
          <p><strong className="text-emerald-500">Maya:</strong> Heading to JFK airport right now</p>
          <p><strong className="text-[#d7192b]">David:</strong> Traffic in Seattle is wild today.</p>
        </div>
        
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs whitespace-nowrap cursor-pointer hover:bg-slate-200 transition-colors">Vibe</span>
          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs whitespace-nowrap cursor-pointer hover:bg-slate-200 transition-colors">Traffic</span>
          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs whitespace-nowrap cursor-pointer hover:bg-slate-200 transition-colors">Hello</span>
        </div>
        
        <div className="mt-3 flex items-center rounded-full border border-slate-200 bg-white px-4 py-3 text-xs text-slate-400 cursor-text shadow-sm">
          Drop a quick message... <ArrowUpRight className="ml-auto text-[#d7192b]" size={16} />
        </div>
        
        <div className="mt-auto grid grid-cols-4 gap-2 border-t border-slate-200 pt-4 bg-[#f8fafc]">
          <button className="flex h-12 items-center justify-center rounded-2xl bg-slate-100 transition-colors hover:bg-slate-200 text-slate-700">
            <Mic size={18} />
          </button>
          <button className="flex h-12 items-center justify-center rounded-2xl bg-slate-100 transition-colors hover:bg-slate-200 text-slate-700">
            <Video size={18} />
          </button>
          <button 
            onClick={() => setShowReport(true)} 
            className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold transition-colors hover:bg-slate-50 text-slate-800 shadow-sm"
          >
            <ShieldCheck size={17} className="text-[#d7192b]" /> Report
          </button>
        </div>
        
        <button 
          onClick={() => setLocation("/summary")} 
          className="mt-4 pb-2 text-center text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
        >
          Disconnect &amp; view ride summary
        </button>

        {showReport && (
          <div className="fixed inset-0 z-50 flex items-end bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowReport(false)}>
            <div className="w-full rounded-t-[30px] bg-white p-6 shadow-[0_-20px_50px_rgba(20,30,50,0.16)]" onClick={e => e.stopPropagation()}>
              <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" />
              <div className="mt-6 flex items-center justify-between">
                <h2 className="text-xl font-black">Quick report</h2>
                <button onClick={() => setShowReport(false)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 transition-colors"><X size={18} /></button>
              </div>
              <p className="mt-2 text-sm text-slate-500">Mute this participant instantly and log a safety incident.</p>
              
              <div className="mt-5 space-y-2">
                {["Harassment or unsafe conduct", "Spam or inappropriate content", "Something else"].map(x => (
                  <button 
                    onClick={() => setShowReport(false)} 
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-4 text-left text-sm font-bold hover:bg-slate-50 transition-colors" 
                    key={x}
                  >
                    {x}<ChevronRight size={16} className="text-slate-400" />
                  </button>
                ))}
              </div>
              
              <div className="mt-4">
                <Button secondary onClick={() => setShowReport(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
