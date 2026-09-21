import { type ReactNode } from "react";
import { ArrowLeft, Car, History as HistoryIcon, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";

export const pill = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em]";
export const card = "rounded-[22px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(20,30,50,0.06)]";

export function BrandMark() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-slate-200 bg-white shadow-sm" data-testid="img-brand-mark">
      <img className="h-8 w-8 object-contain" src="/images/rs-ride-share-chats-logo.png" alt="RS Chats" />
    </div>
  );
}

export function Header({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button onClick={onBack} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50" aria-label="Back" data-testid="button-back">
            <ArrowLeft size={17} />
          </button>
        ) : (
          <BrandMark />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[18px] font-black leading-none tracking-[-0.04em] text-slate-950" data-testid="text-header-title">{title}</h1>
          {subtitle && <p className="mt-1 truncate text-[11px] text-slate-500" data-testid="text-header-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="shrink-0">{right}</div>
    </header>
  );
}

export function Button({ children, onClick, secondary = false, className = "" }: { children: ReactNode; onClick?: () => void; secondary?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-12 w-full items-center justify-center gap-2 rounded-[15px] text-[14px] font-extrabold transition-transform active:scale-[0.98] ${
        secondary ? "border border-slate-200 bg-white text-slate-700" : "bg-[#d7192b] text-white shadow-[0_10px_22px_rgba(215,25,43,0.2)]"
      } ${className}`}
      data-testid={secondary ? "button-secondary" : "button-primary"}
    >
      {children}
    </button>
  );
}

export function BottomNav() {
  const [location] = useLocation();
  
  return (
    <nav className="mt-auto grid shrink-0 grid-cols-3 border-t border-slate-200 bg-white/95 px-5 pb-safe pt-3 sticky bottom-0 z-10 backdrop-blur-md" data-testid="nav-bottom">
      <Link href="/vibe" className={`flex flex-col items-center gap-1 ${location.startsWith('/vibe') || location === '/room' ? 'text-[#d7192b]' : 'text-slate-400'}`}>
        <Car size={18} />
        <span className="text-[10px] font-bold">Home</span>
      </Link>
      <Link href="/history" className={`flex flex-col items-center gap-1 ${location === '/history' ? 'text-[#d7192b]' : 'text-slate-400'}`}>
        <HistoryIcon size={18} />
        <span className="text-[10px] font-bold">History</span>
      </Link>
      <Link href="/settings" className={`flex flex-col items-center gap-1 ${location === '/settings' ? 'text-[#d7192b]' : 'text-slate-400'}`}>
        <Settings size={18} />
        <span className="text-[10px] font-bold">Settings</span>
      </Link>
    </nav>
  );
}

export const avatars = [
  ["Maya", "NY", "MA"],
  ["Lucas", "IL", "LU"],
  ["Elena", "TX", "EL"],
  ["David", "WA", "DA"],
  ["Zara", "FL", "ZA"],
  ["Devon", "CO", "DE"],
  ["Sam", "GA", "SA"],
  ["Leo", "AZ", "LE"],
];
