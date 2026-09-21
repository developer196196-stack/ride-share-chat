import { Check, Gauge, Navigation, Signal, Video, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { Header, card, pill, Button } from "@/components/shared";
import { useLocalStorage } from "@/hooks/use-local-storage";

export default function Permissions() {
  const [, setLocation] = useLocation();
  const [, setPermissionsGranted] = useLocalStorage("rs_permissions_granted", false);

  const handleNext = () => {
    setPermissionsGranted(true);
    setLocation("/validation");
  };

  const items = [
    ["Camera & Microphone", "Stream HD video and audio in active room", Video], 
    ["High-Precision GPS", "Verifies vehicle speed > 15 MPH in transit", Navigation], 
    ["Motion & Accelerometer", "Micro-vibrations confirm vehicle cabin motion", Gauge]
  ] as const;

  return (
    <div className="flex min-h-full flex-col px-5 py-5">
      <Header 
        title="RS Chats" 
        onBack={() => setLocation("/connect")} 
        right={<span className="text-xs font-bold text-slate-500">Step 4/4</span>} 
      />
      
      <div className="mt-16">
        <span className={`${pill} border-emerald-200 bg-emerald-50 text-emerald-600`}>
          <Signal size={13} /> Hardware telemetry handshake
        </span>
        <h2 className="mt-4 text-[29px] font-black tracking-[-0.06em]">Device permissions</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Required to calculate real-time speed, anti-couch spoofing, and 9-seater video rooms.</p>
        
        <div className="mt-6 space-y-3">
          {items.map(([name, desc, Icon]) => (
            <div className={`${card} flex items-center gap-3 p-4`} key={name}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#d7192b]">
                <Icon size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black">{name}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
              <div className="h-6 w-11 shrink-0 rounded-full bg-[#d7192b] p-1 cursor-pointer">
                <div className="ml-auto h-4 w-4 rounded-full bg-white shadow-sm" />
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-100 p-4 text-xs font-bold">
          <span><Check className="mr-2 inline text-emerald-500" size={15} />Trip Validation Engine Ready</span>
          <span className="text-[#d7192b]">READY</span>
        </div>
      </div>
      
      <div className="mt-auto pt-6">
        <Button onClick={handleNext}>Launch Trip Validation <Zap size={17} /></Button>
      </div>
    </div>
  );
}
