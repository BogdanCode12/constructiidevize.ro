"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { execute, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import type { FormState } from "@/components/action-form";

const STATUSES = ["ofertare", "licitatie", "in_executie", "finalizat", "anulat"];
const TYPES = ["depunere", "clarificari", "deschidere", "garantie", "contract", "executie", "altul"];
const s = (d: FormData, k: string, len = 190) => String(d.get(k) ?? "").trim().slice(0, len) || null;

async function ownProject(id: number) {
  const user = await requireUser();
  if (!user.company) throw new Error("Fără firmă");
  const p = await queryOne<{ id: number }>("SELECT id FROM projects WHERE id = ? AND company_id = ?", [id, user.company.id]);
  if (!p) throw new Error("Proiectul nu există");
  return user;
}

export async function updateProjectAction(_: FormState, data: FormData): Promise<FormState> {
  const id = Number(data.get("id"));
  const user = await ownProject(id);
  const name = s(data, "name");
  const status = String(data.get("status"));
  if (!name) return { error: "Denumirea este obligatorie." };
  if (!STATUSES.includes(status)) return { error: "Status invalid." };
  await execute(
    "UPDATE projects SET name = ?, client_name = ?, authority = ?, notice_number = ?, location = ?, status = ?, notes = ? WHERE id = ?",
    [name, s(data, "client_name"), s(data, "authority"), s(data, "notice_number", 60), s(data, "location"), status, s(data, "notes", 5000), id],
  );
  await logActivity({ companyId: user.company!.id, userId: user.id, action: "proiect.modificat", details: { id } });
  revalidatePath(`/panou/proiecte/${id}`);
  revalidatePath("/panou/proiecte");
  return { ok: "Proiect salvat." };
}

export async function addDeadlineAction(_: FormState, data: FormData): Promise<FormState> {
  const id = Number(data.get("project_id"));
  await ownProject(id);
  const type = String(data.get("type"));
  const date = String(data.get("date") ?? "");
  const time = String(data.get("time") ?? "") || "12:00";
  const title = s(data, "title");
  if (!TYPES.includes(type)) return { error: "Tip invalid." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Alege data și ora." };
  await execute("INSERT INTO project_deadlines (project_id, type, title, due_at) VALUES (?, ?, ?, ?)", [id, type, title ?? "", `${date} ${time}:00`]);
  revalidatePath(`/panou/proiecte/${id}`);
  revalidatePath("/panou");
  return { ok: "Termen adăugat." };
}

export async function toggleDeadlineAction(data: FormData): Promise<void> {
  const id = Number(data.get("project_id"));
  await ownProject(id);
  await execute("UPDATE project_deadlines SET done = 1 - done WHERE id = ? AND project_id = ?", [Number(data.get("id")), id]);
  revalidatePath(`/panou/proiecte/${id}`);
  revalidatePath("/panou");
}

export async function deleteDeadlineAction(data: FormData): Promise<void> {
  const id = Number(data.get("project_id"));
  await ownProject(id);
  await execute("DELETE FROM project_deadlines WHERE id = ? AND project_id = ?", [Number(data.get("id")), id]);
  revalidatePath(`/panou/proiecte/${id}`);
  revalidatePath("/panou");
}

export async function deleteProjectAction(data: FormData): Promise<void> {
  const id = Number(data.get("id"));
  const user = await ownProject(id);
  await execute("DELETE FROM projects WHERE id = ? AND company_id = ?", [id, user.company!.id]);
  await logActivity({ companyId: user.company!.id, userId: user.id, action: "proiect.sters", details: { id } });
  revalidatePath("/panou/proiecte");
  redirect("/panou/proiecte");
}
