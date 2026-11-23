"use server";

import { redirect } from "next/navigation";
import { execute, queryOne, transaction } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { clientIp, createSession, requireUser } from "@/lib/auth/session";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/auth/emails";
import { hashToken } from "@/lib/auth/tokens";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";
import type { FormState } from "@/components/action-form";
import { clearAttempts, LIMITS, recordAttempt, TOO_MANY, tooMany } from "@/lib/ratelimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (d: FormData, k: string) => String(d.get(k) ?? "").trim();

function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Parola trebuie să aibă cel puțin 8 caractere.";
  if (pw.length > 200) return "Parola este prea lungă.";
  return null;
}

export async function registerAction(_: FormState, data: FormData): Promise<FormState> {
  // Câmp-capcană invizibil: oamenii nu-l completează, roboții de spam da.
  if (str(data, "website")) return { error: "Înregistrarea nu a putut fi finalizată." };
  const ip = (await clientIp()) ?? "necunoscut";
  if (await tooMany(`register:ip:${ip}`, LIMITS.registerPerIp.max, LIMITS.registerPerIp.minutes)) return { error: TOO_MANY };
  await recordAttempt(`register:ip:${ip}`);
  const name = str(data, "name");
  const companyName = str(data, "company");
  const email = str(data, "email").toLowerCase();
  const password = String(data.get("password") ?? "");

  if (name.length < 2) return { error: "Completează numele." };
  if (companyName.length < 2) return { error: "Completează numele firmei." };
  if (!EMAIL_RE.test(email)) return { error: "Adresa de email nu este validă." };
  const pwErr = passwordProblem(password);
  if (pwErr) return { error: pwErr };
  if (data.get("terms") !== "on") return { error: "Trebuie să accepți termenii și politica de confidențialitate." };

  const passwordHash = await hashPassword(password);
  const { trial_days } = await getSettings();
  let userId: number;
  let companyId: number;
  try {
    ({ userId, companyId } = await transaction(async (conn) => {
      const u = await execute("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)", [email, passwordHash, name], conn);
      const c = await execute("INSERT INTO companies (name) VALUES (?)", [companyName], conn);
      await execute("INSERT INTO company_members (company_id, user_id, role) VALUES (?, ?, 'owner')", [c.insertId, u.insertId], conn);
      await execute(
        "INSERT INTO subscriptions (company_id, plan, status, trial_ends_at) VALUES (?, 'trial', 'trialing', DATE_ADD(NOW(), INTERVAL ? DAY))",
        [c.insertId, trial_days],
        conn,
      );
      return { userId: u.insertId, companyId: c.insertId };
    }));
  } catch (err) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") return { error: "Există deja un cont cu acest email." };
    console.error("[register]", err);
    return { error: "A apărut o eroare. Încearcă din nou." };
  }

  await sendVerificationEmail(userId, email, name).catch((e) => console.error("[register] email", e));
  await logActivity({ companyId, userId, action: "cont.creat", ip: await clientIp() });
  await createSession(userId);
  redirect("/panou");
}

export async function loginAction(_: FormState, data: FormData): Promise<FormState> {
  const email = str(data, "email").toLowerCase();
  const password = String(data.get("password") ?? "");
  const ip = (await clientIp()) ?? "necunoscut";
  const emailKey = `login:email:${email}`;
  const ipKey = `login:ip:${ip}`;
  if (
    (await tooMany(emailKey, LIMITS.loginPerEmail.max, LIMITS.loginPerEmail.minutes)) ||
    (await tooMany(ipKey, LIMITS.loginPerIp.max, LIMITS.loginPerIp.minutes))
  ) return { error: "Prea multe încercări greșite. Încearcă din nou peste 15 minute sau resetează parola." };
  const user = await queryOne<{ id: number; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = ?",
    [email],
  );
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await recordAttempt(emailKey);
    await recordAttempt(ipKey);
    return { error: "Email sau parolă greșită." };
  }
  await clearAttempts(emailKey);
  await createSession(user.id);
  await logActivity({ userId: user.id, action: "autentificare", ip: await clientIp() });
  const next = str(data, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/panou");
}

export async function forgotPasswordAction(_: FormState, data: FormData): Promise<FormState> {
  const email = str(data, "email").toLowerCase();
  const ip = (await clientIp()) ?? "necunoscut";
  if (
    (await tooMany(`reset:email:${email}`, LIMITS.resetPerEmail.max, LIMITS.resetPerEmail.minutes)) ||
    (await tooMany(`reset:ip:${ip}`, LIMITS.resetPerIp.max, LIMITS.resetPerIp.minutes))
  ) return { error: TOO_MANY };
  await recordAttempt(`reset:email:${email}`);
  await recordAttempt(`reset:ip:${ip}`);
  const user = await queryOne<{ id: number }>("SELECT id FROM users WHERE email = ?", [email]);
  if (user) await sendPasswordResetEmail(user.id, email).catch((e) => console.error("[forgot]", e));
  // Același mesaj indiferent dacă există contul (nu dezvăluim emailurile înregistrate).
  return { ok: "Dacă există un cont cu acest email, ți-am trimis un link de resetare." };
}

export async function resetPasswordAction(_: FormState, data: FormData): Promise<FormState> {
  const token = str(data, "token");
  const password = String(data.get("password") ?? "");
  const pwErr = passwordProblem(password);
  if (pwErr) return { error: pwErr };

  const row = await queryOne<{ id: number; user_id: number }>(
    "SELECT id, user_id FROM email_tokens WHERE token_hash = ? AND purpose = 'reset' AND used_at IS NULL AND expires_at > NOW()",
    [hashToken(token)],
  );
  if (!row) return { error: "Linkul a expirat sau a fost deja folosit. Cere unul nou." };

  await transaction(async (conn) => {
    await execute("UPDATE users SET password_hash = ? WHERE id = ?", [await hashPassword(password), row.user_id], conn);
    await execute("UPDATE email_tokens SET used_at = NOW() WHERE id = ?", [row.id], conn);
    await execute("DELETE FROM sessions WHERE user_id = ?", [row.user_id], conn);
  });
  const owner = await queryOne<{ email: string }>("SELECT email FROM users WHERE id = ?", [row.user_id]);
  if (owner) await clearAttempts(`login:email:${owner.email}`); // parola nouă deblochează logarea
  await logActivity({ userId: row.user_id, action: "parola.resetata", ip: await clientIp() });
  redirect("/autentificare?resetat=1");
}

export async function resendVerificationAction(): Promise<void> {
  const user = await requireUser();
  if (!user.emailVerified) await sendVerificationEmail(user.id, user.email, user.name);
  redirect("/panou?email=retrimis");
}
