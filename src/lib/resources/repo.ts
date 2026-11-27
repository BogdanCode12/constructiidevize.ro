import "server-only";
import { execute, query, queryOne, type Conn } from "../db";
import type { CatalogResource, PriceOffer, PriceSource, ResPrice, ResStatus, ResType, TariffKind } from "../estimate/types";
import { isCounty, regionCounties } from "../counties";

/*
 * Catalogul de resurse.
 *  - resources.price = prețul de referință (lei, fără TVA), sincronizat cu oferta aleasă (current_price_id).
 *  - resource_prices = ofertele, cu istoric (nu se suprascriu).
 *  - O firmă vede catalogul global + resursele ei; pe resursele globale poate avea prețuri proprii (negociate),
 *    care au prioritate față de prețul de referință. Prețurile proprii ale unei firme nu sunt vizibile altora.
 *  - Zone de preț: o ofertă poate fi pentru un județ (resource_prices.county) sau pentru toată țara (NULL).
 *    Cu o zonă (județul devizului), ordinea este: propriu județ → propriu regiune → propriu național
 *    → catalog județ → catalog regiune → preț de referință (național).
 */

type Row = {
  id: number; company_id: number | null; type: ResType; category: string | null; code: string | null; name: string; unit: string;
  specs: string | null; producer: string | null; product_code: string | null; status: ResStatus; tariff_kind: TariffKind | null;
  region: string | null; mobilization_cost: string | null; conditions: string | null; notes: string | null; price: string | null;
  cur_id: number | null; cur_supplier: string | null; cur_source: PriceSource | null; cur_status: ResStatus | null;
  cur_obtained: Date | null; cur_valid: Date | null; cur_transport: number | null; cur_county: string | null;
  own_id: number | null; own_price: string | null; own_supplier: string | null; own_source: PriceSource | null; own_status: ResStatus | null;
  own_obtained: Date | null; own_valid: Date | null; own_transport: number | null; own_county: string | null;
  zg_id: number | null; zg_price: string | null; zg_supplier: string | null; zg_source: PriceSource | null; zg_status: ResStatus | null;
  zg_obtained: Date | null; zg_valid: Date | null; zg_transport: number | null; zg_county: string | null;
};

/** Datele DATE vin din pool cu timezone „Z” (miezul nopții UTC), deci partea de dată din ISO e cea corectă. */
const ymd = (d: Date | string | null) => (!d ? null : typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));
/** Data de azi în România, „YYYY-MM-DD”. */
export const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest" }).format(new Date());
export const isExpired = (validUntil: string | null) => !!validUntil && validUntil < today();

function offerInfo(kind: ResPrice["kind"], id: number | null, price: string | null, supplier: string | null, source: PriceSource | null,
  status: ResStatus | null, obtained: Date | null, validUntil: Date | null, transport: number | null, county: string | null): ResPrice {
  const valid = ymd(validUntil);
  return {
    offerId: id, value: Number(price), kind, county, supplier, source, status, obtainedAt: ymd(obtained), validUntil: valid,
    expired: isExpired(valid), transportIncluded: transport === null ? null : transport === 1,
  };
}

function map(r: Row): CatalogResource {
  let info: ResPrice | null = null;
  // Prețul propriu al firmei: pe resursele din catalog, oricare; pe resursele firmei, doar unul pe județ/regiune
  // (prețul național al resursei proprii este chiar oferta de referință aleasă).
  const ownApplies = r.own_id && r.own_price !== null && (r.company_id === null || r.own_county !== null);
  if (ownApplies) info = offerInfo("propriu", r.own_id, r.own_price, r.own_supplier, r.own_source, r.own_status, r.own_obtained, r.own_valid, r.own_transport, r.own_county);
  else if (r.zg_id && r.zg_price !== null) info = offerInfo("zona", r.zg_id, r.zg_price, r.zg_supplier, r.zg_source, r.zg_status, r.zg_obtained, r.zg_valid, r.zg_transport, r.zg_county);
  else if (r.price !== null) info = offerInfo("referinta", r.cur_id, r.price, r.cur_supplier, r.cur_source, r.cur_status, r.cur_obtained, r.cur_valid, r.cur_transport, r.cur_county);
  return {
    id: r.id, global: r.company_id === null, type: r.type, category: r.category, code: r.code, name: r.name, unit: r.unit,
    specs: r.specs, producer: r.producer, productCode: r.product_code, status: r.status, tariffKind: r.tariff_kind, region: r.region,
    mobilizationCost: r.mobilization_cost === null ? null : Number(r.mobilization_cost), conditions: r.conditions, notes: r.notes,
    price: info ? info.value : null, priceInfo: info,
  };
}

/**
 * SELECT comun: resursa + oferta de referință + prețul propriu al firmei + (cu zonă) oferta din catalog pentru zonă.
 * Întoarce și parametrii pentru semnele „?” din SELECT (se pun primii).
 */
