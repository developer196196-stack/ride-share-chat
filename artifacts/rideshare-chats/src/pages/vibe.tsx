import { BadgeCheck, Sparkles, UsersRound } from "lucide-react";
import { useLocation } from "wouter";
import { Header, pill, Button, BottomNav } from "@/components/shared";
import { useLocalStorage } from "@/hooks/use-local-storage";

function BriefcaseIcon() { 
  return <div className="h-4 w-4 rounded-[3px] border-2 border-current" />; 
}

export default function Vibe() {
  const [, setLocation] = useLocation();
  const [selectedVibe, setSelectedVibe] = useLocalStorage("rs_vibe", "Party Mode");

  const handleNext = () => {
    setLocation("/room");
  };

  const handleMatch = () => {
    setLocation("/match");
  };

  const handleHistory = () => {
    setLocation("/history");
  };

  return (
    <div className="flex min-h-full flex-col pt-5">
      <div className="px-5">
        <Header 
          title="floatersondemand" 
          subtitle="Uber passenger · CA transit" 
          right={
            <span className={`${pill} border-red-200 bg-red-50 text-[#c41f36]`}>
              <BadgeCheck size={12} /> Verified
            </span>
          } 
        />
        
        <div className="mt-5 rounded-[22px] border border-red-200 bg-gradient-to-r from-red-50 to-white p-5">
          <span className={`${pill} border-red-200 bg-[#d7192b] text-white`}>Recommended room</span>
          <p className="mt-3 text-lg font-black">Party Mode &amp; Late Night Hype</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">High-energy banter with active riders traveling in CA and TX.</p>
        </div>
        
        <div className="mt-6 flex items-end justify-between">
          <h2 className="text-2xl font-black tracking-[-0.05em]">Choose your vibe</h2>
          <span className="text-xs font-bold text-[#c41f36]">4 rolling queues</span>
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button 
            onClick={() => setSelectedVibe("Party Mode")}
            className={`rounded-[22px] p-4 text-left shadow-sm transition-all ${
              selectedVibe === "Party Mode" 
                ? "border-2 border-[#d7192b] bg-white" 
                : "border border-slate-200 bg-white opacity-80"
            }`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              selectedVibe === "Party Mode" ? "bg-[#d7192b] text-white" : "bg-slate-100 text-slate-500"
            }`}>
              <Sparkles size={19} />
            </div>
            <p className="mt-4 font-black">Party Mode</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Weekend vibes, music recommendations, fast banter.</p>
            {selectedVibe === "Party Mode" && (
              <div className="mt-5 border-t border-slate-100 pt-3 text-[10px] font-bold text-[#d7192b]">High energy</div>
            )}
          </button>
          
          <button 
            onClick={() => setSelectedVibe("Networking")}
            className={`rounded-[22px] p-4 text-left transition-all ${
              selectedVibe === "Networking" 
                ? "border-2 border-[#d7192b] bg-white shadow-sm" 
                : "border border-slate-200 bg-white opacity-80"
            }`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              selectedVibe === "Networking" ? "bg-[#d7192b] text-white" : "bg-slate-100 text-slate-700"
            }`}>
              <BriefcaseIcon />
            </div>
            <p className="mt-4 font-black">Networking</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Founders, creatives, and operators.</p>
            {selectedVibe === "Networking" && (
              <div className="mt-5 border-t border-slate-100 pt-3 text-[10px] font-bold text-[#d7192b]">Professional</div>
            )}
          </button>
        </div>
        
        <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4 text-xs text-slate-500">
          <span className="font-bold text-emerald-600">● Selected: {selectedVibe}</span>
          <span className="float-right">Up to 9 in transit</span>
          <p className="mt-2">Rolling room auto-fills with verified passengers on active rides.</p>
        </div>
        
        <div className="mt-auto space-y-3 pt-6 pb-4">
          <Button onClick={handleNext}><UsersRound size={17} /> Join Rolling Room Queue</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button secondary onClick={handleMatch}>Fast Escape</Button>
            <Button secondary onClick={handleHistory}>History / Settings</Button>
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
