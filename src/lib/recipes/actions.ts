"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { execute, query, queryOne, transaction } from "../db";
import { requireAdmin, requireUser } from "../auth/session";
import { logActivity } from "../activity";
import { normKey } from "../estimate/normalize";
import { RES_TYPES, type CatalogResource, type ResType } from "../estimate/types";
import { listResources } from "../resources/repo";
import { normalizeUnit } from "../resources/units";
import type { RecipeStatus } from "./repo";
import type { FormState } from "@/components/action-form";

type Scope = { companyId: number | null; userId: number; admin: boolean };

async function scopeOf(scope: unknown): Promise<Scope> {
  if (scope === "global") return { companyId: null, userId: (await requireAdmin()).id, admin: true };
  const user = await requireUser();
  if (!user.company) throw new Error("Contul nu are o firmă.");
  return { companyId: user.company.id, userId: user.id, admin: false };
}

function refresh(id?: number) {
  revalidatePath("/admin/retete");
  revalidatePath("/panou/resurse");
  if (id) {
    revalidatePath(`/admin/retete/${id}`);
    revalidatePath(`/panou/resurse/retete/${id}`);
  }
}

export type RecipeResInput = { resourceId: number | null; type: ResType; code: string; name: string; unit: string; norm: number; waste: number; note: string };

type Owned = { id: number; company_id: number | null; status: RecipeStatus; superseded_by: number | null; version: number; uses: number; norm_key: string };

/** Rețeta pe care scope-ul o administrează (adminul: rețetele globale; firma: ale ei). */
async function owned(id: number, companyId: number | null): Promise<Owned | null> {
  return queryOne<Owned>(
    "SELECT id, company_id, status, superseded_by, version, uses, norm_key FROM recipes WHERE id = ? AND company_id <=> ?",
    [id, companyId],
  );
}

function cleanResources(raw: unknown, allowedIds: Set<number>): RecipeResInput[] | { error: string } {
  if (!Array.isArray(raw)) return { error: "Lista de resurse nu este validă." };
  if (raw.length > 100) return { error: "Maxim 100 de resurse pe articol." };
  const out: RecipeResInput[] = [];
  for (const [i, x] of raw.entries()) {
    const r = x as Partial<RecipeResInput>;
    if (!RES_TYPES.includes(r.type as ResType)) return { error: `Rândul ${i + 1}: tip de resursă invalid.` };
    const name = String(r.name ?? "").trim().slice(0, 255);
    const unit = normalizeUnit(String(r.unit ?? ""));
    const norm = Number(r.norm);
    const waste = Number(r.waste ?? 0);
    if (!name) return { error: `Rândul ${i + 1}: lipsește denumirea resursei.` };
    if (!unit) return { error: `Rândul ${i + 1}: lipsește U.M.` };
    if (!Number.isFinite(norm) || norm < 0) return { error: `Rândul ${i + 1}: consumul nu este valid.` };
    if (!Number.isFinite(waste) || waste < 0 || waste > 100) return { error: `Rândul ${i + 1}: pierderile trebuie să fie între 0 și 100%.` };
    const rid = r.resourceId && Number.isInteger(r.resourceId) && allowedIds.has(r.resourceId) ? r.resourceId : null;
    out.push({ resourceId: rid, type: r.type as ResType, code: String(r.code ?? "").trim().slice(0, 40), name, unit, norm, waste, note: String(r.note ?? "").trim().slice(0, 255) });
  }
  return out;
}

/** Id-urile de resurse pe care rețeta le poate folosi: catalogul global (+ resursele firmei, pentru rețetele firmei). */
async function allowedResourceIds(raw: unknown, companyId: number | null): Promise<Set<number>> {
  const ids = Array.isArray(raw) ? raw.map((x) => Number((x as { resourceId?: unknown }).resourceId)).filter((n) => Number.isInteger(n) && n > 0) : [];
  if (!ids.length) return new Set();
  const rows = await query<{ id: number }>("SELECT id FROM resources WHERE id IN (?) AND (company_id IS NULL OR company_id <=> ?)", [ids, companyId ?? -1]);
  return new Set(rows.map((r) => r.id));
}

