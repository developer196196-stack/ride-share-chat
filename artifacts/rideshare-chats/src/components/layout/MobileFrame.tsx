import { type ReactNode } from "react";

export function MobileFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-slate-100 flex items-center justify-center sm:py-8 sm:px-4">
      <div className="w-full h-[100dvh] sm:h-[844px] max-w-[390px] bg-white sm:rounded-[40px] sm:shadow-[0_0_0_12px_#1e293b,0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden relative flex flex-col">
        {/* Fake iOS Status Bar Space for desktop */}
        <div className="hidden sm:flex h-12 w-full absolute top-0 inset-x-0 z-50 pointer-events-none justify-center">
          {/* Dynamic Island */}
          <div className="w-32 h-7 bg-slate-900 rounded-full mt-2"></div>
        </div>
        
        {/* App Content */}
        <div className="flex-1 overflow-y-auto sm:pt-12 scrollbar-hide bg-[#f8fafc]">
          {children}
        </div>
      </div>
    </div>
  );
}
