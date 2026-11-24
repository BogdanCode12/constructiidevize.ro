import "server-only";
import { query, queryOne } from "../db";
import { effNorm } from "../estimate/calc";
import { effectivePrices } from "../resources/repo";
import type { ResType } from "../estimate/types";
import type { RecipeStatus } from "./repo";

export type RecipeRow = {
  id: number; company_id: number | null; company: string | null; code: string | null; name: string; unit: string;
  category: string | null; status: RecipeStatus; norm_source: string | null; norm_version: string | null; version: number;
  source: string; uses: number; resources: number; updated_at: Date;
};

export type RecipeListOpts = {
  companyId?: number | null; includeGlobal?: boolean; allCompanies?: boolean;
  /** „global” / „firme” — doar pentru admin. */
  owner?: "global" | "firme";
  q?: string; category?: string; status?: RecipeStatus;
  /** Și versiunile vechi (înlocuite). Implicit: doar ultima versiune a fiecărui articol. */
  withHistory?: boolean;
  limit?: number;
};

/** Listă de rețete (articole) pentru pagini de administrare (fără calcul de prețuri). */
export async function listRecipes(opts: RecipeListOpts): Promise<RecipeRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (!opts.allCompanies) {
    const scope: string[] = [];
    if (opts.includeGlobal) scope.push("r.company_id IS NULL");
    if (opts.companyId) { scope.push("r.company_id = ?"); params.push(opts.companyId); }
    where.push(scope.length ? `(${scope.join(" OR ")})` : "1 = 0");
  }
  if (opts.owner === "global") where.push("r.company_id IS NULL");
  if (opts.owner === "firme") where.push("r.company_id IS NOT NULL");
  if (!opts.withHistory) where.push("r.superseded_by IS NULL");
  if (opts.status) { where.push("r.status = ?"); params.push(opts.status); }
  if (opts.category) { where.push("r.category = ?"); params.push(opts.category); }
  if (opts.q) { where.push("(r.name LIKE ? OR r.code LIKE ? OR r.norm_source LIKE ?)"); params.push(`%${opts.q}%`, `%${opts.q}%`, `%${opts.q}%`); }
  params.push(opts.limit ?? 500);
  return query<RecipeRow>(
    `SELECT r.id, r.company_id, c.name AS company, r.code, r.name, r.unit, r.category, r.status, r.norm_source, r.norm_version,
            r.version, r.source, r.uses, r.updated_at,
            (SELECT COUNT(*) FROM recipe_resources rr WHERE rr.recipe_id = r.id) AS resources
       FROM recipes r LEFT JOIN companies c ON c.id = r.company_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY (r.company_id IS NULL) DESC, r.category, r.name LIMIT ?`,
    params,
  );
}

export async function listRecipeCategories(companyId: number | null): Promise<string[]> {
  const rows = await query<{ category: string }>(
    "SELECT DISTINCT category FROM recipes WHERE category IS NOT NULL AND category <> '' AND (company_id IS NULL OR company_id = ?) ORDER BY category",
    [companyId ?? 0],
  );
  return rows.map((r) => r.category);
}

export type RecipeResourceView = {
  resourceId: number | null; type: ResType; code: string | null; name: string; unit: string;
  norm: number; waste: number; note: string | null;
  /** Prețul aplicabil acum (din catalog), doar informativ; null = fără preț / resursă scoasă din catalog. */
  price: number | null; linked: boolean;
};

export type RecipeDetail = {
  id: number; companyId: number | null; code: string | null; name: string; unit: string; category: string | null;
  description: string | null; status: RecipeStatus; normSource: string | null; normVersion: string | null; conditions: string | null;
  verifiedAt: Date | null; verifiedBy: string | null; version: number; previousId: number | null; supersededBy: number | null;
  source: string; uses: number; createdAt: Date; updatedAt: Date;
  resources: RecipeResourceView[];
  unitPrice: number;
  missingPrices: number;
  versions: { id: number; version: number; status: RecipeStatus; updatedAt: Date }[];
};

/**
 * O rețetă vizibilă pentru scope: adminul (companyId null) vede orice rețetă; o firmă vede rețetele globale și pe ale ei.
 * Prețurile afișate sunt cele aplicabile firmei (sau cele de referință, pentru admin).
 */
