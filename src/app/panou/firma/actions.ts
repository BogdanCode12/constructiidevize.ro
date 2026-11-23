"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { execute, queryOne } from "@/lib/db";
import { COMPANY_COOKIE, requireCompanyManager, requireUser } from "@/lib/auth/session";
import { anafLookup, listMemberships, type AnafCompany } from "@/lib/company";
import { hashToken, newToken } from "@/lib/auth/tokens";
import { appUrl, emailLayout, sendMail } from "@/lib/email";
import { escapeHtml } from "@/lib/auth/emails";
import { logActivity } from "@/lib/activity";
import { getPlans } from "@/lib/plans";
import type { FormState } from "@/components/action-form";

const s = (d: FormData, k: string, len = 190) => String(d.get(k) ?? "").trim().slice(0, len) || null;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateCompanyProfileAction(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireCompanyManager();
  const name = s(data, "name");
  if (!name) return { error: "Denumirea firmei este obligatorie." };
  await execute(
    `UPDATE companies SET name = ?, cui = ?, reg_com = ?, address = ?, county = ?, phone = ?, email = ?,
       legal_rep = ?, legal_rep_role = ?, iban = ?, bank = ?, caen = ? WHERE id = ?`,
    [
      name, s(data, "cui", 20), s(data, "reg_com", 40), s(data, "address", 255), s(data, "county", 60), s(data, "phone", 40),
      s(data, "email"), s(data, "legal_rep", 120), s(data, "legal_rep_role", 80), s(data, "iban", 40)?.replace(/\s/g, "") ?? null,
      s(data, "bank", 120), s(data, "caen", 10), user.company.id,
    ],
  );
  await logActivity({ companyId: user.company.id, userId: user.id, action: "firma.modificata" });
  revalidatePath("/panou", "layout");
  return { ok: "Datele firmei au fost salvate." };
}

export async function anafLookupAction(cui: string): Promise<{ ok: true; data: AnafCompany } | { ok: false; error: string }> {
  await requireUser();
  try {
    const data = await anafLookup(cui);
    return data ? { ok: true, data } : { ok: false, error: "CUI-ul nu a fost găsit la ANAF." };
  } catch (err) {
    console.error("[anaf]", err);
    return { ok: false, error: "ANAF nu răspunde acum. Încearcă din nou sau completează manual." };
  }
}

async function seatLimit(companyId: number): Promise<number> {
  const sub = await queryOne<{ plan: string }>("SELECT plan FROM subscriptions WHERE company_id = ?", [companyId]);
  if (!sub || sub.plan === "trial") return 3;
  return (await getPlans()).find((p) => p.id === sub.plan)?.maxUsers ?? 1;
}

export async function inviteMemberAction(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireCompanyManager();
  const email = String(data.get("email") ?? "").trim().toLowerCase();
  const role = data.get("role") === "admin" ? "admin" : "member";
  if (!EMAIL_RE.test(email)) return { error: "Email invalid." };

  const used = await queryOne<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM company_members WHERE company_id = ?)
          + (SELECT COUNT(*) FROM invitations WHERE company_id = ? AND accepted_at IS NULL AND expires_at > NOW()) AS n`,
    [user.company.id, user.company.id],
  );
  const limit = await seatLimit(user.company.id);
  if (Number(used?.n ?? 0) >= limit) return { error: `Planul curent permite ${limit} utilizatori. Schimbă planul pentru mai mulți.` };

  const already = await queryOne<{ x: number }>(
    "SELECT 1 AS x FROM company_members cm JOIN users u ON u.id = cm.user_id WHERE cm.company_id = ? AND u.email = ?",
    [user.company.id, email],
  );
  if (already) return { error: "Persoana face deja parte din firmă." };

  const token = newToken();
  await execute("DELETE FROM invitations WHERE company_id = ? AND email = ? AND accepted_at IS NULL", [user.company.id, email]);
  await execute(
    "INSERT INTO invitations (company_id, email, role, token_hash, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))",
    [user.company.id, email, role, hashToken(token), user.id],
  );
  const link = appUrl(`/invitatie?token=${token}`);
  await sendMail(
    email,
    `Invitație în ${user.company.name}`,
    emailLayout("Ai fost invitat", `<p>${escapeHtml(user.name)} te invită să lucrezi în contul firmei <b>${escapeHtml(user.company.name)}</b> pe ConstructiiDevize.ro.</p>`, {
      label: "Acceptă invitația",
      href: link,
    }),
  ).catch((e) => console.error("[invite] email", e));
  await logActivity({ companyId: user.company.id, userId: user.id, action: "coleg.invitat", details: { email, role } });
  revalidatePath("/panou/firma");
  return { ok: `Invitație trimisă către ${email}. Linkul (valabil 7 zile): ${link}` };
}

export async function revokeInvitationAction(data: FormData): Promise<void> {
  const user = await requireCompanyManager();
  await execute("DELETE FROM invitations WHERE id = ? AND company_id = ?", [Number(data.get("id")), user.company.id]);
  revalidatePath("/panou/firma");
}

export async function changeMemberRoleAction(data: FormData): Promise<void> {
  const user = await requireCompanyManager();
  const memberId = Number(data.get("user_id"));
  const role = data.get("role") === "admin" ? "admin" : "member";
  if (memberId === user.id) return;
  await execute("UPDATE company_members SET role = ? WHERE company_id = ? AND user_id = ? AND role <> 'owner'", [role, user.company.id, memberId]);
  revalidatePath("/panou/firma");
}

export async function removeMemberAction(data: FormData): Promise<void> {
  const user = await requireCompanyManager();
  const memberId = Number(data.get("user_id"));
  if (memberId === user.id) return;
  await execute("DELETE FROM company_members WHERE company_id = ? AND user_id = ? AND role <> 'owner'", [user.company.id, memberId]);
  await logActivity({ companyId: user.company.id, userId: user.id, action: "coleg.eliminat", details: { memberId } });
  revalidatePath("/panou/firma");
}

export async function switchCompanyAction(data: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(data.get("company_id"));
  const ok = (await listMemberships(user.id)).some((m) => m.id === id);
  if (ok) (await cookies()).set(COMPANY_COOKIE, String(id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/panou");
}
