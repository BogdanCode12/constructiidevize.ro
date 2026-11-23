"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { execute, query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { deleteUpload } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import { aiConfigured } from "@/lib/ai/claude";
import { monthlyUsage, runChat, runJob } from "@/lib/ai/jobs";
import type { FormState } from "@/components/action-form";

async function context(projectId: number) {
  const user = await requireUser();
  if (!user.company) throw new Error("Fără firmă");
  const p = await queryOne<{ id: number }>("SELECT id FROM projects WHERE id = ? AND company_id = ?", [projectId, user.company.id]);
  if (!p) throw new Error("Proiectul nu există");
  return { user, companyId: user.company.id };
}

async function checkQuota(companyId: number): Promise<string | null> {
  if (!aiConfigured()) return "Asistentul AI nu este configurat încă pe platformă.";
  const { used, limit } = await monthlyUsage(companyId);
  if (used >= limit) return `Ai folosit toate cele ${limit} cereri AI incluse luna aceasta.`;
  return null;
}

export async function startAiJobAction(_: FormState, data: FormData): Promise<FormState> {
  const projectId = Number(data.get("project_id"));
  const { user, companyId } = await context(projectId);
  const quota = await checkQuota(companyId);
  if (quota) return { error: quota };

  const task = await queryOne<{ slug: string; name: string; needs_files: number }>(
    "SELECT slug, name, needs_files FROM ai_tasks WHERE slug = ? AND active = 1",
    [String(data.get("task"))],
  );
  if (!task) return { error: "Alege o analiză." };
  const requested = data.getAll("file_ids").map(Number).filter(Boolean);
  const files = requested.length
    ? await query<{ id: number }>("SELECT id FROM project_files WHERE project_id = ? AND company_id = ? AND id IN (?)", [projectId, companyId, requested])
    : [];
  if (task.needs_files && !files.length) return { error: "Bifează documentele pe care să le analizeze AI-ul." };
  const instructions = String(data.get("instructions") ?? "").trim().slice(0, 4000) || null;

  const res = await execute(
    "INSERT INTO ai_jobs (company_id, project_id, task_slug, task_name, file_ids, instructions, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [companyId, projectId, task.slug, task.name, JSON.stringify(files.map((f) => f.id)), instructions, user.id],
  );
  after(() => runJob(res.insertId));
  await logActivity({ companyId, userId: user.id, action: "ai.analiza", details: { task: task.slug, projectId } });
  redirect(`/panou/proiecte/${projectId}/ai/${res.insertId}`);
}

export async function sendChatAction(_: FormState, data: FormData): Promise<FormState> {
  const projectId = Number(data.get("project_id"));
  const { user, companyId } = await context(projectId);
  const text = String(data.get("message") ?? "").trim().slice(0, 8000);
  if (!text) return { error: "Scrie o întrebare." };
  const busy = await queryOne("SELECT id FROM ai_chat_messages WHERE project_id = ? AND status = 'pending'", [projectId]);
  if (busy) return { error: "Așteaptă răspunsul la întrebarea anterioară." };
  const quota = await checkQuota(companyId);
  if (quota) return { error: quota };

  await execute("INSERT INTO ai_chat_messages (company_id, project_id, role, content, created_by) VALUES (?, ?, 'user', ?, ?)", [companyId, projectId, text, user.id]);
  const a = await execute("INSERT INTO ai_chat_messages (company_id, project_id, role, content, status) VALUES (?, ?, 'assistant', '', 'pending')", [companyId, projectId]);
  after(() => runChat(a.insertId));
  revalidatePath(`/panou/proiecte/${projectId}/ai`);
  return { ok: " " };
}

export async function clearChatAction(data: FormData): Promise<void> {
  const projectId = Number(data.get("project_id"));
  await context(projectId);
  await execute("DELETE FROM ai_chat_messages WHERE project_id = ? AND status <> 'pending'", [projectId]);
  revalidatePath(`/panou/proiecte/${projectId}/ai`);
}

export async function deleteProjectFileAction(data: FormData): Promise<void> {
  const projectId = Number(data.get("project_id"));
  const { companyId } = await context(projectId);
  const f = await queryOne<{ file_path: string }>("SELECT file_path FROM project_files WHERE id = ? AND project_id = ? AND company_id = ?", [Number(data.get("id")), projectId, companyId]);
  if (!f) return;
  await execute("DELETE FROM project_files WHERE id = ?", [Number(data.get("id"))]);
  await deleteUpload(f.file_path);
  revalidatePath(`/panou/proiecte/${projectId}/ai`);
}

export async function deleteJobAction(data: FormData): Promise<void> {
  const projectId = Number(data.get("project_id"));
  const { companyId } = await context(projectId);
  await execute("DELETE FROM ai_jobs WHERE id = ? AND project_id = ? AND company_id = ?", [Number(data.get("id")), projectId, companyId]);
  revalidatePath(`/panou/proiecte/${projectId}/ai`);
  redirect(`/panou/proiecte/${projectId}/ai`);
}
