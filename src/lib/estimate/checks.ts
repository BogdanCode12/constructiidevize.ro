import { itemUnitPrice } from "./calc";
import { RES_TYPE_LABEL, type EstimateDoc } from "./types";

export type Issue = {
  level: "eroare" | "atentie";
  where: string;
  message: string;
  /** cheia articolului / capitolului, pentru navigare în editor */
  itemKey?: string;
  chapterKey?: string;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Verificări automate: cantități lipsă, prețuri 0, dubluri, neconcordanțe de preț și U.M. */
export function checkEstimate(doc: EstimateDoc): Issue[] {
  const issues: Issue[] = [];
  const seenItems = new Map<string, string>();
  const resPrices = new Map<string, { price: number; where: string }>();
  const resUnits = new Map<string, { unit: string; where: string }>();

  if (doc.chapters.length === 0) issues.push({ level: "atentie", where: "Deviz", message: "Devizul nu are niciun capitol." });

  doc.chapters.forEach((ch, ci) => {
    const chWhere = `Cap. ${ci + 1}`;
    if (!ch.name.trim()) issues.push({ level: "atentie", where: chWhere, message: "Capitol fără denumire.", chapterKey: ch.key });
    if (ch.items.length === 0) issues.push({ level: "atentie", where: chWhere, message: `Capitolul „${ch.name}” nu are articole.`, chapterKey: ch.key });

    ch.items.forEach((it, ii) => {
      const where = `Art. ${ci + 1}.${ii + 1}`;
      const base = { where, itemKey: it.key, chapterKey: ch.key };
      if (!it.name.trim()) issues.push({ ...base, level: "eroare", message: "Articol fără denumire." });
      if (it.reviewNote) issues.push({ ...base, level: "atentie", message: `De verificat: ${it.reviewNote}` });
      if (!it.unit.trim()) issues.push({ ...base, level: "eroare", message: "Lipsește unitatea de măsură." });
      if (it.quantity <= 0) issues.push({ ...base, level: "eroare", message: "Cantitatea este 0." });
      if (it.resources.length === 0) issues.push({ ...base, level: "eroare", message: "Articolul nu are resurse, deci prețul unitar este 0." });
      else if (itemUnitPrice(it) <= 0) issues.push({ ...base, level: "eroare", message: "Prețul unitar este 0." });
      if (it.quantity > 0 && it.quantity % 1 !== 0 && /^(buc|bucati|bucăți|set|seturi)$/i.test(it.unit.trim()))
        issues.push({ ...base, level: "atentie", message: `Cantitate fracționară (${it.quantity}) la U.M. „${it.unit}”.` });

      const key = `${norm(it.name)}|${norm(it.unit)}`;
      if (it.name.trim()) {
        const prev = seenItems.get(key);
        if (prev) issues.push({ ...base, level: "atentie", message: `Posibilă dublură: același articol apare și la ${prev}.` });
        else seenItems.set(key, where);
      }

      const hasLabor = it.resources.some((r) => r.type === "manopera");
      const hasMaterial = it.resources.some((r) => r.type === "material");
      if (it.resources.length > 0 && !hasLabor && hasMaterial)
        issues.push({ ...base, level: "atentie", message: "Articolul are materiale, dar nu are manoperă." });

      it.resources.forEach((r, ri) => {
        const rw = `${where}, resursa ${ri + 1}`;
        const rb = { where: rw, itemKey: it.key, chapterKey: ch.key };
        if (!r.name.trim()) issues.push({ ...rb, level: "eroare", message: "Resursă fără denumire." });
        if (r.price <= 0) issues.push({ ...rb, level: "eroare", message: `${RES_TYPE_LABEL[r.type]} „${r.name}” are prețul 0.` });
        if (r.norm <= 0) issues.push({ ...rb, level: "eroare", message: `${RES_TYPE_LABEL[r.type]} „${r.name}” are consumul (norma) 0.` });
        if (!r.name.trim()) return;
        const rk = `${r.type}|${norm(r.name)}`;
        const p = resPrices.get(rk);
        if (p && Math.abs(p.price - r.price) > 0.0001)
          issues.push({ ...rb, level: "atentie", message: `„${r.name}” are preț diferit față de ${p.where} (${r.price} vs ${p.price}).` });
        else if (!p) resPrices.set(rk, { price: r.price, where: rw });
        const u = resUnits.get(rk);
        if (u && norm(u.unit) !== norm(r.unit))
          issues.push({ ...rb, level: "atentie", message: `„${r.name}” are U.M. diferită față de ${u.where} („${r.unit}” vs „${u.unit}”).` });
        else if (!u) resUnits.set(rk, { unit: r.unit, where: rw });
      });
    });
  });

  if (doc.overheadPct > 30) issues.push({ level: "atentie", where: "Recapitulație", message: `Cheltuieli indirecte mari: ${doc.overheadPct}%.` });
  if (doc.profitPct > 20) issues.push({ level: "atentie", where: "Recapitulație", message: `Profit mare: ${doc.profitPct}% — verifică plafonul din documentație.` });
  return issues;
}
