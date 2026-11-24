"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { saveEstimateAction, deleteEstimateAction, estimatorJobAction, saveRecipeAction, startEstimatorAction } from "../actions";
import { cellCls, ImportDialog, newKey, NumInput, RecipePicker, ResourcePicker } from "./parts";
import { Simulator } from "./simulator";
import { Gantt } from "./gantt";
import { checkEstimate, type Issue } from "@/lib/estimate/checks";
import { chapterBreakdown, effNorm, fmtMoney, fmtQty, itemTotal, itemUnitBreakdown, itemUnitPrice, recap, sum } from "@/lib/estimate/calc";
import {
  RES_TYPE_LABEL, RES_TYPES, type EstChapter, type EstimateDoc, type EstItem, type EstResource, type ResType,
} from "@/lib/estimate/types";

type Tab = "deviz" | "verificari" | "simulator" | "grafic";

const emptyItem = (): EstItem => ({ key: newKey(), code: "", name: "", unit: "", quantity: 0, reviewNote: null, resources: [] });

const move = <T,>(arr: T[], from: number, to: number) => {
  if (to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [x] = copy.splice(from, 1);
  copy.splice(to, 0, x);
  return copy;
};

export function EstimateEditor({ initial, isAdmin }: { initial: EstimateDoc; isAdmin: boolean }) {
  const [doc, setDoc] = useState<EstimateDoc>(initial);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("deviz");
  const [flash, setFlash] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [showImport, setShowImport] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiJob, setAiJob] = useState<number | null>(null);

  const update = useCallback((fn: (d: EstimateDoc) => EstimateDoc) => {
    setDoc((d) => fn(d));
    setDirty(true);
  }, []);

  const setChapter = useCallback((ci: number, fn: (c: EstChapter) => EstChapter) =>
    update((d) => ({ ...d, chapters: d.chapters.map((c, i) => (i === ci ? fn(c) : c)) })), [update]);
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

  // Articole fără resurse (de completat cu AI din bază)
  const missing = useMemo(
    () => doc.chapters.flatMap((c) => c.items).filter((i) => i.name.trim() && i.resources.length === 0),
    [doc],
  );

  const startAi = async () => {
    setError(null);
    const res = await startEstimatorAction(doc.id, missing.map((i) => ({ ref: i.key, code: i.code, name: i.name, unit: i.unit })));
    if (!res.ok) return setError(res.error);
    setAiJob(res.jobId);
    setNotice(`Asistentul caută în bază pentru ${missing.length} articole…`);
  };

  // Urmărește lucrarea AI și aplică propunerile pe articole când e gata.
  useEffect(() => {
    if (!aiJob) return;
    const t = setInterval(async () => {
      const r = await estimatorJobAction(aiJob);
      if (r.status === "done" && r.proposals) {
        clearInterval(t);
        setAiJob(null);
        const byRef = new Map(r.proposals.map((p) => [p.ref, p]));
        update((d) => ({
          ...d,
          chapters: d.chapters.map((c) => ({
            ...c,
            items: c.items.map((it) => {
              const p = byRef.get(it.key);
              return p && it.resources.length === 0 ? { ...it, resources: p.resources.map((x) => ({ ...x, key: newKey() })), reviewNote: p.note } : it;
            }),
          })),
        }));
        setNotice(`Asistentul a propus resurse pentru ${r.proposals.length} articole. Verifică notele galbene, apoi salvează.`);
      } else if (r.status === "error") {
        clearInterval(t);
        setAiJob(null);
        setNotice(null);
        setError(r.error ?? "Completarea automată a eșuat.");
      }
    }, 3000);
    return () => clearInterval(t);
  }, [aiJob, update]);

  const saveAsRecipe = async (item: EstItem, global: boolean) => {
    const res = await saveRecipeAction(item, global);
    setNotice(res.ok ? `„${item.name.slice(0, 60)}” salvat ca rețetă${global ? " globală" : ""} — data viitoare se găsește automat.` : null);
    if (!res.ok) setError(res.error);
  };

  const saveAllRecipes = async () => {
    const ok = doc.chapters.flatMap((c) => c.items).filter((i) => i.name.trim() && i.unit.trim() && i.resources.length && !i.reviewNote);
    for (const it of ok) await saveRecipeAction(it, false);
    setNotice(`${ok.length} articole salvate ca rețete ale firmei.`);
  };

  const issues = useMemo(() => checkEstimate(doc), [doc]);
  const errors = issues.filter((i) => i.level === "eroare").length;

  const goTo = (issue: Issue) => {
    setTab("deviz");
    if (issue.itemKey) setExpanded((s) => new Set(s).add(issue.itemKey!));
    const target = issue.itemKey ?? issue.chapterKey;
    if (!target) return;
    setFlash(target);
    setTimeout(() => document.getElementById(`k-${target}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    setTimeout(() => setFlash(null), 2000);
  };

  const r = recap(doc);
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "deviz", label: "Deviz" },
    { id: "verificari", label: "Verificări", badge: issues.length },
    { id: "simulator", label: "Simulator preț & profit" },
    { id: "grafic", label: "Grafic execuție" },
  ];

  return (
    <div className="-mt-2">
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-line bg-canvas/95 px-4 pt-3 backdrop-blur sm:-mx-8 sm:px-8">
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
          <button onClick={() => setShowImport(true)} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand-200">Import F3</button>
          {missing.length > 0 && (
            <button onClick={startAi} disabled={!!aiJob}
              className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:border-brand-500 disabled:opacity-60">
              {aiJob ? "Se completează…" : `✦ Completează automat (${missing.length})`}
            </button>
          )}
          <a
            href={dirty ? undefined : `/panou/devize/${doc.id}/export`}
            onClick={(e) => { if (dirty) { e.preventDefault(); alert("Salvează devizul înainte de export."); } }}
            className="cursor-pointer rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand-200"
          >
            Export Excel
          </a>
          <button onClick={save} disabled={saving || !dirty}
            className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
            Salvează
          </button>
        </div>
        {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {notice && (
          <p className="mt-2 flex items-center justify-between gap-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="text-brand-700">✕</button>
          </p>
        )}
        <nav className="mt-2 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${tab === t.id ? "border-brand-700 text-brand-800" : "border-transparent text-muted hover:text-ink"}`}>
              {t.label}
              {!!t.badge && (
                <span className={`rounded-full px-1.5 text-[11px] font-semibold ${errors ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{t.badge}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onImport={(res) => {
            setShowImport(false);
            update((d) => ({
              ...d,
              chapters: [
                ...d.chapters.filter((c) => c.items.length > 0 || c.name.trim() !== "Capitolul 1"),
                ...res.chapters.map((c) => ({ key: newKey(), name: c.name, teamSize: 4, startDay: null, items: c.items.map((it) => ({ ...it, key: newKey(), resources: it.resources.map((r) => ({ ...r, key: newKey() })) })) })),
              ],
            }));
            const s = res.stats;
            setNotice(`Import: ${s.exact} potrivite sigur, ${s.propus + s.cache} propuse (de verificat), ${s.negasit} negăsite${s.negasit ? " — le poți completa automat" : ""}. Nu uita să salvezi.`);
          }}
        />
      )}
      {tab === "verificari" && <IssuesPanel issues={issues} onGo={goTo} />}
      {tab === "simulator" && <Simulator doc={doc} />}
      {tab === "grafic" && <Gantt doc={doc} onDoc={update} onChapter={setChapter} />}

      {tab === "deviz" && (
        <>
          <div className="space-y-6">
            {doc.chapters.map((ch, ci) => {
              const chTotal = sum(chapterBreakdown(ch));
              return (
                <section key={ch.key} id={`k-${ch.key}`}
                  className={`rounded-xl border bg-white transition ${flash === ch.key ? "border-amber-400 ring-4 ring-amber-100" : "border-line"}`}>
                  <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                    <span className="text-sm font-semibold text-muted">Cap. {ci + 1}</span>
                    <input value={ch.name} onChange={(e) => setChapter(ci, (c) => ({ ...c, name: e.target.value }))}
                      className="min-w-48 flex-1 rounded-md border border-transparent px-2 py-1 font-semibold outline-none hover:border-line focus:border-brand-500" />
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
                        {ch.items.map((it, ii) => (
                          <ItemRows
                            key={it.key}
                            nr={`${ci + 1}.${ii + 1}`}
                            item={it}
                            open={expanded.has(it.key)}
                            flash={flash === it.key}
                            onToggle={() => toggle(it.key)}
                            onItem={(fn) => setItem(ci, ii, fn)}
                            onRes={(ri, fn) => setRes(ci, ii, ri, fn)}
                            onMove={(dir) => setChapter(ci, (c) => ({ ...c, items: move(c.items, ii, ii + dir) }))}
                            onDuplicate={() => setChapter(ci, (c) => {
                              const copy: EstItem = { ...it, key: newKey(), resources: it.resources.map((x) => ({ ...x, key: newKey() })) };
                              const items = [...c.items];
                              items.splice(ii + 1, 0, copy);
                              return { ...c, items };
                            })}
                            onDelete={() => setChapter(ci, (c) => ({ ...c, items: c.items.filter((_, i) => i !== ii) }))}
                            onSaveRecipe={(global) => saveAsRecipe(it, global)}
                            isAdmin={isAdmin}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 px-4 py-3">
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
                    <RecipePicker onPick={(it) => setChapter(ci, (c) => ({ ...c, items: [...c.items, { ...it, key: newKey(), resources: it.resources.map((r) => ({ ...r, key: newKey() })) }] }))} />
                  </div>
                </section>
              );
            })}
            <button
              onClick={() => update((d) => ({ ...d, chapters: [...d.chapters, { key: newKey(), name: `Capitolul ${d.chapters.length + 1}`, teamSize: 4, startDay: null, items: [] }] }))}
              className="w-full rounded-xl border-2 border-dashed border-line py-4 font-semibold text-brand-700 hover:border-brand-200 hover:bg-white"
            >
              + Adaugă capitol
            </button>
          </div>

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-5">
              <h2 className="mb-3 font-bold">Recapitulație</h2>
              <dl className="space-y-1.5 text-sm">
                {(["material", "manopera", "utilaj", "transport"] as ResType[]).map((t) => (
                  <Row key={t} label={t === "utilaj" ? "Utilaje" : RES_TYPE_LABEL[t]} value={r.direct[t]} />
                ))}
                <Row label="Total cheltuieli directe C+M" value={r.directTotal} strong />
                <PctRow label="Cheltuieli indirecte" pct={doc.overheadPct} value={r.overhead} onPct={(n) => update((d) => ({ ...d, overheadPct: n }))} />
                <PctRow label="Profit" pct={doc.profitPct} value={r.profit} onPct={(n) => update((d) => ({ ...d, profitPct: n }))} />
                <Row label="Valoare construcții-montaj" value={r.cmTotal} strong />
                {r.equipment > 0 && <Row label="Echipamente tehnologice" value={r.equipment} />}
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
                <div className="flex justify-between"><dt className="text-muted">Zile-om ({doc.hoursPerDay} ore/zi)</dt><dd className="font-semibold tabular-nums">{fmtQty(Math.round(r.laborHours / (doc.hoursPerDay || 8) * 10) / 10)}</dd></div>
              </dl>
              <button onClick={() => setTab("grafic")} className="mt-3 text-sm font-semibold text-brand-700 hover:underline">Vezi durata și graficul de execuție →</button>
              <div className="mt-6 border-t border-line pt-4">
                <h3 className="font-semibold">Rețete</h3>
                <p className="mt-1 text-sm text-muted">Articolele salvate ca rețete se găsesc automat la următorul import F3, instant și fără cost.</p>
                <button onClick={saveAllRecipes} className="mt-2 text-sm font-semibold text-brand-700 hover:underline">★ Salvează articolele verificate ca rețete</button>
              </div>
              <form action={deleteEstimateAction} className="mt-6 border-t border-line pt-4"
                onSubmit={(e) => { if (!confirm("Ștergi definitiv acest deviz?")) e.preventDefault(); }}>
                <input type="hidden" name="id" value={doc.id} />
                <button className="text-sm text-red-700 hover:underline">Șterge devizul</button>
              </form>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function IssuesPanel({ issues, onGo }: { issues: Issue[]; onGo: (i: Issue) => void }) {
  if (issues.length === 0)
    return (
      <div className="rounded-xl border border-line bg-white px-5 py-12 text-center">
        <p className="text-lg font-semibold text-brand-700">✓ Nicio problemă găsită</p>
        <p className="mt-1 text-sm text-muted">Am verificat cantitățile, prețurile, normele, dublurile și unitățile de măsură.</p>
      </div>
    );
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <ul className="divide-y divide-line text-sm">
        {issues.map((i, n) => (
          <li key={n} className="flex items-start gap-3 px-5 py-3">
            <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${i.level === "eroare" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
              {i.level === "eroare" ? "Eroare" : "Atenție"}
            </span>
            <span className="w-40 shrink-0 text-muted">{i.where}</span>
            <span className="flex-1">{i.message}</span>
            {(i.itemKey || i.chapterKey) && (
              <button onClick={() => onGo(i)} className="shrink-0 font-semibold text-brand-700 hover:underline">Vezi</button>
            )}
          </li>
        ))}
      </ul>
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
          <NumInput value={pct} onChange={(n) => onPct(n ?? 0)} className="py-0.5" />
          <span className="pr-2 text-xs">%</span>
        </span>
      </dt>
      <dd className="tabular-nums">{fmtMoney(value)} lei</dd>
    </div>
  );
}

function ItemRows({
  nr, item, open, flash, onToggle, onItem, onRes, onMove, onDuplicate, onDelete, onSaveRecipe, isAdmin,
}: {
  nr: string; item: EstItem; open: boolean; flash: boolean;
  onToggle: () => void;
  onItem: (fn: (it: EstItem) => EstItem) => void;
  onRes: (ri: number, fn: (r: EstResource) => EstResource) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveRecipe: (global: boolean) => void;
  isAdmin: boolean;
}) {
  const ub = itemUnitBreakdown(item);
  const addRes = (r: Omit<EstResource, "key">) => onItem((it) => ({ ...it, resources: [...it.resources, { ...r, key: newKey() }] }));
  return (
    <>
      <tr id={`k-${item.key}`} className={`border-b border-line align-top transition ${flash ? "bg-amber-50" : open ? "bg-brand-50/40" : ""}`}>
        <td className="px-3 py-2.5 text-muted">
          <button onClick={onToggle} className="flex items-center gap-1 hover:text-ink" title="Resursele articolului">
            <span className={`inline-block transition ${open ? "rotate-90" : ""}`}>›</span>{nr}
          </button>
        </td>
        <td className="px-1 py-1"><input value={item.code} onChange={(e) => onItem((it) => ({ ...it, code: e.target.value }))} className={cellCls} placeholder="Cod" /></td>
        <td className="px-1 py-1"><input value={item.name} onChange={(e) => onItem((it) => ({ ...it, name: e.target.value }))} className={cellCls} placeholder="Denumirea lucrării" /></td>
        <td className="px-1 py-1"><input value={item.unit} onChange={(e) => onItem((it) => ({ ...it, unit: e.target.value }))} className={cellCls} placeholder="mc" /></td>
        <td className="px-1 py-1"><NumInput value={item.quantity} onChange={(n) => onItem((it) => ({ ...it, quantity: n ?? 0 }))} /></td>
        <td className="px-2 py-2.5 text-right tabular-nums">{fmtMoney(itemUnitPrice(item))}</td>
        <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{fmtMoney(itemTotal(item))}</td>
        <td className="px-2 py-2.5 text-right whitespace-nowrap text-muted">
          <button title="Mută sus" onClick={() => onMove(-1)} className="px-1 hover:text-ink">↑</button>
          <button title="Mută jos" onClick={() => onMove(1)} className="px-1 hover:text-ink">↓</button>
          <button title="Duplică articolul" onClick={onDuplicate} className="px-1 hover:text-ink">⧉</button>
          <button title="Salvează ca rețetă a firmei" onClick={() => onSaveRecipe(false)} disabled={!item.resources.length} className="px-1 hover:text-amber-600 disabled:opacity-30">★</button>
          {isAdmin && <button title="Salvează ca rețetă globală (pentru toți clienții)" onClick={() => onSaveRecipe(true)} disabled={!item.resources.length} className="px-1 text-xs hover:text-amber-600 disabled:opacity-30">★G</button>}
          <button title="Șterge articolul" onClick={() => { if (!item.resources.length || confirm("Ștergi articolul?")) onDelete(); }} className="px-1 text-red-700 hover:text-red-900">✕</button>
        </td>
      </tr>
      {item.reviewNote && (
        <tr className="border-b border-line bg-amber-50">
          <td />
          <td colSpan={7} className="px-2 py-1.5 text-xs text-amber-900">
            <span className="mr-3">⚠ {item.reviewNote}</span>
            <button onClick={() => onItem((it) => ({ ...it, reviewNote: null }))} className="font-semibold text-brand-700 hover:underline">✓ Am verificat</button>
            {!open && item.resources.length > 0 && <button onClick={onToggle} className="ml-3 font-semibold text-brand-700 hover:underline">Vezi resursele</button>}
          </td>
        </tr>
      )}
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
                    <th className="w-24 px-1 py-1.5 text-right font-medium" title="Consum pe unitatea articolului">Consum / {item.unit || "U.M."}</th>
                    <th className="w-16 px-1 py-1.5 text-right font-medium" title="Pierderi tehnologice: consum efectiv = consum × (1 + pierderi/100)">Pierd. %</th>
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
                      <td className="px-1 py-0.5"><NumInput value={res.norm} onChange={(n) => onRes(ri, (x) => ({ ...x, norm: n ?? 0 }))} /></td>
                      <td className="px-1 py-0.5"><NumInput value={res.waste} onChange={(n) => onRes(ri, (x) => ({ ...x, waste: Math.min(100, Math.max(0, n ?? 0)) }))} /></td>
                      <td className="px-1 py-0.5"><NumInput value={res.price} onChange={(n) => onRes(ri, (x) => ({ ...x, price: n ?? 0 }))} /></td>
                      <td className="px-2 py-0.5 text-right tabular-nums">{fmtMoney(effNorm(res) * res.price)}</td>
                      <td className="px-1 text-center">
                        <button title="Elimină" onClick={() => onItem((it) => ({ ...it, resources: it.resources.filter((_, i) => i !== ri) }))} className="text-red-700">✕</button>
                      </td>
                    </tr>
                  ))}
                  {item.resources.length === 0 && (
                    <tr><td colSpan={9} className="px-3 py-3 text-muted">Adaugă resursele articolului: materiale, manoperă, utilaje, transport, echipamente — cu consumul pe {item.unit || "unitatea de măsură"}.</td></tr>
                  )}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2.5">
                <ResourcePicker
                  onPick={(c) => addRes({ resourceId: c.id, type: c.type, code: c.code ?? "", name: c.name, unit: c.unit, norm: 1, waste: 0, price: c.price ?? 0 })}
                  onManual={(t) => addRes({ resourceId: null, type: t, code: "", name: "", unit: t === "material" || t === "echipament" ? "buc" : "ora", norm: 1, waste: 0, price: 0 })}
                />
                <div className="flex flex-wrap gap-3 text-muted">
                  {RES_TYPES.filter((t) => t !== "echipament" || ub.echipament > 0).map((t) => (
                    <span key={t}>{RES_TYPE_LABEL[t].charAt(0)}: <b className="text-ink tabular-nums">{fmtMoney(ub[t])}</b></span>
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
