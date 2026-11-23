import "server-only";
import { randomUUID } from "node:crypto";
import { execute, query, queryOne, transaction } from "../db";
import { normKey, normUnit, similarity } from "../estimate/normalize";
import type { EstItem, EstResource, ResType } from "../estimate/types";

export type RecipeHit = { id: number; global: boolean; code: string | null; name: string; unit: string; uses: number; unitPrice: number; score: number };

type RecipeRow = { id: number; company_id: number | null; code: string | null; name: string; unit: string; uses: number };

/** Caută rețete (ale firmei + globale): FULLTEXT ca generator de candidați, apoi scor de asemănare. */
export async function searchRecipes(companyId: number, q: string, unit?: string, limit = 10): Promise<RecipeHit[]> {
  const text = q.trim();
  if (!text) return [];
  let rows = await query<RecipeRow & { rel: number }>(
    `SELECT id, company_id, code, name, unit, uses, MATCH(name, code) AGAINST (?) AS rel
       FROM recipes WHERE (company_id IS NULL OR company_id = ?) AND MATCH(name, code) AGAINST (?)
      ORDER BY rel DESC LIMIT 40`,
    [text, companyId, text],
  );
  if (!rows.length) {
    rows = await query<RecipeRow & { rel: number }>(
      `SELECT id, company_id, code, name, unit, uses, 0 AS rel FROM recipes
        WHERE (company_id IS NULL OR company_id = ?) AND (name LIKE ? OR code LIKE ?) LIMIT 40`,
      [companyId, `%${text}%`, `%${text}%`],
    );
  }
  const u = unit ? normUnit(unit) : null;
  const scored = rows.map((r) => {
    let score = Math.max(similarity(text, r.name), r.code && r.code.toLowerCase() === text.toLowerCase() ? 1 : 0);
    if (u && normUnit(r.unit) !== u) score *= 0.7;
    if (r.company_id === companyId) score += 0.02; // preferă rețetele firmei
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);
  const prices = await unitPrices(companyId, top.map((t) => t.r.id));
  return top.map(({ r, score }) => ({
    id: r.id, global: r.company_id === null, code: r.code, name: r.name, unit: r.unit, uses: r.uses,
    unitPrice: prices.get(r.id) ?? 0, score: Math.min(1, score),
  }));
}

type RRow = { recipe_id: number; resource_id: number | null; type: ResType; code: string | null; name: string; unit: string; norm: string; price: string;
  cur_price: string | null; cur_name: string | null; cur_code: string | null; cur_unit: string | null };

/** Resursele rețetelor, cu prețul curent din catalog (dacă resursa e vizibilă firmei). */
async function recipeResources(companyId: number, recipeIds: number[]): Promise<Map<number, EstResource[]>> {
  const map = new Map<number, EstResource[]>();
  if (!recipeIds.length) return map;
  const rows = await query<RRow>(
    `SELECT rr.recipe_id, rr.resource_id, rr.type, rr.code, rr.name, rr.unit, rr.norm, rr.price,
            r.price AS cur_price, r.name AS cur_name, r.code AS cur_code, r.unit AS cur_unit
       FROM recipe_resources rr
       LEFT JOIN resources r ON r.id = rr.resource_id AND (r.company_id IS NULL OR r.company_id = ?)
      WHERE rr.recipe_id IN (?) ORDER BY rr.recipe_id, rr.position`,
    [companyId, recipeIds],
  );
  for (const x of rows) {
    const list = map.get(x.recipe_id) ?? [];
    list.push({
      key: randomUUID(),
      resourceId: x.cur_price !== null ? x.resource_id : null,
      type: x.type,
      code: x.cur_code ?? x.code ?? "",
      name: x.cur_name ?? x.name,
      unit: x.cur_unit ?? x.unit,
      norm: Number(x.norm),
      price: Number(x.cur_price ?? x.price),
    });
    map.set(x.recipe_id, list);
  }
  return map;
}

async function unitPrices(companyId: number, ids: number[]): Promise<Map<number, number>> {
  const res = await recipeResources(companyId, ids);
  const out = new Map<number, number>();
  for (const [id, list] of res) out.set(id, list.reduce((s, r) => s + r.norm * r.price, 0));
  return out;
}

/** Articol gata de pus în deviz, construit dintr-o rețetă (prețuri curente). */
export async function recipeItem(companyId: number, recipeId: number, quantity = 0): Promise<EstItem | null> {
  const r = await queryOne<RecipeRow>("SELECT id, company_id, code, name, unit, uses FROM recipes WHERE id = ? AND (company_id IS NULL OR company_id = ?)", [recipeId, companyId]);
  if (!r) return null;
  const res = (await recipeResources(companyId, [r.id])).get(r.id) ?? [];
  await execute("UPDATE recipes SET uses = uses + 1 WHERE id = ?", [r.id]);
  return { key: randomUUID(), code: r.code ?? "", name: r.name, unit: r.unit, quantity, reviewNote: null, resources: res };
}

/** Salvează (sau actualizează) un articol ca rețetă a firmei sau globală. */
export async function saveRecipe(companyId: number | null, item: Pick<EstItem, "code" | "name" | "unit" | "resources">, userId: number, source: "deviz" | "manual" | "ai" | "import" = "deviz"): Promise<number> {
  const key = normKey(item.name, item.unit);
  return transaction(async (conn) => {
    const existing = await queryOne<{ id: number }>("SELECT id FROM recipes WHERE company_id <=> ? AND norm_key = ?", [companyId, key], conn);
    let id: number;
    if (existing) {
      id = existing.id;
      await execute("UPDATE recipes SET code = ?, name = ?, unit = ? WHERE id = ?", [item.code || null, item.name.slice(0, 500), item.unit.slice(0, 20), id], conn);
      await execute("DELETE FROM recipe_resources WHERE recipe_id = ?", [id], conn);
    } else {
      const ins = await execute(
        "INSERT INTO recipes (company_id, code, name, unit, norm_key, source, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [companyId, item.code || null, item.name.slice(0, 500), item.unit.slice(0, 20), key, source, userId],
        conn,
      );
      id = ins.insertId;
    }
    const rows = item.resources.map((r, i) => [id, i, r.resourceId, r.type, r.code || null, r.name.slice(0, 255), r.unit.slice(0, 20), r.norm, r.price]);
    if (rows.length) await execute("INSERT INTO recipe_resources (recipe_id, position, resource_id, type, code, name, unit, norm, price) VALUES ?", [rows], conn);
    return id;
  });
}

export type ImportLine = { code: string; name: string; unit: string; quantity: number };
export type MatchStatus = "exact" | "propus" | "cache" | "negasit";

/**
 * Potrivire fără AI: cod → denumire exactă → potriviri AI salvate → căutare cu scor.
 * Întoarce articolele cu resurse și o notă de verificare unde potrivirea nu e sigură.
 */
export async function matchLines(companyId: number, lines: ImportLine[]): Promise<{ item: EstItem; status: MatchStatus }[]> {
  const out: { item: EstItem; status: MatchStatus }[] = [];
  for (const line of lines) {
    const base = { key: randomUUID(), code: line.code, name: line.name, unit: line.unit, quantity: line.quantity, resources: [] as EstResource[], reviewNote: null as string | null };
    const key = normKey(line.name, line.unit);

    // 1. cod identic sau 2. denumire + U.M. identice
    const exact = await queryOne<{ id: number }>(
      `SELECT id FROM recipes WHERE (company_id IS NULL OR company_id = ?)
         AND ((? <> '' AND code = ? AND unit = ?) OR norm_key = ?)
       ORDER BY (company_id IS NULL), uses DESC LIMIT 1`,
      [companyId, line.code, line.code, line.unit, key],
    );
    if (exact) {
      const it = await recipeItem(companyId, exact.id, line.quantity);
      if (it) { out.push({ item: { ...it, code: line.code || it.code, name: line.name, quantity: line.quantity }, status: "exact" }); continue; }
    }

    // 3. potrivire AI salvată anterior (a firmei sau refolosibilă global)
    const cached = await queryOne<{ id: number; proposal: string | EstResource[] }>(
      "SELECT id, proposal FROM ai_match_cache WHERE norm_key = ? AND (company_id = ? OR company_id IS NULL) ORDER BY (company_id IS NULL) LIMIT 1",
      [key, companyId],
    );
    if (cached) {
      const res = (typeof cached.proposal === "string" ? JSON.parse(cached.proposal) : cached.proposal) as EstResource[];
      await execute("UPDATE ai_match_cache SET hits = hits + 1 WHERE id = ?", [cached.id]);
      out.push({ item: { ...base, resources: await refreshPrices(companyId, res), reviewNote: "Propus de AI anterior (din cache) — verifică normele și prețurile" }, status: "cache" });
      continue;
    }

    // 4. căutare cu scor
    const [best] = await searchRecipes(companyId, line.name, line.unit, 1);
    if (best && best.score >= 0.5 && normUnit(best.unit) === normUnit(line.unit)) {
      const it = await recipeItem(companyId, best.id, line.quantity);
      if (it) {
        const sure = best.score >= 0.9;
        out.push({
          item: { ...it, code: line.code || it.code, name: line.name, quantity: line.quantity, reviewNote: sure ? null : `Propus automat din rețeta „${best.name}” (asemănare ${Math.round(best.score * 100)}%) — verifică` },
          status: sure ? "exact" : "propus",
        });
        continue;
      }
    }
    out.push({ item: { ...base, reviewNote: "Negăsit în bază — completează resursele sau folosește AI" }, status: "negasit" });
  }
  return out;
}

/** Actualizează prețurile resurselor după catalogul curent (resursele dispărute rămân cu prețul salvat). */
export async function refreshPrices(companyId: number, res: EstResource[]): Promise<EstResource[]> {
  const ids = res.map((r) => r.resourceId).filter((x): x is number => !!x);
  const cur = ids.length
    ? await query<{ id: number; price: string; name: string; unit: string; code: string | null }>(
        "SELECT id, price, name, unit, code FROM resources WHERE id IN (?) AND (company_id IS NULL OR company_id = ?)",
        [ids, companyId],
      )
    : [];
  const m = new Map(cur.map((c) => [c.id, c]));
  return res.map((r) => {
    const c = r.resourceId ? m.get(r.resourceId) : undefined;
    return { ...r, key: randomUUID(), resourceId: c ? r.resourceId : null, price: c ? Number(c.price) : r.price, name: c?.name ?? r.name, unit: c?.unit ?? r.unit, code: c?.code ?? r.code };
  });
}
