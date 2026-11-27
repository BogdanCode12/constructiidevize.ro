import "server-only";
import { pendingReview } from "./review";
import ExcelJS from "exceljs";
import {
  aggregateResources, chapterBreakdown, chapterCamBase, chapterRecap, effNorm, itemCamBase, itemCamUnit, itemUnitBreakdown, itemValueBreakdown,
  recap, sum, type Recap,
} from "./calc";
import { RES_TYPE_LABEL, RES_TYPES, type EstimateDoc, type ResType } from "./types";
import { evalFormula } from "./formula";

/*
 * Export Excel cu formule verificabile:
 *   Analize (consum × (1 + pierderi) × preț) → F3 (cantitate × preț unitar) → F2 / Recapitulație (sume, procente editabile).
 * Fiecare formulă are și rezultatul precalculat, ca fișierul să arate corect și fără recalculare.
 */

const MONEY = "#,##0.00";
const QTY = "#,##0.000";
const PCT = '0.00"%"';
const THIN = { style: "thin" as const, color: { argb: "FFBFC9CA" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE6F2F2" } };

type F = { formula: string; result: number };
const f = (formula: string, result: number): F => ({ formula, result: Number.isFinite(result) ? result : 0 });

function headerRow(ws: ExcelJS.Worksheet, values: string[]) {
  const r = ws.addRow(values);
  r.font = { bold: true };
  r.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  r.eachCell((c) => {
    c.fill = FILL;
    c.border = BORDER;
  });
  return r;
}

function titleBlock(ws: ExcelJS.Worksheet, title: string, lines: string[], width: number) {
  ws.addRow([title]).font = { bold: true, size: 13 };
  ws.mergeCells(ws.rowCount, 1, ws.rowCount, width);
  for (const l of lines) ws.addRow([l]);
  ws.addRow([]);
}

function fmt(row: ExcelJS.Row, cols: number[], numFmt: string) {
  for (const c of cols) row.getCell(c).numFmt = numFmt;
}

const COLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ref = (sheet: string, col: number, row: number) => `'${sheet}'!${COLS[col - 1]}${row}`;

export type WorkbookInfo = { company: string; project: string };

/** Adaugă în workbook toate foile unui deviz. Întoarce celula cu totalul fără TVA (pentru F1). */
export function addEstimateSheets(wb: ExcelJS.Workbook, doc: EstimateDoc, info: WorkbookInfo) {
  const lines = [`Ofertant: ${info.company}`, `Obiectiv: ${info.project}`, `Obiect / deviz: ${doc.name}`];
  const r = recap(doc);
  const mode = doc.rounding;
  const PU = mode === "pret_unitar";
  /** În modul „preț unitar rotunjit”, formulele se rotunjesc la 2 zecimale exact ca în aplicație. */
  const rnd = (expr: string) => (PU ? `ROUND(${expr},2)` : expr);

  // Foile se creează în ordinea finală și se completează după.
  const f2 = wb.addWorksheet("F2");
  const f3 = wb.addWorksheet("F3", { views: [{ state: "frozen", ySplit: 5 }] });
  const an = wb.addWorksheet("Analize");
  const rc = wb.addWorksheet("Recapitulatie");

  // ---------- Analize de preț ----------
  titleBlock(an, "Analize de preț pe articole (consum × (1 + pierderi) × preț unitar)", lines, 9);
  an.columns = [{ width: 14 }, { width: 12 }, { width: 50 }, { width: 8 }, { width: 12 }, { width: 10 }, { width: 13 }, { width: 14 }, { width: 9 }];
  const unitRefs = new Map<string, Record<ResType, string>>();
  const camRefs = new Map<string, string>();

  doc.chapters.forEach((ch, ci) =>
    ch.items.forEach((it, ii) => {
      const nr = `${ci + 1}.${ii + 1}`;
      const t = an.addRow([`Art. ${nr}`, it.code, `${it.name} (${it.unit})`]);
      t.font = { bold: true };
      headerRow(an, ["Tip", "Cod", "Resursă", "U.M.", "Consum", "Pierderi %", "Preț unitar", "Valoare / U.M.", "Bază CAM"]);
      const first = an.rowCount + 1;
      for (const res of it.resources) {
        const row = an.addRow([RES_TYPE_LABEL[res.type], res.code, res.name, res.unit, res.norm, res.waste || 0, res.price, null,
          res.type === "manopera" && res.tariffKind === "cost_salarial" ? 1 : 0]);
        row.getCell(8).value = f(`E${row.number}*(1+F${row.number}/100)*G${row.number}`, effNorm(res) * res.price);
        fmt(row, [5], QTY);
        fmt(row, [7, 8], MONEY);
      }
      const last = Math.max(first, an.rowCount);
      const ub = itemUnitBreakdown(it);
      const refs = {} as Record<ResType, string>;
      const totalRows: number[] = [];
      for (const type of RES_TYPES) {
        const row = an.addRow(["", "", `Total ${RES_TYPE_LABEL[type].toLowerCase()}`]);
        row.getCell(8).value = f(`SUMIF(A${first}:A${last},"${RES_TYPE_LABEL[type]}",H${first}:H${last})`, ub[type]);
        fmt(row, [8], MONEY);
        refs[type] = ref("Analize", 8, row.number);
        totalRows.push(row.number);
      }
      const tot = an.addRow(["", "", "Preț unitar articol"]);
      tot.getCell(8).value = f(`SUM(H${totalRows[0]}:H${totalRows[totalRows.length - 1]})`, sum(ub));
      tot.font = { bold: true };
      fmt(tot, [8], MONEY);
      const camRow = an.addRow(["", "", "Manoperă la cost salarial (bază CAM / U.M.)"]);
      camRow.getCell(8).value = f(`SUMIF(I${first}:I${last},1,H${first}:H${last})`, itemCamUnit(it));
      fmt(camRow, [8], MONEY);
      camRow.font = { italic: true };
      an.addRow([]);
      unitRefs.set(it.key, refs);
      camRefs.set(it.key, ref("Analize", 8, camRow.number));
    }),
  );

  // ---------- Recapitulație (procente editabile) ----------
  titleBlock(rc, "Recapitulație", lines, 3);
  rc.columns = [{ width: 44 }, { width: 12 }, { width: 18 }];
  const pctRow = (label: string, value: number) => {
    const row = rc.addRow([label, value]);
    row.getCell(2).numFmt = PCT;
    row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4D6" } };
    return `'Recapitulatie'!$B$${row.number}`;
  };
  const camPct = pctRow("CAM (% din manopera la cost salarial) — editabil", doc.camPct);
  const indPct = pctRow(`Cheltuieli indirecte (${doc.overheadBase === "manopera" ? "% din manoperă + CAM" : "% din direct C+M"}) — editabil`, doc.overheadPct);
  const profPct = pctRow(`Profit (${doc.profitBase === "direct" ? "% din direct" : "% din direct + indirecte"}) — editabil`, doc.profitPct);
  const vatPct = pctRow("TVA (%) — editabil", doc.vatPct);
  rc.addRow([]);

  // ---------- F3: lista cantităților de lucrări ----------
  titleBlock(f3, "Formular F3 — Lista cu cantitățile de lucrări (cost direct pe articole)", lines, 19);
  headerRow(f3, [
    "Nr.", "Cod", "Denumire articol", "U.M.", "Cantitate",
    "Material / UM", "Manoperă / UM", "Utilaj / UM", "Transport / UM", "Echipament / UM", "Preț unitar", "Valoare",
    "Val. material", "Val. manoperă", "Val. utilaj", "Val. transport", "Val. echipament", "Bază CAM (manoperă cost salarial)",
    "Calculul cantității (sursă, ipoteze)",
  ]);
  f3.columns = [
    { width: 7 }, { width: 11 }, { width: 50 }, { width: 7 }, { width: 11 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 15 },
    { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 15 }, { width: 48 },
  ];
  const subRows: number[] = [];
  doc.chapters.forEach((ch, ci) => {
    const h = f3.addRow([`Cap. ${ci + 1}`, "", ch.name]);
    h.font = { bold: true };
    const first = f3.rowCount + 1;
    ch.items.forEach((it, ii) => {
      const ub = itemUnitBreakdown(it, mode);
      const vb = itemValueBreakdown(it, mode);
      const refs = unitRefs.get(it.key)!;
      const row = f3.addRow([`${ci + 1}.${ii + 1}`, it.code, it.name, it.unit, it.quantity]);
      const n = row.number;
      // Cantitatea calculată dintr-o formulă se scrie ca formulă Excel (verificabilă), cu sursa dimensiunilor alături.
      const fr = it.qtyFormula ? evalFormula(it.qtyFormula) : null;
      if (fr?.ok) row.getCell(5).value = f(fr.excel, it.quantity);
      const how = [
        fr?.ok ? `${fr.pretty} = ${it.quantity} ${it.unit}` : "",
        fr?.ok ? fr.dims.filter((d) => d.label).map((d) => `${d.value} = ${d.label}`).join("; ") : "",
        it.qtyNote ?? "",
        it.qtyEstimated ? "CANTITATE ESTIMATĂ — necesită verificare" : "",
      ].filter(Boolean).join(" · ");
      if (how) {
        row.getCell(19).value = how;
        row.getCell(19).alignment = { wrapText: true, vertical: "top" };
      }
      RES_TYPES.forEach((type, k) => (row.getCell(6 + k).value = f(rnd(refs[type]), ub[type])));
      row.getCell(11).value = f(`SUM(F${n}:J${n})`, sum(ub));
      row.getCell(12).value = f(`SUM(M${n}:Q${n})`, sum(vb));
      RES_TYPES.forEach((type, k) => (row.getCell(13 + k).value = f(rnd(`E${n}*${COLS[5 + k]}${n}`), vb[type])));
      row.getCell(18).value = f(rnd(`E${n}*${camRefs.get(it.key)}`), itemCamBase(it, mode));
      row.getCell(3).alignment = { wrapText: true, vertical: "top" };
      fmt(row, [5], QTY);
      fmt(row, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], MONEY);
    });
    const last = Math.max(first, f3.rowCount);
    const b = chapterBreakdown(ch, mode);
    const st = f3.addRow(["", "", `Total capitol ${ci + 1}`]);
    st.getCell(12).value = f(`SUM(L${first}:L${last})`, sum(b));
    RES_TYPES.forEach((type, k) => (st.getCell(13 + k).value = f(`SUM(${COLS[12 + k]}${first}:${COLS[12 + k]}${last})`, b[type])));
    st.getCell(18).value = f(`SUM(R${first}:R${last})`, chapterCamBase(ch, mode));
    st.font = { bold: true };
    fmt(st, [12, 13, 14, 15, 16, 17, 18], MONEY);
    subRows.push(st.number);
  });
  const sumOf = (col: number) => (subRows.length ? subRows.map((n) => `'F3'!${COLS[col - 1]}${n}`).join("+") : "0");

  // ---------- Recapitulație: valori ----------
  const lineRow = (label: string, formula: string, result: number, bold = false) => {
    const row = rc.addRow([label, "", f(formula, result)]);
    row.getCell(3).numFmt = MONEY;
    if (bold) row.font = { bold: true };
    return `'Recapitulatie'!C${row.number}`;
  };
  const mat = lineRow("Materiale", sumOf(13), r.direct.material);
  const man = lineRow("Manoperă", sumOf(14), r.direct.manopera);
  const camB = lineRow("   bază CAM: manopera la cost salarial", sumOf(18), r.camBase);
  const cam = lineRow("CAM — contribuția asiguratorie pentru muncă", rnd(`${camB}*${camPct}/100`), r.cam);
  const utl = lineRow("Utilaje", sumOf(15), r.direct.utilaj);
  const trs = lineRow("Transport", sumOf(16), r.direct.transport);
  const dir = lineRow("Total cheltuieli directe C+M", `${mat}+${man}+${cam}+${utl}+${trs}`, r.directTotal, true);
  const ind = lineRow("Cheltuieli indirecte", rnd(`${doc.overheadBase === "manopera" ? `(${man}+${cam})` : dir}*${indPct}/100`), r.overhead);
  const prof = lineRow("Profit", rnd(`${doc.profitBase === "direct" ? dir : `(${dir}+${ind})`}*${profPct}/100`), r.profit);
  const cm = lineRow("Valoare construcții-montaj", `${dir}+${ind}+${prof}`, r.cmTotal, true);
  const ech = lineRow("Echipamente tehnologice (fără indirecte și profit)", sumOf(17), r.equipment);
  const tnv = lineRow("TOTAL FĂRĂ TVA", `${cm}+${ech}`, r.totalNoVat, true);
  const tva = lineRow("TVA", rnd(`${tnv}*${vatPct}/100`), r.vat);
  const ttl = lineRow("TOTAL CU TVA", `${tnv}+${tva}`, r.total, true);
  rc.addRow([]);
  rc.addRow(["Total ore manoperă (ore-om)", "", r.laborHours]).getCell(3).numFmt = QTY;

  // ---------- F2: deviz pe obiect (pe capitole) ----------
  titleBlock(f2, "Formular F2 — Deviz pe obiect (centralizator pe capitole de lucrări)", lines, 11);
  headerRow(f2, ["Nr.", "Capitol de lucrări", "Direct C+M fără CAM", "CAM", "Direct C+M", "Echipamente", "Indirecte", "Profit", "Total fără TVA", "TVA", "Total cu TVA"]);
  f2.columns = [{ width: 7 }, { width: 42 }, { width: 15 }, { width: 12 }, { width: 15 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 16 }];
  const f2first = f2.rowCount + 1;
  const chRecaps = doc.chapters.map((ch) => chapterRecap(ch, doc));
  doc.chapters.forEach((ch, ci) => {
    const cr = chRecaps[ci];
    const row = f2.addRow([ci + 1, ch.name]);
    const n = row.number;
    const st = subRows[ci];
    row.getCell(3).value = f(`'F3'!L${st}-'F3'!Q${st}`, cr.directTotal - cr.cam);
    row.getCell(4).value = f(rnd(`'F3'!R${st}*${camPct}/100`), cr.cam);
    row.getCell(5).value = f(`C${n}+D${n}`, cr.directTotal);
    row.getCell(6).value = f(`'F3'!Q${st}`, cr.equipment);
    row.getCell(7).value = f(rnd(`${doc.overheadBase === "manopera" ? `('F3'!N${st}+D${n})` : `E${n}`}*${indPct}/100`), cr.overhead);
    row.getCell(8).value = f(rnd(`${doc.profitBase === "direct" ? `E${n}` : `(E${n}+G${n})`}*${profPct}/100`), cr.profit);
    row.getCell(9).value = f(`E${n}+F${n}+G${n}+H${n}`, cr.totalNoVat);
    row.getCell(10).value = f(rnd(`I${n}*${vatPct}/100`), cr.vat);
    row.getCell(11).value = f(`I${n}+J${n}`, cr.total);
    fmt(row, [3, 4, 5, 6, 7, 8, 9, 10, 11], MONEY);
  });
  const f2last = Math.max(f2first, f2.rowCount);
  const f2tot = f2.addRow(["", "TOTAL OBIECT"]);
  const tsum = (k: (x: Recap) => number) => chRecaps.reduce((acc, x) => acc + k(x), 0);
  const totals = [
    tsum((x) => x.directTotal - x.cam), tsum((x) => x.cam), tsum((x) => x.directTotal), tsum((x) => x.equipment),
    tsum((x) => x.overhead), tsum((x) => x.profit), tsum((x) => x.totalNoVat), tsum((x) => x.vat), tsum((x) => x.total),
  ];
  for (let c = 3; c <= 11; c++) f2tot.getCell(c).value = f(`SUM(${COLS[c - 1]}${f2first}:${COLS[c - 1]}${f2last})`, totals[c - 3]);
  f2tot.font = { bold: true };
  fmt(f2tot, [3, 4, 5, 6, 7, 8, 9, 10, 11], MONEY);
  if (PU) f2.addRow(["", "Rotunjirile pe capitole pot face ca totalul F2 să difere cu câțiva bani de Recapitulație (calculată pe total)."]);

  // ---------- C5–C9: liste de consumuri ----------
  const lists: [ResType, string, string][] = [
    ["material", "C5", "Formular C5 — Lista consumurilor de resurse materiale"],
    ["manopera", "C6", "Formular C6 — Lista consumurilor cu mâna de lucru"],
    ["utilaj", "C7", "Formular C7 — Lista consumurilor de ore de funcționare a utilajelor de construcții"],
    ["transport", "C8", "Formular C8 — Lista consumurilor privind transporturile"],
    ["echipament", "C9", "Formular C9 — Lista cuprinzând cantitățile de utilaje și echipamente tehnologice"],
  ];
  for (const [type, name, title] of lists) {
    const rows = aggregateResources(doc, type);
    const s = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 5 }] });
    titleBlock(s, title, lines, 7);
    headerRow(s, ["Nr.", "Cod", "Denumire resursă", "U.M.", "Cantitate totală", "Preț unitar", "Valoare"]);
    s.columns = [{ width: 7 }, { width: 12 }, { width: 50 }, { width: 8 }, { width: 15 }, { width: 14 }, { width: 16 }];
    const first = s.rowCount + 1;
    let total = 0;
    rows.forEach((x, i) => {
      const v = x.qty * x.price;
      total += v;
      const row = s.addRow([i + 1, x.code, x.name, x.unit, x.qty, x.price]);
      row.getCell(7).value = f(`E${row.number}*F${row.number}`, v);
      fmt(row, [5], QTY);
      fmt(row, [6, 7], MONEY);
    });
    const last = Math.max(first, s.rowCount);
    const t = s.addRow(["", "", "TOTAL"]);
    t.getCell(7).value = f(rows.length ? `SUM(G${first}:G${last})` : "0", total);
    t.font = { bold: true };
    t.getCell(7).numFmt = MONEY;
    if (!rows.length) s.addRow(["", "", "Nu există resurse de acest tip în deviz."]);
  }

  // ---------- F4 / F5: utilaje și echipamente tehnologice ----------
  const eq = aggregateResources(doc, "echipament");
  const f4 = wb.addWorksheet("F4");
  titleBlock(f4, "Formular F4 — Lista cuprinzând cantitățile de utilaje și echipamente tehnologice, inclusiv dotări", lines, 8);
  headerRow(f4, ["Nr.", "Denumire", "U.M.", "Cantitate", "Preț unitar", "Valoare", "Furnizor", "Fișa tehnică"]);
  f4.columns = [{ width: 7 }, { width: 46 }, { width: 8 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 22 }, { width: 14 }];
  const f4first = f4.rowCount + 1;
  eq.forEach((x, i) => {
    const row = f4.addRow([i + 1, x.name, x.unit, x.qty, x.price]);
    row.getCell(6).value = f(`D${row.number}*E${row.number}`, x.qty * x.price);
    row.getCell(8).value = `F5 nr. ${i + 1}`;
    fmt(row, [4], QTY);
    fmt(row, [5, 6], MONEY);
  });
  const f4t = f4.addRow(["", "TOTAL"]);
  f4t.getCell(6).value = f(eq.length ? `SUM(F${f4first}:F${f4.rowCount - 1})` : "0", r.equipment);
  f4t.font = { bold: true };
  f4t.getCell(6).numFmt = MONEY;

  const f5 = wb.addWorksheet("F5");
  titleBlock(f5, "Formular F5 — Fișa tehnică a utilajului / echipamentului tehnologic", lines, 3);
  f5.columns = [{ width: 6 }, { width: 50 }, { width: 50 }];
  if (!eq.length) f5.addRow(["", "Nu există echipamente tehnologice în deviz."]);
  eq.forEach((x, i) => {
    f5.addRow([`${i + 1}.`, `Utilaj / echipament: ${x.name}`]).font = { bold: true };
    headerRow(f5, ["", "Specificații tehnice impuse prin caietul de sarcini", "Corespondența propunerii tehnice cu specificațiile"]);
    for (const label of [
      "Parametri tehnici și funcționali",
      "Specificații de performanță și condiții privind siguranța în exploatare",
      "Condiții privind conformitatea cu standardele relevante",
      "Condiții de garanție și postgaranție",
      "Alte condiții cu caracter tehnic",
    ]) {
      const row = f5.addRow(["", label, ""]);
      row.height = 30;
      row.eachCell((c) => (c.border = BORDER));
    }
    f5.addRow([]);
  });

  return { totalNoVatRef: tnv, totalRef: ttl, r };
}

