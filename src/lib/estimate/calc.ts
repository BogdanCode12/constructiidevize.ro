import { CM_TYPES, RES_TYPES, type EstChapter, type EstimateDoc, type EstItem, type ResType } from "./types";

export type Breakdown = Record<ResType, number>;

export const zero = (): Breakdown => ({ material: 0, manopera: 0, utilaj: 0, transport: 0, echipament: 0 });

/** Prețul unitar al articolului, pe categorii (lei / U.M. articol). */
export function itemUnitBreakdown(item: EstItem): Breakdown {
  const b = zero();
  for (const r of item.resources) b[r.type] += r.norm * r.price;
  return b;
}

export const sum = (b: Breakdown) => RES_TYPES.reduce((s, t) => s + b[t], 0);
export const sumCM = (b: Breakdown) => CM_TYPES.reduce((s, t) => s + b[t], 0);

export function itemUnitPrice(item: EstItem): number {
  return sum(itemUnitBreakdown(item));
}

export function itemTotal(item: EstItem): number {
  return item.quantity * itemUnitPrice(item);
}

export function chapterBreakdown(ch: EstChapter): Breakdown {
  const b = zero();
  for (const it of ch.items) {
    const u = itemUnitBreakdown(it);
    for (const t of RES_TYPES) b[t] += u[t] * it.quantity;
  }
  return b;
}

const isHourUnit = (u: string) => /^(or[ae]?|h|ore-om|om-or[ae])$/i.test(u.trim());

/** Ore de manoperă (ore-om) ale unui capitol: normele de manoperă în ore × cantitate. */
export function chapterLaborHours(ch: EstChapter): number {
  let h = 0;
  for (const it of ch.items)
    for (const r of it.resources) if (r.type === "manopera" && isHourUnit(r.unit)) h += r.norm * it.quantity;
  return h;
}

/** Ore de funcționare utilaje ale unui capitol. */
export function chapterMachineHours(ch: EstChapter): number {
  let h = 0;
  for (const it of ch.items)
    for (const r of it.resources) if ((r.type === "utilaj" || r.type === "transport") && isHourUnit(r.unit)) h += r.norm * it.quantity;
  return h;
}

export function laborHours(doc: Pick<EstimateDoc, "chapters">): number {
  return doc.chapters.reduce((s, ch) => s + chapterLaborHours(ch), 0);
}

export type Recap = {
  direct: Breakdown;
  /** Cost direct construcții-montaj (fără echipamente). */
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

export type RecapInput = Pick<EstimateDoc, "chapters" | "overheadPct" | "profitPct" | "vatPct">;

/**
 * Recapitulația: cost direct C+M → cheltuieli indirecte (% din direct) → profit (% din direct + indirecte)
 * → + echipamente tehnologice (fără indirecte/profit) → TVA.
 */
export function recapFromDirect(direct: Breakdown, pct: { overheadPct: number; profitPct: number; vatPct: number }, hours = 0): Recap {
  const directTotal = sumCM(direct);
  const overhead = (directTotal * pct.overheadPct) / 100;
  const profit = ((directTotal + overhead) * pct.profitPct) / 100;
  const cmTotal = directTotal + overhead + profit;
  const equipment = direct.echipament;
  const totalNoVat = cmTotal + equipment;
  const vat = (totalNoVat * pct.vatPct) / 100;
  return { direct, directTotal, overhead, profit, cmTotal, equipment, totalNoVat, vat, total: totalNoVat + vat, laborHours: hours };
}

export function directBreakdown(doc: Pick<EstimateDoc, "chapters">): Breakdown {
  const direct = zero();
  for (const ch of doc.chapters) {
    const b = chapterBreakdown(ch);
    for (const t of RES_TYPES) direct[t] += b[t];
  }
  return direct;
}

export function recap(doc: RecapInput): Recap {
  return recapFromDirect(directBreakdown(doc), doc, laborHours(doc));
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
        e.qty += r.norm * it.quantity;
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
