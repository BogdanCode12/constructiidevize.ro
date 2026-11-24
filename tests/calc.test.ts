import { test } from "node:test";
import assert from "node:assert/strict";
import { effNorm, itemTotal, itemUnitPrice, offerUnitPriceOf, recap } from "../src/lib/estimate/calc";
import { close, doc, item, res } from "./helpers";

test("cantitate resursă = cantitate lucrare × consum × (1 + pierderi)", () => {
  const r = res({ type: "material", name: "BCA", norm: 1, waste: 3, price: 300 });
  assert.ok(close(effNorm(r), 1.03));
  const it = item({ name: "Zidărie", quantity: 10, resources: [r] });
  assert.ok(close(itemTotal(it), 10 * 1.03 * 300));
});

test("Test 2 — schimbarea prețului unui material se propagă în articol, costul direct, recapitulație și total", () => {
  const mat = res({ type: "material", name: "Beton", norm: 1.02, price: 450 });
  const lab = res({ type: "manopera", name: "Betonist", unit: "ora", norm: 2, price: 40, tariffKind: "comercial" });
  const d1 = doc([item({ name: "Beton fundații", quantity: 20, resources: [mat, lab] })]);
  const before = recap(d1);
  const d2 = doc([item({ name: "Beton fundații", quantity: 20, resources: [{ ...mat, price: 500 }, lab] })]);
  const after = recap(d2);
  const dDirect = 20 * 1.02 * 50; // 1020 lei în plus pe costul direct
  assert.ok(close(itemUnitPrice(d2.chapters[0].items[0]) - itemUnitPrice(d1.chapters[0].items[0]), 1.02 * 50));
  assert.ok(close(after.directTotal - before.directTotal, dDirect));
  assert.ok(close(after.overhead - before.overhead, dDirect * 0.1));
  assert.ok(close(after.profit - before.profit, dDirect * 1.1 * 0.05));
  assert.ok(close(after.total - before.total, dDirect * 1.1 * 1.05 * 1.21));
});

test("Test 4 — CAM se aplică doar pe manopera la cost salarial, nu pe tarife comerciale sau pe tot devizul", () => {
  const d = doc([item({
    name: "Tencuială", quantity: 100, resources: [
      res({ type: "material", name: "Mortar", norm: 0.02, price: 400 }),
      res({ type: "manopera", name: "Tencuitor (angajat)", unit: "ora", norm: 0.5, price: 40, tariffKind: "cost_salarial" }),
      res({ type: "manopera", name: "Echipă externă", unit: "ora", norm: 0.2, price: 60, tariffKind: "comercial" }),
      res({ type: "manopera", name: "Necunoscut", unit: "ora", norm: 0.1, price: 50 }),
    ],
  })]);
  const r = recap(d);
  assert.ok(close(r.camBase, 100 * 0.5 * 40), "baza CAM = doar manopera la cost salarial");
  assert.ok(close(r.cam, 2000 * 0.0225));
  assert.ok(close(r.directTotal, r.direct.material + r.direct.manopera + r.direct.utilaj + r.direct.transport + r.cam));
});

test("recapitulație: bazele indirectelor și ale profitului, echipamente fără indirecte/profit", () => {
  const items = [item({ name: "A", quantity: 1, resources: [
    res({ type: "material", name: "M", price: 1000 }), res({ type: "manopera", name: "L", unit: "ora", price: 200, tariffKind: "cost_salarial" }),
    res({ type: "echipament", name: "Centrală", price: 5000 }),
  ] })];
  const a = recap(doc(items));
  const direct = 1000 + 200 + 4.5;
  assert.ok(close(a.directTotal, direct));
  assert.ok(close(a.overhead, direct * 0.1));
  assert.ok(close(a.profit, direct * 1.1 * 0.05));
  assert.ok(close(a.totalNoVat, direct * 1.1 * 1.05 + 5000));
  const b = recap(doc(items, { overheadBase: "manopera", profitBase: "direct" }));
  assert.ok(close(b.overhead, (200 + 4.5) * 0.1));
  assert.ok(close(b.profit, direct * 0.05));
});

test("rotunjire „preț unitar”: prețurile pe categorii rotunjite la 2 zecimale, fără rotunjiri repetate în modul final", () => {
  const it = item({ name: "A", quantity: 3, resources: [res({ type: "material", name: "M", norm: 1, price: 10.005 }), res({ type: "material", name: "N", norm: 1, price: 0.0049 })] });
  assert.ok(close(itemUnitPrice(it, "final"), 10.0099));
  assert.equal(itemUnitPrice(it, "pret_unitar"), 10.01);
  assert.equal(itemTotal(it, "pret_unitar"), 30.03);
});

test("prețul unitar de ofertă (situații de lucrări) = recapitulația aplicată pe prețul unitar", () => {
  const it = item({ name: "A", quantity: 7, resources: [res({ type: "material", name: "M", price: 100 }), res({ type: "manopera", name: "L", unit: "ora", price: 50, tariffKind: "cost_salarial" })] });
  const d = doc([it]);
  assert.ok(close(offerUnitPriceOf(it, d) * 7, recap(d).totalNoVat, 1e-6));
});
