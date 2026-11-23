"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/*
 * Animația din prima pagină: o clădire desenată ca o planșă (proiecție izometrică), linie cu linie.
 * Un etaj evidențiat cu roșu urcă de la un nivel la altul, iar cardurile alăturate arată cum se construiește
 * devizul pe capitole și progresul execuției. Macaraua mută sarcina pe braț. Totul e SVG + CSS, fără biblioteci.
 */

const S = 24; // pixeli pe unitate
const COS = 0.866;
const FLOORS = 5;
const FH = 1.25; // înălțimea unui etaj (unități)
const BX = 8; // lungime clădire (axa x)
const BY = 5; // lățime clădire (axa y)

type P = [number, number];
const iso = (x: number, y: number, z: number): P => [(x - y) * S * COS, (x + y) * S * 0.5 - z * S];
const path = (...pts: P[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
const line = (a: [number, number, number], b: [number, number, number]) => path(iso(...a), iso(...b));

type Seg = { d: string; kind: "grid" | "struct" | "detail" | "crane" };

function buildSegments(): Seg[] {
  const segs: Seg[] = [];
  // grila de la sol (planșa)
  for (let x = -2; x <= 12; x++) segs.push({ d: line([x, -2, 0], [x, 8, 0]), kind: "grid" });
  for (let y = -2; y <= 8; y++) segs.push({ d: line([-2, y, 0], [12, y, 0]), kind: "grid" });
  const top = FLOORS * FH;
  // stâlpi pe fețele vizibile + colțuri
  for (let x = 0; x <= BX; x += 2) segs.push({ d: line([x, BY, 0], [x, BY, top]), kind: "struct" });
  for (let y = 0; y <= BY; y += 2.5) segs.push({ d: line([BX, y, 0], [BX, y, top]), kind: "struct" });
  segs.push({ d: line([0, 0, 0], [0, 0, top]), kind: "struct" });
  // planșee
  for (let k = 0; k <= FLOORS; k++) {
    const z = k * FH;
    segs.push({ d: path(iso(0, 0, z), iso(BX, 0, z), iso(BX, BY, z), iso(0, BY, z), iso(0, 0, z)), kind: "struct" });
  }
  // ferestre / montanți pe fețele vizibile
  for (let k = 0; k < FLOORS; k++) {
    const z0 = k * FH + 0.35;
    const z1 = k * FH + FH - 0.25;
    segs.push({ d: line([0, BY, z0], [BX, BY, z0]), kind: "detail" });
    segs.push({ d: line([BX, 0, z0], [BX, BY, z0]), kind: "detail" });
    for (let x = 0.5; x < BX; x += 1) segs.push({ d: line([x, BY, z0], [x, BY, z1]), kind: "detail" });
    for (let y = 0.5; y < BY; y += 1) segs.push({ d: line([BX, y, z0], [BX, y, z1]), kind: "detail" });
  }
  // copertină în consolă la ultimul nivel
  const zc = top + 0.15;
  segs.push({ d: path(iso(-0.6, -0.6, zc), iso(BX + 0.9, -0.6, zc), iso(BX + 0.9, BY + 0.9, zc), iso(-0.6, BY + 0.9, zc), iso(-0.6, -0.6, zc)), kind: "struct" });
  for (let x = 0; x <= BX; x += 1.6) segs.push({ d: line([x, -0.6, zc], [x, BY + 0.9, zc]), kind: "detail" });
  // macara: turn cu zăbrele + braț
  const mx = 11, my = -1.2, mh = 10.2;
  segs.push({ d: line([mx, my, 0], [mx, my, mh]), kind: "crane" });
  segs.push({ d: line([mx + 0.6, my, 0], [mx + 0.6, my, mh]), kind: "crane" });
  for (let z = 0; z < mh - 0.6; z += 0.6) {
    segs.push({ d: line([mx, my, z], [mx + 0.6, my, z + 0.6]), kind: "crane" });
    segs.push({ d: line([mx, my, z + 0.6], [mx + 0.6, my, z + 0.6]), kind: "crane" });
  }
  segs.push({ d: line([-1, my, mh], [mx + 3, my, mh]), kind: "crane" });
  segs.push({ d: line([-1, my, mh - 0.45], [mx + 3, my, mh - 0.45]), kind: "crane" });
  for (let x = -1; x < mx + 3; x += 0.7) segs.push({ d: line([x, my, mh - 0.45], [x + 0.35, my, mh]), kind: "crane" });
  segs.push({ d: line([mx + 0.3, my, mh], [mx + 0.3, my, mh + 1.3]), kind: "crane" });
  segs.push({ d: line([mx + 0.3, my, mh + 1.3], [0, my, mh]), kind: "crane" });
  segs.push({ d: line([mx + 0.3, my, mh + 1.3], [mx + 3, my, mh]), kind: "crane" });
  return segs;
}

const CHAPTERS = [
  { name: "Fundații", value: 186_420 },
  { name: "Structură parter", value: 248_960 },
  { name: "Structură etaje", value: 512_380 },
  { name: "Închideri și termoizolații", value: 297_150 },
  { name: "Instalații și finisaje", value: 421_700 },
];

const lei = (n: number) => new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n);

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduce;
}

