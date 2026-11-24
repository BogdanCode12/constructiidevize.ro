"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { execute, queryOne, transaction } from "../db";
import { requireAdmin, requireUser } from "../auth/session";
import { logActivity } from "../activity";
import { parseNum } from "../numbers";
import { bnrRates } from "../bnr";
import {
  RES_TYPES, type CatalogResource, type PriceSource, type ResStatus, type ResType, type TariffKind,
} from "../estimate/types";
import { listResources, syncReferencePrice, today } from "./repo";
import { normalizeUnit } from "./units";
import type { FormState } from "@/components/action-form";

type Scope = { companyId: number | null; userId: number; admin: boolean };

/** „global” = catalogul platformei (doar admin); „company” = firma utilizatorului. */
async function resolveScope(scope: unknown): Promise<Scope> {
  if (scope === "global") {
    const admin = await requireAdmin();
    return { companyId: null, userId: admin.id, admin: true };
  }
  const user = await requireUser();
  if (!user.company) throw new Error("Contul nu are o firmă.");
  return { companyId: user.company.id, userId: user.id, admin: false };
}

function refresh(id?: number) {
  for (const p of ["/panou/resurse", "/admin/resurse", "/admin/manopera"]) revalidatePath(p);
  if (id) {
    revalidatePath(`/panou/resurse/${id}`);
    revalidatePath(`/admin/resurse/${id}`);
  }
}

const isType = (t: unknown): t is ResType => RES_TYPES.includes(t as ResType);
const STATUSES: ResStatus[] = ["neverificat", "verificat", "inactiv"];
const TARIFFS: TariffKind[] = ["cost_salarial", "echipa", "comercial"];
const SOURCES: PriceSource[] = ["manual", "import", "oferta_furnizor", "negociat"];
const CURRENCIES = ["RON", "EUR", "USD"];

const str = (data: FormData, k: string, max: number) => String(data.get(k) ?? "").trim().slice(0, max) || null;
const isDate = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Resursa pe care scope-ul are voie s-o modifice (adminul: catalogul global; firma: resursele ei). */
async function ownedResource(id: number, companyId: number | null) {
  return queryOne<{ id: number; type: ResType; name: string }>(
    "SELECT id, type, name FROM resources WHERE id = ? AND company_id <=> ?", [id, companyId],
  );
}

/** Resursa pe care firma o poate vedea (a ei sau din catalog) — pentru prețuri proprii. */
async function visibleResource(id: number, companyId: number | null) {
  return queryOne<{ id: number; company_id: number | null; name: string }>(
    "SELECT id, company_id, name FROM resources WHERE id = ? AND (company_id IS NULL OR company_id <=> ?)", [id, companyId],
  );
}

type OfferInput = {
  supplier: string | null; price: number; currency: string; exchangeRate: number; source: PriceSource; documentUrl: string | null;
  obtainedAt: string; validUntil: string | null; transportIncluded: boolean | null; minQty: number | null; status: ResStatus; notes: string | null;
};