async function writeResources(recipeId: number, list: RecipeResInput[], conn: Parameters<typeof execute>[2]) {
  await execute("DELETE FROM recipe_resources WHERE recipe_id = ?", [recipeId], conn);
  // Tipul tarifului manoperei se ia din catalog (decide CAM).
  const ids = list.map((r) => r.resourceId).filter((x): x is number => !!x);
  const kinds = new Map(
    (ids.length ? await query<{ id: number; tariff_kind: string | null }>("SELECT id, tariff_kind FROM resources WHERE id IN (?)", [ids], conn) : [])
      .map((x) => [x.id, x.tariff_kind]),
  );
  const rows = list.map((r, i) => [recipeId, i, r.resourceId, r.type, r.code || null, r.name, r.unit, r.norm, r.waste, 0,
    r.type === "manopera" && r.resourceId ? (kinds.get(r.resourceId) ?? null) : null, r.note || null]);
  if (rows.length) await execute("INSERT INTO recipe_resources (recipe_id, position, resource_id, type, code, name, unit, norm, waste_pct, price, tariff_kind, note) VALUES ?", [rows], conn);
}

/**
 * Salvează un articol (rețetă). Nou → versiunea 1, draft. Draft → se modifică pe loc.
 * Verificat → NU se modifică: se creează o versiune nouă (draft), iar cea verificată rămâne în uz până la validarea celei noi.
 */
export async function saveRecipeFormAction(_: FormState, data: FormData): Promise<FormState> {
  const { companyId, userId } = await scopeOf(data.get("scope"));
  const id = Number(data.get("id") || 0);
  const s = (k: string, n: number) => String(data.get(k) ?? "").trim().slice(0, n) || null;
  const name = s("name", 500);
  const unit = normalizeUnit(String(data.get("unit") ?? ""));
  if (!name) return { error: "Completează denumirea articolului." };
  if (!unit) return { error: "Completează unitatea de măsură." };
  let raw: unknown;
  try { raw = JSON.parse(String(data.get("resources") ?? "[]")); } catch { return { error: "Lista de resurse nu este validă." }; }
  const list = cleanResources(raw, await allowedResourceIds(raw, companyId));
  if ("error" in list) return list;

  const meta = {
    code: s("code", 40), name, unit, category: s("category", 80), description: s("description", 4000),
    norm_source: s("norm_source", 190), norm_version: s("norm_version", 60), conditions: s("conditions", 500),
    norm_key: normKey(name, unit),
  };
  const basePath = String(data.get("base") ?? "");
  let targetId = id;

  if (id) {
    const cur = await owned(id, companyId);
    if (!cur) return { error: "Articolul nu există." };
    if (cur.superseded_by) return { error: "Aceasta e o versiune veche. Deschide ultima versiune ca să faci modificări." };
    if (cur.status === "draft") {
      await transaction(async (conn) => {
        await execute(
          `UPDATE recipes SET code = ?, name = ?, unit = ?, category = ?, description = ?, norm_source = ?, norm_version = ?, conditions = ?, norm_key = ?
            WHERE id = ?`,
          [meta.code, meta.name, meta.unit, meta.category, meta.description, meta.norm_source, meta.norm_version, meta.conditions, meta.norm_key, id], conn,
        );
        await writeResources(id, list, conn);
      });
    } else {
      // verificat sau depasit (scos din uz): versiune nouă, în draft
      targetId = await transaction(async (conn) => {
        const ins = await execute(
          `INSERT INTO recipes (company_id, code, name, unit, category, description, norm_source, norm_version, conditions, norm_key, source,
             status, version, previous_id, uses, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'draft', ?, ?, ?, ?)`,
          [companyId, meta.code, meta.name, meta.unit, meta.category, meta.description, meta.norm_source, meta.norm_version, meta.conditions,
            meta.norm_key, cur.version + 1, cur.id, cur.uses, userId], conn,
        );
        await writeResources(ins.insertId, list, conn);
        return ins.insertId;
      });
      await logActivity({ companyId, userId, action: "reteta.versiune_noua", details: { from: id, id: targetId } });
      refresh(targetId);
      if (basePath) redirect(`${basePath}/${targetId}?versiune=noua`);
      return { ok: "S-a creat o versiune nouă (draft)." };
    }
  } else {
    targetId = await transaction(async (conn) => {
      const ins = await execute(
        `INSERT INTO recipes (company_id, code, name, unit, category, description, norm_source, norm_version, conditions, norm_key, source, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'draft', ?)`,
        [companyId, meta.code, meta.name, meta.unit, meta.category, meta.description, meta.norm_source, meta.norm_version, meta.conditions, meta.norm_key, userId], conn,
      );
      await writeResources(ins.insertId, list, conn);
      return ins.insertId;
    });
  }
  await logActivity({ companyId, userId, action: id ? "reteta.modificata" : "reteta.adaugata", details: { id: targetId, name } });
  refresh(targetId);
  if (!id && basePath) redirect(`${basePath}/${targetId}`);
  return { ok: "Salvat." };
}

