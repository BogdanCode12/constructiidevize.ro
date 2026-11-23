import "server-only";
import ExcelJS from "exceljs";
import { parseNum } from "../numbers";
import type { ImportLine } from "../recipes/repo";

export type F3Chapter = { name: string; lines: ImportLine[] };

type Cols = { code: number; name: number; unit: number; qty: number };

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    return String(o.result ?? o.text ?? "");
  }
  return String(v);
};

function detectHeader(rows: string[][]): { index: number; cols: Cols } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = rows[i].map((c) => c.toLowerCase());
    const name = r.findIndex((c) => /denumire|descriere|lucrar/.test(c));
    const qty = r.findIndex((c) => /cantit/.test(c));
    if (name >= 0 && qty >= 0) {
      const unit = r.findIndex((c) => /^u\.?\s*m\.?$|unitat|u\.m/.test(c.trim()));
      const code = r.findIndex((c, j) => j !== name && /cod|simbol|indicator|articol|norm/.test(c));
      return { index: i, cols: { code, name, unit, qty } };
    }
  }
  return null;
}

/** Ghicește coloanele când nu există cap de tabel: cel mai lung text = denumire, ultima coloană numerică = cantitate. */
function guessCols(rows: string[][]): Cols {
  const width = Math.max(...rows.map((r) => r.length));
  const textLen = Array(width).fill(0);
  const numeric = Array(width).fill(0);
  for (const r of rows.slice(0, 50))
    r.forEach((c, j) => {
      textLen[j] += c.length;
      if (parseNum(c) !== null && c.trim()) numeric[j]++;
    });
  const name = textLen.indexOf(Math.max(...textLen));
  let qty = -1;
  for (let j = width - 1; j > name; j--) if (numeric[j] > 0) { qty = j; break; }
  const unit = qty > name + 1 ? qty - 1 : -1;
  const code = name > 0 && !/^\d+(\.\d+)*$/.test(rows[0]?.[name - 1] ?? "") ? name - 1 : -1;
  return { code, name, unit, qty };
}

function toChapters(rows: string[][], cols: Cols): F3Chapter[] {
  const chapters: F3Chapter[] = [];
  let current: F3Chapter | null = null;
  for (const r of rows) {
    const name = (r[cols.name] ?? "").trim();
    if (!name) continue;
    const qty = cols.qty >= 0 ? parseNum(r[cols.qty] ?? "") : null;
    const unit = cols.unit >= 0 ? (r[cols.unit] ?? "").trim() : "";
    if ((qty === null || qty === 0) && !unit) {
      // rând fără cantitate și U.M. = titlu de capitol (dacă nu e un rând de total)
      if (/^total/i.test(name)) continue;
      current = { name: name.slice(0, 255), lines: [] };
      chapters.push(current);
      continue;
    }
    if (!current) {
      current = { name: "Import F3", lines: [] };
      chapters.push(current);
    }
    current.lines.push({
      code: cols.code >= 0 ? (r[cols.code] ?? "").trim().slice(0, 40) : "",
      name: name.slice(0, 500),
      unit: unit.slice(0, 20) || "buc",
      quantity: qty ?? 0,
    });
  }
  return chapters.filter((c) => c.lines.length > 0);
}

export function parseF3Rows(rows: string[][]): F3Chapter[] {
  const clean = rows.map((r) => r.map((c) => c.replace(/\s+/g, " ").trim())).filter((r) => r.some(Boolean));
  if (!clean.length) return [];
  const header = detectHeader(clean);
  return header ? toChapters(clean.slice(header.index + 1), header.cols) : toChapters(clean, guessCols(clean));
}

export function parseF3Text(text: string): F3Chapter[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const sep = lines.some((l) => l.includes("\t")) ? "\t" : ";";
  return parseF3Rows(lines.map((l) => l.split(sep)));
}

export async function parseF3Xlsx(buf: ArrayBuffer): Promise<F3Chapter[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  let best: F3Chapter[] = [];
  wb.eachSheet((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => rows.push((row.values as unknown[]).slice(1).map(cellText)));
    const parsed = parseF3Rows(rows);
    if (parsed.reduce((s, c) => s + c.lines.length, 0) > best.reduce((s, c) => s + c.lines.length, 0)) best = parsed;
  });
  return best;
}
