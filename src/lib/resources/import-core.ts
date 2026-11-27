import "server-only";
import { parseCounty } from "../counties";
import ExcelJS from "exceljs";
import { query } from "../db";
import { normKey, normText, similarity } from "../estimate/normalize";
import { parseNum } from "../numbers";
import type { ResType } from "../estimate/types";
import { normalizeUnit } from "./units";

/*
 * Importul de catalog în 3 pași: (1) citirea tabelului, (2) maparea coloanelor (în pagină),
 * (3) previzualizarea: ce e nou, ce există deja (și cum se schimbă prețul), dubluri, rânduri invalide.
 * La aplicare, potrivirea se refac pe server — nu se folosesc id-urile venite din pagină.
 */

export const IMPORT_FIELDS = [
  { key: "name", label: "Denumire", required: true, hints: ["denumire", "denumirea", "nume", "material", "resursa", "produs", "articol", "descriere"] },
  { key: "unit", label: "U.M.", required: true, hints: ["um", "u.m", "u.m.", "unitate", "unit", "unitatea"] },
  { key: "price", label: "Preț fără TVA", required: false, hints: ["pret", "preț", "pret unitar", "pret fara tva", "valoare", "tarif", "cost"] },
  { key: "code", label: "Cod", required: false, hints: ["cod", "cod intern", "simbol", "code"] },
  { key: "supplier", label: "Furnizor", required: false, hints: ["furnizor", "supplier", "distribuitor"] },
  { key: "category", label: "Categorie", required: false, hints: ["categorie", "grupa", "familie", "category"] },
  { key: "producer", label: "Producător", required: false, hints: ["producator", "producător", "marca", "brand"] },
  { key: "specs", label: "Specificații", required: false, hints: ["specificatii", "specificații", "caracteristici", "detalii"] },
  { key: "valid_until", label: "Valabil până la", required: false, hints: ["valabil", "valabilitate", "valid"] },
  { key: "county", label: "Județ (zona prețului)", required: false, hints: ["judet", "județ", "zona", "zonă", "county", "regiune"] },
] as const;
export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
export type ImportRow = Partial<Record<ImportFieldKey, string>>;

export type ParsedTable = { headers: string[]; rows: string[][]; guess: Partial<Record<ImportFieldKey, number>>; headerRow: boolean };

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    return cellText(o.result ?? o.text ?? "");
  }
  return String(v).trim();
};

export async function parseTable(file: File | null, text: string): Promise<ParsedTable> {
  let grid: string[][] = [];
  if (file && file.size) {
    if (/\.xlsx$/i.test(file.name)) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load((await file.arrayBuffer()) as ArrayBuffer);
      const ws = wb.worksheets.find((w) => w.rowCount > 0);
      ws?.eachRow((row) => {
        const vals = (row.values as unknown[]).slice(1).map(cellText);
        if (vals.some((x) => x)) grid.push(vals);
      });
    } else {
      text = await file.text();
    }
  }
  if (!grid.length && text.trim()) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const sep = lines.some((l) => l.includes("\t")) ? "\t" : lines.some((l) => l.includes(";")) ? ";" : ",";
    grid = lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, "$1")));
  }
  grid = grid.slice(0, 3001);
  const width = Math.max(0, ...grid.map((r) => r.length));
  grid = grid.map((r) => [...r, ...Array(width - r.length).fill("")]);

  // Cap de tabel: primul rând fără niciun număr, cu cel puțin 2 celule completate.
  const first = grid[0] ?? [];
  const headerRow = first.filter((c) => c).length >= 2 && first.every((c) => !c || parseNum(c) === null);
  const headers = headerRow ? first.map((h, i) => h || `Coloana ${i + 1}`) : first.map((_, i) => `Coloana ${i + 1}`);
  const rows = headerRow ? grid.slice(1) : grid;

  const guess: Partial<Record<ImportFieldKey, number>> = {};
  if (headerRow) {
    const norm = headers.map((h) => normText(h));
    for (const f of IMPORT_FIELDS) {
      const idx = norm.findIndex((h, i) => !Object.values(guess).includes(i) && f.hints.some((x) => h === normText(x) || h.startsWith(normText(x))));
      if (idx >= 0) guess[f.key] = idx;
    }
  } else if (width >= 3) {
    // Fără cap de tabel: formatul vechi Cod | Denumire | U.M. | Preț (sau Denumire | U.M. | Preț).
    Object.assign(guess, width >= 4 ? { code: 0, name: 1, unit: 2, price: 3 } : { name: 0, unit: 1, price: 2 });
  }
  return { headers, rows, guess, headerRow };
}

