"use client";

import { useMemo, useState, useTransition } from "react";
import { fmtMoney, fmtQty } from "@/lib/estimate/calc";
import { saveSituationAction } from "../../actions";
import type { Situation } from "@/lib/site/situations";

const STATUS = { ciorna: "Ciornă", emisa: "Emisă", acceptata: "Acceptată", incasata: "Încasată" } as const;

const parse = (s: string) => {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function SituationEditor({ s }: { s: Situation }) {
  const [qty, setQty] = useState<Record<number, string>>(() => Object.fromEntries(s.lines.map((l) => [l.id, l.qtyCurrent ? String(l.qtyCurrent).replace(".", ",") : ""])));
  const [meta, setMeta] = useState({ status: s.status as string, periodFrom: s.periodFrom ?? "", periodTo: s.periodTo ?? "", notes: s.notes ?? "" });
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, start] = useTransition();
  const [onlyActive, setOnlyActive] = useState(false);

  const num = (id: number) => parse(qty[id] ?? "") ?? 0;
  const totals = useMemo(() => {
    let current = 0, cumulative = 0, contract = 0;
    for (const l of s.lines) {
      const q = num(l.id);
      current += q * l.unitPrice;
      cumulative += (l.qtyPrevious + q) * l.unitPrice;
      contract += l.qtyContract * l.unitPrice;
    }
    return { current, cumulative, contract };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qty, s.lines]);

  const save = () => {
    const bad = s.lines.find((l) => parse(qty[l.id] ?? "") === null);
    if (bad) return setMsg({ ok: false, text: `Cantitate invalidă la „${bad.name.slice(0, 60)}”.` });
    start(async () => {
      const res = await saveSituationAction(s.projectId, s.id, {
        ...meta, periodFrom: meta.periodFrom || null, periodTo: meta.periodTo || null, notes: meta.notes || null,
        quantities: Object.fromEntries(s.lines.map((l) => [l.id, num(l.id)])),
      });
      setMsg(res.ok ? { ok: true, text: "Situația a fost salvată." } : { ok: false, text: res.error ?? "Eroare." });
      if (res.ok) setDirty(false);
    });
  };

  let chapter = "";
  const lines = onlyActive ? s.lines.filter((l) => num(l.id) > 0 || l.qtyPrevious > 0) : s.lines;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4 text-sm">
        <label>Status<select value={meta.status} onChange={(e) => { setMeta({ ...meta, status: e.target.value }); setDirty(true); }} className="mt-1 block rounded-md border border-line px-2 py-1.5">
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>De la<input type="date" value={meta.periodFrom} onChange={(e) => { setMeta({ ...meta, periodFrom: e.target.value }); setDirty(true); }} className="mt-1 block rounded-md border border-line px-2 py-1.5" /></label>
        <label>Până la<input type="date" value={meta.periodTo} onChange={(e) => { setMeta({ ...meta, periodTo: e.target.value }); setDirty(true); }} className="mt-1 block rounded-md border border-line px-2 py-1.5" /></label>
        <label className="min-w-48 flex-1">Observații<input value={meta.notes} onChange={(e) => { setMeta({ ...meta, notes: e.target.value }); setDirty(true); }} className="mt-1 block w-full rounded-md border border-line px-2 py-1.5" /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="accent-brand-700" /> Doar articolele cu cantități</label>
        <button onClick={save} disabled={saving} className="rounded-lg bg-brand-700 px-5 py-2 font-semibold text-white hover:bg-brand-800 disabled:opacity-50">{saving ? "Se salvează…" : dirty ? "Salvează *" : "Salvează"}</button>
        <a href={`/panou/proiecte/${s.projectId}/santier/situatii/${s.id}/excel`} className="rounded-lg border border-line px-4 py-2 font-semibold hover:border-brand-200">Excel</a>
      </div>
      {msg && <p className={`rounded-lg px-4 py-2.5 text-sm ${msg.ok ? "bg-brand-50 text-brand-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Valoare situație (fără TVA)", totals.current], ["Cumulat executat", totals.cumulative], ["Rămas de executat", totals.contract - totals.cumulative]].map(([l, v]) => (
          <div key={l as string} className="rounded-xl border border-line bg-white p-4"><div className="text-sm text-muted">{l}</div><div className="mt-1 text-xl font-bold tabular-nums">{fmtMoney(v as number)} lei</div></div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Articol</th><th className="px-2 py-2 font-medium">U.M.</th>
              <th className="px-2 py-2 text-right font-medium">Contract</th><th className="px-2 py-2 text-right font-medium">Preț unitar</th>
              <th className="px-2 py-2 text-right font-medium">Anterior</th><th className="w-32 px-2 py-2 text-right font-medium">Curent</th>
              <th className="px-2 py-2 text-right font-medium">Cumulat</th><th className="px-3 py-2 text-right font-medium">Valoare curentă</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const q = parse(qty[l.id] ?? "");
              const cum = l.qtyPrevious + (q ?? 0);
              const over = cum > l.qtyContract + 1e-9;
              const head = l.chapter !== chapter ? (chapter = l.chapter) : null;
              return (
                <FragmentRow key={l.id} head={head}>
                  <tr className="border-b border-line">
                    <td className="px-3 py-2">{l.code && <span className="mr-2 text-xs text-muted">{l.code}</span>}{l.name}</td>
                    <td className="px-2 py-2">{l.unit}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtQty(l.qtyContract)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(l.unitPrice)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-muted">{fmtQty(l.qtyPrevious)}</td>
                    <td className="px-2 py-1">
                      <input inputMode="decimal" value={qty[l.id] ?? ""} placeholder="0"
                        onChange={(e) => { setQty({ ...qty, [l.id]: e.target.value }); setDirty(true); }}
                        className={`w-full rounded-md border px-2 py-1.5 text-right tabular-nums outline-none focus:border-brand-500 ${q === null ? "border-red-400" : "border-line"}`} />
                    </td>
                    <td className={`px-2 py-2 text-right tabular-nums ${over ? "font-semibold text-red-700" : ""}`} title={over ? "Depășește cantitatea din contract" : ""}>{fmtQty(cum)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtMoney((q ?? 0) * l.unitPrice)}</td>
                  </tr>
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Prețurile unitare sunt cele de ofertă (cost direct cu indirecte și profit), fără TVA. Cantitățile cumulate peste contract apar cu roșu.</p>
    </div>
  );
}

function FragmentRow({ head, children }: { head: string | null; children: React.ReactNode }) {
  return (
    <>
      {head && <tr className="bg-canvas"><td colSpan={8} className="px-3 py-1.5 text-xs font-semibold uppercase text-muted">{head}</td></tr>}
      {children}
    </>
  );
}