export async function getRecipe(id: number, companyId: number | null, admin = false): Promise<RecipeDetail | null> {
  const r = await queryOne<{
    id: number; company_id: number | null; code: string | null; name: string; unit: string; category: string | null; description: string | null;
    status: RecipeStatus; norm_source: string | null; norm_version: string | null; conditions: string | null; verified_at: Date | null;
    verifier: string | null; version: number; previous_id: number | null; superseded_by: number | null; source: string; uses: number;
    created_at: Date; updated_at: Date;
  }>(
    `SELECT r.*, u.name AS verifier FROM recipes r LEFT JOIN users u ON u.id = r.verified_by
      WHERE r.id = ? ${admin ? "" : "AND (r.company_id IS NULL OR r.company_id = ?)"}`,
    admin ? [id] : [id, companyId ?? 0],
  );
  if (!r) return null;
  const rows = await query<{ resource_id: number | null; type: ResType; code: string | null; name: string; unit: string; norm: string; waste_pct: string; price: string; note: string | null }>(
    "SELECT resource_id, type, code, name, unit, norm, waste_pct, price, note FROM recipe_resources WHERE recipe_id = ? ORDER BY position",
    [id],
  );
  // Prețurile se văd în contextul proprietarului rețetei (firma ei) sau, pentru rețetele globale, al firmei care privește.
  // Adminul vede doar prețurile de referință (nu prețurile negociate private ale firmelor).
  const priceCompany = admin ? 0 : (r.company_id ?? companyId ?? 0);
  const cur = await effectivePrices(priceCompany, rows.map((x) => x.resource_id).filter((x): x is number => !!x));
  const resources: RecipeResourceView[] = rows.map((x) => {
    const c = x.resource_id ? cur.get(x.resource_id) : undefined;
    return {
      resourceId: c ? c.id : null, type: x.type, code: c?.code ?? x.code, name: c?.name ?? x.name, unit: c?.unit ?? x.unit,
      norm: Number(x.norm), waste: Number(x.waste_pct), note: x.note, price: c ? c.price : null, linked: !!c,
    };
  });
  // Lanțul de versiuni: înapoi prin previous_id, înainte prin superseded_by (și ciornele noi pornite din ea).
  type V = { id: number; version: number; status: RecipeStatus; updated_at: Date; previous_id: number | null; superseded_by: number | null };
  const one = (vid: number) => queryOne<V>("SELECT id, version, status, updated_at, previous_id, superseded_by FROM recipes WHERE id = ?", [vid]);
  const chain = new Map<number, V>();
  let back: number | null = r.previous_id;
  while (back && chain.size < 30) { const v = await one(back); if (!v || chain.has(v.id)) break; chain.set(v.id, v); back = v.previous_id; }
  const fwd = await query<V>("SELECT id, version, status, updated_at, previous_id, superseded_by FROM recipes WHERE previous_id = ? LIMIT 10", [r.id]);
  for (const v of fwd) chain.set(v.id, v);
  let next: number | null = r.superseded_by;
  while (next && chain.size < 30) { const v = await one(next); if (!v || chain.has(v.id)) break; chain.set(v.id, v); next = v.superseded_by; }
  chain.set(r.id, { id: r.id, version: r.version, status: r.status, updated_at: r.updated_at, previous_id: r.previous_id, superseded_by: r.superseded_by });
  const versions = [...chain.values()].sort((a, b) => b.version - a.version || b.id - a.id);
  return {
    id: r.id, companyId: r.company_id, code: r.code, name: r.name, unit: r.unit, category: r.category, description: r.description,
    status: r.status, normSource: r.norm_source, normVersion: r.norm_version, conditions: r.conditions,
    verifiedAt: r.verified_at, verifiedBy: r.verifier, version: r.version, previousId: r.previous_id, supersededBy: r.superseded_by,
    source: r.source, uses: r.uses, createdAt: r.created_at, updatedAt: r.updated_at,
    resources,
    unitPrice: resources.reduce((s, x) => s + effNorm(x) * (x.price ?? 0), 0),
    missingPrices: resources.filter((x) => x.price === null).length,
    versions: versions.map((v) => ({ id: v.id, version: v.version, status: v.status, updatedAt: v.updated_at })),
  };
}