export type PreviewRow = {
  index: number;
  code: string | null; name: string; unit: string; price: number | null; supplier: string | null; category: string | null;
  producer: string | null; specs: string | null; validUntil: string | null;
  /** Județul prețului (cod auto) din coloana „Județ”; null = cel ales pentru tot fișierul. */
  county: string | null;
  status: "nou" | "existent" | "dublura_fisier" | "invalid";
  reason?: string;
  existing?: { id: number; name: string; price: number | null; verified: boolean };
  similar?: { id: number; name: string };
};

const toDate = (s: string | undefined): string | null => {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
};

/** Potrivește rândurile cu catalogul (al proprietarului) și clasifică fiecare rând. */
export async function previewRows(companyId: number | null, type: ResType, input: ImportRow[]): Promise<PreviewRow[]> {
  const existing = await query<{ id: number; code: string | null; name: string; unit: string; price: string | null; verified: number }>(
    `SELECT r.id, r.code, r.name, r.unit, r.price, (p.status = 'verificat') AS verified
       FROM resources r LEFT JOIN resource_prices p ON p.id = r.current_price_id
      WHERE r.company_id <=> ? AND r.type = ?`,
    [companyId, type],
  );
  const byCode = new Map(existing.filter((e) => e.code).map((e) => [normText(e.code!), e]));
  const byKey = new Map(existing.map((e) => [normKey(e.name, e.unit), e]));
  const seen = new Set<string>();
  const fuzzyOk = existing.length * input.length <= 1_500_000;

  return input.map((raw, index) => {
    const name = (raw.name ?? "").trim().slice(0, 255);
    const unit = normalizeUnit(raw.unit ?? "");
    const code = (raw.code ?? "").trim().slice(0, 40) || null;
    const priceRaw = (raw.price ?? "").trim();
    const price = priceRaw ? parseNum(priceRaw) : null;
    const validRaw = (raw.valid_until ?? "").trim();
    const base: PreviewRow = {
      index, code, name, unit, price, status: "nou",
      supplier: (raw.supplier ?? "").trim().slice(0, 160) || null,
      category: (raw.category ?? "").trim().slice(0, 80) || null,
      producer: (raw.producer ?? "").trim().slice(0, 120) || null,
      specs: (raw.specs ?? "").trim().slice(0, 500) || null,
      validUntil: toDate(validRaw),
      county: parseCounty(raw.county),
    };
    if (!name) return { ...base, status: "invalid", reason: "Lipsește denumirea." };
    if (!unit) return { ...base, status: "invalid", reason: "Lipsește unitatea de măsură." };
    if (priceRaw && (price === null || price <= 0)) return { ...base, status: "invalid", reason: `Preț nevalid: „${priceRaw}”.` };
    if (validRaw && !base.validUntil) return { ...base, status: "invalid", reason: `Dată de valabilitate nevalidă: „${validRaw}”.` };
    if ((raw.county ?? "").trim() && !base.county) return { ...base, status: "invalid", reason: `Județ nerecunoscut: „${(raw.county ?? "").trim()}”.` };

    const key = normKey(name, unit);
    const fileKey = code ? `c:${normText(code)}` : `k:${key}`;
    if (seen.has(fileKey)) return { ...base, status: "dublura_fisier", reason: "Apare de mai multe ori în fișier." };
    seen.add(fileKey);

    const hit = (code && byCode.get(normText(code))) || byKey.get(key);
    if (hit) {
      return { ...base, status: "existent", existing: { id: hit.id, name: hit.name, price: hit.price === null ? null : Number(hit.price), verified: hit.verified === 1 } };
    }
    if (fuzzyOk) {
      let best: { id: number; name: string; s: number } | null = null;
      for (const e of existing) {
        if (normKey("", e.unit) !== normKey("", unit)) continue;
        const s = similarity(name, e.name);
        if (s >= 0.85 && (!best || s > best.s)) best = { id: e.id, name: e.name, s };
      }
      if (best) return { ...base, similar: { id: best.id, name: best.name } };
    }
    return base;
  });
}
