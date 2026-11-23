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
import { after } from "next/server";
import { matchLines, recipeItem, saveRecipe, searchRecipes, type MatchStatus, type RecipeHit } from "@/lib/recipes/repo";
import { parseF3Text, parseF3Xlsx } from "@/lib/estimate/f3";
import { aiConfigured } from "@/lib/ai/claude";
import { monthlyUsage } from "@/lib/ai/jobs";
import { runEstimatorJob, type EstimatorInput, type EstimatorProposal } from "@/lib/ai/estimator";
import type { EstItem } from "@/lib/estimate/types";

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

// ---------- Rețete, import F3, completare AI ----------


export async function searchRecipesAction(q: string, unit?: string): Promise<RecipeHit[]> {
  const { companyId } = await companyOf();
  return searchRecipes(companyId, q.slice(0, 200), unit?.slice(0, 20), 12);
}

export async function recipeItemAction(id: number): Promise<EstItem | null> {
  const { companyId } = await companyOf();
  return recipeItem(companyId, Number(id));
}

export async function saveRecipeAction(item: EstItem, global: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user, companyId } = await companyOf();
  if (global && user.role !== "admin") return { ok: false, error: "Doar administratorul platformei poate salva rețete globale." };
  if (!item.name.trim() || !item.unit.trim() || !item.resources.length) return { ok: false, error: "Articolul are nevoie de denumire, U.M. și resurse." };
  await saveRecipe(global ? null : companyId, item, user.id);
  await logActivity({ companyId, userId: user.id, action: "reteta.salvata", details: { name: item.name, global } });
  return { ok: true };
}

export type ImportResult =
  | { ok: true; chapters: { name: string; items: EstItem[] }[]; stats: Record<MatchStatus, number> }
  | { ok: false; error: string };

export async function importF3Action(data: FormData): Promise<ImportResult> {
  const { user, companyId } = await companyOf();
  const file = data.get("file");
  const text = String(data.get("text") ?? "");
  let chapters;
  try {
    if (file instanceof File && file.size > 0) {
      if (!/\.xlsx$/i.test(file.name)) return { ok: false, error: "Încarcă un fișier .xlsx (sau lipește rândurile din Excel)." };
      if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Fișierul depășește 10 MB." };
      chapters = await parseF3Xlsx(await file.arrayBuffer());
    } else if (text.trim()) chapters = parseF3Text(text);
    else return { ok: false, error: "Lipește rândurile din Excel sau alege un fișier." };
  } catch (err) {
    console.error("[f3]", err);
    return { ok: false, error: "Fișierul nu a putut fi citit." };
  }
  const total = chapters.reduce((s, c) => s + c.lines.length, 0);
  if (!total) return { ok: false, error: "N-am găsit articole (denumire + U.M. + cantitate)." };
  if (total > 2000) return { ok: false, error: "Maxim 2000 de articole la un import." };

  const stats: Record<MatchStatus, number> = { exact: 0, propus: 0, cache: 0, negasit: 0 };
  const out = [];
  for (const ch of chapters) {
    const matched = await matchLines(companyId, ch.lines);
    matched.forEach((m) => stats[m.status]++);
    out.push({ name: ch.name, items: matched.map((m) => m.item) });
  }
  await logActivity({ companyId, userId: user.id, action: "deviz.import_f3", details: { total, ...stats } });
  return { ok: true, chapters: out, stats };
}

export async function startEstimatorAction(estimateId: number, items: EstimatorInput[]): Promise<{ ok: true; jobId: number } | { ok: false; error: string }> {
  const { user, companyId } = await companyOf();
  if (!aiConfigured()) return { ok: false, error: "Asistentul AI nu este configurat încă pe platformă." };
  const est = await queryOne<{ project_id: number }>("SELECT project_id FROM estimates WHERE id = ? AND company_id = ?", [estimateId, companyId]);
  if (!est) return { ok: false, error: "Devizul nu există." };
  const clean = items
    .filter((i) => i.name?.trim())
    .slice(0, 300)
    .map((i) => ({ ref: String(i.ref).slice(0, 60), code: String(i.code ?? "").slice(0, 40), name: String(i.name).slice(0, 300), unit: String(i.unit ?? "").slice(0, 20) }));
  if (!clean.length) return { ok: false, error: "Nu există articole de completat." };
  const { used, limit } = await monthlyUsage(companyId);
  if (used >= limit) return { ok: false, error: `Ai folosit toate cele ${limit} cereri AI incluse luna aceasta.` };

  const res = await execute(
    "INSERT INTO ai_jobs (company_id, project_id, task_slug, task_name, instructions, created_by) VALUES (?, ?, 'deviz_ai', ?, ?, ?)",
    [companyId, est.project_id, `Completare deviz (${clean.length} articole)`, JSON.stringify(clean), user.id],
  );
  after(() => runEstimatorJob(res.insertId));
  return { ok: true, jobId: res.insertId };
}

export async function estimatorJobAction(jobId: number): Promise<{ status: string; proposals?: EstimatorProposal[]; error?: string }> {
  const { companyId } = await companyOf();
  const job = await queryOne<{ status: string; output: string | null; error: string | null }>(
    "SELECT status, output, error FROM ai_jobs WHERE id = ? AND company_id = ? AND task_slug = 'deviz_ai'",
    [jobId, companyId],
  );
  if (!job) return { status: "error", error: "Lucrarea nu există." };
  if (job.status === "done") return { status: "done", proposals: JSON.parse(job.output ?? "[]") };
  return { status: job.status, error: job.error ?? undefined };
}