function selectFor(companyId: number | null, county?: string | null): { sql: string; params: unknown[] } {
  const zone = isCounty(county) ? county : null;
  const near = zone ? regionCounties(zone) : [];
  const offerCols = (a: string) =>
    `${a}.id AS ${a}_id, ${a}.price_ron AS ${a}_price, ${a}.supplier AS ${a}_supplier, ${a}.source AS ${a}_source, ${a}.status AS ${a}_status,
     ${a}.obtained_at AS ${a}_obtained, ${a}.valid_until AS ${a}_valid, ${a}.transport_included AS ${a}_transport, ${a}.county AS ${a}_county`;
  // Prețul propriu: cu zonă — județul, apoi regiunea, apoi național; fără zonă — de preferință cel național.
  const ownWhere = zone ? "AND (p.county IS NULL OR p.county IN (?))" : "";
  const ownOrder = zone ? "(p.county = ?) DESC, (p.county IS NOT NULL) DESC," : "(p.county IS NULL) DESC,";
  const sql = `
  SELECT r.id, r.company_id, r.type, r.category, r.code, r.name, r.unit, r.specs, r.producer, r.product_code, r.status,
         r.tariff_kind, r.region, r.mobilization_cost, r.conditions, r.notes, r.price,
         cur.id AS cur_id, cur.supplier AS cur_supplier, cur.source AS cur_source, cur.status AS cur_status,
         cur.obtained_at AS cur_obtained, cur.valid_until AS cur_valid, cur.transport_included AS cur_transport, cur.county AS cur_county,
         ${offerCols("own")}, ${offerCols("zg")}
    FROM resources r
    LEFT JOIN resource_prices cur ON cur.id = r.current_price_id
    LEFT JOIN resource_prices own ON own.id = (
      SELECT p.id FROM resource_prices p
       WHERE p.resource_id = r.id AND p.company_id = ? AND p.status <> 'inactiv' ${ownWhere}
       ORDER BY ${ownOrder} p.obtained_at DESC, p.id DESC LIMIT 1)
    LEFT JOIN resource_prices zg ON ${zone ? `r.company_id IS NULL AND zg.id = (
      SELECT p.id FROM resource_prices p
       WHERE p.resource_id = r.id AND p.company_id IS NULL AND p.status <> 'inactiv' AND p.county IN (?)
       ORDER BY (p.county = ?) DESC, (p.status = 'verificat') DESC, p.obtained_at DESC, p.id DESC LIMIT 1)` : "FALSE"}`;
  const params: unknown[] = [companyId ?? 0];
  if (zone) params.push(near, zone, near, zone);
  return { sql, params };
}

export type ListOpts = {
  /** Firma care privește (pentru resursele ei și prețurile proprii). null = adminul, doar catalogul global. */
  companyId: number | null;
  includeGlobal: boolean;
  /** Doar resursele firmei (fără catalog) — pentru export, administrare. */
  onlyOwn?: boolean;
  type?: ResType;
  types?: ResType[];
  category?: string;
  /** „expirat” = preț de referință cu valabilitatea depășită; „fara_pret” = fără preț. */
  status?: ResStatus | "expirat" | "fara_pret";
  /** Resursele inactive apar doar în administrare. */
  includeInactive?: boolean;
  /** Zona de prețuri (cod de județ): prețul afișat e cel aplicabil în zonă. */
  county?: string | null;
  q?: string;
  limit?: number;
};

/** Resursele vizibile: catalogul global + (opțional) resursele firmei, cu prețul aplicabil. */
export async function listResources(opts: ListOpts): Promise<CatalogResource[]> {
  const where: string[] = [];
  const sel = selectFor(opts.companyId, opts.county);
  const params: unknown[] = [...sel.params];
  const scope: string[] = [];
  if (opts.includeGlobal && !opts.onlyOwn) scope.push("r.company_id IS NULL");
  if (opts.companyId) {
    scope.push("r.company_id = ?");
    params.push(opts.companyId);
  }
  if (!scope.length) return [];
  where.push(`(${scope.join(" OR ")})`);
  const types = opts.type ? [opts.type] : opts.types;
  if (types?.length) {
    where.push("r.type IN (?)");
    params.push(types);
  }
  if (opts.category) {
    where.push("r.category = ?");
    params.push(opts.category);
  }
  if (opts.status === "expirat") where.push("cur.valid_until IS NOT NULL AND cur.valid_until < CURDATE()");
  else if (opts.status === "fara_pret") where.push("r.price IS NULL");
  else if (opts.status) {
    where.push("r.status = ?");
    params.push(opts.status);
  }
  if (!opts.includeInactive && opts.status !== "inactiv") where.push("r.status <> 'inactiv'");
  if (opts.q) {
    where.push("(r.name LIKE ? OR r.code LIKE ? OR r.category LIKE ? OR r.producer LIKE ?)");
    const like = `%${opts.q}%`;
    params.push(like, like, like, like);
  }
  params.push(opts.limit ?? 500);
  const rows = await query<Row>(
    `${sel.sql} WHERE ${where.join(" AND ")} ORDER BY (r.company_id IS NULL), r.type, r.category, r.name LIMIT ?`,
    params,
  );
  return rows.map(map);
}

