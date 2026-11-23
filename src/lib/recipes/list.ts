import "server-only";
import { query } from "../db";

export type RecipeRow = {
  id: number; company_id: number | null; company: string | null; code: string | null; name: string; unit: string;
  source: string; uses: number; resources: number; updated_at: Date;
};

/** Listă de rețete pentru pagini de administrare (fără calcul de prețuri). */
export async function listRecipes(opts: { companyId?: number | null; includeGlobal?: boolean; allCompanies?: boolean; q?: string; limit?: number }): Promise<RecipeRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (!opts.allCompanies) {
    const scope: string[] = [];
    if (opts.includeGlobal) scope.push("r.company_id IS NULL");
    if (opts.companyId) { scope.push("r.company_id = ?"); params.push(opts.companyId); }
    where.push(scope.length ? `(${scope.join(" OR ")})` : "1 = 0");
  }
  if (opts.q) { where.push("(r.name LIKE ? OR r.code LIKE ?)"); params.push(`%${opts.q}%`, `%${opts.q}%`); }
  params.push(opts.limit ?? 300);
  return query<RecipeRow>(
    `SELECT r.id, r.company_id, c.name AS company, r.code, r.name, r.unit, r.source, r.uses, r.updated_at,
            (SELECT COUNT(*) FROM recipe_resources rr WHERE rr.recipe_id = r.id) AS resources
       FROM recipes r LEFT JOIN companies c ON c.id = r.company_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY (r.company_id IS NULL) DESC, r.uses DESC, r.name LIMIT ?`,
    params,
  );
}
