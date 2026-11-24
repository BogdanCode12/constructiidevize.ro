"use client";

import { useEffect, useRef, useState } from "react";
import { ActionForm } from "../action-form";
import { saveRecipeFormAction, searchRecipeResourcesAction } from "@/lib/recipes/actions";
import { UNIT_SUGGESTIONS } from "@/lib/resources/units";
import { RES_TYPE_LABEL, RES_TYPES, type CatalogResource, type ResType } from "@/lib/estimate/types";
import type { RecipeDetail } from "@/lib/recipes/list";

const inputCls = "w-full rounded-lg border-2 border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500";
const cell = "w-full rounded-md border border-line bg-white px-2 py-1 text-sm outline-none focus:border-brand-500";
const money = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

type Row = {
  key: string; resourceId: number | null; type: ResType; code: string; name: string; unit: string;
  norm: string; waste: string; note: string; price: number | null;
};

const num = (s: string) => {
  const n = Number(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const key = () => Math.random().toString(36).slice(2);

const CATEGORIES = ["Terasamente", "Beton", "Armături", "Cofraje", "Zidărie", "Tencuieli", "Zugrăveli", "Termoizolații", "Hidroizolații", "Pardoseli", "Învelitori", "Instalații", "Altele"];

function Picker({ scope, onPick }: { scope: string; onPick: (r: CatalogResource) => void }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<ResType | "">("");
  const [list, setList] = useState<CatalogResource[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => setList(await searchRecipeResourcesAction(scope, q, type || undefined)), 250);
    return () => clearTimeout(t);
  }, [q, type, open, scope]);
  return (
    <div className="relative flex flex-1 flex-wrap gap-2">
      <select value={type} onChange={(e) => setType(e.target.value as ResType | "")} className="rounded-lg border-2 border-ink/10 bg-white px-2 py-1.5 text-sm">
        <option value="">Toate tipurile</option>
        {RES_TYPES.map((t) => <option key={t} value={t}>{RES_TYPE_LABEL[t]}</option>)}
      </select>
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => { if (timer.current) clearTimeout(timer.current); setOpen(true); }}
        onBlur={() => { timer.current = setTimeout(() => setOpen(false), 150); }}
        placeholder="Caută resursa în catalog și adaug-o…" className="min-w-56 flex-1 rounded-lg border-2 border-ink/10 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
      {open && (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-auto rounded-xl border-2 border-ink/10 bg-white shadow-lg">
          {list.length === 0 ? <p className="px-3 py-2 text-sm text-muted">Nimic găsit.</p> : list.map((r) => (
            <button key={r.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(r); setQ(""); setOpen(false); }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brand-50">
              <span className="w-20 shrink-0 text-xs text-muted">{RES_TYPE_LABEL[r.type]}</span>
              <span className="flex-1">{r.name}</span>
              <span className="text-muted">{r.unit}</span>
              <span className="w-24 text-right tabular-nums">{r.price === null ? <span className="text-xs text-muted">fără preț</span> : money.format(r.price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Editorul unui articol: date tehnice + rețeta (resurse, consum pe U.M. de articol, pierderi tehnologice). */
export function RecipeEditor({ scope, recipe, base, readOnly }: { scope: "global" | "company"; recipe?: RecipeDetail; base: string; readOnly: boolean }) {
  const [rows, setRows] = useState<Row[]>(
    (recipe?.resources ?? []).map((r) => ({
      key: key(), resourceId: r.resourceId, type: r.type, code: r.code ?? "", name: r.name, unit: r.unit,
      norm: String(r.norm).replace(".", ","), waste: String(r.waste).replace(".", ","), note: r.note ?? "", price: r.price,
    })),
  );
  const set = (k: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === k ? { ...r, ...patch } : r)));
  const total = rows.reduce((s, r) => {
    const n = num(r.norm), w = num(r.waste || "0");
    return s + (Number.isFinite(n) && Number.isFinite(w) ? n * (1 + w / 100) * (r.price ?? 0) : 0);
  }, 0);
  const payload = JSON.stringify(rows.map((r) => ({
    resourceId: r.resourceId, type: r.type, code: r.code, name: r.name, unit: r.unit, norm: num(r.norm), waste: num(r.waste || "0"), note: r.note,
  })));
  const verified = recipe?.status === "verificat";

  const body = (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-3"><span className="mb-1 block text-sm font-medium">Denumirea lucrării</span>
          <input name="name" required disabled={readOnly} defaultValue={recipe?.name ?? ""} className={inputCls} placeholder="ex. Zidărie din blocuri ceramice cu goluri, 25 cm" />
        </label>
        <label className="block"><span className="mb-1 block text-sm font-medium">U.M.</span>
          <input name="unit" required disabled={readOnly} list="r-units" defaultValue={recipe?.unit ?? ""} className={inputCls} />
          <datalist id="r-units">{UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}</datalist>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block"><span className="mb-1 block text-sm font-medium">Cod</span>
          <input name="code" disabled={readOnly} defaultValue={recipe?.code ?? ""} className={inputCls} />
        </label>
        <label className="block"><span className="mb-1 block text-sm font-medium">Categorie</span>
          <input name="category" disabled={readOnly} list="r-cats" defaultValue={recipe?.category ?? ""} className={inputCls} />
          <datalist id="r-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="block"><span className="mb-1 block text-sm font-medium">Sursa normei / rețetei</span>
          <input name="norm_source" disabled={readOnly} defaultValue={recipe?.normSource ?? ""} className={inputCls} placeholder="ex. rețetă proprie, fișă tehnică" />
        </label>
        <label className="block"><span className="mb-1 block text-sm font-medium">Versiunea / ediția sursei</span>
          <input name="norm_version" disabled={readOnly} defaultValue={recipe?.normVersion ?? ""} className={inputCls} placeholder="ex. 2026, ed. 3" />
        </label>
      </div>
      <label className="block"><span className="mb-1 block text-sm font-medium">Descriere tehnică</span>
        <textarea name="description" disabled={readOnly} rows={2} defaultValue={recipe?.description ?? ""} className={inputCls} />
      </label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Condiții de aplicare</span>
        <input name="conditions" disabled={readOnly} defaultValue={recipe?.conditions ?? ""} className={inputCls} placeholder="ex. înălțime până la 3 m, fără schelă" />
      </label>

      <div className="rounded-xl border-2 border-ink/10">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink/10 px-3 py-2.5">
          <h3 className="text-sm font-bold">Rețeta: resurse pe 1 {recipe?.unit || "U.M."} de lucrare</h3>
          <span className="text-sm">Preț unitar estimat (prețurile de acum): <b className="tabular-nums">{money.format(total)} lei</b></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-2 py-2 font-medium">Tip</th>
                <th className="px-2 py-2 font-medium">Resursă</th>
                <th className="px-2 py-2 font-medium">U.M.</th>
                <th className="px-2 py-2 font-medium">Consum</th>
                <th className="px-2 py-2 font-medium">Pierderi %</th>
                <th className="px-2 py-2 text-right font-medium">Preț</th>
                <th className="px-2 py-2 text-right font-medium">Valoare / U.M.</th>
                <th className="px-2 py-2 font-medium">Notă</th>
                {!readOnly && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted">Nicio resursă. Articolul rămâne draft până primește consumuri din surse verificate.</td></tr>
              )}
              {rows.map((r) => {
                const n = num(r.norm), w = num(r.waste || "0");
                const v = Number.isFinite(n) && Number.isFinite(w) ? n * (1 + w / 100) * (r.price ?? 0) : 0;
                return (
                  <tr key={r.key}>
                    <td className="w-28 px-2 py-1">
                      {readOnly || r.resourceId ? <span className="text-xs text-muted">{RES_TYPE_LABEL[r.type]}</span> : (
                        <select value={r.type} onChange={(e) => set(r.key, { type: e.target.value as ResType })} className={cell}>
                          {RES_TYPES.map((t) => <option key={t} value={t}>{RES_TYPE_LABEL[t]}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="min-w-56 px-2 py-1">
                      {readOnly || r.resourceId ? <span>{r.name}</span> : <input value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} className={cell} placeholder="Denumire" />}
                      {!r.resourceId && <div className="mt-0.5 text-[11px] text-amber-800">nelegată de catalog — fără preț</div>}
                    </td>
                    <td className="w-20 px-2 py-1">{readOnly || r.resourceId ? <span>{r.unit}</span> : <input value={r.unit} onChange={(e) => set(r.key, { unit: e.target.value })} className={cell} />}</td>
                    <td className="w-24 px-2 py-1"><input value={r.norm} disabled={readOnly} inputMode="decimal" onChange={(e) => set(r.key, { norm: e.target.value })} className={`${cell} text-right`} /></td>
                    <td className="w-20 px-2 py-1"><input value={r.waste} disabled={readOnly} inputMode="decimal" onChange={(e) => set(r.key, { waste: e.target.value })} className={`${cell} text-right`} /></td>
                    <td className="px-2 py-1 text-right tabular-nums text-muted">{r.price === null ? "—" : money.format(r.price)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{money.format(v)}</td>
                    <td className="min-w-48 px-2 py-1"><input value={r.note} disabled={readOnly} onChange={(e) => set(r.key, { note: e.target.value })} className={cell} placeholder="ex. justificare pierderi" /></td>
                    {!readOnly && (
                      <td className="px-2 py-1">
                        <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="text-muted hover:text-red-700" title="Scoate">✕</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink/10 px-3 py-2.5">
            <Picker scope={scope} onPick={(c) => setRows((rs) => [...rs, {
              key: key(), resourceId: c.id, type: c.type, code: c.code ?? "", name: c.name, unit: c.unit, norm: "", waste: "0", note: "", price: c.price,
            }])} />
            <button type="button" onClick={() => setRows((rs) => [...rs, { key: key(), resourceId: null, type: "material", code: "", name: "", unit: "buc", norm: "", waste: "0", note: "", price: null }])}
              className="text-sm font-semibold text-brand-700 hover:underline">+ resursă fără legătură</button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted">
        Cantitate resursă în deviz = cantitate lucrare × consum × (1 + pierderi/100). Introdu consumurile doar din surse verificate
        (fișe tehnice, rețete proprii măsurate, norme cu licență); o normă veche nu e automat potrivită tehnologiilor actuale.
      </p>
    </>
  );

  if (readOnly) return <div className="space-y-4">{body}</div>;
  return (
    <ActionForm action={saveRecipeFormAction} submitLabel={!recipe ? "Creează articolul (draft)" : verified ? "Salvează ca versiune nouă (draft)" : "Salvează"}>
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="base" value={base} />
      {recipe && <input type="hidden" name="id" value={recipe.id} />}
      <input type="hidden" name="resources" value={payload} />
      {verified && (
        <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          Articolul e <b>verificat</b>. Modificările se salvează ca <b>versiune nouă (draft)</b>; versiunea actuală rămâne în uz până validezi versiunea nouă.
        </p>
      )}
      {body}
    </ActionForm>
  );
}
