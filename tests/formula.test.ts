import { test } from "node:test";
import assert from "node:assert/strict";
import { evalFormula } from "../src/lib/estimate/formula";

test("Test 1 — cantitate geometrică: gard 30 × 0,40 × 0,80 = 9,60 mc, cu sursa dimensiunilor", () => {
  const r = evalFormula("30[lungime gard] × 0,40[lățime] × 0,80[adâncime]");
  assert.ok(r.ok);
  assert.equal(r.value, 9.6);
  assert.deepEqual(r.dims.map((d) => d.label), ["lungime gard", "lățime", "adâncime"]);
  assert.equal(r.excel, "30*0.40*0.80");
});

test("formula: operatori, paranteze, zecimale românești", () => {
  const cases: [string, number][] = [["2 x (3,5 + 4,25) - 1", 14.5], ["1.234,5 / 2", 617.25], ["(10 + 2) * 3 / 4", 9], ["-5 + 10", 5]];
  for (const [f, v] of cases) {
    const r = evalFormula(f);
    assert.ok(r.ok, f);
    assert.equal(r.value, v, f);
  }
});

test("formula: refuză intrări nevalide (fără evaluare de cod)", () => {
  for (const f of ["", "5 / 0", "3 +", "2 * (3 + 4", "alert(1)", "process.exit()", "10 - 20"]) assert.equal(evalFormula(f).ok, false, f);
});
