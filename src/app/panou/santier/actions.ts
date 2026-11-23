"use server";

import { revalidatePath } from "next/cache";
import { execute } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/components/action-form";

const s = (d: FormData, k: string, len = 190) => String(d.get(k) ?? "").trim().slice(0, len) || null;

export async function saveSubcontractorAction(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.company) return { error: "Fără firmă." };
  const name = s(data, "name");
  if (!name) return { error: "Completează denumirea firmei." };
  const id = Number(data.get("id") || 0);
  const vals = [name, s(data, "cui", 20), s(data, "specialty"), s(data, "contact", 120), s(data, "phone", 40), s(data, "email"), s(data, "notes", 500)];
  if (id) await execute("UPDATE subcontractors SET name = ?, cui = ?, specialty = ?, contact = ?, phone = ?, email = ?, notes = ? WHERE id = ? AND company_id = ?", [...vals, id, user.company.id]);
  else await execute("INSERT INTO subcontractors (name, cui, specialty, contact, phone, email, notes, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [...vals, user.company.id]);
  revalidatePath("/panou/santier");
  return { ok: `„${name}” salvat.` };
}

export async function deleteSubcontractorAction(data: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.company) return;
  await execute("DELETE FROM subcontractors WHERE id = ? AND company_id = ?", [Number(data.get("id")), user.company.id]);
  revalidatePath("/panou/santier");
}