/**
 * Validare: draft → verificat (cere cel puțin o resursă cu consum > 0; la rețetele globale și sursa normei).
 * La validarea unei versiuni noi, versiunea anterioară devine „depășit”.
 * Scoatere din uz: → depășit. Redeschidere: depășit (fără înlocuitor) → draft.
 */
export async function setRecipeStatusAction(_: FormState, data: FormData): Promise<FormState> {
  const { companyId, userId } = await scopeOf(data.get("scope"));
  const id = Number(data.get("id"));
  const to = String(data.get("status")) as RecipeStatus;
  const cur = await owned(id, companyId);
  if (!cur) return { error: "Articolul nu există." };
  if (cur.superseded_by) return { error: "Versiunea a fost deja înlocuită." };

  if (to === "verificat") {
    const r = await queryOne<{ norm_source: string | null; n: number; zero: number }>(
      `SELECT norm_source, (SELECT COUNT(*) FROM recipe_resources WHERE recipe_id = ?) AS n,
              (SELECT COUNT(*) FROM recipe_resources WHERE recipe_id = ? AND norm <= 0) AS zero
         FROM recipes WHERE id = ?`, [id, id, id],
    );
    if (!r || Number(r.n) === 0) return { error: "Nu poți valida un articol fără resurse și consumuri." };
    if (Number(r.zero) > 0) return { error: "Toate resursele trebuie să aibă consum mai mare decât 0." };
    if (companyId === null && !r.norm_source) return { error: "Completează sursa normei / rețetei înainte de validare (ex. „rețetă proprie DevizConstruct”, fișă tehnică producător)." };
    await transaction(async (conn) => {
      await execute("UPDATE recipes SET status = 'verificat', verified_at = NOW(), verified_by = ? WHERE id = ?", [userId, id], conn);
      const prev = await queryOne<{ previous_id: number | null }>("SELECT previous_id FROM recipes WHERE id = ?", [id], conn);
      if (prev?.previous_id) {
        await execute("UPDATE recipes SET status = 'depasit', superseded_by = ? WHERE id = ? AND company_id <=> ? AND superseded_by IS NULL", [id, prev.previous_id, companyId], conn);
      }
    });
  } else if (to === "depasit") {
    await execute("UPDATE recipes SET status = 'depasit' WHERE id = ?", [id]);
  } else if (to === "draft") {
    if (cur.status !== "depasit") return { error: "Doar un articol scos din uz poate fi redeschis." };
    await execute("UPDATE recipes SET status = 'draft', verified_at = NULL, verified_by = NULL WHERE id = ?", [id]);
  } else return { error: "Status invalid." };

  await logActivity({ companyId, userId, action: "reteta.status", details: { id, status: to } });
  refresh(id);
  return { ok: to === "verificat" ? "Articolul a fost validat." : to === "depasit" ? "Articolul a fost scos din uz." : "Articolul a fost redeschis ca draft." };
}

/** Duplică un articol (al tău sau, pentru firme, unul din catalog) ca articol nou, în draft. */
export async function duplicateRecipeAction(data: FormData): Promise<void> {
  const { companyId, userId } = await scopeOf(data.get("scope"));
  const id = Number(data.get("id"));
  const src = await queryOne<{ name: string; unit: string }>(
    "SELECT name, unit FROM recipes WHERE id = ? AND (company_id <=> ? OR company_id IS NULL)", [id, companyId],
  );
  if (!src) return;
  const name = `${src.name} (copie)`.slice(0, 500);
  const newId = await transaction(async (conn) => {
    const ins = await execute(
      `INSERT INTO recipes (company_id, code, name, unit, category, description, norm_source, norm_version, conditions, norm_key, source, status, created_by)
       SELECT ?, code, ?, unit, category, description, norm_source, norm_version, conditions, ?, 'manual', 'draft', ? FROM recipes WHERE id = ?`,
      [companyId, name, normKey(name, src.unit), userId, id], conn,
    );
    await execute(
      `INSERT INTO recipe_resources (recipe_id, position, resource_id, type, code, name, unit, norm, waste_pct, price, tariff_kind, note)
       SELECT ?, rr.position, CASE WHEN res.company_id IS NULL OR res.company_id <=> ? THEN rr.resource_id ELSE NULL END,
              rr.type, rr.code, rr.name, rr.unit, rr.norm, rr.waste_pct, rr.price, rr.tariff_kind, rr.note
         FROM recipe_resources rr LEFT JOIN resources res ON res.id = rr.resource_id WHERE rr.recipe_id = ?`,
      [ins.insertId, companyId ?? -1, id], conn,
    );
    return ins.insertId;
  });
  await logActivity({ companyId, userId, action: "reteta.duplicata", details: { from: id, id: newId } });
  refresh(newId);
  redirect(`${String(data.get("base") ?? "")}/${newId}`);
}

