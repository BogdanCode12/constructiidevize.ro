import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { estimateWorkbook } from "../src/lib/estimate/excel";
import { checkEstimate } from "../src/lib/estimate/checks";
import { pendingReview } from "../src/lib/estimate/review";
import { doc, item, res } from "./helpers";

const d = () => doc([
  item({ name: "Beton C20/25", reviewNote: "Propus de asistent — verifică. Nu există C20/25 în catalog.", resources: [res({ type: "material", name: "Beton", price: 400 })] }),
  item({ name: "Zidărie", reviewNote: "Rețetă nevalidată (draft) — verifică consumurile", resources: [res({ type: "material", name: "Bloc", price: 300 })] }),
  item({ name: "Tencuială", resources: [res({ type: "material", name: "Mortar", price: 30 })] }),
]);

test("Propunerile asistentului neverificate: eroare în verificator, foaia „DE VERIFICAT” prima la export", async () => {
  const p = pendingReview(d());
  assert.equal(p.length, 2);
  assert.equal(p.filter((x) => x.assistant).length, 1);
  const issues = checkEstimate(d(), {});
  assert.ok(issues.some((i) => i.level === "eroare" && i.message.startsWith("Propus de asistent, neverificat")));
  assert.ok(issues.some((i) => i.level === "atentie" && i.message.startsWith("De verificat: Rețetă nevalidată")));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await estimateWorkbook(d(), { company: "Firma", project: "P" }));
  assert.equal(wb.worksheets[0].name, "DE VERIFICAT");
  const names: string[] = [];
  wb.worksheets[0].eachRow((r) => names.push(String(r.getCell(3).value ?? "")));
  assert.ok(names.includes("Beton C20/25") && names.includes("Zidărie") && !names.includes("Tencuială"));
});

test("Fără articole de verificat, exportul nu are foaia „DE VERIFICAT”", async () => {
  const clean = doc([item({ name: "Tencuială", resources: [res({ type: "material", name: "Mortar", price: 30 })] })]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await estimateWorkbook(clean, { company: "Firma", project: "P" }));
  assert.ok(!wb.worksheets.some((w) => w.name === "DE VERIFICAT"));
});
