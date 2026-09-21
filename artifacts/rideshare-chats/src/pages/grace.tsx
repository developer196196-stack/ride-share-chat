import { Timer } from "lucide-react";
import { useLocation } from "wouter";
import { pill, Button } from "@/components/shared";

export default function Grace() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-full flex-col justify-center bg-slate-700/80 px-5">
      <div className="rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Timer size={27} />
        </div>
        
        <div className="flex justify-center">
          <span className={`${pill} mt-5 border-amber-200 bg-amber-50 text-amber-600`}>
            Traffic grace active
          </span>
        </div>
        
        <h2 className="mt-4 text-center text-2xl font-black">5-minute state hold</h2>
        <p className="mt-2 text-center text-sm leading-6 text-slate-500">Your ride paused at a traffic light or congestion. Stay in the room while we wait for speed recovery.</p>
        
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Hold countdown</p>
            <p className="mt-1 font-mono text-2xl font-black text-amber-600">04:38</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Threshold</p>
            <p className="mt-2 text-xs font-black">&gt;15 MPH resumes</p>
          </div>
        </div>
        
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button secondary onClick={() => setLocation("/room")}>Stay in Room</Button>
          <Button onClick={() => setLocation("/summary")}>Exit Now</Button>
        </div>
      </div>
    </div>
  );
}
