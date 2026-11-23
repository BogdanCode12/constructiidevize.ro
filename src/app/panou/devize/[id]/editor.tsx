"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { saveEstimateAction, deleteEstimateAction } from "../actions";
import { searchCatalogAction } from "@/lib/resources/actions";
import {
  fmtMoney, fmtQty, itemTotal, itemUnitBreakdown, itemUnitPrice, recap, chapterBreakdown, sum,
} from "@/lib/estimate/calc";
import {
  RES_TYPE_LABEL, RES_TYPES,
  type CatalogResource, type EstChapter, type EstimateDoc, type EstItem, type EstResource, type ResType,
} from "@/lib/estimate/types";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const parse = (s: string): number | null => {
  let t = s.trim().replace(/\s/g, "");
  if (!t) return 0;
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const toText = (n: number) => (n === 0 ? "" : String(n).replace(".", ","));

/** Câmp numeric care acceptă virgulă; comite valoarea doar când e un număr valid. */
function NumInput({ value, onChange, className = "", placeholder = "0" }: {
  value: number; onChange: (n: number) => void; className?: string; placeholder?: string;
}) {
  const [text, setText] = useState(toText(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(toText(value));
  }, [value]);
  const invalid = parse(text) === null;
  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(toText(value));
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parse(e.target.value);
        if (n !== null) onChange(n);
      }}
      className={`${cellCls} text-right tabular-nums ${invalid ? "border-red-400" : ""} ${className}`}
    />
  );
}

const cellCls =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 outline-none hover:border-line focus:border-brand-500 focus:bg-white";

