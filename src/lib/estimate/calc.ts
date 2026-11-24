import { CM_TYPES, RES_TYPES, type EstChapter, type EstimateDoc, type EstItem, type EstResource, type ResType, type RoundingMode } from "./types";

export type Breakdown = Record<ResType, number>;

export const zero = (): Breakdown => ({ material: 0, manopera: 0, utilaj: 0, transport: 0, echipament: 0 });

/** Consumul efectiv pe U.M. de articol: consum × (1 + pierderi tehnologice / 100). */
export const effNorm = (r: Pick<EstResource, "norm" | "waste">) => r.norm * (1 + (r.waste || 0) / 100);

/** Rotunjire la 2 zecimale (bani), robustă la erorile de virgulă mobilă. */
export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Prețul unitar al articolului, pe categorii (lei / U.M. articol).
 * Cu `rounding = "pret_unitar"`, fiecare categorie se rotunjește la 2 zecimale (ca în formularul F3).
 */
export function itemUnitBreakdown(item: EstItem, rounding: RoundingMode = "final"): Breakdown {
  const b = zero();
  for (const r of item.resources) b[r.type] += effNorm(r) * r.price;
  if (rounding === "pret_unitar") for (const t of RES_TYPES) b[t] = r2(b[t]);
  return b;
}

export const sum = (b: Breakdown) => RES_TYPES.reduce((s, t) => s + b[t], 0);
export const sumCM = (b: Breakdown) => CM_TYPES.reduce((s, t) => s + b[t], 0);

export function itemUnitPrice(item: EstItem, rounding: RoundingMode = "final"): number {
  return sum(itemUnitBreakdown(item, rounding));
}

/** Valoarea articolului pe categorii (cantitate × preț unitar); rotunjită pe categorii în modul „pret_unitar”. */
export function itemValueBreakdown(item: EstItem, rounding: RoundingMode = "final"): Breakdown {
  const u = itemUnitBreakdown(item, rounding);
  const b = zero();
  for (const t of RES_TYPES) b[t] = rounding === "pret_unitar" ? r2(u[t] * item.quantity) : u[t] * item.quantity;
  return b;
}

export function itemTotal(item: EstItem, rounding: RoundingMode = "final"): number {
  return sum(itemValueBreakdown(item, rounding));
}

/** Manopera la cost salarial pe U.M. de articol — baza CAM (tarifele de echipă/comerciale nu intră). */
export function itemCamUnit(item: EstItem): number {
  let s = 0;
  for (const r of item.resources) if (r.type === "manopera" && r.tariffKind === "cost_salarial") s += effNorm(r) * r.price;
  return s;
}

export function itemCamBase(item: EstItem, rounding: RoundingMode = "final"): number {
  const v = itemCamUnit(item) * item.quantity;
  return rounding === "pret_unitar" ? r2(v) : v;
}

export function chapterBreakdown(ch: EstChapter, rounding: RoundingMode = "final"): Breakdown {
  const b = zero();
  for (const it of ch.items) {
    const v = itemValueBreakdown(it, rounding);
    for (const t of RES_TYPES) b[t] += v[t];
  }
  return b;
}

export function chapterCamBase(ch: EstChapter, rounding: RoundingMode = "final"): number {
  return ch.items.reduce((s, it) => s + itemCamBase(it, rounding), 0);
}

const isHourUnit = (u: string) => /^(or[ae]?|h|ore-om|om-or[ae])$/i.test(u.trim());

/** Ore de manoperă (ore-om) ale unui capitol: normele de manoperă în ore × cantitate. */
export function chapterLaborHours(ch: EstChapter): number {
  let h = 0;
  for (const it of ch.items)
    for (const r of it.resources) if (r.type === "manopera" && isHourUnit(r.unit)) h += effNorm(r) * it.quantity;
  return h;
}

/** Ore de funcționare utilaje ale unui capitol. */
export function chapterMachineHours(ch: EstChapter): number {
  let h = 0;
  for (const it of ch.items)
    for (const r of it.resources) if ((r.type === "utilaj" || r.type === "transport") && isHourUnit(r.unit)) h += effNorm(r) * it.quantity;
  return h;
}

export function laborHours(doc: Pick<EstimateDoc, "chapters">): number {
  return doc.chapters.reduce((s, ch) => s + chapterLaborHours(ch), 0);
}

export type Recap = {
  direct: Breakdown;
  /** Baza CAM: manopera la cost salarial. */
  camBase: number;
  /** CAM = baza CAM × procent. Intră în costul direct. */
  cam: number;
  /** Cost direct construcții-montaj (materiale + manoperă + CAM + utilaje + transport, fără echipamente). */
  directTotal: number;
  overhead: number;
  profit: number;
  /** Valoare C+M (direct + indirecte + profit). */
  cmTotal: number;
  equipment: number;
  totalNoVat: number;
  vat: number;
  total: number;
  laborHours: number;
};

/** Regulile recapitulației, salvate pe deviz. */
export type RecapCfg = Pick<EstimateDoc, "overheadPct" | "profitPct" | "vatPct" | "camPct" | "overheadBase" | "profitBase" | "rounding">;
export type RecapInput = Pick<EstimateDoc, "chapters"> & RecapCfg;

