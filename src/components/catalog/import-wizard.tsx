"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { applyImportAction, parseImportAction, previewImportAction } from "@/lib/resources/import-actions";
import type { ImportFieldKey, ImportRow, ParsedTable, PreviewRow } from "@/lib/resources/import-core";
import { RES_TYPE_LABEL, type ResType } from "@/lib/estimate/types";

const inputCls = "w-full rounded-lg border-2 border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500";
const btn = "rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50";
const ghost = "rounded-lg border-2 border-ink/15 bg-white px-4 py-2 text-sm font-semibold hover:border-ink/40";
const money = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const todayRo = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest" }).format(new Date());

type Field = { key: ImportFieldKey; label: string; required: boolean };

const STATUS: Record<PreviewRow["status"], { label: string; cls: string }> = {
  nou: { label: "Nou", cls: "bg-emerald-50 text-emerald-800" },
  existent: { label: "Există", cls: "bg-sky-50 text-sky-800" },
  dublura_fisier: { label: "Dublură în fișier", cls: "bg-amber-50 text-amber-800" },
  invalid: { label: "Invalid", cls: "bg-red-50 text-red-700" },
};

export function ImportWizard({ scope, types, basePath, fields }: { scope: "global" | "company"; types: ResType[]; basePath: string; fields: Field[] }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [type, setType] = useState<ResType>(types[0]);
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportFieldKey, number>>>({});
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [opts, setOpts] = useState({ obtainedAt: todayRo(), verified: false, supplier: "" });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const mapped = useMemo<ImportRow[]>(() => {
    if (!table) return [];
    return table.rows.map((row) => {
      const out: ImportRow = {};
      for (const f of fields) {
        const i = mapping[f.key];
        if (i !== undefined && i >= 0) out[f.key] = row[i] ?? "";
      }
      return out;
    });
  }, [table, mapping, fields]);

  const parse = (data: FormData) =>
    start(async () => {
      setError(null);
      data.set("scope", scope);
      const r = await parseImportAction(data);
      if ("error" in r) return setError(r.error);
      setTable(r);
      setMapping(r.guess);
      setStep(2);
    });

  const doPreview = () =>
    start(async () => {
      setError(null);
      const missing = fields.filter((f) => f.required && (mapping[f.key] === undefined || mapping[f.key]! < 0));
      if (missing.length) return setError(`Alege coloana pentru: ${missing.map((m) => m.label).join(", ")}.`);
      const r = await previewImportAction(scope, type, mapped);
      if ("error" in r) return setError(r.error);
      setPreview(r);
      // Implicit: bifate rândurile noi (fără posibile dubluri) și cele existente care aduc un preț.
      setSelected(new Set(r.filter((x) => (x.status === "nou" && !x.similar) || (x.status === "existent" && x.price !== null)).map((x) => x.index)));
      setStep(3);
    });

  const apply = () =>
    start(async () => {
      setError(null);
      const rows = mapped.filter((_, i) => selected.has(i));
      const r = await applyImportAction(scope, type, rows, opts);
      if ("error" in r) return setError(r.error);
      setResult(r.ok);
      setStep(4);
    });

  const counts = useMemo(() => {
    const c = { nou: 0, existent: 0, dublura_fisier: 0, invalid: 0, similar: 0, verified: 0 };
    for (const p of preview) {
      c[p.status]++;
      if (p.similar) c.similar++;
      if (p.status === "existent" && p.existing?.verified && p.price !== null && selected.has(p.index)) c.verified++;
    }
    return c;
  }, [preview, selected]);

  const steps = ["Tabelul", "Coloanele", "Verificare", "Gata"];
  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2 text-sm">
        {steps.map((s, i) => (
          <li key={s} className={`rounded-full px-3 py-1 font-medium ${step === i + 1 ? "bg-ink text-white" : step > i + 1 ? "bg-emerald-50 text-emerald-800" : "bg-canvas text-muted"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      {error && <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{error}</p>}

      {step === 1 && (
        <form action={parse} className="space-y-4 rounded-2xl border-2 border-ink/10 bg-white p-5">
          <label className="block max-w-xs">
            <span className="mb-1 block text-sm font-medium">Tipul resurselor din tabel</span>
            <select value={type} onChange={(e) => setType(e.target.value as ResType)} className={inputCls}>
              {types.map((t) => <option key={t} value={t}>{RES_TYPE_LABEL[t]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Fișier Excel (.xlsx) sau CSV</span>
            <input type="file" name="file" accept=".xlsx,.csv,.txt,.tsv" className="block text-sm" />
          </label>
          <p className="text-sm text-muted">sau lipește tabelul copiat din Excel (cu sau fără cap de tabel):</p>
          <textarea name="text" rows={6} className={`${inputCls} font-mono text-xs`} placeholder={"Denumire\tU.M.\tPreț\tFurnizor\nCiment CEM II 42,5R sac 40 kg\tbuc\t32,50\tDepozit X"} />
          <button disabled={pending} className={btn}>{pending ? "Se citește…" : "Continuă"}</button>
        </form>
      )}

      {step === 2 && table && (
        <div className="space-y-4 rounded-2xl border-2 border-ink/10 bg-white p-5">
          <p className="text-sm text-muted">
            {table.rows.length} rânduri {table.headerRow ? "(primul rând a fost recunoscut drept cap de tabel)" : "(fără cap de tabel)"}.
            Alege ce coloană corespunde fiecărui câmp.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-sm font-medium">{f.label}{f.required && <span className="text-brand-700"> *</span>}</span>
                <select value={mapping[f.key] ?? -1} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) }))} className={inputCls}>
                  <option value={-1}>— nu există —</option>
                  {table.headers.map((h, i) => <option key={i} value={i}>{h}{table.rows[0]?.[i] ? ` (ex. ${table.rows[0][i].slice(0, 24)})` : ""}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="grid gap-3 border-t-2 border-ink/10 pt-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Data prețurilor</span>
              <input type="date" value={opts.obtainedAt} max={todayRo()} onChange={(e) => setOpts({ ...opts, obtainedAt: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Furnizor (dacă nu e coloană)</span>
              <input value={opts.supplier} onChange={(e) => setOpts({ ...opts, supplier: e.target.value })} className={inputCls} />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={opts.verified} onChange={(e) => setOpts({ ...opts, verified: e.target.checked })} className="size-4 accent-brand-700" />
              Prețurile din fișier sunt verificate
            </label>
          </div>
          {type === "manopera" && <p className="text-xs text-muted">Manopera nouă se importă cu tipul de tarif „comercial” (fără CAM adăugat). Îl poți schimba din fișa fiecărei meserii.</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className={ghost}>Înapoi</button>
            <button type="button" onClick={doPreview} disabled={pending} className={btn}>{pending ? "Se verifică…" : "Verifică rândurile"}</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-800">{counts.nou} noi</span>
            <span className="rounded-lg bg-sky-50 px-3 py-1.5 text-sky-800">{counts.existent} există deja</span>
            {counts.similar > 0 && <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-800">{counts.similar} posibile dubluri (nebifate)</span>}
            {counts.dublura_fisier > 0 && <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-amber-800">{counts.dublura_fisier} dubluri în fișier</span>}
            {counts.invalid > 0 && <span className="rounded-lg bg-red-50 px-3 py-1.5 text-red-700">{counts.invalid} invalide</span>}
          </div>
          {counts.verified > 0 && (
            <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
              {counts.verified} resurse au deja un preț de referință <b>verificat</b>. Prețul din fișier se adaugă doar în istoric; referința o schimbi manual, din fișa resursei.
            </p>
          )}
          <div className="max-h-[60vh] overflow-auto rounded-2xl border-2 border-ink/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b-2 border-ink/10 bg-white text-muted">
                <tr>
                  <th className="px-3 py-2"><input type="checkbox" className="size-4 accent-brand-700"
                    checked={selected.size > 0 && preview.filter((p) => p.status === "nou" || p.status === "existent").every((p) => selected.has(p.index))}
                    onChange={(e) => setSelected(new Set(e.target.checked ? preview.filter((p) => p.status === "nou" || p.status === "existent").map((p) => p.index) : []))} /></th>
                  <th className="px-3 py-2 font-medium">Rând</th>
                  <th className="px-3 py-2 font-medium">Denumire</th>
                  <th className="px-3 py-2 font-medium">U.M.</th>
                  <th className="px-3 py-2 text-right font-medium">Preț nou</th>
                  <th className="px-3 py-2 font-medium">Situație</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {preview.map((p) => {
                  const canSelect = p.status === "nou" || p.status === "existent";
                  const old = p.existing?.price;
                  const diff = old && p.price ? ((p.price - old) / old) * 100 : null;
                  return (
                    <tr key={p.index} className={canSelect ? "" : "opacity-60"}>
                      <td className="px-3 py-2">
                        <input type="checkbox" disabled={!canSelect} checked={selected.has(p.index)} className="size-4 accent-brand-700"
                          onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(p.index); else n.delete(p.index); return n; })} />
                      </td>
                      <td className="px-3 py-2 text-muted tabular-nums">{p.index + (table?.headerRow ? 2 : 1)}</td>
                      <td className="px-3 py-2">
                        {p.name || <span className="text-muted">—</span>}
                        {p.code && <span className="ml-2 text-xs text-muted">{p.code}</span>}
                        {p.similar && <div className="text-xs text-amber-800">Seamănă cu „{p.similar.name}”</div>}
                        {p.existing && p.existing.name !== p.name && <div className="text-xs text-muted">În catalog: „{p.existing.name}”</div>}
                      </td>
                      <td className="px-3 py-2">{p.unit}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {p.price !== null ? money.format(p.price) : <span className="text-muted">—</span>}
                        {old !== undefined && old !== null && p.price !== null && (
                          <div className={`text-xs ${diff! > 0 ? "text-red-700" : "text-emerald-700"}`}>
                            era {money.format(old)} ({diff! > 0 ? "+" : ""}{diff!.toFixed(1)}%)
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
                        {p.reason && <div className="mt-0.5 text-xs text-muted">{p.reason}</div>}
                        {p.existing?.verified && p.price !== null && <div className="mt-0.5 text-xs text-muted">referință verificată — rămâne</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setStep(2)} className={ghost}>Înapoi</button>
            <button type="button" onClick={apply} disabled={pending || selected.size === 0} className={btn}>
              {pending ? "Se importă…" : `Importă ${selected.size} rânduri`}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="rounded-2xl border-2 border-ink/10 bg-white p-5">
          <p className="rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">{result}</p>
          <div className="mt-4 flex gap-2">
            <Link href={basePath} className={btn}>Înapoi la listă</Link>
            <button type="button" onClick={() => { setStep(1); setTable(null); setPreview([]); setResult(null); }} className={ghost}>Alt import</button>
          </div>
        </div>
      )}
    </div>
  );
}
