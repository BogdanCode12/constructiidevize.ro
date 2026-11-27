"use client";

import { priceOriginLabel } from "@/lib/counties";
import { useEffect, useMemo, useState } from "react";
import { priceSourcesAction } from "../actions";
import { effNorm, fmtMoney } from "@/lib/estimate/calc";
import { RES_TYPE_LABEL, type CatalogResource, type EstimateDoc, type EstResource, type ResType } from "@/lib/estimate/types";

type Row = {
  resourceId: number; type: ResType; name: string; unit: string; oldPrice: number; newPrice: number | null; manual: boolean;
  items: number; qty: number; cur?: CatalogResource;
};

/**
 * „Actualizează prețurile acestui deviz”: compară prețurile salvate în deviz cu prețurile aplicabile acum în catalog
 * (prețul firmei sau cel de referință) și aplică doar ce bifează utilizatorul. Nimic nu se schimbă automat.
 */
export function PriceUpdateDialog({ doc, onApply, onClose }: {
  doc: EstimateDoc;
  onApply: (fn: (d: EstimateDoc) => EstimateDoc, summary: string) => void;
  onClose: () => void;
}) {
  const [cur, setCur] = useState<Record<number, CatalogResource> | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());

  // Resursele legate de catalog, grupate (un rând per resursă și preț salvat).
  const groups = useMemo(() => {
    const m = new Map<string, Row>();
    for (const ch of doc.chapters)
      for (const it of ch.items)
        for (const r of it.resources) {
          if (!r.resourceId) continue;
          const k = `${r.resourceId}|${r.price}|${r.priceManual ? 1 : 0}`;
          const g = m.get(k) ?? { resourceId: r.resourceId, type: r.type, name: r.name, unit: r.unit, oldPrice: r.price, newPrice: null, manual: !!r.priceManual, items: 0, qty: 0 };
          g.items++;
          g.qty += effNorm(r) * it.quantity;
          m.set(k, g);
        }
    return [...m.values()];
  }, [doc]);

  useEffect(() => {
    priceSourcesAction([...new Set(groups.map((g) => g.resourceId))], [], doc.priceCounty).then((s) => setCur(s.resources));
  }, [groups]);

  const rows: Row[] = useMemo(() => groups.map((g) => {
    const c = cur?.[g.resourceId];
    return { ...g, cur: c, newPrice: c ? c.price : null };
  }).filter((g) => g.newPrice !== null && Math.abs(g.newPrice - g.oldPrice) > 0.00005), [groups, cur]);

  const keyOf = (r: Row) => rows.indexOf(r);
  useEffect(() => { setSel(new Set(rows.map((r, i) => (r.manual ? -1 : i)).filter((i) => i >= 0))); }, [rows]);

  const impact = rows.reduce((s, r, i) => s + (sel.has(i) ? (r.newPrice! - r.oldPrice) * r.qty : 0), 0);
  const missing = cur ? groups.filter((g) => !cur[g.resourceId]).length : 0;
  const noPrice = cur ? groups.filter((g) => cur[g.resourceId] && cur[g.resourceId].price === null).length : 0;

  const apply = () => {
    const chosen = rows.filter((_, i) => sel.has(i));
    const match = (r: EstResource) => chosen.find((c) => c.resourceId === r.resourceId && c.oldPrice === r.price && c.manual === !!r.priceManual);
    onApply((d) => ({
      ...d,
      chapters: d.chapters.map((ch) => ({
        ...ch,
        items: ch.items.map((it) => ({
          ...it,
          resources: it.resources.map((r) => {
            const c = match(r);
            return c ? { ...r, price: c.newPrice!, offerId: c.cur?.priceInfo?.offerId ?? null, priceManual: false } : r;
          }),
        })),
      })),
    }), `Am actualizat ${chosen.length} prețuri din catalog (impact pe costul direct: ${impact >= 0 ? "+" : ""}${fmtMoney(impact)} lei). Verifică și salvează.`);
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink/30 p-4" role="dialog" aria-label="Actualizează prețurile">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-ink/10 bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b-2 border-ink/10 px-5 py-4">
          <div className="flex-1">
            <h2 className="text-lg font-bold">Actualizează prețurile acestui deviz</h2>
            <p className="text-sm text-muted">Prețurile salvate în deviz comparate cu cele aplicabile acum în catalog (prețul tău negociat, altfel cel de referință). Se aplică doar ce bifezi.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-muted hover:bg-canvas">✕</button>
        </header>
        <div className="flex-1 overflow-y-auto">
          {!cur ? <p className="px-5 py-8 text-center text-muted">Se compară cu catalogul…</p> : rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-muted">Toate prețurile din deviz sunt la zi cu catalogul.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b-2 border-ink/10 bg-white text-muted">
                <tr>
                  <th className="px-4 py-2"><input type="checkbox" className="size-4 accent-brand-700" checked={sel.size === rows.length}
                    onChange={(e) => setSel(new Set(e.target.checked ? rows.map((_, i) => i) : []))} /></th>
                  <th className="px-2 py-2 font-medium">Resursă</th>
                  <th className="px-2 py-2 text-right font-medium">În deviz</th>
                  <th className="px-2 py-2 text-right font-medium">Acum</th>
                  <th className="px-2 py-2 text-right font-medium">Diferență</th>
                  <th className="px-4 py-2 text-right font-medium">Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const i = keyOf(r);
                  const pct = r.oldPrice ? ((r.newPrice! - r.oldPrice) / r.oldPrice) * 100 : null;
                  const p = r.cur?.priceInfo;
                  return (
                    <tr key={i}>
                      <td className="px-4 py-2"><input type="checkbox" className="size-4 accent-brand-700" checked={sel.has(i)}
                        onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(i); else n.delete(i); return n; })} /></td>
                      <td className="px-2 py-2">
                        <div className="font-medium">{r.name}</div>
                        <div className="flex flex-wrap gap-x-2 text-xs text-muted">
                          <span>{RES_TYPE_LABEL[r.type]} · {r.items} {r.items === 1 ? "articol" : "articole"}</span>
                          {p && <span>{priceOriginLabel(p)}{p.supplier ? ` · ${p.supplier}` : ""}</span>}
                          {p?.expired && <span className="font-semibold text-red-700">preț expirat în catalog</span>}
                          {p?.status === "neverificat" && <span className="text-amber-800">neverificat</span>}
                          {r.manual && <span className="font-semibold text-amber-800">în deviz e preț introdus manual</span>}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(r.oldPrice)}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums">{fmtMoney(r.newPrice!)}</td>
                      <td className={`px-2 py-2 text-right tabular-nums ${r.newPrice! > r.oldPrice ? "text-red-700" : "text-emerald-700"}`}>
                        {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtMoney((r.newPrice! - r.oldPrice) * r.qty)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {(missing > 0 || noPrice > 0) && (
            <p className="px-5 py-3 text-xs text-muted">
              {missing > 0 && `${missing} resurse nu mai sunt în catalog (rămân cu prețul din deviz). `}
              {noPrice > 0 && `${noPrice} resurse nu au preț în catalog.`}
            </p>
          )}
        </div>
        <footer className="flex flex-wrap items-center gap-3 border-t-2 border-ink/10 px-5 py-3">
          <span className="text-sm">Impact pe costul direct: <b className="tabular-nums">{impact >= 0 ? "+" : ""}{fmtMoney(impact)} lei</b></span>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg border-2 border-ink/15 px-4 py-2 text-sm font-semibold">Renunță</button>
          <button type="button" onClick={apply} disabled={!sel.size}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
            Actualizează {sel.size} prețuri
          </button>
        </footer>
      </div>
    </div>
  );
}