/** O resursă vizibilă pentru firmă (sau, cu companyId null, doar din catalogul global). */
export async function getResource(id: number, companyId: number | null): Promise<CatalogResource | null> {
  const sel = selectFor(companyId);
  const row = await queryOne<Row>(
    `${sel.sql} WHERE r.id = ? AND (r.company_id IS NULL OR r.company_id = ?)`,
    [...sel.params, id, companyId ?? 0],
  );
  return row ? map(row) : null;
}

/** Prețurile aplicabile pentru mai multe resurse (pentru rețete, editor, actualizarea devizului), opțional într-o zonă. */
export async function effectivePrices(companyId: number, ids: number[], county?: string | null): Promise<Map<number, CatalogResource>> {
  if (!ids.length) return new Map();
  const sel = selectFor(companyId, county);
  const rows = await query<Row>(
    `${sel.sql} WHERE r.id IN (?) AND (r.company_id IS NULL OR r.company_id = ?)`,
    [...sel.params, [...new Set(ids)], companyId],
  );
  return new Map(rows.map((r) => [r.id, map(r)]));
}

export async function listCategories(companyId: number | null, types?: ResType[]): Promise<string[]> {
  const rows = await query<{ category: string }>(
    `SELECT DISTINCT category FROM resources
      WHERE category IS NOT NULL AND category <> '' AND (company_id IS NULL OR company_id = ?) ${types?.length ? "AND type IN (?)" : ""}
      ORDER BY category`,
    types?.length ? [companyId ?? 0, types] : [companyId ?? 0],
  );
  return rows.map((r) => r.category);
}

type OfferRow = {
  id: number; resource_id: number; company_id: number | null; county: string | null; supplier: string | null; price: string; currency: string; exchange_rate: string;
  price_ron: string; source: PriceSource; document_url: string | null; obtained_at: Date; valid_until: Date | null; transport_included: number | null;
  min_qty: string | null; status: ResStatus; notes: string | null; created_at: Date; current_price_id: number | null;
};

/**
 * Ofertele unei resurse, cele mai noi primele. Adminul (companyId null) vede doar ofertele globale;
 * o firmă vede ofertele globale (pe resursele din catalog) și pe ale ei.
 */
export async function listOffers(resourceId: number, companyId: number | null): Promise<PriceOffer[]> {
  const rows = await query<OfferRow>(
    `SELECT p.*, r.current_price_id FROM resource_prices p JOIN resources r ON r.id = p.resource_id
      WHERE p.resource_id = ? AND (p.company_id IS NULL OR p.company_id = ?) AND (r.company_id IS NULL OR r.company_id = ?)
      ORDER BY p.obtained_at DESC, p.id DESC`,
    [resourceId, companyId ?? 0, companyId ?? 0],
  );
  return rows.map((p) => {
    const valid = ymd(p.valid_until);
    return {
      id: p.id, resourceId: p.resource_id, own: p.company_id !== null && p.company_id === companyId, county: p.county,
      supplier: p.supplier, price: Number(p.price), currency: p.currency, exchangeRate: Number(p.exchange_rate), priceRon: Number(p.price_ron),
      source: p.source, documentUrl: p.document_url, obtainedAt: ymd(p.obtained_at)!, validUntil: valid, expired: isExpired(valid),
      transportIncluded: p.transport_included === null ? null : p.transport_included === 1,
      minQty: p.min_qty === null ? null : Number(p.min_qty), status: p.status, notes: p.notes,
      current: p.current_price_id === p.id, createdAt: ymd(p.created_at)!,
    };
  });
}

/**
 * Sincronizează prețul de referință cu oferta aleasă. Dacă oferta aleasă lipsește sau a fost dezactivată,
 * se alege cea mai recentă ofertă activă a proprietarului resursei (verificată, dacă există); altfel NULL.
 */
export async function syncReferencePrice(resourceId: number, conn?: Conn): Promise<void> {
  const r = await queryOne<{ company_id: number | null; current_price_id: number | null }>(
    "SELECT company_id, current_price_id FROM resources WHERE id = ?", [resourceId], conn,
  );
  if (!r) return;
  let currentId = r.current_price_id;
  if (currentId) {
    const ok = await queryOne<{ id: number }>(
      "SELECT id FROM resource_prices WHERE id = ? AND resource_id = ? AND company_id <=> ? AND status <> 'inactiv'",
      [currentId, resourceId, r.company_id], conn,
    );
    if (!ok) currentId = null;
  }
  if (!currentId) {
    const best = await queryOne<{ id: number }>(
      `SELECT id FROM resource_prices WHERE resource_id = ? AND company_id <=> ? AND status <> 'inactiv'
        ORDER BY (county IS NULL) DESC, (status = 'verificat') DESC, obtained_at DESC, id DESC LIMIT 1`,
      [resourceId, r.company_id], conn,
    );
    currentId = best?.id ?? null;
  }
  await execute(
    `UPDATE resources SET current_price_id = ?,
            price = (SELECT price_ron FROM resource_prices WHERE id = ?)
      WHERE id = ?`,
    [currentId, currentId, resourceId], conn,
  );
}