/** Șterge un articol. Firmele își șterg articolele; adminul poate șterge orice (de preferat: scoatere din uz). */
export async function deleteRecipeAction(data: FormData): Promise<void> {
  const { companyId, userId, admin } = await scopeOf(data.get("scope"));
  const id = Number(data.get("id"));
  // Versiunile care pornesc din ea rămân, fără legătura spre ea.
  await execute("UPDATE recipes SET previous_id = NULL WHERE previous_id = ?", [id]);
  await execute("UPDATE recipes SET superseded_by = NULL WHERE superseded_by = ?", [id]);
  await execute(admin ? "DELETE FROM recipes WHERE id = ?" : "DELETE FROM recipes WHERE id = ? AND company_id = ?", admin ? [id] : [id, companyId]);
  await logActivity({ companyId, userId, action: "reteta.stearsa", details: { id } });
  refresh();
  redirect(String(data.get("redirect") ?? "/panou/resurse?tab=retete"));
}

/**
 * Admin: preia articolul unei firme în baza globală, ca DRAFT (nu intră automat în uz).
 * Dacă există deja un articol global cu aceeași denumire și U.M., devine versiunea lui următoare.
 */
export async function promoteRecipeAction(data: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(data.get("id"));
  const src = await queryOne<{ norm_key: string }>("SELECT norm_key FROM recipes WHERE id = ? AND company_id IS NOT NULL", [id]);
  if (!src) return;
  const newId = await transaction(async (conn) => {
    const prev = await queryOne<{ id: number; version: number }>(
      "SELECT id, version FROM recipes WHERE company_id IS NULL AND norm_key = ? AND superseded_by IS NULL ORDER BY id DESC LIMIT 1", [src.norm_key], conn,
    );
    const ins = await execute(
      `INSERT INTO recipes (company_id, code, name, unit, category, description, norm_source, norm_version, conditions, norm_key, source, status,
         version, previous_id, created_by)
       SELECT NULL, code, name, unit, category, description, norm_source, norm_version, conditions, norm_key, 'manual', 'draft', ?, ?, ? FROM recipes WHERE id = ?`,
      [(prev?.version ?? 0) + 1, prev?.id ?? null, admin.id, id], conn,
    );
    // Resursele private ale firmei nu intră în catalogul global: rămân ca text (fără legătură), de înlocuit cu resurse din catalog.
    await execute(
      `INSERT INTO recipe_resources (recipe_id, position, resource_id, type, code, name, unit, norm, waste_pct, price, tariff_kind, note)
       SELECT ?, rr.position, CASE WHEN res.company_id IS NULL THEN rr.resource_id ELSE NULL END, rr.type, rr.code, rr.name, rr.unit, rr.norm, rr.waste_pct, 0, rr.tariff_kind, rr.note
         FROM recipe_resources rr LEFT JOIN resources res ON res.id = rr.resource_id WHERE rr.recipe_id = ?`,
      [ins.insertId, id], conn,
    );
    return ins.insertId;
  });
  await logActivity({ userId: admin.id, action: "admin.reteta.preluata", details: { from: id, id: newId } });
  refresh(newId);
  redirect(`/admin/retete/${newId}`);
}

/** Căutare de resurse pentru editorul de articole: adminul doar în catalogul global; firma în catalog + resursele ei. */
export async function searchRecipeResourcesAction(scope: string, q: string, type?: ResType): Promise<CatalogResource[]> {
  const { companyId } = await scopeOf(scope);
  return listResources({
    companyId, includeGlobal: true, q: q.trim().slice(0, 100) || undefined,
    type: type && RES_TYPES.includes(type) ? type : undefined, limit: 25,
  });
}
