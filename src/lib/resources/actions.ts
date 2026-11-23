"use server";

import { revalidatePath } from "next/cache";
import { execute } from "../db";
import { requireAdmin, requireUser } from "../auth/session";
import { logActivity } from "../activity";
import { parseNum } from "../numbers";
import { RES_TYPES, type CatalogResource, type ResType } from "../estimate/types";
import { listResources } from "./repo";
import type { FormState } from "@/components/action-form";

/** „global” = catalogul platformei (doar admin); „company” = resursele firmei utilizatorului. */
async function resolveScope(scope: unknown): Promise<{ companyId: number | null; userId: number }> {
  if (scope === "global") {
    const admin = await requireAdmin();
    return { companyId: null, userId: admin.id };
  }
  const user = await requireUser();
  if (!user.company) throw new Error("Contul nu are o firmă.");
  return { companyId: user.company.id, userId: user.id };
}

function refresh() {
  revalidatePath("/panou/resurse");
  revalidatePath("/admin/resurse");
}

const isType = (t: unknown): t is ResType => RES_TYPES.includes(t as ResType);

export async function saveResourceAction(_: FormState, data: FormData): Promise<FormState> {
  const { companyId, userId } = await resolveScope(data.get("scope"));
  const id = Number(data.get("id") || 0);
  const type = data.get("type");
  const name = String(data.get("name") ?? "").trim().slice(0, 255);
  const unit = String(data.get("unit") ?? "").trim().slice(0, 20);
  const code = String(data.get("code") ?? "").trim().slice(0, 40) || null;
  const notes = String(data.get("notes") ?? "").trim().slice(0, 255) || null;
  const price = parseNum(data.get("price"));

  if (!isType(type)) return { error: "Alege tipul resursei." };
  if (!name) return { error: "Completează denumirea." };
  if (!unit) return { error: "Completează unitatea de măsură." };
  if (price === null || price < 0) return { error: "Prețul nu este valid." };

  if (id) {
    const res = await execute(
      "UPDATE resources SET type = ?, code = ?, name = ?, unit = ?, price = ?, notes = ? WHERE id = ? AND company_id <=> ?",
      [type, code, name, unit, price, notes, id, companyId],
    );
    if (!res.affectedRows) return { error: "Resursa nu există." };
  } else {
    await execute(
      "INSERT INTO resources (company_id, type, code, name, unit, price, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [companyId, type, code, name, unit, price, notes],
    );
  }
  await logActivity({ companyId, userId, action: id ? "resursa.modificata" : "resursa.adaugata", details: { name } });
  refresh();
  return { ok: id ? "Salvat." : `„${name}” a fost adăugată.` };
}

export async function deleteResourceAction(data: FormData): Promise<void> {
  const { companyId } = await resolveScope(data.get("scope"));
  await execute("DELETE FROM resources WHERE id = ? AND company_id <=> ?", [Number(data.get("id")), companyId]);
  refresh();
}

/** Import prin copy-paste din Excel: coloanele Cod | Denumire | U.M. | Preț (tab sau „;”). */
export async function importResourcesAction(_: FormState, data: FormData): Promise<FormState> {
  const { companyId, userId } = await resolveScope(data.get("scope"));
  const type = data.get("type");
  if (!isType(type)) return { error: "Alege tipul resurselor." };

  const rows: unknown[][] = [];
  const skipped: number[] = [];
  const lines = String(data.get("text") ?? "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length > 3000) return { error: "Maxim 3000 de rânduri o dată." };

  lines.forEach((line, i) => {
    const cols = line.split(line.includes("\t") ? "\t" : ";").map((c) => c.trim());
    const [code, name, unit, priceRaw] = cols.length >= 4 ? cols : ["", ...cols];
    const price = parseNum(priceRaw);
    if (!name || !unit || price === null || price < 0) {
      skipped.push(i + 1);
      return;
    }
    rows.push([companyId, type, code?.slice(0, 40) || null, name.slice(0, 255), unit.slice(0, 20), price]);
  });

  if (!rows.length) return { error: "Niciun rând valid. Format: Cod, Denumire, U.M., Preț (sau Denumire, U.M., Preț)." };
  await execute("INSERT INTO resources (company_id, type, code, name, unit, price) VALUES ?", [rows]);
  await logActivity({ companyId, userId, action: "resurse.importate", details: { count: rows.length, type } });
  refresh();
  const skip = skipped.length ? ` Rânduri sărite (ex. capul de tabel): ${skipped.slice(0, 10).join(", ")}${skipped.length > 10 ? "…" : ""}.` : "";
  return { ok: `${rows.length} resurse importate.${skip}` };
}

/** Căutare în catalog (global + firma) pentru editorul de deviz. */
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
