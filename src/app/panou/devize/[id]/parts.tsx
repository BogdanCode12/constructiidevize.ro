"use client";

import { useEffect, useRef, useState } from "react";
import { searchCatalogAction } from "@/lib/resources/actions";
import { fmtMoney } from "@/lib/estimate/calc";
import { RES_TYPE_LABEL, RES_TYPES, type CatalogResource, type ResType } from "@/lib/estimate/types";

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
                <span className="w-24 text-right tabular-nums">{fmtMoney(r.price)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
