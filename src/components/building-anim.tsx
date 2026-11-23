"use client";

import { useRef, useState } from "react";

/*
 * Ilustrația din panou: blocul din imaginea aleasă de proprietar se „construiește” în câteva secunde.
 * 1) se vede conturul șters (schița), 2) structura gri se ridică de jos în sus, 3) apar finisajele în culori.
 * La trecerea mouse-ului animația pornește din nou. Cu „reduce motion” se afișează direct imaginea finală.
 */
const SRC = "/brand/bloc-santier.webp";

export function BuildingAnim({ className = "" }: { className?: string }) {
  const [run, setRun] = useState(0);
  const busy = useRef(true);

  return (
    <div
      className={`building-anim relative aspect-[1100/728] select-none ${className}`}
      onMouseEnter={() => {
        if (busy.current) return;
        busy.current = true;
        setRun((r) => r + 1);
      }}
      role="img"
      aria-label="Bloc în construcție: structura de beton, fierul, schela și materialele de pe șantier"
    >
      <div key={run} className="absolute inset-0">
        <img src={SRC} alt="" draggable={false} className="b-ghost absolute inset-0 h-full w-full" />
        <img src={SRC} alt="" draggable={false} className="b-structure absolute inset-0 h-full w-full" />
        <img
          src={SRC}
          alt=""
          draggable={false}
          className="b-finish absolute inset-0 h-full w-full"
          onAnimationEnd={() => { busy.current = false; }}
        />
        <span className="b-scan pointer-events-none absolute inset-x-[6%] h-px bg-brand-700/70" />
      </div>
    </div>
  );
}