function readOffer(data: FormData, prefix = ""): OfferInput | { error: string } {
  const g = (k: string) => data.get(prefix + k);
  const price = parseNum(g("price"));
  if (price === null || price <= 0) return { error: "Completează un preț mai mare decât 0 (fără TVA)." };
  const currency = String(g("currency") ?? "RON");
  if (!CURRENCIES.includes(currency)) return { error: "Moneda nu este validă." };
  const exchangeRate = currency === "RON" ? 1 : parseNum(g("exchange_rate"));
  if (!exchangeRate || exchangeRate <= 0) return { error: `Completează cursul ${currency} (lei pentru 1 ${currency}).` };
  const obtainedAt = String(g("obtained_at") ?? "").trim() || today();
  if (!isDate(obtainedAt)) return { error: "Data obținerii prețului nu este validă." };
  if (obtainedAt > today()) return { error: "Data obținerii prețului nu poate fi în viitor." };
  const validUntil = String(g("valid_until") ?? "").trim() || null;
  if (validUntil && !isDate(validUntil)) return { error: "Data de valabilitate nu este validă." };
  if (validUntil && validUntil < obtainedAt) return { error: "Valabilitatea nu poate fi înainte de data obținerii." };
  const src = String(g("source") ?? "manual") as PriceSource;
  const st = String(g("price_status") ?? "neverificat") as ResStatus;
  const ti = String(g("transport_included") ?? "");
  const docUrl = String(g("document_url") ?? "").trim().slice(0, 500) || null;
  if (docUrl && !/^https?:\/\//i.test(docUrl)) return { error: "Linkul justificativ trebuie să înceapă cu https://" };
  const minQty = parseNum(g("min_qty"));
  return {
    supplier: String(g("supplier") ?? "").trim().slice(0, 160) || null,
    price, currency, exchangeRate, source: SOURCES.includes(src) ? src : "manual", documentUrl: docUrl,
    obtainedAt, validUntil, transportIncluded: ti === "da" ? true : ti === "nu" ? false : null,
    minQty: minQty !== null && minQty > 0 ? minQty : null,
    status: STATUSES.includes(st) && st !== "inactiv" ? st : "neverificat",
    notes: String(g("price_notes") ?? "").trim().slice(0, 500) || null,
  };
}

async function insertOffer(resourceId: number, companyId: number | null, userId: number, o: OfferInput, conn?: Parameters<typeof execute>[2]) {
  const res = await execute(
    `INSERT INTO resource_prices (resource_id, company_id, supplier, price, currency, exchange_rate, price_ron, source, document_url,
       obtained_at, valid_until, transport_included, min_qty, status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [resourceId, companyId, o.supplier, o.price, o.currency, o.exchangeRate, Math.round(o.price * o.exchangeRate * 10000) / 10000, o.source,
      o.documentUrl, o.obtainedAt, o.validUntil, o.transportIncluded === null ? null : o.transportIncluded ? 1 : 0, o.minQty, o.status, o.notes, userId],
    conn,
  );
  return res.insertId;
}

/** Adaugă sau modifică datele unei resurse. La adăugare se poate completa direct și primul preț. */
export async function saveResourceAction(_: FormState, data: FormData): Promise<FormState> {
  const { companyId, userId } = await resolveScope(data.get("scope"));
  const id = Number(data.get("id") || 0);
  const type = data.get("type");
  const name = str(data, "name", 255);
  const unit = normalizeUnit(String(data.get("unit") ?? ""));
  if (!isType(type)) return { error: "Alege tipul resursei." };
  if (!name) return { error: "Completează denumirea." };
  if (!unit) return { error: "Completează unitatea de măsură." };
  const status = String(data.get("status") ?? "neverificat") as ResStatus;
  const tariff = String(data.get("tariff_kind") ?? "") as TariffKind;
  const mob = parseNum(data.get("mobilization_cost"));

  const fields = {
    type, name, unit,
    category: str(data, "category", 80),
    code: str(data, "code", 40),
    specs: str(data, "specs", 500),
    producer: str(data, "producer", 120),
    product_code: str(data, "product_code", 80),
    status: STATUSES.includes(status) ? status : "neverificat",
    tariff_kind: type === "manopera" && TARIFFS.includes(tariff) ? tariff : null,
    region: type === "manopera" ? str(data, "region", 80) : null,
    mobilization_cost: type === "utilaj" && mob !== null && mob >= 0 ? mob : null,
    conditions: str(data, "conditions", 500),
    notes: str(data, "notes", 255),
  };
  if (type === "manopera" && !fields.tariff_kind) return { error: "Alege tipul tarifului de manoperă (decide dacă se aplică CAM)." };

  const dup = await queryOne<{ id: number }>(
    "SELECT id FROM resources WHERE company_id <=> ? AND type = ? AND name = ? AND unit = ? AND id <> ? LIMIT 1",
    [companyId, type, name, unit, id],
  );
  if (dup) return { error: `Există deja „${name}” (${unit}) în acest catalog.` };

  const cols = Object.keys(fields);
  const vals = Object.values(fields);
  let newId = id;
  if (id) {
    const res = await execute(`UPDATE resources SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ? AND company_id <=> ?`, [...vals, id, companyId]);
    if (!res.affectedRows) return { error: "Resursa nu există." };
  } else {
    const hasPrice = String(data.get("price") ?? "").trim() !== "";
    const offer = hasPrice ? readOffer(data) : null;
    if (offer && "error" in offer) return offer;
    await transaction(async (conn) => {
      const ins = await execute(`INSERT INTO resources (company_id, ${cols.join(", ")}) VALUES (?, ${cols.map(() => "?").join(", ")})`, [companyId, ...vals], conn);
      newId = ins.insertId;
      if (offer) {
        const oid = await insertOffer(newId, companyId, userId, offer, conn);
        await execute("UPDATE resources SET current_price_id = ? WHERE id = ?", [oid, newId], conn);
        await syncReferencePrice(newId, conn);
      }
    });
  }
  await logActivity({ companyId, userId, action: id ? "resursa.modificata" : "resursa.adaugata", details: { id: newId, name } });
  refresh(newId);
  if (!id && data.get("redirect")) redirect(`${String(data.get("redirect"))}/${newId}`);
  return { ok: id ? "Salvat." : `„${name}” a fost adăugată.` };
}

/** Status resursă: neverificat / verificat / inactiv (inactivele nu mai apar în editor și la căutare). */
export async function setResourceStatusAction(data: FormData): Promise<void> {
  const { companyId, userId } = await resolveScope(data.get("scope"));
  const id = Number(data.get("id"));
  const status = String(data.get("status")) as ResStatus;
  if (!STATUSES.includes(status)) return;
  await execute("UPDATE resources SET status = ? WHERE id = ? AND company_id <=> ?", [status, id, companyId]);
  await logActivity({ companyId, userId, action: "resursa.status", details: { id, status } });
  refresh(id);
}

export async function deleteResourceAction(data: FormData): Promise<void> {
  const { companyId, userId } = await resolveScope(data.get("scope"));
  const id = Number(data.get("id"));
  await execute("DELETE FROM resources WHERE id = ? AND company_id <=> ?", [id, companyId]);
  await logActivity({ companyId, userId, action: "resursa.stearsa", details: { id } });
  refresh();
  if (data.get("redirect")) redirect(String(data.get("redirect")));
}

/**
 * Ofertă de preț nouă. Pe resursele proprii (sau, pentru admin, pe catalogul global) poate deveni prețul de
 * referință. Pe o resursă din catalog, firma își adaugă prețul ei (negociat) — vizibil doar ei.
 */
export async function addOfferAction(_: FormState, data: FormData): Promise<FormState> {
  const { companyId, userId } = await resolveScope(data.get("scope"));
  const resourceId = Number(data.get("resource_id"));
  const res = await visibleResource(resourceId, companyId);
  if (!res) return { error: "Resursa nu există." };
  const owner = res.company_id === companyId; // adminul pe catalog, firma pe resursele ei
  const offer = readOffer(data);
  if ("error" in offer) return offer;

  await transaction(async (conn) => {
    const oid = await insertOffer(resourceId, companyId, userId, offer, conn);
    if (owner) {
      const cur = await queryOne<{ current_price_id: number | null }>("SELECT current_price_id FROM resources WHERE id = ?", [resourceId], conn);
      if (data.get("make_current") || !cur?.current_price_id) await execute("UPDATE resources SET current_price_id = ? WHERE id = ?", [oid, resourceId], conn);
      await syncReferencePrice(resourceId, conn);
    }
  });
  await logActivity({ companyId, userId, action: "resursa.pret_adaugat", details: { id: resourceId, price: offer.price, currency: offer.currency } });
  refresh(resourceId);
  return { ok: owner ? "Prețul a fost adăugat în istoric." : "Prețul tău a fost salvat. Îl vezi doar tu și se folosește în devizele firmei." };
}

/** Alege oferta folosită ca preț de referință (doar proprietarul resursei). */
export async function setCurrentOfferAction(data: FormData): Promise<void> {
  const { companyId, userId } = await resolveScope(data.get("scope"));
  const offerId = Number(data.get("offer_id"));
  const o = await queryOne<{ resource_id: number }>(
    `SELECT p.resource_id FROM resource_prices p JOIN resources r ON r.id = p.resource_id
      WHERE p.id = ? AND p.status <> 'inactiv' AND p.company_id <=> ? AND r.company_id <=> ?`,
    [offerId, companyId, companyId],
  );
  if (!o) return;
  await execute("UPDATE resources SET current_price_id = ? WHERE id = ?", [offerId, o.resource_id]);
  await syncReferencePrice(o.resource_id);
  await logActivity({ companyId, userId, action: "resursa.pret_referinta", details: { id: o.resource_id, offerId } });
  refresh(o.resource_id);
}

/** Verificat / neverificat / inactiv pentru o ofertă. Prețul și datele ofertei nu se modifică (istoric). */
export async function setOfferStatusAction(data: FormData): Promise<void> {
  const { companyId, userId } = await resolveScope(data.get("scope"));
  const offerId = Number(data.get("offer_id"));
  const status = String(data.get("status")) as ResStatus;
  if (!STATUSES.includes(status)) return;
  const o = await queryOne<{ resource_id: number }>("SELECT resource_id FROM resource_prices WHERE id = ? AND company_id <=> ?", [offerId, companyId]);
  if (!o) return;
  await execute("UPDATE resource_prices SET status = ? WHERE id = ?", [status, offerId]);
  await syncReferencePrice(o.resource_id);
  await logActivity({ companyId, userId, action: "resursa.pret_status", details: { offerId, status } });
  refresh(o.resource_id);
}

/** Cursul BNR al zilei, pentru completarea automată a ofertelor în altă monedă. */
export async function exchangeRateAction(currency: string): Promise<{ rate: number; date: string } | null> {
  await requireUser();
  if (!CURRENCIES.includes(currency) || currency === "RON") return null;
  const r = await bnrRates();
  return r?.rates[currency] ? { rate: r.rates[currency], date: r.date } : null;
}

/** Căutare în catalog (global + firma) pentru editorul de deviz. Fără resursele inactive. */
export async function searchCatalogAction(q: string, type?: ResType): Promise<CatalogResource[]> {
  const user = await requireUser();
  return listResources({
    companyId: user.company?.id ?? null,
    includeGlobal: true,
    q: q.trim().slice(0, 100) || undefined,
    type: type && isType(type) ? type : undefined,
    limit: 25,
  });
}

export async function deleteCompanyRecipeAction(data: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.company) return;
  await execute("DELETE FROM recipes WHERE id = ? AND company_id = ?", [Number(data.get("id")), user.company.id]);
  revalidatePath("/panou/resurse");
}
