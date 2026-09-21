import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Camera,
  Car,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Gauge,
  Headphones,
  History as HistoryIcon,
  LockKeyhole,
  Mic,
  MoreHorizontal,
  Navigation,
  Radio,
  RotateCcw,
  Settings,
  ShieldCheck,
  Signal,
  Sparkles,
  Timer,
  UserRound,
  UsersRound,
  Video,
  X,
  Zap,
} from "lucide-react";

type Screen =
  | "onboarding"
  | "onboarding2"
  | "rules"
  | "auth"
  | "profile"
  | "connect"
  | "permissions"
  | "validation"
  | "vibe"
  | "room"
  | "report"
  | "summary"
  | "grace"
  | "match"
  | "history"
  | "settings";

const avatars = [
  ["Maya", "NY", "MA"],
  ["Lucas", "IL", "LU"],
  ["Elena", "TX", "EL"],
  ["David", "WA", "DA"],
  ["Zara", "FL", "ZA"],
  ["Devon", "CO", "DE"],
  ["Sam", "GA", "SA"],
  ["Leo", "AZ", "LE"],
];

const pill = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em]";
const card = "rounded-[22px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(20,30,50,0.06)]";

function BrandMark() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-slate-200 bg-white shadow-sm">
      <img className="h-8 w-8 object-contain" src="/__mockup/images/rs-ride-share-chats-logo.png" alt="RS Chats" />
    </div>
  );
}

function Header({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600" aria-label="Back">
            <ArrowLeft size={17} />
          </button>
        ) : (
          <BrandMark />
        )}
        <div>
          <h1 className="text-[18px] font-black leading-none tracking-[-0.04em] text-slate-950">{title}</h1>
          {subtitle && <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </header>
  );
}

