import "server-only";
import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import { query, queryOne } from "./db";
import { getCompany, type Company } from "./company";
import { loadEstimate } from "./estimate/repo";
import { fmtMoney, recap, schedule } from "./estimate/calc";

export type Template = { id: number; name: string; category: string; body: string; active: boolean; position: number };

export async function listTemplates(onlyActive = true): Promise<Template[]> {
  const rows = await query<{ id: number; name: string; category: string; body: string; active: number; position: number }>(
    `SELECT id, name, category, body, active, position FROM document_templates ${onlyActive ? "WHERE active = 1" : ""} ORDER BY position, id`,
  );
  return rows.map((r) => ({ ...r, active: r.active === 1 }));
}

/** Câmpurile disponibile în șabloane (afișate și în admin). */
export const PLACEHOLDERS: [string, string][] = [
  ["firma.denumire", "Denumirea firmei"],
  ["firma.cui", "CUI"],
  ["firma.reg_com", "Nr. Registrul Comerțului"],
  ["firma.adresa", "Adresa sediului"],
  ["firma.judet", "Județ"],
  ["firma.telefon", "Telefon"],
  ["firma.email", "Email"],
  ["firma.iban", "IBAN"],
  ["firma.banca", "Banca"],
  ["firma.reprezentant", "Reprezentant legal"],
  ["firma.functie", "Funcția reprezentantului"],
  ["proiect.denumire", "Denumirea proiectului / contractului"],
  ["proiect.autoritate", "Autoritatea contractantă"],
  ["proiect.anunt", "Nr. anunț / procedură SEAP"],
  ["proiect.locatie", "Locația lucrării"],
  ["proiect.beneficiar", "Beneficiar"],
  ["oferta.valoare_fara_tva", "Valoarea ofertei fără TVA (din deviz)"],
  ["oferta.tva", "TVA"],
  ["oferta.valoare_cu_tva", "Valoarea ofertei cu TVA"],
  ["oferta.durata_zile", "Durata de execuție (zile lucrătoare, din grafic)"],
  ["data", "Data de azi"],
];

const BLANK = "__________";

export type TemplateContext = Record<string, string>;

export async function buildContext(companyId: number, projectId?: number | null, estimateId?: number | null): Promise<TemplateContext> {
  const c: Company | null = await getCompany(companyId);
  const p = projectId
    ? await queryOne<{ name: string; authority: string | null; notice_number: string | null; location: string | null; client_name: string | null }>(
        "SELECT name, authority, notice_number, location, client_name FROM projects WHERE id = ? AND company_id = ?",
        [projectId, companyId],
      )
    : null;

  let est = estimateId ? await loadEstimate(estimateId, companyId) : null;
  if (!est && projectId) {
    const first = await queryOne<{ id: number }>("SELECT id FROM estimates WHERE project_id = ? AND company_id = ? ORDER BY created_at LIMIT 1", [projectId, companyId]);
    if (first) est = await loadEstimate(first.id, companyId);
  }
  const r = est ? recap(est) : null;
  const days = est ? Math.max(0, ...schedule(est).map((s) => s.end)) : 0;

  const v = (x: string | null | undefined) => (x && x.trim() ? x.trim() : BLANK);
  return {
    "firma.denumire": v(c?.name),
    "firma.cui": v(c?.cui),
    "firma.reg_com": v(c?.reg_com),
    "firma.adresa": v(c?.address),
    "firma.judet": v(c?.county),
    "firma.telefon": v(c?.phone),
    "firma.email": v(c?.email),
    "firma.iban": v(c?.iban),
    "firma.banca": v(c?.bank),
    "firma.reprezentant": v(c?.legal_rep),
    "firma.functie": v(c?.legal_rep_role),
    "proiect.denumire": v(p?.name),
    "proiect.autoritate": v(p?.authority ?? p?.client_name),
    "proiect.anunt": v(p?.notice_number),
    "proiect.locatie": v(p?.location),
    "proiect.beneficiar": v(p?.client_name),
    "oferta.valoare_fara_tva": r ? fmtMoney(r.totalNoVat) : BLANK,
    "oferta.tva": r ? fmtMoney(r.vat) : BLANK,
    "oferta.valoare_cu_tva": r ? fmtMoney(r.total) : BLANK,
    "oferta.durata_zile": days ? String(days) : BLANK,
    data: new Intl.DateTimeFormat("ro-RO").format(new Date()),
  };
}

export function renderTemplate(body: string, ctx: TemplateContext): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => ctx[key] ?? BLANK);
}

/** Text → document Word: „# ” titlu, „## ” subtitlu, rând gol = paragraf nou. */
export async function toDocx(text: string): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];
  for (const block of text.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n");
    if (lines.length === 1 && lines[0].startsWith("# ")) {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: lines[0].slice(2), bold: true, size: 28 })],
      }));
      continue;
    }
    if (lines.length === 1 && lines[0].startsWith("## ")) {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 240 },
        children: [new TextRun({ text: lines[0].slice(3), bold: true, size: 22 })],
      }));
      continue;
    }
    const heading = lines[0].startsWith("# ") || lines[0].startsWith("## ");
    const runs: TextRun[] = [];
    lines.forEach((line, i) => {
      const t = heading && i === 0 ? line.replace(/^#+ /, "") : line;
      runs.push(new TextRun({ text: t, break: i > 0 ? 1 : undefined, bold: heading && i === 0, size: 22 }));
    });
    paragraphs.push(new Paragraph({ alignment: lines.length > 1 ? AlignmentType.LEFT : AlignmentType.JUSTIFIED, spacing: { after: 160, line: 300 }, children: runs }));
  }
  const doc = new Document({
    creator: "ConstructiiDevize.ro",
    styles: { default: { document: { run: { font: "Arial" } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1247, right: 1134 } } }, children: paragraphs }],
  });
  return Packer.toBuffer(doc);
}

export function docFilename(name: string) {
  return (name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").replace(/_+/g, "_").slice(0, 80) || "document") + ".docx";
}
