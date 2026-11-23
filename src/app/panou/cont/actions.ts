"use server";

import { redirect } from "next/navigation";
import { execute, query, queryOne, transaction } from "@/lib/db";
import { destroySession, requireUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { deleteUpload } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import type { FormState } from "@/components/action-form";

export async function updateProfileAction(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(data.get("name") ?? "").trim().slice(0, 120);
  if (name.length < 2) return { error: "Completează numele." };
  await execute("UPDATE users SET name = ? WHERE id = ?", [name, user.id]);
  return { ok: "Profil salvat." };
}

export async function changePasswordAction(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(data.get("current") ?? "");
  const next = String(data.get("next") ?? "");
  const row = await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", [user.id]);
  if (!row || !(await verifyPassword(current, row.password_hash))) return { error: "Parola actuală nu este corectă." };
  if (next.length < 8) return { error: "Parola nouă trebuie să aibă cel puțin 8 caractere." };
  await execute("UPDATE users SET password_hash = ? WHERE id = ?", [await hashPassword(next), user.id]);
  await logActivity({ userId: user.id, action: "parola.schimbata" });
  return { ok: "Parola a fost schimbată." };
}

/**
 * Ștergerea contului (dreptul la ștergere, GDPR). Firmele în care utilizatorul e singurul membru se șterg
 * cu tot conținutul și fișierele; în firmele cu alți membri, proprietatea trece la cel mai vechi coleg.
 */
export async function deleteAccountAction(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role === "admin") return { error: "Contul de administrator al platformei nu se poate șterge de aici." };
  const row = await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", [user.id]);
  if (!row || !(await verifyPassword(String(data.get("password") ?? ""), row.password_hash))) return { error: "Parola nu este corectă." };
  if (data.get("confirm") !== "STERGE") return { error: "Scrie STERGE pentru confirmare." };

  const memberships = await query<{ company_id: number; role: string; members: number }>(
    `SELECT cm.company_id, cm.role, (SELECT COUNT(*) FROM company_members x WHERE x.company_id = cm.company_id) AS members
       FROM company_members cm WHERE cm.user_id = ?`,
    [user.id],
  );
  const solo = memberships.filter((m) => Number(m.members) === 1).map((m) => m.company_id);
  const files = solo.length
    ? await query<{ file_path: string }>(
        `SELECT file_path FROM company_documents WHERE company_id IN (?) AND file_path IS NOT NULL
         UNION ALL SELECT file_path FROM project_files WHERE company_id IN (?)
         UNION ALL SELECT file_path FROM site_photos WHERE company_id IN (?)`,
        [solo, solo, solo],
      )
    : [];

  await transaction(async (conn) => {
    for (const m of memberships) {
      if (m.role === "owner" && Number(m.members) > 1) {
        await execute(
          `UPDATE company_members SET role = 'owner' WHERE company_id = ? AND user_id = (
             SELECT user_id FROM (SELECT user_id FROM company_members WHERE company_id = ? AND user_id <> ?
               ORDER BY (role = 'admin') DESC, created_at LIMIT 1) t)`,
          [m.company_id, m.company_id, user.id],
          conn,
        );
      }
    }
    if (solo.length) await execute("DELETE FROM companies WHERE id IN (?)", [solo], conn);
    await execute("DELETE FROM users WHERE id = ?", [user.id], conn);
  });
  for (const f of files) await deleteUpload(f.file_path);
  await logActivity({ action: "cont.sters", details: { userId: user.id } });
  await destroySession();
  redirect("/?cont=sters");
}
