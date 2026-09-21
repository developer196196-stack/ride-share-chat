import { ArrowRight, Timer, UsersRound } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/shared";

export default function OnboardingSecond() {
  const [, setLocation] = useLocation();

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden rounded-[34px] bg-[#f8fafc] px-5 pb-4 pt-5">
      <header className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-slate-200 bg-white shadow-sm">
            <img className="h-8 w-8 object-contain" src="/images/rs-ride-share-chats-logo.png" alt="RS Chats" />
          </div>
          <div>
            <h1 className="text-[15px] font-black leading-none tracking-[-0.03em] text-slate-900">Rideshare Chats</h1>
            <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#be3144]">Global community</p>
          </div>
        </div>
        <button type="button" onClick={() => setLocation("/rules")} className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-bold text-slate-500 shadow-sm" data-testid="button-skip">
          Skip
        </button>
      </header>

      <section className="mt-14 rounded-[27px] border border-slate-200 bg-white p-4 shadow-[0_2px_4px_rgba(20,30,50,0.04)]">
        <div className="relative h-[194px] overflow-hidden rounded-[21px] bg-slate-900">
          <img
            className="absolute left-1/2 top-[-142%] max-w-none w-[256%] -translate-x-1/2"
            src="/images/rs-onboarding-screen-2-source.png"
            alt="Passenger riding through a city at night"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent px-3.5 pb-3 pt-10">
            <p className="flex items-center gap-2 text-[12px] font-medium text-white">
              <span className="h-2 w-2 rounded-full bg-[#16bb84] shadow-[0_0_0_3px_rgba(22,187,132,0.12)]" />
              Live from Uber &amp; Lyft rides nationwide
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <span className="rounded-full border border-[#efc8cf] bg-[#fff0f2] px-2.5 py-1 text-[10px] font-extrabold text-[#c33a4f]">100% In-Transit</span>
          <span className="rounded-full border border-[#ccefe5] bg-[#edfbf6] px-2.5 py-1 text-[10px] font-extrabold text-[#36a989]">Zero Couch Lurkers</span>
        </div>
        <h2 className="mt-2.5 text-[21px] font-black leading-[1.16] tracking-[-0.045em] text-slate-950">Verified rides only. Real people moving together.</h2>
        <p className="mt-2.5 text-[12px] leading-[1.65] text-slate-500">
          Our Trip Validation Engine checks speed (&gt;15 MPH), micro-vibrations, and ride receipts so every room member is genuinely moving.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
          {[
            { icon: <UsersRound size={16} />, value: "9-Seat", label: "Rolling Rooms", tone: "bg-[#fff0f2] text-[#cb3850]" },
            { icon: <Timer size={16} />, value: "5 Min", label: "Traffic Grace", tone: "bg-[#edfbf6] text-[#33aa88]" },
            { icon: <ArrowRight size={16} />, value: "Instant", label: "Fast Escape", tone: "bg-[#fff0f2] text-[#cb3850]" },
          ].map((benefit) => (
            <div key={benefit.value} className="flex min-w-0 flex-col items-center rounded-[17px] bg-[#f5f7fa] px-1 py-2.5 text-center">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${benefit.tone}`}>{benefit.icon}</span>
              <strong className="mt-1 text-[11px] font-black text-slate-900">{benefit.value}</strong>
              <span className="text-[9px] font-semibold text-slate-400">{benefit.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-3 py-2.5 shadow-[0_3px_8px_rgba(20,30,50,0.04)]">
        <div className="flex -space-x-2">
          {["NY", "LA", "CH", "MI"].map((initials, index) => (
            <span key={initials} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[8px] font-black text-white ${["bg-[#c49583]", "bg-[#6d788d]", "bg-[#d0a06e]", "bg-[#778c78]"][index]}`}>
              {initials}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-black text-slate-900">1,420+ Passengers riding now</p>
          <p className="text-[10px] text-slate-400">NYC · LA · Chicago · Miami · Austin</p>
        </div>
        <span className="h-2 w-2 rounded-full bg-[#16bb84]" />
      </div>

      <div className="mt-auto">
        <div className="flex justify-center gap-1.5 py-5">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="h-1.5 w-6 rounded-full bg-[#d7192b]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        </div>
        <div className="grid grid-cols-[1fr_1.85fr] gap-2">
          <button type="button" onClick={() => setLocation("/rules")} className="h-[52px] rounded-[17px] border border-slate-200 bg-white px-2 text-[13px] font-extrabold text-slate-800 shadow-sm" data-testid="button-how-it-works">
            How It Works
          </button>
          <button type="button" onClick={() => setLocation("/rules")} className="flex h-[52px] items-center justify-center gap-2 rounded-[17px] bg-[#d7192b] text-[13px] font-extrabold text-white shadow-[0_10px_20px_rgba(215,25,43,0.2)]" data-testid="button-verify-enter">
            Verify &amp; Enter Ride <ArrowRight size={17} />
          </button>
        </div>
        <p className="px-4 pt-3 text-center text-[10px] leading-4 text-slate-400">By continuing, you enable real-time trip motion &amp; video matchmaking permissions.</p>
      </div>
    </div>
  );
}
