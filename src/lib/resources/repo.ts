import "server-only";
import { query } from "../db";
import type { CatalogResource, ResType } from "../estimate/types";

type Row = { id: number; company_id: number | null; type: ResType; code: string | null; name: string; unit: string; price: string; notes: string | null };

const map = (r: Row): CatalogResource => ({
  id: r.id, global: r.company_id === null, type: r.type, code: r.code, name: r.name,
  unit: r.unit, price: Number(r.price), notes: r.notes,
});

/** Resursele vizibile: catalogul global + (opțional) resursele firmei. */
export async function listResources(opts: {
  companyId: number | null; includeGlobal: boolean; type?: ResType; q?: string; limit?: number;
}): Promise<CatalogResource[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const scope: string[] = [];
  if (opts.includeGlobal) scope.push("company_id IS NULL");
  if (opts.companyId) {
    scope.push("company_id = ?");
    params.push(opts.companyId);
  }
  if (!scope.length) return [];
  where.push(`(${scope.join(" OR ")})`);
  if (opts.type) {
    where.push("type = ?");
    params.push(opts.type);
  }
  if (opts.q) {
    where.push("(name LIKE ? OR code LIKE ?)");
    params.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  params.push(opts.limit ?? 500);
  const rows = await query<Row>(
    `SELECT id, company_id, type, code, name, unit, price, notes FROM resources
      WHERE ${where.join(" AND ")}
      ORDER BY (company_id IS NULL), type, name LIMIT ?`,
    params,
  );
  return rows.map(map);
}
