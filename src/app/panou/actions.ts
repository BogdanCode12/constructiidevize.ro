"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { execute } from "@/lib/db";
import { clientIp, destroySession, requireUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import type { FormState } from "@/components/action-form";

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/autentificare");
}

export async function createProjectAction(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.company) return { error: "Contul nu are o firmă asociată." };
  const name = String(data.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Completează numele proiectului." };
  const client = String(data.get("client") ?? "").trim() || null;
  const location = String(data.get("location") ?? "").trim() || null;

  const res = await execute(
    "INSERT INTO projects (company_id, name, client_name, location, created_by) VALUES (?, ?, ?, ?, ?)",
    [user.company.id, name.slice(0, 190), client?.slice(0, 190) ?? null, location?.slice(0, 190) ?? null, user.id],
  );
  await logActivity({ companyId: user.company.id, userId: user.id, action: "proiect.creat", details: { id: res.insertId, name }, ip: await clientIp() });
  revalidatePath("/panou");
  revalidatePath("/panou/proiecte");
  return { ok: `Proiectul „${name}” a fost creat.` };
}