export function BlueprintHero() {
  const segs = useMemo(buildSegments, []);
  const reduce = useReducedMotion();
  const [level, setLevel] = useState(1); // nivelul evidențiat (1..FLOORS)
  const [tick, setTick] = useState(0);
  const [trolley, setTrolley] = useState(0.5);
  const wrap = useRef<HTMLDivElement>(null);

  // Ciclul principal: etajul evidențiat urcă, capitolele devizului se completează.
  useEffect(() => {
    if (reduce) {
      setLevel(3);
      setTick(CHAPTERS.length);
      return;
    }
    let every: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      setTick(1);
      every = setInterval(() => {
        setLevel((l) => (l % FLOORS) + 1);
        setTick((x) => x + 1);
      }, 2600);
    }, 2400);
    return () => {
      clearTimeout(start);
      if (every) clearInterval(every);
    };
  }, [reduce]);

  // Căruciorul macaralei se plimbă continuu pe braț.
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const loop = (ms: number) => {
      setTrolley(0.5 + 0.5 * Math.sin(ms / 2600));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  // Paralaxă discretă la mișcarea mouse-ului.
  const onMove = (e: React.MouseEvent) => {
    if (reduce || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    wrap.current.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    wrap.current.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };

  const filled = Math.min(CHAPTERS.length, tick);
  const total = CHAPTERS.slice(0, filled).reduce((s, c) => s + c.value, 0);
  const progress = Math.min(96, 12 + ((tick * 7) % 85));
  const matched = Math.min(171, 120 + tick * 9);

  // Placa evidențiată (fața de sus + muchia frontală), desenată la nivelul 0 și mutată pe verticală.
  const slabTop = path(iso(0, 0, 0), iso(BX, 0, 0), iso(BX, BY, 0), iso(0, BY, 0));
  const slabEdge = path(iso(0, BY, 0), iso(BX, BY, 0), iso(BX, 0, 0), iso(BX, 0, -0.3), iso(BX, BY, -0.3), iso(0, BY, -0.3));
  const [tx, ty] = iso(-1 + trolley * 9, -1.2, 10.2 - 0.45);
  const hookDrop = 70 + 60 * (1 - trolley);

  return (
    <div ref={wrap} onMouseMove={onMove} className="relative mx-auto mb-10 aspect-[10/9] w-full max-w-[640px] select-none [--px:0] [--py:0] sm:mb-0">
      <svg viewBox="-185 -292 530 480" className="absolute inset-0 size-full transition-transform duration-300 ease-out"
        style={{ transform: "translate(calc(var(--px) * -14px), calc(var(--py) * -10px))" }} aria-hidden>
        {segs.map((s, i) => (
          <path key={i} d={s.d} pathLength={1} fill="none"
            stroke={s.kind === "crane" ? "#0c0c0d" : "#0c0c0d"}
            strokeOpacity={s.kind === "grid" ? 0.07 : s.kind === "detail" ? 0.28 : s.kind === "crane" ? 0.45 : 0.75}
            strokeWidth={s.kind === "struct" ? 1.3 : 1}
            strokeLinecap="round"
            style={reduce ? undefined : {
              strokeDasharray: 1, strokeDashoffset: 1,
              animation: `draw ${s.kind === "grid" ? 0.9 : 1.1}s cubic-bezier(.6,.1,.2,1) forwards`,
              animationDelay: `${s.kind === "grid" ? i * 0.012 : 0.4 + i * 0.006}s`,
            }} />
        ))}
        {/* etajul în lucru */}
        <g style={{ transform: `translateY(${-level * FH * S}px)`, transition: "transform 0.9s cubic-bezier(.6,.1,.2,1)", opacity: tick > 0 ? 1 : 0 }}>
          <path d={slabTop} fill="#c71319" fillOpacity={0.14} stroke="#c71319" strokeWidth={1.6} />
          <path d={slabEdge} fill="#c71319" fillOpacity={0.9} />
        </g>
        {/* căruciorul și cârligul macaralei */}
        <g opacity={tick > 0 || reduce ? 1 : 0} style={{ transition: "opacity .6s" }}>
          <rect x={tx - 5} y={ty - 3} width={10} height={6} fill="#0c0c0d" />
          <line x1={tx} y1={ty + 3} x2={tx} y2={ty + hookDrop} stroke="#0c0c0d" strokeOpacity={0.6} />
          <rect x={tx - 9} y={ty + hookDrop} width={18} height={9} fill="#c71319" />
        </g>
      </svg>

      {/* Card: devizul se construiește pe capitole */}
      <div className="absolute top-0 left-0 hidden w-[min(250px,47%)] sm:block rounded-2xl border border-line bg-white/95 p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,.25)] backdrop-blur transition-transform duration-300 animate-rise"
        style={{ transform: "translate(calc(var(--px) * 10px), calc(var(--py) * 8px))", animationDelay: "1.2s" }}>
        <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-muted uppercase">
          <span>Deviz · Bloc P+4</span><span className="text-brand-700">● live</span>
        </div>
        <ul className="mt-3 space-y-1.5 text-[13px]">
          {CHAPTERS.map((c, i) => (
            <li key={c.name} className={`flex justify-between gap-2 transition-colors ${i === (level - 1) % CHAPTERS.length && tick > 0 ? "font-semibold text-brand-700" : i < filled ? "text-ink" : "text-muted/50"}`}>
              <span className="truncate">{c.name}</span>
              <span className="tabular-nums">{i < filled ? lei(c.value) : "—"}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-2.5">
          <span className="text-xs text-muted">Total fără TVA</span>
          <span className="font-display text-lg font-semibold tabular-nums">{lei(total)} lei</span>
        </div>
      </div>

      {/* Card: execuție */}
      <div className="absolute bottom-[2%] left-0 w-[min(220px,44%)] rounded-2xl bg-ink/95 p-3 sm:p-4 text-white shadow-2xl backdrop-blur transition-transform duration-300 animate-rise"
        style={{ transform: "translate(calc(var(--px) * 12px), calc(var(--py) * 10px))", animationDelay: "1.6s" }}>
        <div className="text-[11px] font-semibold tracking-wider text-white/60 uppercase">Situația de lucrări nr. 3</div>
        <div className="mt-1 font-display text-3xl font-semibold tabular-nums sm:text-4xl">{progress}%</div>
        <div className="mt-2 h-1.5 rounded-full bg-white/15"><div className="h-1.5 rounded-full bg-brand-600 transition-all duration-700" style={{ width: `${progress}%` }} /></div>
        <div className="mt-2 hidden text-xs text-white/60 sm:block">executat din valoarea contractului</div>
      </div>

      {/* Pe telefon: un singur rând compact în loc de carduri suprapuse */}
      <div className="absolute inset-x-0 -bottom-10 flex justify-between gap-3 text-xs text-muted sm:hidden">
        <span>Deviz: <b className="text-ink tabular-nums">{lei(total)} lei</b></span>
        <span>Import F3: <b className="text-ink tabular-nums">{matched}/184</b> automat</span>
      </div>

      {/* Card: import F3 */}
      <div className="absolute right-0 bottom-[4%] hidden w-[min(200px,38%)] sm:block rounded-xl border border-line bg-white p-3 shadow-lg transition-transform duration-300 animate-rise"
        style={{ transform: "translate(calc(var(--px) * 6px), calc(var(--py) * 5px))", animationDelay: "2s" }}>
        <div className="text-[11px] font-semibold text-muted">Import F3 · 184 articole</div>
        <div className="mt-1 text-sm"><b className="tabular-nums">{matched}</b> potrivite automat din bază</div>
        <div className="mt-1.5 h-1 rounded-full bg-canvas"><div className="h-1 rounded-full bg-ink transition-all duration-700" style={{ width: `${(matched / 184) * 100}%` }} /></div>
      </div>
    </div>
  );
}
