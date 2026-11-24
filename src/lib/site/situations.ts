import "server-only";
import ExcelJS from "exceljs";
import { execute, query, queryOne, transaction } from "../db";
import { loadEstimate } from "../estimate/repo";
import { offerUnitPriceOf, recap, type RecapCfg } from "../estimate/calc";
import { normKey, normText } from "../estimate/normalize";
import type { EstimateDoc, EstItem } from "../estimate/types";

export const SITUATION_STATUS = { ciorna: "Ciornă", emisa: "Emisă", acceptata: "Acceptată", incasata: "Încasată" } as const;
export type SituationStatus = keyof typeof SITUATION_STATUS;

/**
 * Cheia unui articol între situații: capitol + cod + denumire/U.M. normalizate + numărul apariției
 * (același articol poate apărea în mai multe capitole sau de mai multe ori în același capitol).
 */
export const itemKey = (chapter: string, code: string | null, name: string, unit: string, occurrence = 0) =>
  `${normText(chapter).slice(0, 60)}|${(code ?? "").trim().toLowerCase()}|${normKey(name, unit)}#${occurrence}`.slice(0, 300);

/** Prețul unitar de ofertă: cost direct C+M (cu CAM), cu indirecte și profit după regulile devizului, plus echipamentele (fără TVA). */
export function offerUnitPrice(item: EstItem, doc: RecapCfg): number {
  return offerUnitPriceOf(item, doc);
}

export async function createSituation(companyId: number, projectId: number, estimateId: number, userId: number): Promise<number> {
  const doc = await loadEstimate(estimateId, companyId);
  if (!doc || doc.projectId !== projectId) throw new Error("Devizul nu aparține proiectului.");
  return transaction(async (conn) => {
    const last = await queryOne<{ n: number | null; to: string | null }>(
      "SELECT MAX(number) AS n, DATE_FORMAT(MAX(period_to), '%Y-%m-%d') AS `to` FROM work_situations WHERE project_id = ? FOR UPDATE",
      [projectId],
      conn,
    );
    const number = Number(last?.n ?? 0) + 1;
    const ins = await execute(
      "INSERT INTO work_situations (company_id, project_id, estimate_id, number, period_from, vat_pct, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [companyId, projectId, estimateId, number, last?.to ?? null, doc.vatPct, userId],
      conn,
    );
    const rows: unknown[][] = [];
    const seen = new Map<string, number>();
    let pos = 0;
    for (const ch of doc.chapters)
      for (const it of ch.items) {
        const base = itemKey(ch.name, it.code, it.name, it.unit);
        const occ = seen.get(base) ?? 0;
        seen.set(base, occ + 1);
        rows.push([ins.insertId, pos++, itemKey(ch.name, it.code, it.name, it.unit, occ), ch.name.slice(0, 255), it.code || null, it.name.slice(0, 500), it.unit.slice(0, 20), it.quantity, Math.round(offerUnitPrice(it, doc) * 10000) / 10000, 0]);
      }
    if (rows.length)
      await execute("INSERT INTO work_situation_lines (situation_id, position, item_key, chapter, code, name, unit, qty_contract, unit_price, qty_current) VALUES ?", [rows], conn);
    return ins.insertId;
  });
}

export type SituationLine = {
  id: number; chapter: string; code: string | null; name: string; unit: string;
  qtyContract: number; unitPrice: number; qtyPrevious: number; qtyCurrent: number;
};

export type Situation = {
  id: number; projectId: number; projectName: string; number: number; status: SituationStatus;
  periodFrom: string | null; periodTo: string | null; vatPct: number; notes: string | null; lines: SituationLine[];
};

export async function loadSituation(id: number, companyId: number): Promise<Situation | null> {
  const s = await queryOne<{ id: number; project_id: number; project_name: string; number: number; status: SituationStatus; period_from: string | null; period_to: string | null; vat_pct: string; notes: string | null }>(
    `SELECT s.id, s.project_id, p.name AS project_name, s.number, s.status,
            DATE_FORMAT(s.period_from, '%Y-%m-%d') AS period_from, DATE_FORMAT(s.period_to, '%Y-%m-%d') AS period_to, s.vat_pct, s.notes
       FROM work_situations s JOIN projects p ON p.id = s.project_id WHERE s.id = ? AND s.company_id = ?`,
    [id, companyId],
  );
  if (!s) return null;
  const lines = await query<{ id: number; item_key: string; chapter: string; code: string | null; name: string; unit: string; qty_contract: string; unit_price: string; qty_current: string }>(
    "SELECT id, item_key, chapter, code, name, unit, qty_contract, unit_price, qty_current FROM work_situation_lines WHERE situation_id = ? ORDER BY position",
    [id],
  );
  // Cantitățile din situațiile anterioare ale aceluiași proiect, pe articol.
  const prev = await query<{ item_key: string; q: string }>(
    `SELECT l.item_key, SUM(l.qty_current) AS q FROM work_situation_lines l JOIN work_situations s ON s.id = l.situation_id
      WHERE s.project_id = ? AND s.number < ? GROUP BY l.item_key`,
    [s.project_id, s.number],
  );
  const prevMap = new Map(prev.map((p) => [p.item_key, Number(p.q)]));
  return {
    id: s.id, projectId: s.project_id, projectName: s.project_name, number: s.number, status: s.status,
    periodFrom: s.period_from, periodTo: s.period_to, vatPct: Number(s.vat_pct), notes: s.notes,
    lines: lines.map((l) => ({
      id: l.id, chapter: l.chapter, code: l.code, name: l.name, unit: l.unit,
      qtyContract: Number(l.qty_contract), unitPrice: Number(l.unit_price),
      qtyPrevious: prevMap.get(l.item_key) ?? 0, qtyCurrent: Number(l.qty_current),
    })),
  };
}

