"use client";

import { useEffect, useRef, useState } from "react";
import { searchCatalogAction } from "@/lib/resources/actions";
import { fmtMoney } from "@/lib/estimate/calc";
import { RES_TYPE_LABEL, RES_TYPES, type CatalogResource, type ResType } from "@/lib/estimate/types";
import { importF3Action, recipeItemAction, searchRecipesAction, type ImportResult } from "../actions";
import type { RecipeHit } from "@/lib/recipes/repo";
import type { EstItem } from "@/lib/estimate/types";

export const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

export const cellCls =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 outline-none hover:border-line focus:border-brand-500 focus:bg-white";

const parse = (s: string, allowNegative: boolean): number | null => {
  let t = s.trim().replace(/\s/g, "");
  if (!t || t === "-") return 0;
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && (allowNegative || n >= 0) ? n : null;
};

const toText = (n: number | null, empty: string) => (n === null || (n === 0 && empty === "") ? "" : String(n).replace(".", ","));

/** Câmp numeric care acceptă virgulă; comite valoarea doar când e un număr valid. */
export function NumInput({ value, onChange, className = "", placeholder = "0", allowNegative = false, nullable = false }: {
  value: number | null; onChange: (n: number | null) => void; className?: string; placeholder?: string;
  allowNegative?: boolean; nullable?: boolean;
}) {
  const [text, setText] = useState(toText(value, ""));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(toText(value, ""));
  }, [value]);
  const invalid = text.trim() !== "" && parse(text, allowNegative) === null;
  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(toText(value, ""));
      }}
      onChange={(e) => {
        setText(e.target.value);
        if (nullable && e.target.value.trim() === "") return onChange(null);
        const n = parse(e.target.value, allowNegative);
        if (n !== null) onChange(n);
      }}
      className={`${cellCls} text-right tabular-nums ${invalid ? "border-red-400" : ""} ${className}`}
    />
  );
}

export function ResourcePicker({ onPick, onManual }: { onPick: (r: CatalogResource) => void; onManual: (t: ResType) => void }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<ResType | "">("");
  const [results, setResults] = useState<CatalogResource[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        setResults(await searchCatalogAction(q, type || undefined));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, type, open]);

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <select value={type} onChange={(e) => setType(e.target.value as ResType | "")}
        className="rounded-md border border-line bg-white px-2 py-1.5 text-sm">
        <option value="">Toate tipurile</option>
        {RES_TYPES.map((t) => <option key={t} value={t}>{RES_TYPE_LABEL[t]}</option>)}
      </select>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); show(); }}
        onFocus={show}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        placeholder="Caută resursă în catalog (ciment, zidar, betonieră…)"
        className="min-w-64 flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500"
      />
      <button type="button" onClick={() => onManual(type || "material")}
        className="rounded-md border border-line bg-white px-3 py-1.5 text-sm hover:border-brand-200">
        + Resursă manuală
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 max-h-72 w-full max-w-2xl overflow-y-auto rounded-lg border border-line bg-white shadow-lg">
          {loading && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">Se caută…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">Nimic găsit. Adaugă resurse în pagina Resurse sau folosește „Resursă manuală”.</p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onPick(r); setQ(""); setOpen(false); }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brand-50"
              >
                <span className="w-20 shrink-0 text-xs text-muted">{RES_TYPE_LABEL[r.type]}</span>
                <span className="flex-1">{r.name}</span>
                <span className="text-muted">{r.unit}</span>
                <span className="w-24 text-right tabular-nums">{r.price === null ? <span className="text-xs text-muted">fără preț</span> : fmtMoney(r.price)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Căutare articole (rețete) în bază ----------


export function RecipePicker({ onPick }: { onPick: (item: EstItem) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<RecipeHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const blur = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || q.trim().length < 2) return setHits([]);
    const t = setTimeout(async () => setHits(await searchRecipesAction(q)), 250);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); if (blur.current) clearTimeout(blur.current); setOpen(true); }}
        onFocus={() => { if (blur.current) clearTimeout(blur.current); setOpen(true); }}
        onBlur={() => { blur.current = setTimeout(() => setOpen(false), 150); }}
        placeholder="Caută articol în bază (ex: zidărie BCA, tencuială)…"
        className="w-80 max-w-full rounded-md border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute bottom-full left-0 z-20 mb-1 max-h-72 w-[36rem] max-w-[90vw] overflow-y-auto rounded-lg border border-line bg-white shadow-lg">
          {hits.length === 0 ? <p className="px-3 py-2 text-sm text-muted">Nicio rețetă găsită. Salvează articole ca rețete (★) ca să le refolosești.</p> : hits.map((h) => (
            <button key={h.id} type="button" disabled={busy}
              onMouseDown={(e) => e.preventDefault()}
              onClick={async () => {
                setBusy(true);
                const it = await recipeItemAction(h.id);
                setBusy(false);
                if (it) { onPick(it); setQ(""); setOpen(false); }
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brand-50">
              <span className="w-16 shrink-0 text-xs text-muted">{h.code ?? ""}</span>
              <span className="flex-1">{h.name}{h.global && <span className="ml-2 rounded bg-canvas px-1 text-[10px] uppercase text-muted">catalog</span>}</span>
              <span className="text-muted">{h.unit}</span>
              <span className="w-24 text-right tabular-nums">{fmtMoney(h.unitPrice)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Import listă de cantități (F3) ----------

export function ImportDialog({ onClose, onImport }: { onClose: () => void; onImport: (r: Extract<ImportResult, { ok: true }>) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const res = await importF3Action(new FormData(e.currentTarget));
            if (res.ok) onImport(res);
            else setError(res.error);
          } finally {
            setBusy(false);
          }
        }}
        className="w-full max-w-2xl space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <div>
          <h2 className="text-lg font-bold">Import listă de cantități (F3)</h2>
          <p className="text-sm text-muted">Articolele se potrivesc automat cu rețetele din bază — instant, fără cost. Ce nu se găsește poate fi completat apoi automat, de asistent.</p>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Fișier Excel (.xlsx)</span>
          <input type="file" name="file" accept=".xlsx" className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">sau lipește rândurile copiate din Excel</span>
          <textarea name="text" rows={8} placeholder={"Cod\tDenumire\tU.M.\tCantitate\nCZ0101\tZidărie din blocuri ceramice 25 cm\tmc\t120"}
            className="w-full rounded-lg border border-line px-3 py-2 font-mono text-xs outline-none focus:border-brand-500" />
        </label>
        <p className="text-xs text-muted">Rândurile fără cantitate și U.M. devin capitole. Capul de tabel (Cod, Denumire, U.M., Cantitate) e recunoscut automat.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm">Renunță</button>
          <button disabled={busy} className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
            {busy ? "Se potrivesc articolele…" : "Importă"}
          </button>
        </div>
      </form>
    </div>
  );
}
