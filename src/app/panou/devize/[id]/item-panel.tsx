"use client";

import { useEffect, useMemo, useState } from "react";
import { priceSourcesAction, resourceOffersAction, type OfferBrief } from "../actions";
import { searchCatalogAction } from "@/lib/resources/actions";
import { effNorm, fmtMoney, fmtQty, itemTotal, itemUnitBreakdown } from "@/lib/estimate/calc";
import {
  PRICE_SOURCE_LABEL, RES_TYPE_LABEL, TARIFF_KIND_LABEL,
  type CatalogResource, type EstimateDoc, type EstItem, type EstResource, type PriceOffer,
} from "@/lib/estimate/types";
import type { Issue } from "@/lib/estimate/checks";
import { NumInput } from "./parts";
import { QuantityBlock } from "./quantity-block";

const dateFmt = (d: string | null) => (d ? new Intl.DateTimeFormat("ro-RO").format(new Date(`${d}T12:00:00`)) : "—");

type Sources = { resources: Record<number, CatalogResource>; offers: Record<number, OfferBrief> };

/** Locația unui articol în deviz, după cheie. */
function findItem(doc: EstimateDoc, key: string): { ci: number; ii: number; item: EstItem } | null {
  for (const [ci, ch] of doc.chapters.entries()) {
    const ii = ch.items.findIndex((it) => it.key === key);
    if (ii >= 0) return { ci, ii, item: ch.items[ii] };
  }
  return null;
}

/** Cantitatea totală a unei resurse în tot devizul (pentru compararea ofertelor pe cantitatea reală). */
function totalQtyInDoc(doc: EstimateDoc, resourceId: number): { qty: number; items: number } {
  let qty = 0, items = 0;
  for (const ch of doc.chapters)
    for (const it of ch.items) {
      let used = false;
      for (const r of it.resources) if (r.resourceId === resourceId) { qty += effNorm(r) * it.quantity; used = true; }
      if (used) items++;
    }
  return { qty, items };
}

function Badge({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: React.ReactNode }) {
  const cls = { ok: "bg-emerald-50 text-emerald-800", warn: "bg-amber-50 text-amber-800", bad: "bg-red-50 text-red-700", muted: "bg-canvas text-muted" }[tone];
  return <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>;
}

/** De unde vine prețul unei resurse din deviz și cum stă față de catalogul de acum. */
function PriceSource({ r, src }: { r: EstResource; src: Sources | null }) {
  if (r.priceManual) return <Badge tone="warn">preț introdus manual</Badge>;
  if (!r.resourceId) return <Badge tone="muted">resursă manuală (nelegată de catalog)</Badge>;
  if (!src) return <span className="text-[11px] text-muted">se verifică…</span>;
  const cur = src.resources[r.resourceId];
  const off = r.offerId ? src.offers[r.offerId] : undefined;
  const diff = cur?.price !== null && cur?.price !== undefined && Math.abs(cur.price - r.price) > 0.00005 ? cur.price : null;
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px]">
      {off ? (
        <>
          <span className="text-muted">{off.own ? "prețul firmei" : "catalog"} · {off.supplier ?? PRICE_SOURCE_LABEL[off.source as keyof typeof PRICE_SOURCE_LABEL] ?? off.source} · {dateFmt(off.obtainedAt)}</span>
          {off.expired && <Badge tone="bad">expirat {dateFmt(off.validUntil)}</Badge>}
          {off.status === "neverificat" && <Badge tone="warn">neverificat</Badge>}
          {off.status === "inactiv" && <Badge tone="muted">ofertă dezactivată</Badge>}
          {off.transportIncluded === true && <Badge tone="muted">transport inclus</Badge>}
        </>
      ) : !cur ? (
        <Badge tone="muted">resursa nu mai e în catalog</Badge>
      ) : (
        <span className="text-muted">din catalog (fără ofertă înregistrată)</span>
      )}
      {cur && cur.price === null && <Badge tone="warn">fără preț în catalog</Badge>}
      {diff !== null && <Badge tone="warn">în catalog acum: {fmtMoney(diff)} lei</Badge>}
    </div>
  );
}

