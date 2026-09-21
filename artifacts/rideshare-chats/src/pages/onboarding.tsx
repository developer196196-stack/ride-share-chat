import { useState } from "react";
import { ArrowRight, ArrowUpRight, LockKeyhole, ShieldCheck, Signal, X } from "lucide-react";
import { useLocation } from "wouter";
import { BrandMark, Button, pill, avatars } from "@/components/shared";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden rounded-[34px] bg-[#f7f8fa] px-5 pb-5 pt-4">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#d7192b]/[0.07] blur-3xl" />
      <header className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <div>
            <p className="text-[15px] font-black tracking-[-0.04em] text-slate-950">Rideshare Chats</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Move together</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLocation("/rules")}
          className="rounded-full px-3 py-2 text-[11px] font-extrabold text-slate-500 transition-colors hover:bg-white hover:text-[#c41f36] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d7192b]"
          data-testid="button-skip"
        >
          Skip
        </button>
      </header>

      <div className="relative mt-5 flex items-center justify-between">
        <span className={`${pill} border-emerald-200 bg-emerald-50 text-emerald-700`}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Global telemetry live
        </span>
        <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-[#c41f36]">100% IN-TRANSIT</span>
      </div>

      <section className="relative mt-4 overflow-hidden rounded-[27px] border border-white bg-[#191d27] shadow-[0_18px_35px_rgba(26,31,43,0.18)]">
        <img
          className="h-[250px] w-full object-cover object-[50%_42%] opacity-90 sm:h-[285px]"
          src="/images/rs-flow-onboarding-reference.png"
          alt="Nine verified passengers in a live rideshare video room"
        />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <span className="rounded-full border border-white/20 bg-slate-950/60 px-2.5 py-1.5 text-[9px] font-bold text-white backdrop-blur-sm">
            Active ride
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-slate-950/60 px-2.5 py-1.5 text-[9px] font-bold text-emerald-200 backdrop-blur-sm">
            <ShieldCheck size={11} /> Trip verified
          </span>
        </div>
        <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-slate-950/70 p-3.5 text-white backdrop-blur-md">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-red-200">Live video rooms</p>
              <h2 className="mt-1 text-[25px] font-black leading-[0.95] tracking-[-0.06em]">Meet while<br />you move.</h2>
            </div>
            <div className="mb-0.5 rounded-xl bg-[#d7192b] px-2.5 py-2 text-right shadow-lg">
              <p className="text-[15px] font-black leading-none">9</p>
              <p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-red-100">seat room</p>
            </div>
          </div>
        </div>
      </section>

      <div className="relative mt-4">
        <h1 className="text-[28px] font-black leading-[0.98] tracking-[-0.07em] text-slate-950">The ride is better<br /><span className="text-[#c41f36]">with company.</span></h1>
        <p className="mt-2.5 max-w-[310px] text-[12px] leading-5 text-slate-500">Join a live room with verified Uber and Lyft passengers who are already on the move.</p>
      </div>

      <div className="relative mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white/75 py-3 shadow-sm">
        {[["9", "seat rooms"], ["24/7", "moderation"], ["< 5s", "match time"]].map(([value, label]) => (
          <div key={label} className="text-center">
            <p className="text-[17px] font-black tracking-[-0.04em] text-slate-950">{value}</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="relative mt-3 flex items-center gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
        <div className="flex -space-x-2">
          {avatars.slice(0, 4).map(([name]) => (
            <div key={name} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-emerald-50 bg-slate-700 text-[8px] font-black text-white">{name.slice(0, 2).toUpperCase()}</div>
          ))}
        </div>
        <p className="text-[10px] font-semibold leading-4 text-emerald-900"><b>184 passengers</b> are riding live<br />across the community</p>
        <Signal size={15} className="ml-auto text-emerald-600" />
      </div>

      <div className="relative mt-auto space-y-2.5 pt-4">
        <Button onClick={() => setLocation("/onboarding2")}>Verify Your Ride &amp; Join <ArrowRight size={18} /></Button>
        <button
          type="button"
          onClick={() => setShowHowItWorks(true)}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-[15px] text-[12px] font-extrabold text-slate-600 transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d7192b]"
          data-testid="button-how-it-works"
        >
          How It Works <ArrowUpRight size={15} />
        </button>
        <div className="flex items-center justify-center gap-2 pt-0.5">
          <span className="h-1.5 w-5 rounded-full bg-[#d7192b]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="ml-1 text-[9px] font-bold text-slate-400">1 of 3</span>
        </div>
        <p className="flex items-center justify-center gap-1.5 text-center text-[9px] font-semibold text-slate-400"><LockKeyhole size={11} className="text-emerald-600" /> Your ride data stays private and encrypted</p>
      </div>

      {showHowItWorks && (
        <div className="absolute inset-0 z-10 flex items-end bg-slate-950/35 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="how-it-works-title">
          <div className="w-full rounded-t-[28px] bg-white p-5 shadow-[0_-20px_45px_rgba(20,30,50,0.18)]">
            <div className="mx-auto h-1.5 w-11 rounded-full bg-slate-200" />
            <div className="mt-5 flex items-start justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c41f36]">Safety, first</p><h2 id="how-it-works-title" className="mt-1 text-xl font-black tracking-[-0.05em]">How it works</h2></div>
              <button type="button" onClick={() => setShowHowItWorks(false)} aria-label="Close how it works" className="rounded-full bg-slate-100 p-2 text-slate-500" data-testid="button-close-how-it-works"><X size={16} /></button>
            </div>
            <div className="mt-4 space-y-3">
              {[["01", "Verify your active ride", "We confirm your Uber or Lyft trip before you enter."], ["02", "Join the rolling room", "Match with passengers who are genuinely in transit."], ["03", "Leave whenever you want", "Live moderation and a fast exit keep the room comfortable."]].map(([number, title, copy]) => (
                <div key={number} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                  <span className="font-mono text-[11px] font-bold text-[#c41f36]">{number}</span>
                  <div><p className="text-xs font-black">{title}</p><p className="mt-0.5 text-[11px] leading-4 text-slate-500">{copy}</p></div>
                </div>
              ))}
            </div>
            <Button onClick={() => { setShowHowItWorks(false); setLocation("/onboarding2"); }}>Verify &amp; Continue <ArrowRight size={17} /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
