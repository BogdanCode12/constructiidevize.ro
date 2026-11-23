import "server-only";
import { execute } from "./db";

export async function logActivity(entry: {
  companyId?: number | null;
  userId?: number | null;
  action: string;
  details?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  try {
    await execute(
      "INSERT INTO activity_log (company_id, user_id, action, details, ip) VALUES (?, ?, ?, ?, ?)",
      [entry.companyId ?? null, entry.userId ?? null, entry.action, entry.details ? JSON.stringify(entry.details) : null, entry.ip ?? null],
    );
  } catch (err) {
    console.error("[activity] nu s-a putut scrie în jurnal", err);
  }
}
