/*
 * Teste cu baza de date (rulează doar cu TEST_DB=1 și DB_* setate): izolarea firmelor și refolosirea rezultatelor.
 * Își creează datele (două firme temporare, resurse, oferte, rețete) și le șterg la final.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { execute, pool, query } from "../../src/lib/db";
import { effectivePrices, getResource, listOffers, listResources } from "../../src/lib/resources/repo";
import { matchLines, searchRecipes } from "../../src/lib/recipes/repo";
import { getRecipe } from "../../src/lib/recipes/list";
import { normKey } from "../../src/lib/estimate/normalize";

const enabled = process.env.TEST_DB === "1";
const tag = `TEST-${Date.now()}`;
let A = 0, B = 0, R = 0, P = 0, recipeA = 0;

before(async () => {
  if (!enabled) return;
  A = (await execute("INSERT INTO companies (name) VALUES (?)", [`${tag} A`])).insertId;
  B = (await execute("INSERT INTO companies (name) VALUES (?)", [`${tag} B`])).insertId;
  // resursă globală cu preț de referință
  R = (await execute("INSERT INTO resources (company_id, type, name, unit, status) VALUES (NULL, 'material', ?, 'mc', 'verificat')", [`${tag} Beton global`])).insertId;
  const ref = await execute("INSERT INTO resource_prices (resource_id, company_id, supplier, price, price_ron, obtained_at, status) VALUES (?, NULL, 'Ref', 400, 400, CURDATE(), 'verificat')", [R]);
  await execute("UPDATE resources SET current_price_id = ?, price = 400 WHERE id = ?", [ref.insertId, R]);
  // prețul negociat al firmei A pe resursa globală
  await execute("INSERT INTO resource_prices (resource_id, company_id, supplier, price, price_ron, obtained_at, source) VALUES (?, ?, 'Secret A', 350, 350, CURDATE(), 'negociat')", [R, A]);
  // resursă privată a firmei B
  P = (await execute("INSERT INTO resources (company_id, type, name, unit, price) VALUES (?, 'material', ?, 'kg', 9)", [B, `${tag} Privat B`])).insertId;
  // rețetă privată a firmei A
  const r = await execute("INSERT INTO recipes (company_id, name, unit, norm_key, status) VALUES (?, ?, 'mc', ?, 'verificat')", [A, `${tag} Zidărie secretă A`, normKey(`${tag} Zidărie secretă A`, "mc")]);
  recipeA = r.insertId;
  await execute("INSERT INTO recipe_resources (recipe_id, position, resource_id, type, name, unit, norm, price) VALUES (?, 0, ?, 'material', 'Beton', 'mc', 1, 350)", [recipeA, R]);
});

after(async () => {
  if (!enabled) return;
  await execute("DELETE FROM ai_match_cache WHERE company_id IN (?, ?)", [A, B]);
  await execute("DELETE FROM recipes WHERE company_id IN (?, ?)", [A, B]);
  await execute("DELETE FROM resources WHERE id = ?", [R]);
  await execute("DELETE FROM companies WHERE id IN (?, ?)", [A, B]);
  await pool().end();
});

test("Test 8 — prețul negociat al firmei A nu e vizibil firmei B (listă, ofertă, preț aplicabil)", { skip: !enabled }, async () => {
  const la = (await listResources({ companyId: A, includeGlobal: true, q: tag })).find((r) => r.id === R);
  const lb = (await listResources({ companyId: B, includeGlobal: true, q: tag })).find((r) => r.id === R);
  assert.equal(la?.price, 350);
  assert.equal(la?.priceInfo?.kind, "propriu");
  assert.equal(lb?.price, 400);
  assert.equal(lb?.priceInfo?.kind, "referinta");
  const offersB = await listOffers(R, B);
  assert.ok(!offersB.some((o) => o.supplier === "Secret A"), "oferta privată a firmei A nu apare la B");
  assert.equal((await effectivePrices(B, [R])).get(R)?.price, 400);
  // adminul (companyId null) vede doar ofertele globale
  assert.ok(!(await listOffers(R, null)).some((o) => o.supplier === "Secret A"));
});

test("Test 8 — resursele și rețetele private nu sunt accesibile altei firme (și prin căutare)", { skip: !enabled }, async () => {
  assert.equal(await getResource(P, A), null);
  assert.equal((await effectivePrices(A, [P])).size, 0);
  assert.ok(!(await listResources({ companyId: A, includeGlobal: true, q: tag })).some((r) => r.id === P));
  assert.equal(await getRecipe(recipeA, B), null);
  assert.ok(!(await searchRecipes(B, `${tag} Zidărie secretă`)).some((r) => r.id === recipeA));
});

test("Test 8 — cache-ul de potriviri al unei firme nu e folosit de alta", { skip: !enabled }, async () => {
  const line = { code: "", name: `${tag} Lucrare din cache`, unit: "mc", quantity: 3 };
  await execute("INSERT INTO ai_match_cache (company_id, norm_key, proposal) VALUES (?, ?, ?)", [
    A, normKey(line.name, line.unit), JSON.stringify([{ key: "k", resourceId: R, type: "material", code: "", name: "Beton", unit: "mc", norm: 1.1, price: 0 }]),
  ]);
  const [b] = await matchLines(B, [line]);
  assert.notEqual(b.status, "cache");
});

test("Test 7 — același deviz a doua oară: potrivirile se refolosesc din bază, fără apeluri la asistent", { skip: !enabled }, async () => {
  const saved = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, AI_MOCK: process.env.AI_MOCK };
  delete process.env.ANTHROPIC_API_KEY; // dacă s-ar încerca un apel la asistent, ar eșua
  delete process.env.AI_MOCK;
  try {
    const lines = [
      { code: "", name: `${tag} Lucrare din cache`, unit: "mc", quantity: 3 },
      { code: "", name: `${tag} Zidărie secretă A`, unit: "mc", quantity: 10 },
    ];
    const first = await matchLines(A, lines);
    const second = await matchLines(A, lines);
    assert.deepEqual(first.map((x) => x.status), ["cache", "exact"]);
    assert.deepEqual(second.map((x) => x.status), ["cache", "exact"]);
    assert.equal(second[0].item.resources[0].price, 350, "prețul din cache e actualizat la prețul aplicabil firmei");
    const [hits] = await query<{ hits: number }>("SELECT hits FROM ai_match_cache WHERE company_id = ? AND norm_key = ?", [A, normKey(lines[0].name, "mc")]);
    assert.equal(hits.hits, 2);
  } finally {
    Object.assign(process.env, Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== undefined)));
  }
});
