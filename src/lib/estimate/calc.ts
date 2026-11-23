import { RES_TYPES, type EstChapter, type EstimateDoc, type EstItem, type ResType } from "./types";

export type Breakdown = Record<ResType, number>;

const zero = (): Breakdown => ({ material: 0, manopera: 0, utilaj: 0, transport: 0 });

/** Prețul unitar al articolului, pe categorii (lei / U.M. articol). */
export function itemUnitBreakdown(item: EstItem): Breakdown {
  const b = zero();
  for (const r of item.resources) b[r.type] += r.norm * r.price;
  return b;
}

export const sum = (b: Breakdown) => b.material + b.manopera + b.utilaj + b.transport;

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

/** Ore de manoperă (ore-om) — suma normelor de manoperă măsurate în ore × cantitate. */
export function laborHours(doc: Pick<EstimateDoc, "chapters">): number {
  let h = 0;
  for (const ch of doc.chapters)
    for (const it of ch.items)
      for (const r of it.resources)
        if (r.type === "manopera" && /^or[ae]?$|^h$/i.test(r.unit.trim())) h += r.norm * it.quantity;
  return h;
}

export type Recap = {
  direct: Breakdown;
  directTotal: number;
  overhead: number;
  profit: number;
  totalNoVat: number;
  vat: number;
  total: number;
  laborHours: number;
};

/** Recapitulația: cost direct → cheltuieli indirecte → profit → TVA. */
export function recap(doc: EstimateDoc): Recap {
  const direct = zero();
  for (const ch of doc.chapters) {
    const b = chapterBreakdown(ch);
    for (const t of RES_TYPES) direct[t] += b[t];
  }
  const directTotal = sum(direct);
  const overhead = (directTotal * doc.overheadPct) / 100;
  const profit = ((directTotal + overhead) * doc.profitPct) / 100;
  const totalNoVat = directTotal + overhead + profit;
  const vat = (totalNoVat * doc.vatPct) / 100;
  return { direct, directTotal, overhead, profit, totalNoVat, vat, total: totalNoVat + vat, laborHours: laborHours(doc) };
}

/** Consumul total pe resursă (pentru listele C5–C8). */
export function aggregateResources(doc: EstimateDoc, type: ResType) {
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

const money = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 4 });
export const fmtMoney = (n: number) => money.format(Number.isFinite(n) ? n : 0);
export const fmtQty = (n: number) => qtyFmt.format(Number.isFinite(n) ? n : 0);
