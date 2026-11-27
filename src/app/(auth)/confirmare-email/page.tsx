import { ButtonLink } from "@/components/ui";
import { execute, queryOne } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { sendWelcomeEmail } from "@/lib/auth/emails";

export const metadata = { title: "Confirmare email", robots: { index: false, follow: true } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const row = token
    ? await queryOne<{ id: number; user_id: number; email: string; name: string; verified: Date | null }>(
        `SELECT t.id, t.user_id, u.email, u.name, u.email_verified_at AS verified
           FROM email_tokens t JOIN users u ON u.id = t.user_id
          WHERE t.token_hash = ? AND t.purpose = 'verify' AND t.used_at IS NULL AND t.expires_at > NOW()`,
        [hashToken(token)],
      )
    : null;

  if (row) {
    await execute("UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?", [row.user_id]);
    await execute("UPDATE email_tokens SET used_at = NOW() WHERE id = ?", [row.id]);
    if (!row.verified) {
      // E-mail de bun venit, o singură dată (la prima confirmare), cu zilele de probă rămase ale firmei proprii.
      const trial = await queryOne<{ days: number }>(
        `SELECT GREATEST(0, DATEDIFF(s.trial_ends_at, NOW())) AS days FROM company_members cm JOIN subscriptions s ON s.company_id = cm.company_id
          WHERE cm.user_id = ? AND cm.role = 'owner' AND s.plan = 'trial' ORDER BY cm.company_id LIMIT 1`,
        [row.user_id],
      );
      await sendWelcomeEmail(row.email, row.name, trial ? Number(trial.days) : null).catch((e) => console.error("[welcome]", e));
    }
  }

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold">{row ? "Adresa de e-mail a fost confirmată" : "Link invalid sau expirat"}</h1>
      <p className="mt-2 mb-6 text-muted">
        {row ? "Contul tău este activ. Poți începe lucrul." : "Linkul a expirat sau a fost deja folosit. Intră în cont și cere un e-mail nou de confirmare."}
      </p>
      <ButtonLink href="/panou">{row ? "Intră în cont" : "Mergi la cont"}</ButtonLink>
    </div>
  );
}
