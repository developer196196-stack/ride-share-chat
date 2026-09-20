import React from "react";

const logoPath = "/__mockup/images/rs-ride-share-chats-logo.png";

export function IPhoneSplash() {
  return (
    <main
      className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 42%, rgba(210,49,72,.48) 0%, rgba(139,24,48,.30) 26%, transparent 56%), linear-gradient(135deg, #3a121f 0%, #57172d 46%, #11131a 100%)",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes rs-drift { 0%,100% { transform: translate3d(0,0,0) scale(1); opacity:.55 } 50% { transform: translate3d(0,-12px,0) scale(1.05); opacity:.82 } }
        @keyframes rs-shimmer { 0% { transform: translateX(-120%) rotate(16deg); } 55%,100% { transform: translateX(180%) rotate(16deg); } }
        @keyframes rs-pulse { 0%,100% { opacity:.38; transform:scale(.96) } 50% { opacity:.7; transform:scale(1.04) } }
        .rs-drift { animation: rs-drift 7s ease-in-out infinite; }
        .rs-drift-delay { animation: rs-drift 9s 1.2s ease-in-out infinite; }
        .rs-shimmer { animation: rs-shimmer 6s ease-in-out infinite; }
        .rs-pulse { animation: rs-pulse 4.5s ease-in-out infinite; }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-[15%] top-[7%] h-[38vw] w-[38vw] rounded-full bg-[#c92e4b]/35 blur-[90px] rs-drift" />
        <div className="absolute -right-[14%] bottom-[10%] h-[34vw] w-[34vw] rounded-full bg-[#e04a63]/25 blur-[100px] rs-drift-delay" />
        <div
          className="absolute inset-0 opacity-[.11]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(205,173,177,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(205,173,177,.25) 1px, transparent 1px)",
            backgroundSize: "52px 52px",
            maskImage: "radial-gradient(ellipse at center, black, transparent 68%)",
          }}
        />
        <div className="rs-pulse absolute left-1/2 top-1/2 h-[52%] w-[45%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d8aeb2]/20" />
        <div className="absolute left-[8%] top-[18%] h-px w-[28%] rotate-[28deg] bg-gradient-to-r from-transparent via-[#d7a1a8]/40 to-transparent" />
        <div className="absolute bottom-[19%] right-[7%] h-px w-[26%] rotate-[28deg] bg-gradient-to-r from-transparent via-[#d7a1a8]/30 to-transparent" />
      </div>

      <section className="relative flex h-full min-h-[100dvh] w-full items-center justify-center px-5 py-8 sm:px-10">
        <div className="relative w-[min(76vw,334px)] sm:w-[min(39vw,360px)]">
          <div
            className="absolute -inset-[7%] rounded-[4.6rem] blur-[32px]"
            style={{ background: "rgba(194, 35, 62, .42)" }}
          />
          <div className="relative rounded-[3.7rem] p-[2px] shadow-[0_34px_80px_rgba(0,0,0,.56),0_8px_18px_rgba(215,148,157,.14)]"
            style={{
              background:
                "linear-gradient(125deg, #fbf4f2 0%, #65666c 10%, #17181d 23%, #a9a9ad 49%, #33343a 71%, #ede3e1 94%, #6b6b70 100%)",
            }}
          >
            <div className="relative rounded-[3.55rem] bg-[#0a0b0e] p-[7px]">
              <div className="absolute -left-[5px] top-[25%] h-12 w-[3px] rounded-l-full bg-[#8f9094]" />
              <div className="absolute -left-[5px] top-[33%] h-20 w-[3px] rounded-l-full bg-[#77787d]" />
              <div className="absolute -left-[5px] top-[46%] h-20 w-[3px] rounded-l-full bg-[#77787d]" />
              <div className="absolute -right-[5px] top-[35%] h-24 w-[3px] rounded-r-full bg-[#aaa9ad]" />

              <div
                className="relative aspect-[9/19.5] overflow-hidden rounded-[3.05rem]"
                style={{
                  background:
                    "radial-gradient(circle at 52% 44%, rgba(219,49,73,.38), transparent 38%), linear-gradient(160deg, #5a162c 0%, #28101c 51%, #0d1017 100%)",
                }}
              >
                <div className="absolute left-1/2 top-[10px] z-20 h-[25px] w-[38%] -translate-x-1/2 rounded-full bg-[#050507] shadow-[inset_0_1px_2px_rgba(255,255,255,.15)]">
                  <div className="absolute right-[20%] top-[8px] h-[6px] w-[6px] rounded-full bg-[#161b27]" />
                </div>
                <div className="absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-[#b83755]/35 to-transparent" />
                <div className="rs-shimmer pointer-events-none absolute -left-[40%] top-[-15%] h-[140%] w-[22%] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <div className="relative flex h-full flex-col items-center justify-center px-[11%] pb-[5%]">
                  <div className="mb-[11%] w-[80%] drop-shadow-[0_12px_18px_rgba(0,0,0,.5)]">
                    <img
                      src={logoPath}
                      alt="RS Ride Share Chats"
                      className="h-auto w-full"
                    />
                  </div>
                  <div className="h-px w-[29%] bg-gradient-to-r from-transparent via-[#d7aeb0]/75 to-transparent" />
                  <div className="mt-[7%] flex items-center gap-2 opacity-75">
                    <span className="h-[4px] w-[4px] rounded-full bg-[#be4458]" />
                    <span className="h-[3px] w-[3px] rounded-full bg-[#d3c0bd]" />
                    <span className="h-[4px] w-[4px] rounded-full bg-[#be4458]" />
                  </div>
                </div>
                <div className="absolute bottom-[7px] left-1/2 h-[4px] w-[33%] -translate-x-1/2 rounded-full bg-[#faf2f1]/80" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}