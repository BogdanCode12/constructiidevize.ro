"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { execute, queryOne, transaction } from "@/lib/db";
import { findInvitation, type Invitation } from "@/lib/invitations";
import { hashToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { COMPANY_COOKIE, createSession, getCurrentUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import type { FormState } from "@/components/action-form";

async function join(inv: Invitation, userId: number) {
  await transaction(async (conn) => {
    await execute("INSERT IGNORE INTO company_members (company_id, user_id, role) VALUES (?, ?, ?)", [inv.company_id, userId, inv.role], conn);
    await execute("UPDATE invitations SET accepted_at = NOW() WHERE id = ?", [inv.id], conn);
  });
  (await cookies()).set(COMPANY_COOKIE, String(inv.company_id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  await logActivity({ companyId: inv.company_id, userId, action: "invitatie.acceptata" });
}

export async function acceptInvitationAction(data: FormData): Promise<void> {
  const user = await getCurrentUser();
  const inv = await findInvitation(String(data.get("token") ?? ""));
  if (!user || !inv) redirect("/panou");
  await join(inv, user.id);
  redirect("/panou");
}

export async function registerFromInvitationAction(_: FormState, data: FormData): Promise<FormState> {
  const inv = await findInvitation(String(data.get("token") ?? ""));
  if (!inv) return { error: "Invitația a expirat sau a fost folosită." };
  const name = String(data.get("name") ?? "").trim().slice(0, 120);
  const password = String(data.get("password") ?? "");
  if (name.length < 2) return { error: "Completează numele." };
  if (password.length < 8) return { error: "Parola trebuie să aibă cel puțin 8 caractere." };
  if (await queryOne("SELECT id FROM users WHERE email = ?", [inv.email])) {
    return { error: "Există deja un cont cu acest email. Autentifică-te, apoi deschide din nou linkul invitației." };
  }
  // Emailul e confirmat implicit: invitația a ajuns pe el.
  const u = await execute(
    "INSERT INTO users (email, password_hash, name, email_verified_at) VALUES (?, ?, ?, NOW())",
    [inv.email, await hashPassword(password), name],
  );
  await join(inv, u.insertId);
  await createSession(u.insertId);
  redirect("/panou");
}
