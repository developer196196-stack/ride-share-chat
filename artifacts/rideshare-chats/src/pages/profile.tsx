import { ArrowRight, BadgeCheck, Camera } from "lucide-react";
import { useLocation } from "wouter";
import { Header, card, pill, Button } from "@/components/shared";
import { useLocalStorage } from "@/hooks/use-local-storage";

export default function Profile() {
  const [, setLocation] = useLocation();
  const [, setProfileComplete] = useLocalStorage("rs_profile_complete", false);

  const handleNext = () => {
    setProfileComplete(true);
    setLocation("/connect");
  };

  return (
    <div className="flex min-h-full flex-col px-5 py-5">
      <Header 
        title="RS Chats" 
        onBack={() => setLocation("/auth")} 
        right={<span className="text-xs font-bold text-slate-500">Step 2/4</span>} 
      />
      
      <div className="mt-16">
        <span className={`${pill} border-emerald-200 bg-emerald-50 text-emerald-600`}>
          <BadgeCheck size={13} /> Passenger verification
        </span>
        <h2 className="mt-4 text-[29px] font-black tracking-[-0.06em]">Set up your profile</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Other verified riders will see your display name, city, and active vibe badge.</p>
        
        <div className="my-5 flex justify-center">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-red-100 bg-gradient-to-br from-slate-300 to-slate-600 text-3xl font-black text-white">
            FS
            <span className="absolute -right-1 bottom-0 rounded-full bg-[#d7192b] p-2">
              <Camera size={15} />
            </span>
            <span className="absolute -top-1 right-0 rounded-full bg-emerald-500 px-2 py-1 text-[9px] font-bold text-white">
              Verified
            </span>
          </div>
        </div>
        
        <p className="text-center text-xs font-semibold text-slate-500">
          <BadgeCheck className="mr-1 inline text-emerald-500" size={14} />
          Liveness biometric selfie matched
        </p>
        
        <div className={`${card} mt-5 p-4`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Display name</p>
          <p className="mt-2 font-black">floatersondemand</p>
        </div>
        
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className={`${card} p-4`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Home metro</p>
            <p className="mt-2 text-xs font-black">Los Angeles, CA</p>
          </div>
          <div className={`${card} p-4`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ride style</p>
            <p className="mt-2 text-xs font-black">Party &amp; Tech</p>
          </div>
        </div>
      </div>
      
      <div className="mt-auto pt-6">
        <Button onClick={handleNext}>Save &amp; Link Rideshare <ArrowRight size={18} /></Button>
      </div>
    </div>
  );
}
