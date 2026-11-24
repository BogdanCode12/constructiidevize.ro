/*
 * Exportul Excel: fiecare formulă, recalculată de LibreOffice, dă exact valoarea din aplicație.
 * Se sare dacă LibreOffice (soffice) nu e instalat.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ExcelJS from "exceljs";
import { addEstimateSheets } from "../src/lib/estimate/excel";
import type { EstimateDoc } from "../src/lib/estimate/types";
import { doc, item, res } from "./helpers";

const hasSoffice = (() => { try { execFileSync("soffice", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } })();

const sample = (o: Partial<EstimateDoc> = {}) => doc([
  item({ name: "Zidărie BCA", quantity: 12.537, resources: [
    res({ type: "material", name: "BCA", unit: "mc", norm: 1, waste: 3, price: 310.517 }),
    res({ type: "manopera", name: "Zidar", unit: "ora", norm: 2.4, price: 52.33, tariffKind: "cost_salarial" }),
    res({ type: "manopera", name: "Echipă externă", unit: "ora", norm: 1.1, price: 41.7, tariffKind: "comercial" }),
    res({ type: "utilaj", name: "Malaxor", unit: "ora", norm: 0.3, price: 18.257 }),
  ] }),
  item({ name: "Săpătură gard", quantity: 9.6, qtyFormula: "30[lungime] × 0,40[lățime] × 0,80[adâncime]", resources: [
    res({ type: "manopera", name: "Muncitor", unit: "ora", norm: 3.2, price: 38.5, tariffKind: "cost_salarial" }),
    res({ type: "transport", name: "Camion", unit: "t", norm: 1.8, price: 41.9 }),
  ] }),
  item({ name: "Centrală", unit: "buc", quantity: 1, resources: [res({ type: "echipament", name: "Centrală", price: 8450.5 })] }),
], o);

async function diffs(d: EstimateDoc) {
  const wb = new ExcelJS.Workbook();
  addEstimateSheets(wb, d, { company: "Firma", project: "Proiect" });
  const dir = mkdtempSync(join(tmpdir(), "xl-"));
  await wb.xlsx.writeFile(join(dir, "in.xlsx"));
  execFileSync("soffice", ["--headless", "--calc", "--convert-to", "xlsx", "--outdir", join(dir, "out"), join(dir, "in.xlsx")], { stdio: "ignore" });
  const out = new ExcelJS.Workbook();
  await out.xlsx.readFile(join(dir, "out", readdirSync(join(dir, "out"))[0]));
  let n = 0;
  const bad: string[] = [];
  wb.eachSheet((ws) => ws.eachRow((row) => row.eachCell((cell) => {
    const v = cell.value as { formula?: string; result?: number } | null;
    if (!v || typeof v !== "object" || !("formula" in v)) return;
    n++;
    const o = out.getWorksheet(ws.name)!.getCell(cell.address).value as { result?: number } | number;
    const got = typeof o === "object" && o ? o.result : o;
    if (Math.abs(Number(got) - Number(v.result)) > 0.005) bad.push(`${ws.name}!${cell.address} ${v.formula}: app ${v.result}, excel ${got}`);
  })));
  return { n, bad };
}

for (const [label, o] of [
  ["rotunjire finală, indirecte din direct", {}],
  ["preț unitar rotunjit", { rounding: "pret_unitar" }],
  ["indirecte din manoperă + CAM, profit din direct", { overheadBase: "manopera", profitBase: "direct" }],
] as [string, Partial<EstimateDoc>][]) {
  test(`Excel = aplicație (${label})`, { skip: !hasSoffice && "LibreOffice nu e instalat" }, async () => {
    const { n, bad } = await diffs(sample(o));
    assert.ok(n > 50, "foile au formule");
    assert.deepEqual(bad, []);
  });
}
