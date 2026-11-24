import { test } from "node:test";
import assert from "node:assert/strict";
import { parseF3Text } from "../src/lib/estimate/f3";

test("Test 3 — importul F3 păstrează ordinea, codurile, denumirile, U.M. și cantitățile", () => {
  const text = [
    "Cod\tDenumire\tU.M.\tCantitate",
    "Capitolul 1 Terasamente\t\t\t",
    "TS01\tSăpătură manuală în pământ\tmc\t12,5",
    "TS02\tUmplutură compactată\tmc\t8",
    "Capitolul 2 Zidărie\t\t\t",
    "CZ01\tZidărie BCA 25 cm\tmc\t1.234,75",
  ].join("\n");
  const chapters = parseF3Text(text);
  const lines = chapters.flatMap((c) => c.lines);
  assert.deepEqual(lines.map((l) => l.code), ["TS01", "TS02", "CZ01"]);
  assert.deepEqual(lines.map((l) => l.name), ["Săpătură manuală în pământ", "Umplutură compactată", "Zidărie BCA 25 cm"]);
  assert.deepEqual(lines.map((l) => l.unit), ["mc", "mc", "mc"]);
  assert.deepEqual(lines.map((l) => l.quantity), [12.5, 8, 1234.75]);
});
