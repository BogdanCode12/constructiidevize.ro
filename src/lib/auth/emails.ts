import "server-only";
import { execute } from "../db";
import { appUrl, emailLayout, sendMail } from "../email";
import { hashToken, newToken } from "./tokens";

export async function sendVerificationEmail(userId: number, email: string, name: string): Promise<void> {
  const token = newToken();
  await execute(
    "INSERT INTO email_tokens (user_id, token_hash, purpose, expires_at) VALUES (?, ?, 'verify', DATE_ADD(NOW(), INTERVAL 2 DAY))",
    [userId, hashToken(token)],
  );
  const link = appUrl(`/confirmare-email?token=${token}`);
  await sendMail(
    email,
    "Confirmă adresa de email",
    emailLayout(`Bun venit, ${escapeHtml(name)}!`, "<p>Confirmă adresa de email ca să-ți activezi contul.</p>", {
      label: "Confirmă emailul",
      href: link,
    }),
  );
}

export async function sendPasswordResetEmail(userId: number, email: string): Promise<void> {
  const token = newToken();
  await execute(
    "INSERT INTO email_tokens (user_id, token_hash, purpose, expires_at) VALUES (?, ?, 'reset', DATE_ADD(NOW(), INTERVAL 1 HOUR))",
    [userId, hashToken(token)],
  );
  const link = appUrl(`/resetare-parola?token=${token}`);
  await sendMail(
    email,
    "Resetare parolă",
    emailLayout("Resetare parolă", "<p>Ai cerut resetarea parolei. Linkul e valabil o oră. Dacă nu ai cerut tu, ignoră acest email.</p>", {
      label: "Setează o parolă nouă",
      href: link,
    }),
  );
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