/** Valorile implicite pentru câmpurile noi (devize vechi, simulări). */
export const RECAP_DEFAULTS: Omit<RecapCfg, "overheadPct" | "profitPct" | "vatPct"> = {
  camPct: 2.25, overheadBase: "direct", profitBase: "direct_indirecte", rounding: "final",
};

/**
 * Recapitulația, după regulile devizului:
 *   cost direct = materiale + manoperă + CAM (doar pe manopera la cost salarial) + utilaje + transport
 *   indirecte  = % din costul direct (sau din manoperă + CAM)
 *   profit     = % din direct + indirecte (sau doar din direct)
 *   + echipamente tehnologice (fără indirecte și profit) → TVA.
 * În modul „pret_unitar”, fiecare sumă din recapitulație se rotunjește la 2 zecimale.
 */
export function recapFromDirect(direct: Breakdown, camBase: number, cfg: RecapCfg, hours = 0): Recap {
  const cfgFull = { ...RECAP_DEFAULTS, ...cfg };
  const R = cfgFull.rounding === "pret_unitar" ? r2 : (n: number) => n;
  const cam = R((camBase * (cfgFull.camPct || 0)) / 100);
  const directTotal = sumCM(direct) + cam;
  const ohBase = cfgFull.overheadBase === "manopera" ? direct.manopera + cam : directTotal;
  const overhead = R((ohBase * cfgFull.overheadPct) / 100);
  const profit = R(((cfgFull.profitBase === "direct" ? directTotal : directTotal + overhead) * cfgFull.profitPct) / 100);
  const cmTotal = directTotal + overhead + profit;
  const equipment = direct.echipament;
  const totalNoVat = cmTotal + equipment;
  const vat = R((totalNoVat * cfgFull.vatPct) / 100);
  return { direct, camBase, cam, directTotal, overhead, profit, cmTotal, equipment, totalNoVat, vat, total: totalNoVat + vat, laborHours: hours };
}

export function directBreakdown(doc: Pick<EstimateDoc, "chapters"> & { rounding?: RoundingMode }): Breakdown {
  const direct = zero();
  for (const ch of doc.chapters) {
    const b = chapterBreakdown(ch, doc.rounding);
    for (const t of RES_TYPES) direct[t] += b[t];
  }
  return direct;
}

export function camBaseOf(doc: Pick<EstimateDoc, "chapters"> & { rounding?: RoundingMode }): number {
  return doc.chapters.reduce((s, ch) => s + chapterCamBase(ch, doc.rounding), 0);
}

export function recap(doc: RecapInput): Recap {
  return recapFromDirect(directBreakdown(doc), camBaseOf(doc), doc, laborHours(doc));
}

/** Recapitulația unui singur capitol (pentru F2). */
export function chapterRecap(ch: EstChapter, cfg: RecapCfg): Recap {
  return recapFromDirect(chapterBreakdown(ch, cfg.rounding), chapterCamBase(ch, cfg.rounding), cfg, chapterLaborHours(ch));
}

/**
 * Prețul unitar de ofertă al unui articol (cu CAM, indirecte și profit, fără TVA), folosit la situațiile de lucrări.
 * Recapitulația e liniară în cantitate, deci se aplică direct pe prețul unitar (fără rotunjirile pe sume).
 */
export function offerUnitPriceOf(item: EstItem, cfg: RecapCfg): number {
  const r = recapFromDirect(itemUnitBreakdown(item, cfg.rounding), itemCamUnit(item), { ...cfg, rounding: "final" });
  return r.totalNoVat;
}

/** Consumul total pe resursă (pentru listele C5–C9). */
export function aggregateResources(doc: Pick<EstimateDoc, "chapters">, type: ResType) {
  const map = new Map<string, { code: string; name: string; unit: string; price: number; qty: number }>();
  for (const ch of doc.chapters)
    for (const it of ch.items)
      for (const r of it.resources) {
        if (r.type !== type) continue;
        const k = `${r.code}|${r.name}|${r.unit}|${r.price}`;
        const e = map.get(k) ?? { code: r.code, name: r.name, unit: r.unit, price: r.price, qty: 0 };
        e.qty += effNorm(r) * it.quantity;
        map.set(k, e);
      }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

export type ScheduleRow = { key: string; name: string; hours: number; teamSize: number; days: number; start: number; end: number };

/** Programarea capitolelor: durată = ore-om / (echipă × ore pe zi); începutul implicit = după capitolul anterior. */
export function schedule(doc: Pick<EstimateDoc, "chapters" | "hoursPerDay">): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  let prevEnd = 0;
  for (const ch of doc.chapters) {
    const hours = chapterLaborHours(ch);
    const team = Math.max(1, ch.teamSize || 1);
    const days = hours > 0 ? Math.ceil(hours / (team * Math.max(1, doc.hoursPerDay || 8))) : 0;
    const start = ch.startDay ?? prevEnd;
    rows.push({ key: ch.key, name: ch.name, hours, teamSize: team, days, start, end: start + days });
    prevEnd = start + days;
  }
  return rows;
}

const money = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 4 });
export const fmtMoney = (n: number) => money.format(Number.isFinite(n) ? n : 0);
export const fmtQty = (n: number) => qtyFmt.format(Number.isFinite(n) ? n : 0);