/** Comparația ofertelor unei resurse pe cantitatea necesară în deviz. */
function OfferCompare({ doc, res, onUse }: { doc: EstimateDoc; res: EstResource; onUse: (o: PriceOffer, everywhere: boolean) => void }) {
  const [offers, setOffers] = useState<PriceOffer[] | null>(null);
  const [everywhere, setEverywhere] = useState(true);
  const need = totalQtyInDoc(doc, res.resourceId!);
  useEffect(() => { resourceOffersAction(res.resourceId!).then(setOffers); }, [res.resourceId]);
  if (!offers) return <p className="px-3 py-2 text-xs text-muted">Se încarcă ofertele…</p>;
  if (!offers.length) return <p className="px-3 py-2 text-xs text-muted">Nicio ofertă activă pentru această resursă. Adaugă prețuri din pagina Resurse.</p>;
  const rows = offers.map((o) => ({
    o, total: o.priceRon * need.qty,
    underMin: o.minQty !== null && need.qty < o.minQty,
  })).sort((a, b) => a.total - b.total);
  const best = rows.find((x) => !x.o.expired && !x.underMin);
  return (
    <div className="border-t border-line bg-canvas/50 px-3 py-2">
      <p className="mb-1.5 text-xs text-muted">
        Cantitate necesară în deviz: <b className="text-ink">{fmtQty(need.qty)} {res.unit}</b> ({need.items} {need.items === 1 ? "articol" : "articole"}).
        Comparăm costul total, nu doar prețul unitar.
      </p>
      <table className="w-full text-xs">
        <thead className="text-left text-muted"><tr><th className="py-1">Ofertă</th><th className="py-1 text-right">Preț / {res.unit}</th><th className="py-1 text-right">Total</th><th /></tr></thead>
        <tbody className="divide-y divide-line">
          {rows.map(({ o, total, underMin }) => (
            <tr key={o.id} className={o.id === res.offerId ? "bg-brand-50/60" : ""}>
              <td className="py-1.5 pr-2">
                <div className="font-medium">{o.supplier ?? "—"} {o.own && <span className="text-brand-800">(prețul firmei)</span>}</div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  <span className="text-muted">{dateFmt(o.obtainedAt)}</span>
                  {o.expired && <Badge tone="bad">expirat</Badge>}
                  {o.status === "neverificat" && <Badge tone="warn">neverificat</Badge>}
                  <Badge tone="muted">transport {o.transportIncluded === null ? "necunoscut" : o.transportIncluded ? "inclus" : "neinclus"}</Badge>
                  {underMin && <Badge tone="warn">sub cantitatea minimă ({fmtQty(o.minQty!)})</Badge>}
                  {best?.o.id === o.id && <Badge tone="ok">cel mai mic cost valabil</Badge>}
                </div>
              </td>
              <td className="py-1.5 text-right tabular-nums">{fmtMoney(o.priceRon)}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{fmtMoney(total)}</td>
              <td className="py-1.5 pl-2 text-right">
                {o.id === res.offerId && !res.priceManual
                  ? <span className="text-[11px] text-muted">folosită</span>
                  : <button type="button" onClick={() => onUse(o, everywhere)} className="font-semibold text-brand-700 hover:underline">Folosește</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {need.items > 1 && (
        <label className="mt-1.5 flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={everywhere} onChange={(e) => setEverywhere(e.target.checked)} className="size-3.5 accent-brand-700" />
          Aplică prețul în toate cele {need.items} articole care folosesc resursa
        </label>
      )}
    </div>
  );
}

/** Înlocuirea unei resurse cu alta din catalog (niciodată automat). */
function ReplacePicker({ res, onPick }: { res: EstResource; onPick: (c: CatalogResource) => void }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<CatalogResource[]>([]);
  useEffect(() => {
    const t = setTimeout(async () => setList(await searchCatalogAction(q, res.type)), 250);
    return () => clearTimeout(t);
  }, [q, res.type]);
  return (
    <div className="border-t border-line bg-canvas/50 px-3 py-2">
      <p className="mb-1.5 text-xs text-amber-900">
        Nu înlocui un material cerut explicit în proiect sau în caietul de sarcini. Înlocuirea păstrează consumul și pierderile.
      </p>
      <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder={`Caută ${RES_TYPE_LABEL[res.type].toLowerCase()} în catalog…`}
        className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-brand-500" />
      <ul className="mt-1 max-h-56 overflow-auto text-xs">
        {list.filter((c) => c.id !== res.resourceId).map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => { if (confirm(`Înlocuiești „${res.name}” cu „${c.name}”?`)) onPick(c); }}
              className="flex w-full items-start gap-2 px-1.5 py-1.5 text-left hover:bg-brand-50">
              <span className="flex-1">
                {c.name}
                {c.specs && <span className="block text-[11px] text-muted">{c.specs}</span>}
              </span>
              <span className="text-muted">{c.unit}</span>
              <span className="w-20 text-right tabular-nums">{c.price === null ? <span className="text-muted">fără preț</span> : fmtMoney(c.price)}</span>
            </button>
          </li>
        ))}
        {!list.length && <li className="px-1.5 py-1.5 text-muted">Nimic găsit.</li>}
      </ul>
    </div>
  );
}

/**
 * Panoul lateral al unui articol: calculul cantității, rețeta cu sursa fiecărui preț, compararea ofertelor,
 * înlocuirea manuală a materialelor și atenționările articolului. Totul se recalculează imediat.
 */
export function ItemPanel({
  doc, itemKey, issues, update, onClose,
}: {
  doc: EstimateDoc; itemKey: string; issues: Issue[]; update: (fn: (d: EstimateDoc) => EstimateDoc) => void; onClose: () => void;
}) {
  const loc = findItem(doc, itemKey);
  const [src, setSrc] = useState<Sources | null>(null);
  const [open, setOpen] = useState<{ key: string; mode: "oferte" | "inlocuire" } | null>(null);
  const resIds = useMemo(() => (loc?.item.resources ?? []).map((r) => r.resourceId).filter((x): x is number => !!x), [loc?.item.resources]);
  const offIds = useMemo(() => (loc?.item.resources ?? []).map((r) => r.offerId).filter((x): x is number => !!x), [loc?.item.resources]);
  const sig = `${resIds.join(",")}|${offIds.join(",")}`;

  useEffect(() => {
    let alive = true;
    setSrc(null);
    priceSourcesAction(resIds, offIds).then((s) => { if (alive) setSrc(s); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!loc) return null;
  const { ci, ii, item } = loc;
  const setItem = (fn: (it: EstItem) => EstItem) =>
    update((d) => ({ ...d, chapters: d.chapters.map((c, i) => (i !== ci ? c : { ...c, items: c.items.map((it, j) => (j === ii ? fn(it) : it)) })) }));
  const setRes = (key: string, fn: (r: EstResource) => EstResource) =>
    setItem((it) => ({ ...it, resources: it.resources.map((r) => (r.key === key ? fn(r) : r)) }));

  const useOffer = (res: EstResource, o: PriceOffer, everywhere: boolean) => {
    const apply = (r: EstResource): EstResource => ({ ...r, price: o.priceRon, offerId: o.id, priceManual: false });
    if (everywhere) {
      update((d) => ({
        ...d,
        chapters: d.chapters.map((c) => ({ ...c, items: c.items.map((it) => ({ ...it, resources: it.resources.map((r) => (r.resourceId === res.resourceId ? apply(r) : r)) })) })),
      }));
    } else setRes(res.key, apply);
    setOpen(null);
  };

  const replace = (res: EstResource, c: CatalogResource) => {
    setRes(res.key, (r) => ({
      ...r, resourceId: c.id, code: c.code ?? "", name: c.name, unit: c.unit, price: c.price ?? 0,
      tariffKind: c.type === "manopera" ? c.tariffKind : null, offerId: c.priceInfo?.offerId ?? null, priceManual: false,
    }));
    setOpen(null);
  };

  const ub = itemUnitBreakdown(item, doc.rounding);
  const own = issues.filter((x) => x.itemKey === item.key);
  const nr = `${ci + 1}.${ii + 1}`;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-label={`Articolul ${nr}`}>
      <button type="button" aria-label="Închide" onClick={onClose} className="absolute inset-0 bg-ink/20" />
      <aside className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden border-l-2 border-ink/10 bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b-2 border-ink/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted">Art. {nr}{item.code ? ` · ${item.code}` : ""}</div>
            <h2 className="text-lg font-bold leading-snug">{item.name || "Articol fără denumire"}</h2>
            <div className="mt-1 text-sm">
              {fmtQty(item.quantity)} {item.unit} × {fmtMoney(Object.values(ub).reduce((s, v) => s + v, 0))} = <b>{fmtMoney(itemTotal(item, doc.rounding))} lei</b>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-muted hover:bg-canvas hover:text-ink" title="Închide (Esc)">✕</button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {own.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-sm font-bold">Atenționări</h3>
              <ul className="space-y-1 text-sm">
                {own.map((x, i) => (
                  <li key={i} className="flex gap-2">
                    <Badge tone={x.level === "eroare" ? "bad" : x.level === "atentie" ? "warn" : "muted"}>{x.level === "eroare" ? "Eroare" : x.level === "atentie" ? "Atenție" : "Info"}</Badge>
                    <span>{x.message}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <QuantityBlock item={item} onItem={setItem} />
          </section>

          <section>
            <h3 className="mb-1.5 text-sm font-bold">Rețeta: resurse pe 1 {item.unit || "U.M."}</h3>
            {item.resources.length === 0 && <p className="text-sm text-muted">Articolul nu are resurse. Adaugă-le din tabel sau completează-l automat.</p>}
            <ul className="space-y-2">
              {item.resources.map((r) => {
                const isOpen = open?.key === r.key;
                return (
                  <li key={r.key} className="rounded-lg border border-line">
                    <div className="flex flex-wrap items-start gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-muted">
                          {RES_TYPE_LABEL[r.type]}{r.type === "manopera" && r.tariffKind ? ` · ${TARIFF_KIND_LABEL[r.tariffKind]}` : r.type === "manopera" ? " · tip tarif necunoscut" : ""}
                        </div>
                        <div className="font-medium">{r.name || "—"}</div>
                        <PriceSource r={r} src={src} />
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-xs">
                        <label className="block w-20"><span className="text-muted">Consum</span><NumInput value={r.norm} onChange={(n) => setRes(r.key, (x) => ({ ...x, norm: n ?? 0 }))} /></label>
                        <label className="block w-16"><span className="text-muted">Pierd. %</span><NumInput value={r.waste} onChange={(n) => setRes(r.key, (x) => ({ ...x, waste: Math.min(100, Math.max(0, n ?? 0)) }))} /></label>
                        <label className="block w-24"><span className="text-muted">Preț / {r.unit}</span>
                          <NumInput value={r.price} onChange={(n) => setRes(r.key, (x) => ({ ...x, price: n ?? 0, priceManual: true, offerId: null }))} />
                        </label>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-1.5 text-xs">
                      <span className="text-muted">
                        {fmtQty(effNorm(r))} {r.unit}/{item.unit} × {fmtQty(item.quantity)} = <b className="text-ink">{fmtQty(effNorm(r) * item.quantity)} {r.unit}</b> · {fmtMoney(effNorm(r) * r.price * item.quantity)} lei
                      </span>
                      <span className="ml-auto flex gap-3">
                        {r.resourceId && (
                          <button type="button" onClick={() => setOpen(isOpen && open?.mode === "oferte" ? null : { key: r.key, mode: "oferte" })} className="font-semibold text-brand-700 hover:underline">
                            Compară oferte
                          </button>
                        )}
                        <button type="button" onClick={() => setOpen(isOpen && open?.mode === "inlocuire" ? null : { key: r.key, mode: "inlocuire" })} className="font-semibold text-brand-700 hover:underline">
                          {r.type === "material" ? "Alege alt material" : "Înlocuiește"}
                        </button>
                      </span>
                    </div>
                    {isOpen && open?.mode === "oferte" && r.resourceId && <OfferCompare doc={doc} res={r} onUse={(o, all) => useOffer(r, o, all)} />}
                    {isOpen && open?.mode === "inlocuire" && <ReplacePicker res={r} onPick={(c) => replace(r, c)} />}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
        <footer className="border-t-2 border-ink/10 px-5 py-3 text-xs text-muted">
          Modificările se văd imediat în deviz; nu uita să salvezi. Prețurile din deviz nu se schimbă singure când se schimbă catalogul.
        </footer>
      </aside>
    </div>
  );
}