function ResourcePicker({ onPick, onManual }: { onPick: (r: CatalogResource) => void; onManual: (t: ResType) => void }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<ResType | "">("");
  const [results, setResults] = useState<CatalogResource[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
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

const emptyItem = (): EstItem => ({ key: newKey(), code: "", name: "", unit: "", quantity: 0, resources: [] });

export function EstimateEditor({ initial }: { initial: EstimateDoc }) {
  const [doc, setDoc] = useState<EstimateDoc>(initial);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, startSaving] = useTransition();

  const update = useCallback((fn: (d: EstimateDoc) => EstimateDoc) => {
    setDoc((d) => fn(d));
    setDirty(true);
  }, []);

  const setChapter = (ci: number, fn: (c: EstChapter) => EstChapter) =>
    update((d) => ({ ...d, chapters: d.chapters.map((c, i) => (i === ci ? fn(c) : c)) }));
  const setItem = (ci: number, ii: number, fn: (it: EstItem) => EstItem) =>
    setChapter(ci, (c) => ({ ...c, items: c.items.map((it, i) => (i === ii ? fn(it) : it)) }));
  const setRes = (ci: number, ii: number, ri: number, fn: (r: EstResource) => EstResource) =>
    setItem(ci, ii, (it) => ({ ...it, resources: it.resources.map((r, i) => (i === ri ? fn(r) : r)) }));

  const toggle = (key: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const save = useCallback(() => {
    setError(null);
    startSaving(async () => {
      const res = await saveEstimateAction(doc);
      if (res.ok) {
        setDirty(false);
        setSavedAt(new Date());
      } else setError(res.error);
    });
  }, [doc]);

  // Ctrl+S salvează; avertizare la închiderea paginii cu modificări nesalvate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [save, dirty]);

  const r = recap(doc);
  const move = <T,>(arr: T[], from: number, to: number) => {
    if (to < 0 || to >= arr.length) return arr;
    const copy = [...arr];
    const [x] = copy.splice(from, 1);
    copy.splice(to, 0, x);
    return copy;
  };

  return (
    <div className="-mt-2">
      {/* Bara de sus */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8 lg:top-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <Link href="/panou/devize" className="text-sm text-muted hover:text-ink">← Devize · {doc.projectName}</Link>
            <input
              value={doc.name}
              onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
              className="block w-full rounded-md border border-transparent bg-transparent text-xl font-bold outline-none hover:border-line focus:border-brand-500 focus:bg-white sm:text-2xl"
            />
          </div>
          <span className="text-sm text-muted">
            {saving ? "Se salvează…" : dirty ? "Modificări nesalvate" : savedAt ? `Salvat la ${savedAt.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}` : "Salvat"}
          </span>
          <a
            href={dirty ? undefined : `/panou/devize/${doc.id}/export`}
            onClick={(e) => { if (dirty) { e.preventDefault(); alert("Salvează devizul înainte de export."); } }}
            className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand-200"
          >
            Export Excel
          </a>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
          >
            Salvează
          </button>
        </div>
        {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>

      {/* Capitole */}
      <div className="space-y-6">
        {doc.chapters.map((ch, ci) => {
          const chTotal = sum(chapterBreakdown(ch));
          return (
            <section key={ch.key} className="rounded-xl border border-line bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                <span className="text-sm font-semibold text-muted">Cap. {ci + 1}</span>
                <input
                  value={ch.name}
                  onChange={(e) => setChapter(ci, (c) => ({ ...c, name: e.target.value }))}
                  className="min-w-48 flex-1 rounded-md border border-transparent px-2 py-1 font-semibold outline-none hover:border-line focus:border-brand-500"
                />
                <span className="font-semibold tabular-nums">{fmtMoney(chTotal)} lei</span>
                <button title="Mută sus" onClick={() => update((d) => ({ ...d, chapters: move(d.chapters, ci, ci - 1) }))} className="px-1.5 text-muted hover:text-ink">↑</button>
                <button title="Mută jos" onClick={() => update((d) => ({ ...d, chapters: move(d.chapters, ci, ci + 1) }))} className="px-1.5 text-muted hover:text-ink">↓</button>
                <button
                  onClick={() => {
                    if (ch.items.length && !confirm(`Ștergi capitolul „${ch.name}” cu ${ch.items.length} articole?`)) return;
                    update((d) => ({ ...d, chapters: d.chapters.filter((_, i) => i !== ci) }));
                  }}
                  className="px-1.5 text-sm text-red-700 hover:underline"
                >
                  Șterge
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr className="border-b border-line">
                      <th className="w-14 px-3 py-2 font-medium">Nr.</th>
                      <th className="w-28 px-1 py-2 font-medium">Cod</th>
                      <th className="px-1 py-2 font-medium">Denumire articol</th>
                      <th className="w-20 px-1 py-2 font-medium">U.M.</th>
                      <th className="w-28 px-1 py-2 text-right font-medium">Cantitate</th>
                      <th className="w-28 px-2 py-2 text-right font-medium">Preț unitar</th>
                      <th className="w-32 px-2 py-2 text-right font-medium">Valoare</th>
                      <th className="w-28 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {ch.items.map((it, ii) => {
                      const open = expanded.has(it.key);
                      const ub = itemUnitBreakdown(it);
                      return (
                        <ItemRows
                          key={it.key}
                          nr={`${ci + 1}.${ii + 1}`}
                          item={it}
                          open={open}
                          unitBreakdown={ub}
                          onToggle={() => toggle(it.key)}
                          onItem={(fn) => setItem(ci, ii, fn)}
                          onRes={(ri, fn) => setRes(ci, ii, ri, fn)}
                          onMove={(dir) => setChapter(ci, (c) => ({ ...c, items: move(c.items, ii, ii + dir) }))}
                          onDelete={() => setChapter(ci, (c) => ({ ...c, items: c.items.filter((_, i) => i !== ii) }))}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3">
                <button
                  onClick={() => {
                    const it = emptyItem();
                    setChapter(ci, (c) => ({ ...c, items: [...c.items, it] }));
                    setExpanded((s) => new Set(s).add(it.key));
                  }}
                  className="text-sm font-semibold text-brand-700 hover:underline"
                >
                  + Adaugă articol
                </button>
              </div>
            </section>
          );
        })}

        <button
          onClick={() => update((d) => ({ ...d, chapters: [...d.chapters, { key: newKey(), name: `Capitolul ${d.chapters.length + 1}`, items: [] }] }))}
          className="w-full rounded-xl border-2 border-dashed border-line py-4 font-semibold text-brand-700 hover:border-brand-200 hover:bg-white"
        >
          + Adaugă capitol
        </button>
      </div>

      {/* Recapitulație */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-3 font-bold">Recapitulație</h2>
          <dl className="space-y-1.5 text-sm">
            {RES_TYPES.map((t) => (
              <Row key={t} label={t === "utilaj" ? "Utilaje" : RES_TYPE_LABEL[t]} value={r.direct[t]} />
            ))}
            <Row label="Total cheltuieli directe" value={r.directTotal} strong />
            <PctRow label="Cheltuieli indirecte" pct={doc.overheadPct} value={r.overhead}
              onPct={(n) => update((d) => ({ ...d, overheadPct: n }))} />
            <PctRow label="Profit" pct={doc.profitPct} value={r.profit}
              onPct={(n) => update((d) => ({ ...d, profitPct: n }))} />
            <Row label="Total fără TVA" value={r.totalNoVat} strong />
            <PctRow label="TVA" pct={doc.vatPct} value={r.vat} onPct={(n) => update((d) => ({ ...d, vatPct: n }))} />
            <div className="mt-2 flex justify-between border-t border-line pt-3 text-lg font-bold">
              <dt>Total cu TVA</dt>
              <dd className="tabular-nums">{fmtMoney(r.total)} lei</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-3 font-bold">Manoperă</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Total ore-om</dt><dd className="font-semibold tabular-nums">{fmtQty(r.laborHours)} ore</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Zile-om (8 ore/zi)</dt><dd className="font-semibold tabular-nums">{fmtQty(Math.ceil(r.laborHours / 8 * 10) / 10)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted">
            Orele se calculează din resursele de manoperă cu U.M. „ora”: normă × cantitate. Calculul pe echipe, durată și ore de regie vine în modulul Manoperă.
          </p>
          <form action={deleteEstimateAction} className="mt-6 border-t border-line pt-4"
            onSubmit={(e) => { if (!confirm("Ștergi definitiv acest deviz?")) e.preventDefault(); }}>
            <input type="hidden" name="id" value={doc.id} />
            <button className="text-sm text-red-700 hover:underline">Șterge devizul</button>
          </form>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-line pt-1.5 font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className="tabular-nums">{fmtMoney(value)} lei</dd>
    </div>
  );
}

function PctRow({ label, pct, value, onPct }: { label: string; pct: number; value: number; onPct: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-2 text-muted">
        {label}
        <span className="flex w-20 items-center rounded-md border border-line">
          <NumInput value={pct} onChange={onPct} className="py-0.5" />
          <span className="pr-2 text-xs">%</span>
        </span>
      </dt>
      <dd className="tabular-nums">{fmtMoney(value)} lei</dd>
    </div>
  );
}

function ItemRows({
  nr, item, open, unitBreakdown, onToggle, onItem, onRes, onMove, onDelete,
}: {
  nr: string; item: EstItem; open: boolean; unitBreakdown: Record<ResType, number>;
  onToggle: () => void;
  onItem: (fn: (it: EstItem) => EstItem) => void;
  onRes: (ri: number, fn: (r: EstResource) => EstResource) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const addRes = (r: Omit<EstResource, "key">) => onItem((it) => ({ ...it, resources: [...it.resources, { ...r, key: newKey() }] }));
  return (
    <>
      <tr className={`border-b border-line align-top ${open ? "bg-brand-50/40" : ""}`}>
        <td className="px-3 py-2.5 text-muted">
          <button onClick={onToggle} className="flex items-center gap-1 hover:text-ink" title="Resursele articolului">
            <span className={`inline-block transition ${open ? "rotate-90" : ""}`}>›</span>{nr}
          </button>
        </td>
        <td className="px-1 py-1"><input value={item.code} onChange={(e) => onItem((it) => ({ ...it, code: e.target.value }))} className={cellCls} placeholder="Cod" /></td>
        <td className="px-1 py-1"><input value={item.name} onChange={(e) => onItem((it) => ({ ...it, name: e.target.value }))} className={cellCls} placeholder="Denumirea lucrării" /></td>
        <td className="px-1 py-1"><input value={item.unit} onChange={(e) => onItem((it) => ({ ...it, unit: e.target.value }))} className={cellCls} placeholder="mc" /></td>
        <td className="px-1 py-1"><NumInput value={item.quantity} onChange={(n) => onItem((it) => ({ ...it, quantity: n }))} /></td>
        <td className="px-2 py-2.5 text-right tabular-nums">{fmtMoney(itemUnitPrice(item))}</td>
        <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{fmtMoney(itemTotal(item))}</td>
        <td className="px-2 py-2.5 text-right whitespace-nowrap text-muted">
          <button title="Mută sus" onClick={() => onMove(-1)} className="px-1 hover:text-ink">↑</button>
          <button title="Mută jos" onClick={() => onMove(1)} className="px-1 hover:text-ink">↓</button>
          <button title="Șterge articolul" onClick={() => { if (!item.resources.length || confirm("Ștergi articolul?")) onDelete(); }} className="px-1 text-red-700 hover:text-red-900">✕</button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-line bg-brand-50/40">
          <td />
          <td colSpan={7} className="px-1 pt-1 pb-4">
            <div className="rounded-lg border border-line bg-white">
              <table className="w-full text-xs">
                <thead className="text-left text-muted">
                  <tr className="border-b border-line">
                    <th className="w-28 px-2 py-1.5 font-medium">Tip</th>
                    <th className="w-24 px-1 py-1.5 font-medium">Cod</th>
                    <th className="px-1 py-1.5 font-medium">Resursă</th>
                    <th className="w-16 px-1 py-1.5 font-medium">U.M.</th>
                    <th className="w-24 px-1 py-1.5 text-right font-medium" title="Consum pe unitatea articolului">Normă / {item.unit || "U.M."}</th>
                    <th className="w-24 px-1 py-1.5 text-right font-medium">Preț</th>
                    <th className="w-24 px-2 py-1.5 text-right font-medium">Valoare / {item.unit || "U.M."}</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {item.resources.map((res, ri) => (
                    <tr key={res.key} className="border-b border-line last:border-0">
                      <td className="px-1 py-0.5">
                        <select value={res.type} onChange={(e) => onRes(ri, (x) => ({ ...x, type: e.target.value as ResType }))} className={cellCls}>
                          {RES_TYPES.map((t) => <option key={t} value={t}>{RES_TYPE_LABEL[t]}</option>)}
                        </select>
                      </td>
                      <td className="px-1 py-0.5"><input value={res.code} onChange={(e) => onRes(ri, (x) => ({ ...x, code: e.target.value }))} className={cellCls} /></td>
                      <td className="px-1 py-0.5"><input value={res.name} onChange={(e) => onRes(ri, (x) => ({ ...x, name: e.target.value }))} className={cellCls} placeholder="Denumire" /></td>
                      <td className="px-1 py-0.5"><input value={res.unit} onChange={(e) => onRes(ri, (x) => ({ ...x, unit: e.target.value }))} className={cellCls} /></td>
                      <td className="px-1 py-0.5"><NumInput value={res.norm} onChange={(n) => onRes(ri, (x) => ({ ...x, norm: n }))} /></td>
                      <td className="px-1 py-0.5"><NumInput value={res.price} onChange={(n) => onRes(ri, (x) => ({ ...x, price: n }))} /></td>
                      <td className="px-2 py-0.5 text-right tabular-nums">{fmtMoney(res.norm * res.price)}</td>
                      <td className="px-1 text-center">
                        <button title="Elimină" onClick={() => onItem((it) => ({ ...it, resources: it.resources.filter((_, i) => i !== ri) }))} className="text-red-700">✕</button>
                      </td>
                    </tr>
                  ))}
                  {item.resources.length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-3 text-muted">Adaugă resursele articolului: materiale, manoperă, utilaje, transport — cu consumul pe {item.unit || "unitatea de măsură"}.</td></tr>
                  )}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2.5">
                <ResourcePicker
                  onPick={(c) => addRes({ resourceId: c.id, type: c.type, code: c.code ?? "", name: c.name, unit: c.unit, norm: 1, price: c.price })}
                  onManual={(t) => addRes({ resourceId: null, type: t, code: "", name: "", unit: t === "material" ? "buc" : "ora", norm: 1, price: 0 })}
                />
                <div className="flex gap-3 text-muted">
                  {RES_TYPES.map((t) => (
                    <span key={t}>{RES_TYPE_LABEL[t].charAt(0)}: <b className="text-ink tabular-nums">{fmtMoney(unitBreakdown[t])}</b></span>
                  ))}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
