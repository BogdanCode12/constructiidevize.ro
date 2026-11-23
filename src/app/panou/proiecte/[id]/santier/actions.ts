"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { execute, query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { parseNum } from "@/lib/numbers";
import { createSituation, SITUATION_STATUS } from "@/lib/site/situations";
import { TX_CATEGORIES } from "@/lib/site/finance";
import { deleteUpload } from "@/lib/storage";
import type { FormState } from "@/components/action-form";

async function ctx(projectId: number) {
  const user = await requireUser();
  if (!user.company) throw new Error("Fără firmă");
  const p = await queryOne<{ id: number }>("SELECT id FROM projects WHERE id = ? AND company_id = ?", [projectId, user.company.id]);
  if (!p) throw new Error("Proiectul nu există");
  return { user, companyId: user.company.id };
}
const s = (d: FormData, k: string, len = 255) => String(d.get(k) ?? "").trim().slice(0, len) || null;
const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const back = (id: number) => revalidatePath(`/panou/proiecte/${id}/santier`);

export async function setContractAction(_: FormState, data: FormData): Promise<FormState> {
  const projectId = Number(data.get("project_id"));
  const { companyId } = await ctx(projectId);
  const estimateId = Number(data.get("estimate_id")) || null;
  if (estimateId && !(await queryOne("SELECT id FROM estimates WHERE id = ? AND project_id = ? AND company_id = ?", [estimateId, projectId, companyId])))
    return { error: "Devizul nu aparține proiectului." };
  const raw = s(data, "contract_value", 30);
  const value = raw ? parseNum(raw) : null;
  if (raw && (value === null || value < 0)) return { error: "Valoarea contractului nu este validă." };
  await execute("UPDATE projects SET contract_estimate_id = ?, contract_value = ?, contract_date = ?, status = IF(status IN ('ofertare','licitatie'), 'in_executie', status) WHERE id = ?",
    [estimateId, value, date(s(data, "contract_date", 10)), projectId]);
  back(projectId);
  return { ok: "Contract salvat. Proiectul e acum în execuție." };
}

export async function newSituationAction(data: FormData): Promise<void> {
  const projectId = Number(data.get("project_id"));
  const { user, companyId } = await ctx(projectId);
  const p = await queryOne<{ contract_estimate_id: number | null }>("SELECT contract_estimate_id FROM projects WHERE id = ?", [projectId]);
  if (!p?.contract_estimate_id) redirect(`/panou/proiecte/${projectId}/santier?eroare=contract`);
  const id = await createSituation(companyId, projectId, p.contract_estimate_id, user.id);
  await logActivity({ companyId, userId: user.id, action: "situatie.creata", details: { projectId, id } });
  redirect(`/panou/proiecte/${projectId}/santier/situatii/${id}`);
}

export async function saveSituationAction(projectId: number, situationId: number, payload: {
  status: string; periodFrom: string | null; periodTo: string | null; notes: string | null; quantities: Record<number, number>;
}): Promise<{ ok: boolean; error?: string }> {
  const { user, companyId } = await ctx(projectId);
  const sit = await queryOne<{ id: number }>("SELECT id FROM work_situations WHERE id = ? AND project_id = ? AND company_id = ?", [situationId, projectId, companyId]);
  if (!sit) return { ok: false, error: "Situația nu există." };
  if (!(payload.status in SITUATION_STATUS)) return { ok: false, error: "Status invalid." };
  await execute("UPDATE work_situations SET status = ?, period_from = ?, period_to = ?, notes = ? WHERE id = ?",
    [payload.status, date(payload.periodFrom), date(payload.periodTo), payload.notes?.slice(0, 500) ?? null, situationId]);
  for (const [lineId, q] of Object.entries(payload.quantities)) {
    const qty = Number(q);
    if (!Number.isFinite(qty) || qty < 0) continue;
    await execute("UPDATE work_situation_lines SET qty_current = ? WHERE id = ? AND situation_id = ?", [qty, Number(lineId), situationId]);
  }
  await logActivity({ companyId, userId: user.id, action: "situatie.salvata", details: { situationId } });
  revalidatePath(`/panou/proiecte/${projectId}/santier`);
  return { ok: true };
}

