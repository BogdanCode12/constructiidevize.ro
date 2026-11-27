/*
 * Prețuri pe zone (TEST_DB=1): ordinea propriu județ → propriu regiune → propriu național → catalog județ
 * → catalog regiune → referință națională. Își creează datele și le șterge la final.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { execute, pool } from "../../src/lib/db";
import { effectivePrices, listResources } from "../../src/lib/resources/repo";

const enabled = process.env.TEST_DB === "1";
const tag = `ZONE-${Date.now()}`;
let A = 0, R = 0, P = 0;

const offer = (resource: number, company: number | null, county: string | null, price: number, status = "neverificat", daysAgo = 0) =>
  execute(
    `INSERT INTO resource_prices (resource_id, company_id, county, supplier, price, price_ron, obtained_at, status)
     VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL ? DAY), ?)`,
    [resource, company, county, `${county ?? "RO"}-${price}`, price, price, daysAgo, status],
  );
const price = async (company: number, id: number, county?: string | null) => (await effectivePrices(company, [id], county)).get(id)?.priceInfo;

before(async () => {
  if (!enabled) return;
  A = (await execute("INSERT INTO companies (name) VALUES (?)", [`${tag} A`])).insertId;
  R = (await execute("INSERT INTO resources (company_id, type, name, unit, status) VALUES (NULL, 'material', ?, 'kg', 'verificat')", [`${tag} Oțel global`])).insertId;
  const ref = await offer(R, null, null, 5.0, "verificat", 3);
  await execute("UPDATE resources SET current_price_id = ?, price = 5.0 WHERE id = ?", [ref.insertId, R]);
  await offer(R, null, "BZ", 5.5);                 // catalog Buzău
  await offer(R, null, "GL", 5.3, "verificat");     // catalog Galați (aceeași regiune, Sud-Est)
  P = (await execute("INSERT INTO resources (company_id, type, name, unit, status) VALUES (?, 'material', ?, 'kg', 'verificat')", [A, `${tag} Privat A`])).insertId;
  const pref = await offer(P, A, null, 10, "verificat", 2);
  await execute("UPDATE resources SET current_price_id = ?, price = 10 WHERE id = ?", [pref.insertId, P]);
  await offer(P, A, "BZ", 11);
});

after(async () => {
  if (!enabled) return;
  await execute("DELETE FROM resources WHERE id IN (?, ?)", [R, P]);
  await execute("DELETE FROM companies WHERE id = ?", [A]);
  await pool().end();
});

test("Zone — catalogul: județul, apoi regiunea, apoi referința națională", { skip: !enabled }, async () => {
  assert.equal((await price(A, R))?.value, 5.0, "fără zonă: referința");
  assert.equal((await price(A, R, "BZ"))?.value, 5.5, "Buzău: oferta din Buzău");
  const br = await price(A, R, "BR");
  assert.equal(br?.value, 5.3, "Brăila (Sud-Est): oferta din regiune");
  assert.equal(br?.kind, "zona");
  assert.equal((await price(A, R, "BC"))?.value, 5.0, "Bacău (Nord-Est): referința");
});

test("Zone — prețurile firmei au prioritate, cu aceeași ordine pe zone", { skip: !enabled }, async () => {
  await offer(R, A, null, 4.8, "neverificat", 1);
  assert.equal((await price(A, R, "BZ"))?.value, 4.8, "prețul național al firmei bate catalogul din județ");
  await offer(R, A, "BZ", 4.6);
  assert.equal((await price(A, R, "BZ"))?.value, 4.6, "prețul firmei pentru Buzău");
  assert.equal((await price(A, R, "BR"))?.value, 4.6, "în Brăila: prețul firmei din regiune (Buzău)");
  assert.equal((await price(A, R, "BC"))?.value, 4.8, "în Bacău: prețul național al firmei");
  assert.equal((await price(A, R))?.value, 4.8, "fără zonă: prețul național al firmei");
  const [inList] = await listResources({ companyId: A, includeGlobal: true, q: `${tag} Oțel`, county: "BZ" });
  assert.equal(inList?.price, 4.6, "lista catalogului arată prețul zonei");
});

test("Zone — resursele proprii: oferta pe județ doar în zona ei, altfel referința aleasă", { skip: !enabled }, async () => {
  assert.equal((await price(A, P))?.value, 10);
  assert.equal((await price(A, P, "BZ"))?.value, 11);
  assert.equal((await price(A, P, "BC"))?.value, 10);
});