export async function estimateWorkbook(doc: EstimateDoc, info: WorkbookInfo): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DevizConstruct.ro";
  // Articolele încă neverificate apar pe prima foaie, ca să nu ajungă în ofertă din greșeală.
  const pending = pendingReview(doc);
  if (pending.length) {
    const ws = wb.addWorksheet("DE VERIFICAT", { properties: { tabColor: { argb: "FFC71319" } } });
    titleBlock(ws, "Articole de verificat înainte de depunere", [
      `${pending.length} articole au note de verificare${pending.some((p) => p.assistant) ? ", dintre care unele propuse de asistent" : ""}.`,
      "Confirmă-le în platformă („✓ Am verificat”) și exportă din nou. Șterge această foaie înainte de depunere.",
    ], 5);
    headerRow(ws, ["Nr. art.", "Cod", "Denumire", "U.M.", "De verificat"]);
    ws.columns = [{ width: 9 }, { width: 14 }, { width: 50 }, { width: 8 }, { width: 70 }];
    for (const p of pending) {
      const row = ws.addRow([p.where, p.code, p.name, p.unit, p.note]);
      row.getCell(5).alignment = { wrapText: true, vertical: "top" };
      row.getCell(3).alignment = { wrapText: true, vertical: "top" };
      if (p.assistant) row.getCell(1).font = { bold: true, color: { argb: "FFC71319" } };
    }
  }
  addEstimateSheets(wb, doc, info);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** F1 — centralizatorul obiectivului (proiectului): un rând pe fiecare deviz / obiect. */
