import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { execute, queryOne } from "../db";
import { hashToken, newToken } from "./tokens";
import type { PlanId } from "../plans";

export const SESSION_COOKIE = "cd_session";
/** Firma activă, când utilizatorul face parte din mai multe firme. */
export const COMPANY_COOKIE = "cd_company";
const SESSION_DAYS = 30;

export type CurrentUser = {
  id: number;
  email: string;
  name: string;
  role: "user" | "admin";
  emailVerified: boolean;
  company: {
    id: number;
    name: string;
    memberRole: "owner" | "admin" | "member";
    plan: PlanId;
    status: string;
    trialEndsAt: Date | null;
  } | null;
};

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function createSession(userId: number): Promise<void> {
  const token = newToken();
  const h = await headers();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await execute(
    "INSERT INTO sessions (id, user_id, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?)",
    [hashToken(token), userId, expires, await clientIp(), h.get("user-agent")?.slice(0, 255) ?? null],
  );
  await execute("UPDATE users SET last_login_at = NOW() WHERE id = ?", [userId]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await execute("DELETE FROM sessions WHERE id = ?", [hashToken(token)]);
  jar.delete(SESSION_COOKIE);
}

type Row = {
  id: number; email: string; name: string; role: "user" | "admin"; email_verified_at: Date | null;
  company_id: number | null; company_name: string | null; member_role: "owner" | "admin" | "member" | null;
  plan: PlanId | null; status: string | null; trial_ends_at: Date | null;
};

/** Utilizatorul logat (o singură interogare per request), sau null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const preferred = Number(jar.get(COMPANY_COOKIE)?.value) || 0;
  const row = await queryOne<Row>(
    `SELECT u.id, u.email, u.name, u.role, u.email_verified_at,
            c.id AS company_id, c.name AS company_name, cm.role AS member_role,
            s.plan, s.status, s.trial_ends_at
       FROM sessions se
       JOIN users u ON u.id = se.user_id
       LEFT JOIN company_members cm ON cm.user_id = u.id
       LEFT JOIN companies c ON c.id = cm.company_id
       LEFT JOIN subscriptions s ON s.company_id = c.id
      WHERE se.id = ? AND se.expires_at > NOW()
      ORDER BY (cm.company_id = ?) DESC, cm.created_at ASC
      LIMIT 1`,
    [hashToken(token), preferred],
  );
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    emailVerified: row.email_verified_at !== null,
    company: row.company_id
      ? {
          id: row.company_id,
          name: row.company_name ?? "",
          memberRole: row.member_role ?? "member",
          plan: row.plan ?? "trial",
          status: row.status ?? "expired",
          trialEndsAt: row.trial_ends_at,
        }
      : null,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/autentificare");
  return user;
}

/** Utilizator cu firmă, cu rol de proprietar sau administrator în firmă. */
export async function requireCompanyManager(): Promise<CurrentUser & { company: NonNullable<CurrentUser["company"]> }> {
  const user = await requireUser();
  if (!user.company || user.company.memberRole === "member") redirect("/panou/firma?eroare=drepturi");
  return user as CurrentUser & { company: NonNullable<CurrentUser["company"]> };
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/panou");
  return user;
}
