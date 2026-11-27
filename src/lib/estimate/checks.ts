import { effNorm, itemUnitPrice } from "./calc";
import { isAssistantNote } from "./review";
import { evalFormula } from "./formula";
import { normText } from "./normalize";
import { RES_TYPE_LABEL, type EstimateDoc, type EstItem } from "./types";

/**
 * Niveluri:
 *  - eroare:   calcul sau informație obligatorie incorectă / lipsă;
 *  - atentie:  posibilă problemă care trebuie verificată;
 *  - info:     recomandare, fără caracter obligatoriu.
 * Verificările automate nu confirmă conformitatea tehnică sau juridică a devizului.
 */
export type IssueLevel = "eroare" | "atentie" | "info";

export type Issue = {
  level: IssueLevel;
  where: string;
  message: string;
  /** cheia articolului / capitolului, pentru navigare în editor */
  itemKey?: string;
  chapterKey?: string;
};

/** Informații din afara devizului (catalog, reguli), încărcate separat. Fără ele se fac doar verificările de bază. */
export type CheckContext = {
  /** Ofertele cu care au fost preluate prețurile: valabilitate, status, transport inclus. */
  offers?: Record<number, { expired: boolean; status: string; transportIncluded: boolean | null; validUntil: string | null }>;
  /** TVA și CAM aplicabile la data regulilor devizului. */
  rules?: { vatPct: number; camPct: number };
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const has = (it: EstItem, re: RegExp) => re.test(normText(it.name));
const isHour = (u: string) => /^(or[ae]?|h|ore-om|om-or[ae])$/i.test(u.trim());

/** Verificările automate ale devizului. */
export function checkEstimate(doc: EstimateDoc, ctx: CheckContext = {}): Issue[] {
  const issues: Issue[] = [];
  const seenItems = new Map<string, string>();
  const resPrices = new Map<string, { price: number; where: string }>();
  const resUnits = new Map<string, { unit: string; where: string }>();
  const all = doc.chapters.flatMap((c) => c.items);

  if (doc.chapters.length === 0) issues.push({ level: "atentie", where: "Deviz", message: "Devizul nu are niciun capitol." });

  doc.chapters.forEach((ch, ci) => {
    const chWhere = `Cap. ${ci + 1}`;
    if (!ch.name.trim()) issues.push({ level: "atentie", where: chWhere, message: "Capitol fără denumire.", chapterKey: ch.key });
    if (ch.items.length === 0) issues.push({ level: "atentie", where: chWhere, message: `Capitolul „${ch.name}” nu are articole.`, chapterKey: ch.key });

    ch.items.forEach((it, ii) => {
      const where = `Art. ${ci + 1}.${ii + 1}`;
      const base = { where, itemKey: it.key, chapterKey: ch.key };
      const add = (level: IssueLevel, message: string) => issues.push({ ...base, level, message });

      // --- date de bază
      if (!it.name.trim()) add("eroare", "Articol fără denumire.");
      // Propunerile asistentului nu intră în ofertă neverificate: eroare până la „✓ Am verificat”.
      if (it.reviewNote && isAssistantNote(it.reviewNote)) add("eroare", `Propus de asistent, neverificat — confirmă resursele și normele („✓ Am verificat”). ${it.reviewNote}`);
      else if (it.reviewNote) add("atentie", `De verificat: ${it.reviewNote}`);
      if (!it.unit.trim()) add("eroare", "Lipsește unitatea de măsură.");
      if (it.quantity <= 0) add("eroare", "Cantitatea este 0.");
      if (it.resources.length === 0) add("eroare", "Articolul nu are resurse, deci prețul unitar este 0.");
      else if (itemUnitPrice(it) <= 0) add("eroare", "Prețul unitar este 0.");

      // --- cantitate: formulă, estimare, valori suspecte
      if (it.qtyFormula) {
        const fr = evalFormula(it.qtyFormula);
        if (!fr.ok) add("eroare", `Formula cantității nu e validă: ${fr.error}`);
        else if (Math.abs(fr.value - it.quantity) > 0.00005) add("eroare", `Cantitatea (${it.quantity}) nu corespunde formulei (${fr.value}).`);
      }
      if (it.qtyEstimated) add("atentie", "Cantitate estimată — necesită verificare pe planșe sau măsurători.");
      if (it.quantity > 0 && it.quantity % 1 !== 0 && /^(buc|bucati|bucăți|set|seturi)$/i.test(it.unit.trim()))
        add("atentie", `Cantitate fracționară (${it.quantity}) la U.M. „${it.unit}”.`);
      if (it.quantity > 1_000_000) add("atentie", `Cantitate foarte mare (${it.quantity} ${it.unit}) — verifică unitatea de măsură.`);

      // --- F3-ul autorității (Modul licitație): cantitățile și descrierile nu se modifică
      if (it.f3) {
        if (Math.abs(it.f3.quantity - it.quantity) > 0.00005)
          add("eroare", `Cantitatea diferă de F3-ul autorității: ${it.f3.quantity} ${it.f3.unit} în F3, ${it.quantity} ${it.unit} în deviz.`);
        if (norm(it.f3.unit) && norm(it.f3.unit) !== norm(it.unit)) add("eroare", `U.M. diferă de F3: „${it.f3.unit}” în F3, „${it.unit}” în deviz.`);
        if (norm(it.f3.name) !== norm(it.name)) add("atentie", `Denumirea a fost modificată față de F3 („${it.f3.name.slice(0, 80)}”).`);
        if (it.f3.code && norm(it.f3.code) !== norm(it.code)) add("atentie", `Codul diferă de F3 („${it.f3.code}”).`);
      }

      // --- dubluri
      const key = `${norm(it.name)}|${norm(it.unit)}`;
      if (it.name.trim()) {
        const prev = seenItems.get(key);
        if (prev) add("atentie", `Posibilă dublură: același articol apare și la ${prev}.`);
        else seenItems.set(key, where);
      }

      // --- compoziție
      const hasLabor = it.resources.some((r) => r.type === "manopera");
      const hasMaterial = it.resources.some((r) => r.type === "material");
      const transportRes = it.resources.filter((r) => r.type === "transport");
      if (it.resources.length > 0 && !hasLabor && hasMaterial) add("atentie", "Articolul are materiale, dar nu are manoperă.");

      const seenRes = new Map<string, number>();
      it.resources.forEach((r, ri) => {
        const rw = `${where}, resursa ${ri + 1}`;
        const rb = { where: rw, itemKey: it.key, chapterKey: ch.key };
        const addR = (level: IssueLevel, message: string) => issues.push({ ...rb, level, message });
        const label = `${RES_TYPE_LABEL[r.type]} „${r.name}”`;
        if (!r.name.trim()) addR("eroare", "Resursă fără denumire.");
        if (r.price <= 0) addR("eroare", `${label} are prețul 0.`);
        if (r.norm <= 0) addR("eroare", `${label} are consumul (norma) 0.`);
        if (!r.name.trim()) return;

        // aceeași resursă de două ori în același articol
        const dk = r.resourceId ? `id:${r.resourceId}` : `n:${r.type}|${norm(r.name)}`;
        if (seenRes.has(dk)) addR("atentie", `${label} apare de două ori în același articol.`);
        else seenRes.set(dk, ri);

        // consumuri neobișnuite
        if (r.type === "manopera" && isHour(r.unit) && effNorm(r) > 100) addR("atentie", `Consum de manoperă neobișnuit de mare: ${effNorm(r)} ore/${it.unit}.`);
        if (r.waste > 25) addR("atentie", `Pierderi tehnologice mari (${r.waste}%) — justifică-le în notă.`);

        // CAM: tipul tarifului și dubla includere
        if (r.type === "manopera" && !r.tariffKind)
          addR("atentie", `${label}: tipul tarifului e necunoscut, deci nu se știe dacă se aplică CAM. Alege „cost salarial” sau „tarif comercial”.`);
        if (/\b(cam|contributia asiguratorie)\b/.test(normText(r.name)))
          addR("eroare", `${label} pare a fi CAM adăugat ca resursă. CAM se calculează automat în recapitulație (doar pe manopera la cost salarial).`);

        // sursa prețului
        const off = r.offerId ? ctx.offers?.[r.offerId] : undefined;
        if (off?.expired) addR("atentie", `${label}: prețul provine dintr-o ofertă expirată${off.validUntil ? ` (valabilă până la ${off.validUntil})` : ""}.`);
        if (off && off.status === "neverificat") addR("info", `${label}: prețul provine dintr-o sursă neverificată.`);
        if (r.priceManual) addR("info", `${label}: preț introdus manual în deviz.`);
        else if (!r.resourceId && r.price > 0 && (r.type === "manopera" || r.type === "utilaj"))
          addR("info", `${label}: cost fără legătură cu catalogul — documentează de unde provine tariful.`);

        // transport inclus în prețul materialului + transport separat în articol
        if (r.type === "material" && off?.transportIncluded && transportRes.length)
          addR("atentie", `${label} are transportul inclus în preț, dar articolul conține și transport separat — posibil transport dublat.`);

        // același material cu preț / U.M. diferite în deviz
        const rk = `${r.type}|${norm(r.name)}`;
        const p = resPrices.get(rk);
        if (p && Math.abs(p.price - r.price) > 0.0001)
          addR("atentie", `„${r.name}” are preț diferit față de ${p.where} (${r.price} vs ${p.price}).`);
        else if (!p) resPrices.set(rk, { price: r.price, where: rw });
        const u = resUnits.get(rk);
        if (u && norm(u.unit) !== norm(r.unit))
          addR("eroare", `„${r.name}” are U.M. diferită față de ${u.where} („${r.unit}” vs „${u.unit}”) — unități incompatibile.`);
        else if (!u) resUnits.set(rk, { unit: r.unit, where: rw });
      });

      // mai multe resurse de transport în același articol
      if (transportRes.length > 1) add("atentie", `Articolul are ${transportRes.length} resurse de transport — verifică să nu fie același transport de două ori.`);
    });
  });

  // --- posibile lucrări omise (recomandări)
  const any = (re: RegExp) => all.some((it) => has(it, re));
  const R = (message: string) => issues.push({ level: "info", where: "Deviz", message });
  if (any(/beton armat/) && !any(/armatur|otel beton|plasa sudata/)) R("Ai beton armat, dar niciun articol de armătură. Verifică dacă armătura e inclusă în alt articol.");
  if (any(/beton armat|beton in fundatii|beton in stalpi|beton in placi/) && !any(/cofraj/)) R("Ai betoane turnate, dar niciun articol de cofraj.");
  if (any(/sapatur/) && !any(/transport|umplutur|incarcare/)) R("Ai săpături, dar nimic pentru pământul excavat (umplutură sau transport).");
  if (any(/zidari/) && !any(/tencuial|glet|placaj/)) R("Ai zidărie, dar nicio tencuială sau finisaj.");

  // --- recapitulație
  if (doc.overheadPct > 30) issues.push({ level: "atentie", where: "Recapitulație", message: `Cheltuieli indirecte mari: ${doc.overheadPct}%.` });
  if (doc.profitPct > 20) issues.push({ level: "atentie", where: "Recapitulație", message: `Profit mare: ${doc.profitPct}% — verifică plafonul din documentație.` });
  if (ctx.rules) {
    if (Math.abs(doc.vatPct - ctx.rules.vatPct) > 0.0001)
      issues.push({ level: "atentie", where: "Recapitulație", message: `TVA ${doc.vatPct}% diferă de cota standard aplicabilă (${ctx.rules.vatPct}%). Verifică dacă se aplică o cotă redusă sau o excepție legală.` });
    if (Math.abs(doc.camPct - ctx.rules.camPct) > 0.0001)
      issues.push({ level: "atentie", where: "Recapitulație", message: `CAM ${doc.camPct}% diferă de regula aplicabilă (${ctx.rules.camPct}%).` });
  }
  return issues;
}
