import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCounty, regionCounties, COUNTIES, priceOriginLabel } from "../src/lib/counties";

test("Zone — județe recunoscute după nume sau cod, regiuni corecte", () => {
  assert.equal(parseCounty("Buzău"), "BZ");
  assert.equal(parseCounty("JUD. BUZAU"), "BZ");
  assert.equal(parseCounty("Municipiul București"), "B");
  assert.equal(parseCounty("bc"), "BC");
  assert.equal(parseCounty("Satu Mare"), "SM");
  assert.equal(parseCounty("Necunoscut"), null);
  assert.deepEqual(regionCounties("BZ").sort(), ["BR", "BZ", "CT", "GL", "TL", "VN"]);
  assert.equal(COUNTIES.length, 42);
  assert.equal(new Set(COUNTIES.map((c) => c.code)).size, 42);
  assert.equal(priceOriginLabel({ kind: "propriu", county: "BZ" }), "prețul tău · Buzău");
  assert.equal(priceOriginLabel({ kind: "referinta", county: null }), "referință națională");
});