export function situationTotals(s: Situation) {
  let current = 0, cumulative = 0, contract = 0;
  for (const l of s.lines) {
    current += l.qtyCurrent * l.unitPrice;
    cumulative += (l.qtyPrevious + l.qtyCurrent) * l.unitPrice;
    contract += l.qtyContract * l.unitPrice;
  }
  return { current, cumulative, contract, vat: (current * s.vatPct) / 100, total: current * (1 + s.vatPct / 100), progress: contract > 0 ? cumulative / contract : 0 };
}

/** Valoarea executată (fără TVA) a proiectului: toate situațiile, mai puțin ciornele. */
export async function executedValue(projectId: number): Promise<number> {
  const r = await queryOne<{ v: string | null }>(
    `SELECT ROUND(SUM(l.qty_current * l.unit_price), 2) AS v FROM work_situation_lines l JOIN work_situations s ON s.id = l.situation_id
      WHERE s.project_id = ? AND s.status <> 'ciorna'`,
    [projectId],
  );
  return Number(r?.v ?? 0);
}

const MONEY = "#,##0.00";
const QTY = "#,##0.000";

/** Situația de lucrări în Excel, cu formule (cumulat = anterior + curent; valoare = cantitate × preț). */
export async function situationWorkbook(s: Situation, company: string): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Situatia ${s.number}`, { views: [{ state: "frozen", ySplit: 6 }] });
  ws.addRow([`Situație de lucrări nr. ${s.number}`]).font = { bold: true, size: 13 };
  ws.addRow([`Executant: ${company}`]);
  ws.addRow([`Lucrarea: ${s.projectName}`]);
  ws.addRow([`Perioada: ${s.periodFrom ?? "—"} – ${s.periodTo ?? "—"}`]);
  ws.addRow([]);
  const h = ws.addRow(["Nr.", "Cod", "Denumire articol", "U.M.", "Cant. contract", "Preț unitar", "Cant. anterioare", "Cant. curentă", "Cant. cumulată", "Valoare curentă", "Valoare cumulată", "% realizat"]);
  h.font = { bold: true };
  h.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F2F2" } }));
  ws.columns = [{ width: 6 }, { width: 11 }, { width: 48 }, { width: 7 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 15 }, { width: 15 }, { width: 10 }];
  const first = ws.rowCount + 1;
  let chapter = "";
  s.lines.forEach((l, i) => {
    if (l.chapter !== chapter) {
      chapter = l.chapter;
      ws.addRow(["", "", chapter]).font = { bold: true };
    }
    const r = ws.addRow([i + 1, l.code ?? "", l.name, l.unit, l.qtyContract, l.unitPrice, l.qtyPrevious, l.qtyCurrent]);
    const n = r.number;
    r.getCell(9).value = { formula: `G${n}+H${n}`, result: l.qtyPrevious + l.qtyCurrent };
    r.getCell(10).value = { formula: `H${n}*F${n}`, result: l.qtyCurrent * l.unitPrice };
    r.getCell(11).value = { formula: `I${n}*F${n}`, result: (l.qtyPrevious + l.qtyCurrent) * l.unitPrice };
    r.getCell(12).value = { formula: `IF(E${n}=0,0,I${n}/E${n})`, result: l.qtyContract ? (l.qtyPrevious + l.qtyCurrent) / l.qtyContract : 0 };
    [5, 7, 8, 9].forEach((c) => (r.getCell(c).numFmt = QTY));
    [6, 10, 11].forEach((c) => (r.getCell(c).numFmt = MONEY));
    r.getCell(12).numFmt = "0.0%";
    r.getCell(3).alignment = { wrapText: true, vertical: "top" };
  });
  const last = ws.rowCount;
  const t = situationTotals(s);
  const tot = ws.addRow(["", "", "TOTAL FĂRĂ TVA"]);
  tot.getCell(10).value = { formula: `SUM(J${first}:J${last})`, result: t.current };
  tot.getCell(11).value = { formula: `SUM(K${first}:K${last})`, result: t.cumulative };
  const vat = ws.addRow(["", "", `TVA ${s.vatPct}%`]);
  vat.getCell(10).value = { formula: `J${tot.number}*${s.vatPct}/100`, result: t.vat };
  const all = ws.addRow(["", "", "TOTAL CU TVA"]);
  all.getCell(10).value = { formula: `J${tot.number}+J${vat.number}`, result: t.total };
  [tot, vat, all].forEach((r) => { r.font = { bold: true }; r.getCell(10).numFmt = MONEY; r.getCell(11).numFmt = MONEY; });
  ws.addRow([]);
  ws.addRow(["", "", "Executant: ____________________", "", "", "", "", "Beneficiar / diriginte de șantier: ____________________"]);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Valoarea contractului: cea introdusă manual sau totalul fără TVA al devizului de contract. */
export async function contractValue(companyId: number, projectId: number): Promise<{ value: number; estimate: EstimateDoc | null }> {
  const p = await queryOne<{ contract_value: string | null; contract_estimate_id: number | null }>(
    "SELECT contract_value, contract_estimate_id FROM projects WHERE id = ? AND company_id = ?",
    [projectId, companyId],
  );
  const est = p?.contract_estimate_id ? await loadEstimate(p.contract_estimate_id, companyId) : null;
  return { value: p?.contract_value !== null && p?.contract_value !== undefined ? Number(p.contract_value) : est ? recap(est).totalNoVat : 0, estimate: est };
}
