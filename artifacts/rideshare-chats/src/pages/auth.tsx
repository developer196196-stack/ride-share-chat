import { ArrowRight, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { Header, card, pill, Button } from "@/components/shared";
import { useLocalStorage } from "@/hooks/use-local-storage";

export default function Auth() {
  const [, setLocation] = useLocation();
  const [, setIsVerified] = useLocalStorage("rs_is_verified", false);

  const handleNext = () => {
    setIsVerified(true);
    setLocation("/profile");
  };

  return (
    <div className="flex min-h-full flex-col px-5 py-5">
      <Header 
        title="RS Chats" 
        onBack={() => setLocation("/rules")} 
        right={<span className="text-xs font-bold text-slate-500">Step 1/4</span>} 
      />
      
      <div className="mt-20">
        <span className={`${pill} border-red-200 bg-red-50 text-[#c41f36]`}>
          <ShieldCheck size={13} /> Secure transit identity
        </span>
        <h2 className="mt-4 text-[29px] font-black leading-[1.05] tracking-[-0.06em] text-slate-950">Enter your mobile number</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">We will send a 6-digit verification code to confirm your device and link your active transit credentials.</p>
        
        <div className={`${card} mt-6 p-4`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Phone number</p>
          <p className="mt-2 text-lg font-black">US +1&nbsp;&nbsp; (555) 382–9104</p>
        </div>
        
        <div className={`${card} mt-3 p-4`}>
          <div className="flex justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Verification code</p>
            <span className="text-xs font-bold text-[#c41f36]">Resend (42s)</span>
          </div>
          <div className="mt-3 grid grid-cols-6 gap-2">
            {["8", "4", "9", "2", "1", "·"].map((n, i) => (
              <div 
                key={i} 
                className={`flex h-11 items-center justify-center rounded-xl border text-lg font-black ${
                  i < 4 ? "border-[#d7192b] text-slate-900" : "border-slate-200 text-slate-300"
                }`}
              >
                {n}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-auto pt-6">
        <Button onClick={handleNext}>Verify &amp; Create Profile <ArrowRight size={18} /></Button>
        <p className="mt-3 text-center text-[10px] text-slate-400">By signing in, you accept our Transit Safety Code &amp; Privacy Terms.</p>
      </div>
    </div>
  );
}
