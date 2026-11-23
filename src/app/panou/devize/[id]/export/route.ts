import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth/session";
import { loadEstimate } from "@/lib/estimate/repo";
import { aggregateResources, chapterBreakdown, itemTotal, itemUnitBreakdown, itemUnitPrice, recap, sum } from "@/lib/estimate/calc";
import type { ResType } from "@/lib/estimate/types";

export const dynamic = "force-dynamic";

const MONEY = '#,##0.00';
const QTY = '#,##0.000';
const THIN = { style: "thin" as const, color: { argb: "FFBFC9CA" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function header(ws: ExcelJS.Worksheet, row: number) {
  const r = ws.getRow(row);
  r.font = { bold: true };
  r.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  r.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F2F2" } };
    c.border = BORDER;
  });
}

function titleBlock(ws: ExcelJS.Worksheet, title: string, lines: string[], width: number) {
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.mergeCells(1, 1, 1, width);
  for (const l of lines) ws.addRow([l]);
  ws.addRow([]);
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.company) return new Response("Neautorizat", { status: 401 });
  const doc = await loadEstimate(Number((await params).id), user.company.id);
  if (!doc) return new Response("Devizul nu există", { status: 404 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "ConstructiiDevize.ro";
  const info = [`Ofertant: ${user.company.name}`, `Obiectiv: ${doc.projectName}`, `Deviz: ${doc.name}`];

  // ---- Deviz pe articole (formular F3 extins) ----
  const ws = wb.addWorksheet("Deviz F3", { views: [{ state: "frozen", ySplit: 5 }] });
  titleBlock(ws, "Lista cu cantitățile de lucrări (F3) — deviz pe articole", info, 11);
  ws.addRow(["Nr.", "Cod", "Denumire articol", "U.M.", "Cantitate", "Material / UM", "Manoperă / UM", "Utilaj / UM", "Transport / UM", "Preț unitar", "Valoare (lei)"]);
  header(ws, ws.rowCount);
  ws.columns = [
    { width: 7 }, { width: 12 }, { width: 55 }, { width: 8 }, { width: 12 },
    { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 16 },
  ];

  doc.chapters.forEach((ch, ci) => {
    const chRow = ws.addRow([`Cap. ${ci + 1}`, "", ch.name]);
    chRow.font = { bold: true };
    chRow.getCell(3).alignment = { wrapText: true };
    ch.items.forEach((it, ii) => {
      const u = itemUnitBreakdown(it);
      const row = ws.addRow([
        `${ci + 1}.${ii + 1}`, it.code, it.name, it.unit, it.quantity,
        u.material, u.manopera, u.utilaj, u.transport, itemUnitPrice(it), itemTotal(it),
      ]);
      row.getCell(3).alignment = { wrapText: true, vertical: "top" };
      row.getCell(5).numFmt = QTY;
      for (let c = 6; c <= 11; c++) row.getCell(c).numFmt = MONEY;
    });
    const tot = ws.addRow(["", "", `Total capitol ${ci + 1}`, "", "", "", "", "", "", "", sum(chapterBreakdown(ch))]);
    tot.font = { bold: true };
    tot.getCell(11).numFmt = MONEY;
  });

  // ---- Recapitulație ----
  const r = recap(doc);
  ws.addRow([]);
  const recapRows: [string, number][] = [
    ["Materiale", r.direct.material],
    ["Manoperă", r.direct.manopera],
    ["Utilaje", r.direct.utilaj],
    ["Transport", r.direct.transport],
    ["Total cheltuieli directe", r.directTotal],
    [`Cheltuieli indirecte ${doc.overheadPct}%`, r.overhead],
    [`Profit ${doc.profitPct}%`, r.profit],
    ["TOTAL FĂRĂ TVA", r.totalNoVat],
    [`TVA ${doc.vatPct}%`, r.vat],
    ["TOTAL CU TVA", r.total],
  ];
  ws.addRow(["", "", "RECAPITULAȚIE"]).font = { bold: true };
  for (const [label, value] of recapRows) {
    const row = ws.addRow(["", "", label, "", "", "", "", "", "", "", value]);
    row.getCell(11).numFmt = MONEY;
    if (/TOTAL/i.test(label)) row.font = { bold: true };
  }
  ws.addRow(["", "", "Total ore manoperă", "", r.laborHours]).getCell(5).numFmt = QTY;

  // ---- Liste de resurse C5–C8 ----
  const lists: [ResType, string, string][] = [
    ["material", "C5 Materiale", "Lista consumurilor de resurse materiale (C5)"],
    ["manopera", "C6 Manoperă", "Lista consumurilor cu mâna de lucru (C6)"],
    ["utilaj", "C7 Utilaje", "Lista consumurilor de ore de funcționare a utilajelor (C7)"],
    ["transport", "C8 Transport", "Lista consumurilor privind transporturile (C8)"],
  ];
  for (const [type, sheet, title] of lists) {
    const rows = aggregateResources(doc, type);
    const s = wb.addWorksheet(sheet, { views: [{ state: "frozen", ySplit: 5 }] });
    titleBlock(s, title, info, 7);
    s.addRow(["Nr.", "Cod", "Denumire resursă", "U.M.", "Cantitate", "Preț unitar (lei)", "Valoare (lei)"]);
    header(s, s.rowCount);
    s.columns = [{ width: 7 }, { width: 12 }, { width: 50 }, { width: 8 }, { width: 14 }, { width: 16 }, { width: 16 }];
    let total = 0;
    rows.forEach((x, i) => {
      const v = x.qty * x.price;
      total += v;
      const row = s.addRow([i + 1, x.code, x.name, x.unit, x.qty, x.price, v]);
      row.getCell(5).numFmt = QTY;
      row.getCell(6).numFmt = MONEY;
      row.getCell(7).numFmt = MONEY;
    });
    const t = s.addRow(["", "", "TOTAL", "", "", "", total]);
    t.font = { bold: true };
    t.getCell(7).numFmt = MONEY;
  }

  const buf = await wb.xlsx.writeBuffer();
  const safe = doc.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").slice(0, 60) || "deviz";
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
