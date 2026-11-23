"use client";

import { useState } from "react";
import { NumInput } from "./parts";
import { directBreakdown, fmtMoney, recapFromDirect, sumCM, zero } from "@/lib/estimate/calc";
import { RES_TYPE_PLURAL, RES_TYPES, type EstimateDoc, type ResType } from "@/lib/estimate/types";

type Sim = Record<ResType, number> & { qty: number; overheadPct: number; profitPct: number; discount: number; target: number };

/**
 * Calculator profit + simulator preț ofertă.
 * Costul real = cost direct (prețurile din deviz) + cheltuieli indirecte + echipamente.
 * Prețul ofertat = prețurile ajustate, cu indirecte și profit, minus discount.
 */
export function Simulator({ doc }: { doc: EstimateDoc }) {
  const [s, setS] = useState<Sim>({
    material: 0, manopera: 0, utilaj: 0, transport: 0, echipament: 0,
    qty: 0, overheadPct: doc.overheadPct, profitPct: doc.profitPct, discount: 0, target: 10,
  });
  const set = (k: keyof Sim) => (n: number | null) => setS((x) => ({ ...x, [k]: n ?? 0 }));

  const base = directBreakdown(doc);
  const qf = 1 + s.qty / 100;

  // Cost real: prețurile de cost din deviz, la cantitățile ajustate.
  const costDirect = zero();
  for (const t of RES_TYPES) costDirect[t] = base[t] * qf;
  const realCost = sumCM(costDirect) * (1 + doc.overheadPct / 100) + costDirect.echipament;

  // Ofertă: prețuri ajustate pe categorii + procentele simulate − discount.
  const simDirect = zero();
  for (const t of RES_TYPES) simDirect[t] = base[t] * qf * (1 + s[t] / 100);
  const sim = recapFromDirect(simDirect, { overheadPct: s.overheadPct, profitPct: s.profitPct, vatPct: doc.vatPct });
  const offer = sim.totalNoVat * (1 - s.discount / 100);
  const profit = offer - realCost;
  const margin = offer > 0 ? (profit / offer) * 100 : 0;
  const targetPrice = realCost / (1 - Math.min(s.target, 99) / 100);

  const baseRecap = recapFromDirect(base, doc);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="rounded-xl border border-line bg-white p-5">
        <h2 className="font-bold">Ajustări</h2>
        <p className="mb-4 text-sm text-muted">Nu modifică devizul — doar simulează. Procente pozitive = scumpire, negative = reducere.</p>
        <div className="space-y-2 text-sm">
          {RES_TYPES.map((t) => <PctField key={t} label={`Prețuri ${RES_TYPE_PLURAL[t].toLowerCase()}`} value={s[t]} onChange={set(t)} />)}
          <PctField label="Cantități" value={s.qty} onChange={set("qty")} />
          <div className="my-3 border-t border-line" />
          <PctField label="Cheltuieli indirecte" value={s.overheadPct} onChange={set("overheadPct")} positive />
          <PctField label="Profit inclus în preț" value={s.profitPct} onChange={set("profitPct")} positive />
          <PctField label="Discount la ofertă" value={s.discount} onChange={set("discount")} positive />
          <div className="my-3 border-t border-line" />
          <PctField label="Marjă țintă" value={s.target} onChange={set("target")} positive />
        </div>
        <button
          onClick={() => setS({ material: 0, manopera: 0, utilaj: 0, transport: 0, echipament: 0, qty: 0, overheadPct: doc.overheadPct, profitPct: doc.profitPct, discount: 0, target: s.target })}
          className="mt-4 text-sm font-semibold text-brand-700 hover:underline"
        >
          Resetează
        </button>
      </div>

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Preț ofertă (fără TVA)" value={`${fmtMoney(offer)} lei`} sub={`față de ${fmtMoney(baseRecap.totalNoVat)} în deviz`} />
          <Stat label="Costul tău real" value={`${fmtMoney(realCost)} lei`} sub="direct + indirecte + echipamente" />
          <Stat label="Profit estimat" value={`${fmtMoney(profit)} lei`} sub={`marjă ${margin.toFixed(1).replace(".", ",")}%`} tone={profit < 0 ? "bad" : "good"} />
        </div>

        <div className="rounded-xl border border-line bg-white p-5">
          <h3 className="mb-3 font-bold">Detaliu ofertă simulată</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr><th className="py-1.5 font-medium" /><th className="py-1.5 text-right font-medium">Deviz</th><th className="py-1.5 text-right font-medium">Simulare</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {RES_TYPES.map((t) => <Line key={t} label={RES_TYPE_PLURAL[t]} a={base[t]} b={simDirect[t]} />)}
              <Line label="Cheltuieli indirecte" a={baseRecap.overhead} b={sim.overhead} />
              <Line label="Profit inclus" a={baseRecap.profit} b={sim.profit} />
              <Line label="Discount" a={0} b={-sim.totalNoVat * (s.discount / 100)} />
              <Line label="Total fără TVA" a={baseRecap.totalNoVat} b={offer} strong />
              <Line label={`TVA ${doc.vatPct}%`} a={baseRecap.vat} b={offer * doc.vatPct / 100} />
              <Line label="Total cu TVA" a={baseRecap.total} b={offer * (1 + doc.vatPct / 100)} strong />
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-line bg-white p-5 text-sm">
          <h3 className="mb-2 font-bold">Praguri</h3>
          <p>Preț minim fără pierdere: <b className="tabular-nums">{fmtMoney(realCost)} lei</b> (fără TVA).</p>
          <p className="mt-1">Preț pentru marjă de {String(s.target).replace(".", ",")}%: <b className="tabular-nums">{fmtMoney(targetPrice)} lei</b> (fără TVA).</p>
          <p className="mt-1">Discount maxim fără pierdere față de oferta simulată: <b className="tabular-nums">{sim.totalNoVat > 0 ? Math.max(0, (1 - realCost / sim.totalNoVat) * 100).toFixed(1).replace(".", ",") : "0"}%</b>.</p>
        </div>
      </div>
    </div>
  );
}

function PctField({ label, value, onChange, positive }: { label: string; value: number; onChange: (n: number | null) => void; positive?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="flex w-24 items-center rounded-md border border-line bg-white">
        <NumInput value={value} onChange={onChange} allowNegative={!positive} className="py-1" placeholder="0" />
        <span className="pr-2 text-xs text-muted">%</span>
      </span>
    </label>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${tone === "bad" ? "text-red-700" : tone === "good" ? "text-brand-700" : ""}`}>{value}</div>
      <div className="mt-0.5 text-xs text-muted">{sub}</div>
    </div>
  );
}

function Line({ label, a, b, strong }: { label: string; a: number; b: number; strong?: boolean }) {
  const diff = b - a;
  return (
    <tr className={strong ? "font-semibold" : ""}>
      <td className="py-1.5">{label}</td>
      <td className="py-1.5 text-right tabular-nums">{fmtMoney(a)}</td>
      <td className="py-1.5 text-right tabular-nums">
        {fmtMoney(b)}
        {Math.abs(diff) > 0.005 && <span className={`ml-2 text-xs ${diff > 0 ? "text-brand-700" : "text-red-700"}`}>{diff > 0 ? "+" : ""}{fmtMoney(diff)}</span>}
      </td>
    </tr>
  );
}
