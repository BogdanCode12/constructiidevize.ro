"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { execute, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import { saveEstimate } from "@/lib/estimate/repo";
import type { EstimateDoc } from "@/lib/estimate/types";
import type { FormState } from "@/components/action-form";

async function companyOf() {
  const user = await requireUser();
  if (!user.company) throw new Error("Contul nu are o firmă.");
  return { user, companyId: user.company.id };
}

export async function createEstimateAction(_: FormState, data: FormData): Promise<FormState> {
  const { user, companyId } = await companyOf();
  const projectId = Number(data.get("project_id"));
  const name = String(data.get("name") ?? "").trim().slice(0, 190) || "Deviz";
  const project = await queryOne<{ id: number }>("SELECT id FROM projects WHERE id = ? AND company_id = ?", [projectId, companyId]);
  if (!project) return { error: "Alege un proiect." };

  const s = await getSettings();
  const res = await execute(
    "INSERT INTO estimates (company_id, project_id, name, overhead_pct, profit_pct, vat_pct, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [companyId, projectId, name, s.default_overhead_pct, s.default_profit_pct, s.default_vat_pct, user.id],
  );
  await execute("INSERT INTO estimate_chapters (estimate_id, position, name) VALUES (?, 0, 'Capitolul 1')", [res.insertId]);
  await logActivity({ companyId, userId: user.id, action: "deviz.creat", details: { id: res.insertId, name } });
  redirect(`/panou/devize/${res.insertId}`);
}

export async function saveEstimateAction(doc: EstimateDoc): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user, companyId } = await companyOf();
  try {
    await saveEstimate(doc, companyId);
  } catch (err) {
    console.error("[deviz] salvare", err);
    return { ok: false, error: err instanceof Error ? err.message : "Eroare la salvare." };
  }
  await logActivity({ companyId, userId: user.id, action: "deviz.salvat", details: { id: doc.id } });
  revalidatePath("/panou/devize");
  return { ok: true };
}

export async function deleteEstimateAction(data: FormData): Promise<void> {
  const { user, companyId } = await companyOf();
  const id = Number(data.get("id"));
  await execute("DELETE FROM estimates WHERE id = ? AND company_id = ?", [id, companyId]);
  await logActivity({ companyId, userId: user.id, action: "deviz.sters", details: { id } });
  revalidatePath("/panou/devize");
  redirect("/panou/devize");
}
