import "server-only";
import { execute, queryOne } from "./db";

/*
 * Limitarea încercărilor (logare, înregistrare, resetare parolă), ținută în MySQL ca să funcționeze și cu
 * mai multe procese Node pe cPanel. Încercările mai vechi de o zi se șterg periodic.
 */

export async function tooMany(key: string, max: number, minutes: number): Promise<boolean> {
  const r = await queryOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM auth_attempts WHERE attempt_key = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)",
    [key.slice(0, 190), minutes],
  );
  return Number(r?.n ?? 0) >= max;
}

export async function recordAttempt(key: string): Promise<void> {
  await execute("INSERT INTO auth_attempts (attempt_key) VALUES (?)", [key.slice(0, 190)]);
  if (Math.random() < 0.02) await execute("DELETE FROM auth_attempts WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 DAY)");
}

export async function clearAttempts(key: string): Promise<void> {
  await execute("DELETE FROM auth_attempts WHERE attempt_key = ?", [key.slice(0, 190)]);
}

export const LIMITS = {
  loginPerEmail: { max: 5, minutes: 15 },
  loginPerIp: { max: 30, minutes: 15 },
  registerPerIp: { max: 5, minutes: 60 },
  resetPerEmail: { max: 3, minutes: 60 },
  resetPerIp: { max: 10, minutes: 60 },
};

export const TOO_MANY = "Prea multe încercări. Așteaptă puțin și încearcă din nou.";
