import "server-only";
import { effectivePrices } from "../resources/repo";
import { randomUUID } from "node:crypto";
import { execute, query, queryOne, transaction } from "../db";
import { normKey, normUnit, similarity } from "../estimate/normalize";
import { effNorm } from "../estimate/calc";
import type { EstItem, EstResource, ResType, TariffKind } from "../estimate/types";

export type RecipeStatus = "draft" | "verificat" | "depasit";
export type RecipeHit = { id: number; global: boolean; code: string | null; name: string; unit: string; uses: number; unitPrice: number; score: number; status: RecipeStatus };

type RecipeRow = { id: number; company_id: number | null; code: string | null; name: string; unit: string; uses: number; status: RecipeStatus };

/**
 * Rețetele folosibile la potrivire și căutare: ultima versiune, nedepășită, cu cel puțin o resursă.
 * (Articolele-schelet din draft, fără consumuri, nu se propun în deviz.)
 */
export const USABLE = `status <> 'depasit' AND superseded_by IS NULL
  AND EXISTS (SELECT 1 FROM recipe_resources x WHERE x.recipe_id = recipes.id)`;

/** Nota pusă pe articolul din deviz când rețeta folosită nu e validată. */
export const DRAFT_NOTE = "Rețetă nevalidată (draft) — verifică consumurile înainte de ofertare";