function Button({ children, onClick, secondary = false }: { children: ReactNode; onClick?: () => void; secondary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-12 w-full items-center justify-center gap-2 rounded-[15px] text-[14px] font-extrabold transition-transform active:scale-[0.98] ${
        secondary ? "border border-slate-200 bg-white text-slate-700" : "bg-[#d7192b] text-white shadow-[0_10px_22px_rgba(215,25,43,0.2)]"
      }`}
    >
      {children}
    </button>
  );
}

function BottomNav({ onHistory, onSettings }: { onHistory: () => void; onSettings: () => void }) {
  return (
    <nav className="mt-auto grid grid-cols-3 border-t border-slate-200 bg-white/95 px-5 pb-2 pt-3">
      <button className="flex flex-col items-center gap-1 text-[#d7192b]"><Car size={18} /><span className="text-[10px] font-bold">Home</span></button>
      <button onClick={onHistory} className="flex flex-col items-center gap-1 text-slate-400"><HistoryIcon size={18} /><span className="text-[10px] font-bold">History</span></button>
      <button onClick={onSettings} className="flex flex-col items-center gap-1 text-slate-400"><Settings size={18} /><span className="text-[10px] font-bold">Settings</span></button>
    </nav>
  );
}

function Onboarding({ onNext }: { onNext: () => void }) {
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
          onClick={onNext}
          className="rounded-full px-3 py-2 text-[11px] font-extrabold text-slate-500 transition-colors hover:bg-white hover:text-[#c41f36] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d7192b]"
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
          src="/__mockup/images/rs-flow-onboarding-reference.png"
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
        <Button onClick={onNext}>Verify Your Ride &amp; Join <ArrowRight size={18} /></Button>
        <button
          type="button"
          onClick={() => setShowHowItWorks(true)}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-[15px] text-[12px] font-extrabold text-slate-600 transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d7192b]"
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
              <button type="button" onClick={() => setShowHowItWorks(false)} aria-label="Close how it works" className="rounded-full bg-slate-100 p-2 text-slate-500"><X size={16} /></button>
            </div>
            <div className="mt-4 space-y-3">
              {[["01", "Verify your active ride", "We confirm your Uber or Lyft trip before you enter."], ["02", "Join the rolling room", "Match with passengers who are genuinely in transit."], ["03", "Leave whenever you want", "Live moderation and a fast exit keep the room comfortable."]].map(([number, title, copy]) => (
                <div key={number} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                  <span className="font-mono text-[11px] font-bold text-[#c41f36]">{number}</span>
                  <div><p className="text-xs font-black">{title}</p><p className="mt-0.5 text-[11px] leading-4 text-slate-500">{copy}</p></div>
                </div>
              ))}
            </div>
            <Button onClick={() => { setShowHowItWorks(false); onNext(); }}>Verify &amp; Continue <ArrowRight size={17} /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OnboardingSecond({ onNext, onHowItWorks }: { onNext: () => void; onHowItWorks: () => void }) {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden rounded-[34px] bg-[#f8fafc] px-5 pb-4 pt-5">
      <header className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-slate-200 bg-white shadow-sm">
            <img className="h-8 w-8 object-contain" src="/__mockup/images/rs-ride-share-chats-logo.png" alt="RS Chats" />
          </div>
          <div>
            <h1 className="text-[15px] font-black leading-none tracking-[-0.03em] text-slate-900">Rideshare Chats</h1>
            <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#be3144]">Global community</p>
          </div>
        </div>
        <button type="button" onClick={onNext} className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-bold text-slate-500 shadow-sm">
          Skip
        </button>
      </header>

      <section className="mt-14 rounded-[27px] border border-slate-200 bg-white p-4 shadow-[0_2px_4px_rgba(20,30,50,0.04)]">
        <div className="relative h-[194px] overflow-hidden rounded-[21px] bg-slate-900">
          <img
            className="absolute left-1/2 top-[-142%] max-w-none w-[256%] -translate-x-1/2"
            src="/__mockup/images/rs-onboarding-screen-2-source.png"
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
          <span className="h-1.5 w-6 rounded-full bg-[#d7192b]" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
        </div>
        <div className="grid grid-cols-[1fr_1.85fr] gap-2">
          <button type="button" onClick={onHowItWorks} className="h-[52px] rounded-[17px] border border-slate-200 bg-white px-2 text-[13px] font-extrabold text-slate-800 shadow-sm">
            How It Works
          </button>
          <button type="button" onClick={onNext} className="flex h-[52px] items-center justify-center gap-2 rounded-[17px] bg-[#d7192b] text-[13px] font-extrabold text-white shadow-[0_10px_20px_rgba(215,25,43,0.2)]">
            Verify &amp; Enter Ride <ArrowRight size={17} />
          </button>
        </div>
        <p className="px-4 pt-3 text-center text-[10px] leading-4 text-slate-400">By continuing, you enable real-time trip motion &amp; video matchmaking permissions.</p>
      </div>
    </div>
  );
}

function Rules({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return <div className="flex min-h-full flex-col"><Header title="Rideshare Chats" subtitle="Global community" onBack={onBack} right={<span className="text-xs font-bold text-slate-400">2 of 2</span>} /><div className={`${card} mt-8 overflow-hidden`}><div className="h-36 bg-gradient-to-br from-slate-900 via-slate-700 to-[#d7192b] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Live from Uber &amp; Lyft rides</p><p className="mt-12 text-xl font-black">Verified rides only.<br />Real people moving together.</p></div><div className="p-5"><p className="text-sm leading-6 text-slate-500">Our Trip Validation Engine checks speed, micro-vibrations, and ride receipts so every room member is genuinely moving.</p><div className="mt-5 grid grid-cols-3 gap-2">{[["9", "Seat rooms"], ["5m", "Grace hold"], ["Now", "Fast escape"]].map(([a, b]) => <div key={b} className="rounded-2xl bg-slate-50 p-3 text-center"><p className="text-lg font-black text-slate-900">{a}</p><p className="text-[9px] font-bold text-slate-400">{b}</p></div>)}</div></div></div><div className="mt-auto space-y-3"><Button secondary>How It Works</Button><Button onClick={onNext}>Verify &amp; Enter Ride <ArrowRight size={18} /></Button><p className="text-center text-[10px] text-slate-400">Real-time trip motion and video matchmaking permissions apply.</p></div></div>;
}

function Auth({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return <div className="flex min-h-full flex-col"><Header title="RS Chats" onBack={onBack} right={<span className="text-xs font-bold text-slate-500">Step 1/4</span>} /><div className="mt-20"><span className={`${pill} border-red-200 bg-red-50 text-[#c41f36]`}><ShieldCheck size={13} /> Secure transit identity</span><h2 className="mt-4 text-[29px] font-black leading-[1.05] tracking-[-0.06em] text-slate-950">Enter your mobile number</h2><p className="mt-3 text-sm leading-6 text-slate-500">We will send a 6-digit verification code to confirm your device and link your active transit credentials.</p><div className={`${card} mt-6 p-4`}><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Phone number</p><p className="mt-2 text-lg font-black">🇺🇸 +1&nbsp;&nbsp; (555) 382–9104</p></div><div className={`${card} mt-3 p-4`}><div className="flex justify-between"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Verification code</p><span className="text-xs font-bold text-[#c41f36]">Resend (42s)</span></div><div className="mt-3 grid grid-cols-6 gap-2">{["8", "4", "9", "2", "1", "·"].map((n, i) => <div key={i} className={`flex h-11 items-center justify-center rounded-xl border text-lg font-black ${i < 4 ? "border-[#d7192b] text-slate-900" : "border-slate-200 text-slate-300"}`}>{n}</div>)}</div></div></div><div className="mt-auto"><Button onClick={onNext}>Verify &amp; Create Profile <ArrowRight size={18} /></Button><p className="mt-3 text-center text-[10px] text-slate-400">By signing in, you accept our Transit Safety Code &amp; Privacy Terms.</p></div></div>;
}

function Profile({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return <div className="flex min-h-full flex-col"><Header title="RS Chats" onBack={onBack} right={<span className="text-xs font-bold text-slate-500">Step 2/4</span>} /><div className="mt-16"><span className={`${pill} border-emerald-200 bg-emerald-50 text-emerald-600`}><BadgeCheck size={13} /> Passenger verification</span><h2 className="mt-4 text-[29px] font-black tracking-[-0.06em]">Set up your profile</h2><p className="mt-2 text-sm leading-6 text-slate-500">Other verified riders will see your display name, city, and active vibe badge.</p><div className="my-5 flex justify-center"><div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-red-100 bg-gradient-to-br from-slate-300 to-slate-600 text-3xl font-black text-white">FS<span className="absolute -right-1 bottom-0 rounded-full bg-[#d7192b] p-2"><Camera size={15} /></span><span className="absolute -top-1 right-0 rounded-full bg-emerald-500 px-2 py-1 text-[9px] font-bold text-white">Verified</span></div></div><p className="text-center text-xs font-semibold text-slate-500"><BadgeCheck className="mr-1 inline text-emerald-500" size={14} />Liveness biometric selfie matched</p><div className={`${card} mt-5 p-4`}><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Display name</p><p className="mt-2 font-black">floatersondemand</p></div><div className="mt-3 grid grid-cols-2 gap-3"><div className={`${card} p-4`}><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Home metro</p><p className="mt-2 text-xs font-black">Los Angeles, CA</p></div><div className={`${card} p-4`}><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ride style</p><p className="mt-2 text-xs font-black">Party &amp; Tech</p></div></div></div><div className="mt-auto"><Button onClick={onNext}>Save &amp; Link Rideshare <ArrowRight size={18} /></Button></div></div>;
}

function Connect({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return <div className="flex min-h-full flex-col"><Header title="RS Chats" onBack={onBack} right={<span className="text-xs font-bold text-slate-500">Step 3/4</span>} /><div className="mt-16"><span className={`${pill} border-red-200 bg-red-50 text-[#c41f36]`}><Radio size={13} /> Platform webhook sync</span><h2 className="mt-4 text-[29px] font-black tracking-[-0.06em]">Link your ride accounts</h2><p className="mt-2 text-sm leading-6 text-slate-500">Connect Uber or Lyft to auto-unlock video chat rooms the moment your driver starts your trip.</p><div className={`${card} mt-6 border-2 border-emerald-400 p-4`}><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-xs font-black text-white">Uber</div><div><p className="font-black">Uber Passenger API</p><p className="text-xs font-semibold text-emerald-500">Connected &amp; Webhook Active</p></div></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">Linked</span></div><div className="mt-4 border-t border-slate-100 pt-3 font-mono text-[10px] text-slate-400">OAuth Token: Active</div></div><div className={`${card} mt-3 flex items-center justify-between p-4`}><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500 text-[10px] font-black text-white">lyft</div><div><p className="font-black">Lyft Passenger API</p><p className="text-xs text-slate-500">Auto-verify rides hailed on Lyft</p></div></div><span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold">Connect</span></div><div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500"><ShieldCheck className="text-emerald-500" size={17} /> We only read ride status timestamps and motion state.</div></div><div className="mt-auto"><Button onClick={onNext}>Continue to Permissions <ArrowRight size={18} /></Button></div></div>;
}

function Permissions({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const items = [["Camera & Microphone", "Stream HD video and audio in active room", Video], ["High-Precision GPS", "Verifies vehicle speed > 15 MPH in transit", Navigation], ["Motion & Accelerometer", "Micro-vibrations confirm vehicle cabin motion", Gauge]] as const;
  return <div className="flex min-h-full flex-col"><Header title="RS Chats" onBack={onBack} right={<span className="text-xs font-bold text-slate-500">Step 4/4</span>} /><div className="mt-16"><span className={`${pill} border-emerald-200 bg-emerald-50 text-emerald-600`}><Signal size={13} /> Hardware telemetry handshake</span><h2 className="mt-4 text-[29px] font-black tracking-[-0.06em]">Device permissions</h2><p className="mt-2 text-sm leading-6 text-slate-500">Required to calculate real-time speed, anti-couch spoofing, and 9-seater video rooms.</p><div className="mt-6 space-y-3">{items.map(([name, desc, Icon]) => <div className={`${card} flex items-center gap-3 p-4`} key={name}><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#d7192b]"><Icon size={19} /></div><div className="min-w-0 flex-1"><p className="font-black">{name}</p><p className="text-xs text-slate-500">{desc}</p></div><div className="h-6 w-11 rounded-full bg-[#d7192b] p-1"><div className="ml-auto h-4 w-4 rounded-full bg-white" /></div></div>)}</div><div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-100 p-4 text-xs font-bold"><span><Check className="mr-2 inline text-emerald-500" size={15} />Trip Validation Engine Ready</span><span className="text-[#d7192b]">READY</span></div></div><div className="mt-auto"><Button onClick={onNext}>Launch Trip Validation <Zap size={17} /></Button></div></div>;
}

function Validation({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return <div className="flex min-h-full flex-col"><Header title="Trip Validation" subtitle="Step 1 of 3" onBack={onBack} right={<CircleHelp className="text-slate-400" size={20} />} /><div className={`${card} mt-7 bg-gradient-to-br from-white to-red-50 p-5`}><div className="flex justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live sensor telemetry</p><p className="mt-2 text-lg font-black">Transit detected</p></div><span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-600">Active ride</span></div><div className="relative mx-auto my-6 flex h-48 w-48 items-center justify-center rounded-full border-[13px] border-r-[#d7192b] border-t-[#d7192b] border-l-slate-200 border-b-slate-200"><div className="text-center"><p className="text-5xl font-black">42</p><p className="text-[10px] font-bold tracking-widest text-slate-400">MPH</p></div></div><div className="flex items-end justify-center gap-1">{[18, 31, 45, 26, 38, 52, 30].map((h, i) => <span key={i} className="w-2 rounded-t bg-[#d7192b]" style={{ height: h }} />)}</div><p className="mt-4 text-center text-xs text-slate-500">Accelerometer micro-vibrations match in-cabin vehicle motion</p></div><div className="mt-5"><div className="flex justify-between text-xs font-bold"><span>Verification checklist</span><span className="text-[#d7192b]">2 of 3 complete</span></div><div className="mt-2 h-2 rounded-full bg-slate-200"><div className="h-2 w-2/3 rounded-full bg-[#d7192b]" /></div><div className={`${card} mt-4 divide-y divide-slate-100`}>{["GPS speed lock", "Ride platform webhook", "Vibration telemetry"].map((x, i) => <div className="flex items-center justify-between p-4" key={x}><span className="text-sm font-bold">{x}</span>{i < 2 ? <Check className="text-emerald-500" size={18} /> : <RotateCcw className="text-[#d7192b]" size={16} />}</div>)}</div></div><div className="mt-auto pt-4"><Button onClick={onNext}>Choose Your Vibe <ArrowRight size={18} /></Button></div></div>;
}

function Vibe({ onNext, onMatch, onHistory, onSettings }: { onNext: () => void; onMatch: () => void; onHistory: () => void; onSettings: () => void }) {
  return <div className="flex min-h-full flex-col"><Header title="floatersondemand" subtitle="Uber passenger · CA transit" right={<span className={`${pill} border-red-200 bg-red-50 text-[#c41f36]`}><BadgeCheck size={12} /> Verified</span>} /><div className="mt-5 rounded-[22px] border border-red-200 bg-gradient-to-r from-red-50 to-white p-5"><span className={`${pill} border-red-200 bg-[#d7192b] text-white`}>Recommended room</span><p className="mt-3 text-lg font-black">Party Mode &amp; Late Night Hype</p><p className="mt-1 text-xs leading-5 text-slate-500">High-energy banter with active riders traveling in CA and TX.</p></div><div className="mt-6 flex items-end justify-between"><h2 className="text-2xl font-black tracking-[-0.05em]">Choose your vibe</h2><span className="text-xs font-bold text-[#c41f36]">4 rolling queues</span></div><div className="mt-4 grid grid-cols-2 gap-3"><button className="rounded-[22px] border-2 border-[#d7192b] bg-white p-4 text-left shadow-sm"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d7192b] text-white"><Sparkles size={19} /></div><p className="mt-4 font-black">Party Mode</p><p className="mt-1 text-xs leading-5 text-slate-500">Weekend vibes, music recommendations, fast banter.</p><div className="mt-5 border-t border-slate-100 pt-3 text-[10px] font-bold text-[#d7192b]">High energy</div></button><button className="rounded-[22px] border border-slate-200 bg-white p-4 text-left"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><BriefcaseIcon /></div><p className="mt-4 font-black">Networking</p><p className="mt-1 text-xs leading-5 text-slate-500">Founders, creatives, and operators.</p></button></div><div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4 text-xs text-slate-500"><span className="font-bold text-emerald-600">● Selected: Party Mode</span><span className="float-right">Up to 9 in transit</span><p className="mt-2">Rolling room auto-fills with verified passengers on active rides.</p></div><div className="mt-auto space-y-3 pt-4"><Button onClick={onNext}><UsersRound size={17} /> Join Rolling Room Queue</Button><div className="grid grid-cols-2 gap-2"><Button secondary onClick={onMatch}>Fast Escape</Button><Button secondary onClick={onHistory}>History / Settings</Button></div></div><BottomNav onHistory={onHistory} onSettings={onSettings} /></div>;
}

function BriefcaseIcon() { return <div className="h-4 w-4 rounded-[3px] border-2 border-current" />; }

function Room({ onNext, onSummary, onGrace, onReport, onBack }: { onNext: () => void; onSummary: () => void; onGrace: () => void; onReport: () => void; onBack: () => void }) {
  return <div className="flex min-h-full flex-col"><div className="flex items-center justify-between"><span className="rounded-full bg-[#d7192b] px-3 py-2 text-xs font-black text-white">Party Mode</span><button onClick={onGrace} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-600">Grace: 03:42</button><button onClick={onNext} className="rounded-full bg-[#d7192b] px-3 py-2 text-xs font-black text-white">Next Room <ArrowRight className="ml-1 inline" size={13} /></button></div><div className="mt-4 grid grid-cols-3 gap-2">{[["You", "CA"], ...avatars].map(([name, loc], i) => <div className={`relative aspect-[0.82] overflow-hidden rounded-[17px] border-2 ${i === 0 ? "border-red-400" : i === 1 ? "border-emerald-400" : "border-white"} bg-gradient-to-br ${i % 2 ? "from-slate-300 to-slate-500" : "from-amber-200 to-slate-500"} p-2`} key={name}><div className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-1 text-[9px] font-bold text-white">{name} ({loc})</div></div>)}</div><div className={`${card} mt-4 p-4 text-xs leading-5 text-slate-500`}><p><strong className="text-emerald-500">Maya:</strong> Heading to JFK airport right now</p><p><strong className="text-[#d7192b]">David:</strong> Traffic in Seattle is wild today.</p></div><div className="mt-3 flex gap-2"><span className="rounded-full bg-slate-100 px-3 py-2 text-xs">Vibe</span><span className="rounded-full bg-slate-100 px-3 py-2 text-xs">Traffic</span><span className="rounded-full bg-slate-100 px-3 py-2 text-xs">Hello</span></div><div className="mt-3 flex items-center rounded-full border border-slate-200 px-4 py-3 text-xs text-slate-400">Drop a quick message... <ArrowUpRight className="ml-auto text-[#d7192b]" size={16} /></div><div className="mt-auto grid grid-cols-4 gap-2 border-t border-slate-200 pt-4"><button className="flex h-12 items-center justify-center rounded-2xl bg-slate-100"><Mic size={18} /></button><button className="flex h-12 items-center justify-center rounded-2xl bg-slate-100"><Video size={18} /></button><button onClick={onReport} className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 text-sm font-bold"><ShieldCheck size={17} className="text-[#d7192b]" /> Report</button></div><button onClick={onSummary} className="mt-2 text-center text-xs font-bold text-slate-400">Disconnect &amp; view ride summary</button></div>;
}

function Report({ onClose }: { onClose: () => void }) {
  return <div className="flex min-h-full flex-col justify-end"><div className="rounded-t-[30px] bg-white p-6 shadow-[0_-20px_50px_rgba(20,30,50,0.16)]"><div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" /><div className="mt-6 flex items-center justify-between"><h2 className="text-xl font-black">Quick report</h2><button onClick={onClose}><X /></button></div><p className="mt-2 text-sm text-slate-500">Mute this participant instantly and log a safety incident.</p><div className="mt-5 space-y-2">{["Harassment or unsafe conduct", "Spam or inappropriate content", "Something else"].map(x => <button onClick={onClose} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-4 text-left text-sm font-bold" key={x}>{x}<ChevronRight size={16} /></button>)}</div><Button secondary onClick={onClose}>Cancel</Button></div></div>;
}

function Summary({ onVibe, onHistory, onSettings }: { onVibe: () => void; onHistory: () => void; onSettings: () => void }) {
  return <div className="flex min-h-full flex-col"><div className="text-center"><BrandMark /><h2 className="mt-4 text-2xl font-black">Ride session completed</h2><p className="mt-2 text-sm text-slate-500">Trip ended · You safely disconnected from the room.</p></div><div className="mt-7 grid grid-cols-2 gap-3"><div className={`${card} p-4`}><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Chat duration</p><p className="mt-2 text-2xl font-black">24m 18s</p><p className="mt-1 text-xs font-bold text-emerald-500">9 passengers met</p></div><div className={`${card} p-4`}><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Validated distance</p><p className="mt-2 text-2xl font-black">11.4 mi</p><p className="mt-1 text-xs text-slate-500">Avg 34.2 MPH</p></div></div><div className={`${card} mt-4 p-5`}><h3 className="font-black">Trip validation telemetry</h3>{[["Active transit duration", "96.8% of session"], ["Traffic grace periods", "2 times (4m 12s)"], ["Ride provider status", "Uber Verified"], ["Vibe category", "Party Mode"]].map(([a, b]) => <div className="mt-4 flex justify-between text-xs" key={a}><span className="text-slate-500">{a}</span><b>{b}</b></div>)}</div><div className={`${card} mt-4 p-5`}><h3 className="font-black">How was your room experience?</h3><p className="mt-2 text-xs text-slate-500">Your rating helps improve room matching quality and community safety.</p><div className="mt-4 flex justify-between text-2xl"><span>Low</span><span>Good</span><span>Great</span><span>Best</span></div></div><div className="mt-auto space-y-2 pt-4"><Button onClick={onVibe}><RotateCcw size={17} /> Reconnect / New Matchmaking</Button><div className="grid grid-cols-2 gap-2"><Button secondary onClick={onHistory}>Connections &amp; Trips</Button><Button secondary onClick={onSettings}>Trust Center</Button></div></div></div>;
}

function Grace({ onClose, onExit }: { onClose: () => void; onExit: () => void }) {
  return <div className="flex min-h-full flex-col justify-center bg-slate-700/80"><div className="rounded-[28px] bg-white p-6 shadow-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Timer size={27} /></div><span className={`${pill} mx-auto mt-5 border-amber-200 bg-amber-50 text-amber-600`}>Traffic grace active</span><h2 className="mt-4 text-center text-2xl font-black">5-minute state hold</h2><p className="mt-2 text-center text-sm leading-6 text-slate-500">Your ride paused at a traffic light or congestion. Stay in the room while we wait for speed recovery.</p><div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 p-4"><div><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Hold countdown</p><p className="mt-1 font-mono text-2xl font-black text-amber-600">04:38</p></div><div className="text-right"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Threshold</p><p className="mt-2 text-xs font-black">&gt;15 MPH resumes</p></div></div><div className="mt-5 grid grid-cols-2 gap-3"><Button secondary onClick={onClose}>Stay in Room</Button><Button onClick={onExit}>Exit Now</Button></div></div></div>;
}

function Match({ onBack }: { onBack: () => void }) {
  return <div className="flex min-h-full flex-col items-center justify-center text-center"><div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-red-200 bg-red-50 text-[#d7192b] shadow-[0_0_0_18px_rgba(215,25,43,0.05)]"><RotateCcw size={42} /></div><span className={`${pill} mt-10 border-slate-200 bg-slate-50 text-slate-500`}><ShieldCheck size={13} /> Previous room temporarily blacklisted</span><h2 className="mt-5 text-2xl font-black">Matching next room...</h2><p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">Finding 8 other verified in-transit commuters who match your <b className="text-[#d7192b]">Party Mode</b> vibe.</p><div className={`${card} mt-6 w-full p-5 text-left`}>{[["Speed telemetry", "38.4 MPH Verified"], ["Queue match time", "< 3.2s avg"], ["Rolling region", "California Metro Corridor"]].map(([a, b]) => <div className="mb-3 flex justify-between text-xs last:mb-0" key={a}><span className="text-slate-500">{a}</span><b>{b}</b></div>)}</div><div className="mt-auto w-full"><Button secondary onClick={onBack}>Change Vibe / Cancel Search</Button></div></div>;
}

function History({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  return <div className="flex min-h-full flex-col"><Header title="Connections & Trips" subtitle="Your verified in-transit network" onBack={onBack} right={<MoreHorizontal />} /><div className="mt-5 grid grid-cols-3 gap-2">{[["28", "Peers met"], ["142", "Transit logs"], ["5.0", "Trust score"]].map(([a, b]) => <div className={`${card} p-3 text-center`} key={b}><p className="text-xl font-black">{a}</p><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{b}</p></div>)}</div><p className="mt-6 text-xs font-black uppercase tracking-wider text-slate-500">Mutual peer requests (2)</p><div className="mt-3 space-y-2">{["Maya · NY Transit", "Lucas · IL Transit"].map(x => <div className={`${card} flex items-center justify-between p-4`} key={x}><span className="text-sm font-black">{x}</span><div className="flex gap-2"><button className="rounded-full bg-[#d7192b] p-2 text-white"><Check size={14} /></button><button className="rounded-full bg-slate-100 p-2 text-slate-500"><X size={14} /></button></div></div>)}</div><p className="mt-6 text-xs font-black uppercase tracking-wider text-slate-500">Past validated rides</p><div className={`${card} mt-3 flex items-center justify-between p-4`}><div><p className="font-black">Downtown to LAX Airport</p><p className="mt-1 text-xs text-slate-500">Today at 9:41 AM · 11.4 miles</p></div><b>24m 18s</b></div><div className="mt-auto"><Button onClick={onStart}><Car size={17} /> Start New In-Transit Match</Button></div></div>;
}

function SettingsScreen({ onBack }: { onBack: () => void }) {
  return <div className="flex min-h-full flex-col"><Header title="Trust & Settings" subtitle="Privacy, security & ride webhooks" onBack={onBack} right={<span className="rounded-full bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-600">Verified user</span>} /><div className={`${card} mt-5 flex items-center gap-3 p-4`}><div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#d7192b] bg-slate-300 text-lg font-black text-white">FS</div><div><p className="font-black">floatersondemand</p><p className="text-xs text-slate-500">Los Angeles Metro · CA</p><p className="mt-1 text-[10px] font-bold text-emerald-500">● Liveness verified passenger</p></div></div><p className="mt-6 text-xs font-black uppercase tracking-wider text-slate-500">Privacy &amp; transit shields</p><div className={`${card} mt-3 divide-y divide-slate-100`}>{["Incognito Drop-off Shield", "Anonymize Phone Hash"].map(x => <div className="flex items-center justify-between p-4" key={x}><div><p className="text-sm font-black">{x}</p><p className="mt-1 text-xs text-slate-500">Enabled for every active room.</p></div><div className="rounded bg-[#d7192b] p-1 text-white"><Check size={14} /></div></div>)}</div><p className="mt-6 text-xs font-black uppercase tracking-wider text-slate-500">Linked ride providers</p><div className={`${card} mt-3 divide-y divide-slate-100`}>{["Uber Passenger API", "Lyft Passenger API"].map(x => <div className="flex items-center justify-between p-4" key={x}><div><p className="text-sm font-black">{x}</p><p className="text-xs font-bold text-emerald-500">OAuth2 token active</p></div><button className="rounded-full border border-red-200 px-3 py-2 text-xs font-bold text-[#d7192b]">Revoke</button></div>)}</div><div className="mt-auto"><Button secondary onClick={onBack}>Back to Flow</Button></div></div>;
}

export function RideShareFlow() {
  const requestedScreen =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("screen")
      : null;
  const initialScreen: Screen =
    requestedScreen === "onboarding2" ? "onboarding2" : "onboarding";
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const go = (next: Screen) => setScreen(next);
  const shell = "min-h-screen bg-[#f8fafc] px-6 py-6 font-sans text-slate-900 md:px-10 md:py-10";
  return (
    <main className={shell}>
      <div className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-[520px] flex-col md:min-h-[calc(100vh-80px)] md:max-w-[560px]">
        {screen === "onboarding" && <Onboarding onNext={() => go("onboarding2")} />}
        {screen === "onboarding2" && <OnboardingSecond onNext={() => go("rules")} onHowItWorks={() => go("rules")} />}
        {screen === "rules" && <Rules onNext={() => go("auth")} onBack={() => go("onboarding2")} />}
        {screen === "auth" && <Auth onNext={() => go("profile")} onBack={() => go("rules")} />}
        {screen === "profile" && <Profile onNext={() => go("connect")} onBack={() => go("auth")} />}
        {screen === "connect" && <Connect onNext={() => go("permissions")} onBack={() => go("profile")} />}
        {screen === "permissions" && <Permissions onNext={() => go("validation")} onBack={() => go("connect")} />}
        {screen === "validation" && <Validation onNext={() => go("vibe")} onBack={() => go("permissions")} />}
        {screen === "vibe" && <Vibe onNext={() => go("room")} onMatch={() => go("match")} onHistory={() => go("history")} onSettings={() => go("settings")} />}
        {screen === "room" && <Room onNext={() => go("match")} onSummary={() => go("summary")} onGrace={() => go("grace")} onReport={() => go("report")} onBack={() => go("vibe")} />}
        {screen === "report" && <Report onClose={() => go("room")} />}
        {screen === "summary" && <Summary onVibe={() => go("vibe")} onHistory={() => go("history")} onSettings={() => go("settings")} />}
        {screen === "grace" && <Grace onClose={() => go("room")} onExit={() => go("summary")} />}
        {screen === "match" && <Match onBack={() => go("vibe")} />}
        {screen === "history" && <History onBack={() => go("vibe")} onStart={() => go("vibe")} />}
        {screen === "settings" && <SettingsScreen onBack={() => go("vibe")} />}
      </div>
    </main>
  );
}