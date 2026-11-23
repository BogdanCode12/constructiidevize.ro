"use client";

import { useEffect, useState } from "react";

/** Card de „sticlă mată” peste clădirea din fundal: progresul unei lucrări, cu cifra care crește la încărcare. */
export function HeroCard() {
  const target = 27;
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(target);
    let raf = 0;
    const t0 = performance.now() + 900;
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / 1400));
      setN(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="animate-rise absolute top-[30%] left-[6%] w-[340px] rounded-3xl border border-white/60 bg-white/35 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,.35)] backdrop-blur-xl [animation-delay:.5s]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold text-ink">Bloc P+4 · Cluj-Napoca</div>
          <div className="mt-0.5 text-xs text-ink/60">Situația de lucrări nr. 3 · exemplu</div>
        </div>
        <span className="grid size-10 place-items-center rounded-full border border-ink/15 bg-white/50 text-ink">↗</span>
      </div>
      <div className="mt-6 flex items-end justify-between">
        <div className="text-5xl font-semibold tracking-tight text-ink tabular-nums">{n}%</div>
        <div className="flex -space-x-2">
          {["IP", "AM", "RD"].map((i) => (
            <span key={i} className="grid size-9 place-items-center rounded-full border-2 border-white bg-ink text-[11px] font-semibold text-white">{i}</span>
          ))}
          <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-white text-[11px] font-semibold text-ink">+3</span>
        </div>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-ink/10"><div className="h-1.5 rounded-full bg-brand-700 transition-[width] duration-300" style={{ width: `${n}%` }} /></div>
      <div className="mt-2 text-xs text-ink/60">executat din valoarea contractului</div>
    </div>
  );
}