export async function projectWorkbook(docs: EstimateDoc[], info: WorkbookInfo): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DevizConstruct.ro";
  const ws = wb.addWorksheet("F1");
  titleBlock(ws, "Formular F1 — Centralizatorul cheltuielilor pe obiectiv", [`Ofertant: ${info.company}`, `Obiectiv: ${info.project}`], 6);
  headerRow(ws, ["Nr.", "Obiect / deviz", "Valoare C+M", "Echipamente", "Total fără TVA", "TVA", "Total cu TVA"]);
  ws.columns = [{ width: 7 }, { width: 46 }, { width: 16 }, { width: 15 }, { width: 17 }, { width: 15 }, { width: 17 }];
  const first = ws.rowCount + 1;
  docs.forEach((d, i) => {
    const r = recap(d);
    const row = ws.addRow([i + 1, d.name, r.cmTotal, r.equipment, null, r.vat]);
    row.getCell(5).value = f(`C${row.number}+D${row.number}`, r.totalNoVat);
    row.getCell(7).value = f(`E${row.number}+F${row.number}`, r.total);
    fmt(row, [3, 4, 5, 6, 7], MONEY);
  });
  const last = Math.max(first, ws.rowCount);
  const t = ws.addRow(["", "TOTAL OBIECTIV"]);
  const totals = docs.map(recap);
  const tv = [
    totals.reduce((s, x) => s + x.cmTotal, 0), totals.reduce((s, x) => s + x.equipment, 0),
    totals.reduce((s, x) => s + x.totalNoVat, 0), totals.reduce((s, x) => s + x.vat, 0), totals.reduce((s, x) => s + x.total, 0),
  ];
  for (let c = 3; c <= 7; c++) t.getCell(c).value = f(docs.length ? `SUM(${COLS[c - 1]}${first}:${COLS[c - 1]}${last})` : "0", tv[c - 3]);
  t.font = { bold: true };
  fmt(t, [3, 4, 5, 6, 7], MONEY);
  ws.addRow([]);
  ws.addRow(["", "Detaliile fiecărui obiect (F2, F3, C5–C9) se exportă din devizul respectiv."]);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export function safeFilename(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").slice(0, 60) || "export";
}