/** Caută rețete (ale firmei + globale): FULLTEXT ca generator de candidați, apoi scor de asemănare. */
export async function searchRecipes(companyId: number, q: string, unit?: string, limit = 10, county?: string | null): Promise<RecipeHit[]> {
  const text = q.trim();
  if (!text) return [];
  let rows = await query<RecipeRow & { rel: number }>(
    `SELECT id, company_id, code, name, unit, uses, status, MATCH(name, code) AGAINST (?) AS rel
       FROM recipes WHERE (company_id IS NULL OR company_id = ?) AND MATCH(name, code) AGAINST (?) AND ${USABLE}
      ORDER BY rel DESC LIMIT 40`,
    [text, companyId, text],
  );
  if (!rows.length) {
    rows = await query<RecipeRow & { rel: number }>(
      `SELECT id, company_id, code, name, unit, uses, status, 0 AS rel FROM recipes
        WHERE (company_id IS NULL OR company_id = ?) AND (name LIKE ? OR code LIKE ?) AND ${USABLE} LIMIT 40`,
      [companyId, `%${text}%`, `%${text}%`],
    );
  }
  const u = unit ? normUnit(unit) : null;
  const scored = rows.map((r) => {
    let score = Math.max(similarity(text, r.name), r.code && r.code.toLowerCase() === text.toLowerCase() ? 1 : 0);
    if (u && normUnit(r.unit) !== u) score *= 0.7;
    if (r.company_id === companyId) score += 0.02; // preferă rețetele firmei
    if (r.status === "verificat") score += 0.01; // și pe cele verificate
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);
  const prices = await unitPrices(companyId, top.map((t) => t.r.id), county);
  return top.map(({ r, score }) => ({
    id: r.id, global: r.company_id === null, code: r.code, name: r.name, unit: r.unit, uses: r.uses,
    unitPrice: prices.get(r.id) ?? 0, score: Math.min(1, score), status: r.status,
  }));
}

type RRow = { recipe_id: number; resource_id: number | null; type: ResType; code: string | null; name: string; unit: string; norm: string; waste_pct: string; price: string; tariff_kind: TariffKind | null };

/** Resursele rețetelor, cu prețul aplicabil firmei (propriu sau de referință), dacă resursa e vizibilă. */
async function recipeResources(companyId: number, recipeIds: number[], county?: string | null): Promise<Map<number, EstResource[]>> {
  const map = new Map<number, EstResource[]>();
  if (!recipeIds.length) return map;
  const rows = await query<RRow>(
    `SELECT rr.recipe_id, rr.resource_id, rr.type, rr.code, rr.name, rr.unit, rr.norm, rr.waste_pct, rr.price, rr.tariff_kind
       FROM recipe_resources rr WHERE rr.recipe_id IN (?) ORDER BY rr.recipe_id, rr.position`,
    [recipeIds],
  );
  const cur = await effectivePrices(companyId, rows.map((x) => x.resource_id).filter((x): x is number => !!x), county);
  for (const x of rows) {
    const list = map.get(x.recipe_id) ?? [];
    const c = x.resource_id ? cur.get(x.resource_id) : undefined;
    list.push({
      key: randomUUID(),
      resourceId: c ? c.id : null,
      type: x.type,
      code: c?.code ?? x.code ?? "",
      name: c?.name ?? x.name,
      unit: c?.unit ?? x.unit,
      norm: Number(x.norm),
      waste: Number(x.waste_pct),
      price: c ? (c.price ?? 0) : Number(x.price),
      tariffKind: x.type === "manopera" ? (c ? c.tariffKind : x.tariff_kind) : null,
      offerId: c?.priceInfo?.offerId ?? null,
    });
    map.set(x.recipe_id, list);
  }
  return map;
}

async function unitPrices(companyId: number, ids: number[], county?: string | null): Promise<Map<number, number>> {
  const res = await recipeResources(companyId, ids, county);
  const out = new Map<number, number>();
  for (const [id, list] of res) out.set(id, list.reduce((s, r) => s + effNorm(r) * r.price, 0));
  return out;
}

/** Articol gata de pus în deviz, construit dintr-o rețetă (prețuri curente). */
export async function recipeItem(companyId: number, recipeId: number, quantity = 0, county?: string | null): Promise<EstItem | null> {
  const r = await queryOne<RecipeRow>("SELECT id, company_id, code, name, unit, uses, status FROM recipes WHERE id = ? AND (company_id IS NULL OR company_id = ?)", [recipeId, companyId]);
  if (!r) return null;
  const res = (await recipeResources(companyId, [r.id], county)).get(r.id) ?? [];
  await execute("UPDATE recipes SET uses = uses + 1 WHERE id = ?", [r.id]);
  return { key: randomUUID(), code: r.code ?? "", name: r.name, unit: r.unit, quantity, reviewNote: r.status === "verificat" ? null : DRAFT_NOTE, resources: res };
}

/**
 * Salvează un articol din deviz ca rețetă a firmei (sau globală, ★G). Salvarea din editor înseamnă că
 * utilizatorul a confirmat articolul → versiunea nouă e „verificat”. Dacă rețeta există deja, nu se suprascrie:
 * se creează o versiune nouă, iar cea veche devine „depășit” (istoricul rămâne).
 */
export async function saveRecipe(companyId: number | null, item: Pick<EstItem, "code" | "name" | "unit" | "resources">, userId: number, source: "deviz" | "manual" | "ai" | "import" = "deviz"): Promise<number> {
  const key = normKey(item.name, item.unit);
  const status: RecipeStatus = source === "ai" || source === "import" ? "draft" : "verificat";
  return transaction(async (conn) => {
    const prev = await queryOne<{ id: number; version: number; uses: number; category: string | null; description: string | null; norm_source: string | null; norm_version: string | null; conditions: string | null }>(
      `SELECT id, version, uses, category, description, norm_source, norm_version, conditions FROM recipes
        WHERE company_id <=> ? AND norm_key = ? AND superseded_by IS NULL ORDER BY id DESC LIMIT 1`,
      [companyId, key], conn,
    );
    const ins = await execute(
      `INSERT INTO recipes (company_id, code, name, unit, norm_key, source, created_by, status, verified_at, verified_by,
         category, description, norm_source, norm_version, conditions, version, previous_id, uses)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, item.code || null, item.name.slice(0, 500), item.unit.slice(0, 20), key, source, userId, status,
        status === "verificat" ? new Date() : null, status === "verificat" ? userId : null,
        prev?.category ?? null, prev?.description ?? null, prev?.norm_source ?? null, prev?.norm_version ?? null, prev?.conditions ?? null,
        (prev?.version ?? 0) + 1, prev?.id ?? null, prev?.uses ?? 0],
      conn,
    );
    const id = ins.insertId;
    if (prev) await execute("UPDATE recipes SET status = 'depasit', superseded_by = ? WHERE id = ?", [id, prev.id], conn);
    const rows = item.resources.map((r, i) => [id, i, r.resourceId, r.type, r.code || null, r.name.slice(0, 255), r.unit.slice(0, 20), r.norm,
      Math.min(100, Math.max(0, r.waste || 0)), r.price, r.type === "manopera" ? (r.tariffKind ?? null) : null]);
    if (rows.length) await execute("INSERT INTO recipe_resources (recipe_id, position, resource_id, type, code, name, unit, norm, waste_pct, price, tariff_kind) VALUES ?", [rows], conn);
    return id;
  });
}

export type ImportLine = { code: string; name: string; unit: string; quantity: number };
export type MatchStatus = "exact" | "propus" | "cache" | "negasit";

/**
 * Potrivire fără AI: cod → denumire exactă → potriviri AI salvate → căutare cu scor.
 * Întoarce articolele cu resurse și o notă de verificare unde potrivirea nu e sigură.
 */
export async function matchLines(companyId: number, lines: ImportLine[], county?: string | null): Promise<{ item: EstItem; status: MatchStatus }[]> {
  const res = await matchLinesRaw(companyId, lines, county);
  // Datele originale din F3 rămân atașate articolului, pentru verificarea abaterilor.
  return res.map((r, i) => ({ ...r, item: { ...r.item, f3: { code: lines[i].code, name: lines[i].name, unit: lines[i].unit, quantity: lines[i].quantity } } }));
}

async function matchLinesRaw(companyId: number, lines: ImportLine[], county?: string | null): Promise<{ item: EstItem; status: MatchStatus }[]> {
  const out: { item: EstItem; status: MatchStatus }[] = [];
  for (const line of lines) {
    const base = { key: randomUUID(), code: line.code, name: line.name, unit: line.unit, quantity: line.quantity, resources: [] as EstResource[], reviewNote: null as string | null };
    const key = normKey(line.name, line.unit);

    // 1. cod identic sau 2. denumire + U.M. identice
    const exact = await queryOne<{ id: number }>(
      `SELECT id FROM recipes WHERE (company_id IS NULL OR company_id = ?)
         AND ((? <> '' AND code = ? AND unit = ?) OR norm_key = ?) AND ${USABLE}
       ORDER BY (company_id IS NULL), (status = 'verificat') DESC, uses DESC LIMIT 1`,
      [companyId, line.code, line.code, line.unit, key],
    );
    if (exact) {
      const it = await recipeItem(companyId, exact.id, line.quantity, county);
      if (it) { out.push({ item: { ...it, code: line.code || it.code, name: line.name, quantity: line.quantity }, status: it.reviewNote ? "propus" : "exact" }); continue; }
    }

    // 3. potrivire AI salvată anterior (a firmei sau refolosibilă global)
    const cached = await queryOne<{ id: number; proposal: string | EstResource[] }>(
      "SELECT id, proposal FROM ai_match_cache WHERE norm_key = ? AND (company_id = ? OR company_id IS NULL) ORDER BY (company_id IS NULL) LIMIT 1",
      [key, companyId],
    );
    if (cached) {
      const res = (typeof cached.proposal === "string" ? JSON.parse(cached.proposal) : cached.proposal) as EstResource[];
      await execute("UPDATE ai_match_cache SET hits = hits + 1 WHERE id = ?", [cached.id]);
      out.push({ item: { ...base, resources: await refreshPrices(companyId, res, county), reviewNote: "Propus anterior de asistent — verifică normele și prețurile" }, status: "cache" });
      continue;
    }

    // 4. căutare cu scor
    const [best] = await searchRecipes(companyId, line.name, line.unit, 1, county);
    if (best && best.score >= 0.5 && normUnit(best.unit) === normUnit(line.unit)) {
      const it = await recipeItem(companyId, best.id, line.quantity, county);
      if (it) {
        const sure = best.score >= 0.9 && best.status === "verificat";
        out.push({
          item: { ...it, code: line.code || it.code, name: line.name, quantity: line.quantity, reviewNote: sure ? null : best.status !== "verificat" ? `${DRAFT_NOTE} („${best.name}”)` : `Propus automat din rețeta „${best.name}” (asemănare ${Math.round(best.score * 100)}%) — verifică` },
          status: sure ? "exact" : "propus",
        });
        continue;
      }
    }
    out.push({ item: { ...base, reviewNote: "Negăsit în bază — completează resursele sau folosește completarea automată" }, status: "negasit" });
  }
  return out;
}

/** Actualizează prețurile resurselor după catalogul curent (resursele dispărute rămân cu prețul salvat). */
export async function refreshPrices(companyId: number, res: EstResource[], county?: string | null): Promise<EstResource[]> {
  const cur = await effectivePrices(companyId, res.map((r) => r.resourceId).filter((x): x is number => !!x), county);
  return res.map((r) => {
    const c = r.resourceId ? cur.get(r.resourceId) : undefined;
    return {
      ...r, key: randomUUID(), resourceId: c ? r.resourceId : null, waste: r.waste ?? 0,
      tariffKind: r.type === "manopera" ? (c ? c.tariffKind : (r.tariffKind ?? null)) : null,
      offerId: c ? (c.priceInfo?.offerId ?? null) : (r.offerId ?? null), priceManual: false,
      price: c ? (c.price ?? 0) : r.price, name: c?.name ?? r.name, unit: c?.unit ?? r.unit, code: c?.code ?? r.code,
    };
  });
}
