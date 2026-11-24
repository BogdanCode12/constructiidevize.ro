"use client";

import { evalFormula } from "@/lib/estimate/formula";
import { fmtQty } from "@/lib/estimate/calc";
import type { EstItem } from "@/lib/estimate/types";
import { cellCls } from "./parts";

/** „Cum s-a calculat?” — formula cantității, dimensiunile cu sursa lor, ipotezele și marcajul de estimare. */
export function QuantityBlock({ item, onItem }: { item: EstItem; onItem: (fn: (it: EstItem) => EstItem) => void }) {
  const f = item.qtyFormula ?? "";
  const r = f.trim() ? evalFormula(f) : null;
  return (
    <div className="mb-2 rounded-lg border border-line bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Cantitatea — cum s-a calculat</span>
        <span className="text-xs text-muted">ex. 30[lungime gard] × 0,40[lățime] × 0,80[adâncime]</span>
      </div>
      <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <input value={f} placeholder="Formula (opțional): dimensiuni × … , cu sursa între [ ]"
          onChange={(e) => {
            const v = e.target.value;
            const res = v.trim() ? evalFormula(v) : null;
            onItem((it) => ({ ...it, qtyFormula: v || null, quantity: res?.ok ? res.value : it.quantity }));
          }}
          className={`${cellCls} border-ink/15 font-mono ${r && !r.ok ? "border-red-400" : ""}`} />
        <input value={item.qtyNote ?? ""} placeholder="Sursa datelor / ipoteze (ex. planșa A-02; adâncimea din studiul geo)"
          onChange={(e) => onItem((it) => ({ ...it, qtyNote: e.target.value || null }))} className={`${cellCls} border-ink/15`} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {r?.ok && (
          <span className="tabular-nums">
            {r.pretty} = <b>{fmtQty(r.value)} {item.unit}</b>
            {r.dims.some((d) => d.label) && (
              <span className="ml-2 text-xs text-muted">({r.dims.filter((d) => d.label).map((d) => `${fmtQty(d.value)} = ${d.label}`).join("; ")})</span>
            )}
          </span>
        )}
        {r && !r.ok && <span className="text-red-700">{r.error}</span>}
        {!r && <span className="text-xs text-muted">Fără formulă: cantitatea e introdusă direct (din F3 sau manual).</span>}
        <label className="ml-auto flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={!!item.qtyEstimated} onChange={(e) => onItem((it) => ({ ...it, qtyEstimated: e.target.checked }))} className="size-3.5 accent-brand-700" />
          Cantitate estimată — necesită verificare
        </label>
      </div>
    </div>
  );
}