export async function deleteSituationAction(data: FormData): Promise<void> {
  const projectId = Number(data.get("project_id"));
  const { companyId } = await ctx(projectId);
  await execute("DELETE FROM work_situations WHERE id = ? AND project_id = ? AND company_id = ?", [Number(data.get("id")), projectId, companyId]);
  revalidatePath(`/panou/proiecte/${projectId}/santier`);
  redirect(`/panou/proiecte/${projectId}/santier`);
}

export async function addTransactionAction(_: FormState, data: FormData): Promise<FormState> {
  const projectId = Number(data.get("project_id"));
  const { user, companyId } = await ctx(projectId);
  const kind = data.get("kind") === "incasare" ? "incasare" : "cheltuiala";
  const category = String(data.get("category"));
  const amount = parseNum(data.get("amount"));
  const d = date(s(data, "tx_date", 10));
  if (!(category in TX_CATEGORIES)) return { error: "Categorie invalidă." };
  if (amount === null || amount <= 0) return { error: "Suma nu este validă." };
  if (!d) return { error: "Alege data." };
  const sub = Number(data.get("subcontractor_id")) || null;
  await execute(
    "INSERT INTO project_transactions (company_id, project_id, kind, category, amount, tx_date, description, document_no, subcontractor_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [companyId, projectId, kind, category, amount, d, s(data, "description"), s(data, "document_no", 60), sub, user.id],
  );
  back(projectId);
  return { ok: kind === "incasare" ? "Încasare adăugată." : "Cheltuială adăugată." };
}

export async function deleteTransactionAction(data: FormData): Promise<void> {
  const projectId = Number(data.get("project_id"));
  const { companyId } = await ctx(projectId);
  await execute("DELETE FROM project_transactions WHERE id = ? AND project_id = ? AND company_id = ?", [Number(data.get("id")), projectId, companyId]);
  back(projectId);
}

export async function addSubcontractAction(_: FormState, data: FormData): Promise<FormState> {
  const projectId = Number(data.get("project_id"));
  const { companyId } = await ctx(projectId);
  const subId = Number(data.get("subcontractor_id"));
  if (!(await queryOne("SELECT id FROM subcontractors WHERE id = ? AND company_id = ?", [subId, companyId]))) return { error: "Alege subcontractantul." };
  const scope = s(data, "scope", 500);
  if (!scope) return { error: "Descrie lucrările subcontractate." };
  const value = parseNum(data.get("value")) ?? 0;
  await execute("INSERT INTO project_subcontracts (project_id, subcontractor_id, scope, value, status) VALUES (?, ?, ?, ?, ?)",
    [projectId, subId, scope, value, String(data.get("status") || "contractat")]);
  back(projectId);
  return { ok: "Subcontract adăugat." };
}

export async function deleteSubcontractAction(data: FormData): Promise<void> {
  const projectId = Number(data.get("project_id"));
  await ctx(projectId);
  await execute("DELETE FROM project_subcontracts WHERE id = ? AND project_id = ?", [Number(data.get("id")), projectId]);
  back(projectId);
}

export async function deleteJournalAction(data: FormData): Promise<void> {
  const projectId = Number(data.get("project_id"));
  const { companyId } = await ctx(projectId);
  const id = Number(data.get("id"));
  const photos = await query<{ file_path: string }>(
    "SELECT p.file_path FROM site_photos p JOIN site_journal j ON j.id = p.journal_id WHERE j.id = ? AND j.company_id = ?", [id, companyId]);
  await execute("DELETE FROM site_journal WHERE id = ? AND project_id = ? AND company_id = ?", [id, projectId, companyId]);
  for (const p of photos) await deleteUpload(p.file_path);
  back(projectId);
}
