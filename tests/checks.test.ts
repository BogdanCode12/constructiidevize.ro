import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEstimate, type CheckContext } from "../src/lib/estimate/checks";
import { doc, item, res } from "./helpers";
import type { EstimateDoc } from "../src/lib/estimate/types";

const find = (d: EstimateDoc, ctx: CheckContext, re: RegExp) => checkEstimate(d, ctx).find((x) => re.test(x.message));
const lab = () => res({ type: "manopera", name: "M", unit: "ora", price: 40, tariffKind: "comercial" });

test("Test 5 — preț expirat: atenționare, iar prețul din deviz rămâne cel inițial", () => {
  const mat = res({ type: "material", name: "Beton", price: 480, offerId: 5 });
  const d = doc([item({ name: "Beton", resources: [mat, lab()] })]);
  const i = find(d, { offers: { 5: { expired: true, status: "verificat", transportIncluded: null, validUntil: "2026-11-01" } } }, /expirat/);
  assert.equal(i?.level, "atentie");
  assert.equal(d.chapters[0].items[0].resources[0].price, 480);
});

test("Test 6 — transport dublat: material cu transport inclus + transport separat în articol", () => {
  const d = doc([item({ name: "Pietriș", resources: [res({ type: "material", name: "Pietriș", price: 90, offerId: 7 }), res({ type: "transport", name: "Camion", unit: "t", price: 20 }), lab()] })]);
  const i = find(d, { offers: { 7: { expired: false, status: "verificat", transportIncluded: true, validUntil: null } } }, /transport dublat/);
  assert.equal(i?.level, "atentie");
});

test("Test 4 — CAM adăugat manual ca resursă e semnalat (dublă includere)", () => {
  const d = doc([item({ name: "Zidărie", resources: [res({ type: "material", name: "BCA", price: 1 }), res({ type: "manopera", name: "CAM 2,25%", unit: "ora", price: 1, tariffKind: "comercial" })] })]);
  assert.equal(find(d, {}, /CAM adăugat/)?.level, "eroare");
});

test("Test 3 — diferențe față de F3: cantitate și U.M. = erori, denumire modificată = atenționare", () => {
  const d = doc([item({ name: "Săpătură mecanizată", unit: "mp", quantity: 12, f3: { code: "S1", name: "Săpătură", unit: "mc", quantity: 10 }, code: "S1", resources: [lab()] })]);
  assert.equal(find(d, {}, /Cantitatea diferă de F3/)?.level, "eroare");
  assert.equal(find(d, {}, /U.M. diferă de F3/)?.level, "eroare");
  assert.equal(find(d, {}, /Denumirea a fost modificată/)?.level, "atentie");
});

test("trei niveluri și deviz curat fără erori/atenționări", () => {
  const clean = doc([item({ name: "Tencuială", resources: [res({ type: "material", name: "Mortar", resourceId: 1, offerId: 9, price: 5 }), res({ type: "manopera", name: "T", unit: "ora", price: 40, tariffKind: "cost_salarial" })] })]);
  const issues = checkEstimate(clean, { offers: { 9: { expired: false, status: "verificat", transportIncluded: false, validUntil: null } }, rules: { vatPct: 21, camPct: 2.25 } });
  assert.deepEqual(issues.filter((x) => x.level !== "info"), []);
  const bad = checkEstimate(doc([item({ name: "X", quantity: 0, resources: [] })], { vatPct: 19 }), { rules: { vatPct: 21, camPct: 2.25 } });
  assert.ok(bad.some((x) => x.level === "eroare"));
  assert.ok(bad.some((x) => x.level === "atentie" && /cota standard/.test(x.message)));
});
