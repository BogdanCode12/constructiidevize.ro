import { ButtonLink } from "@/components/ui";
import { execute, queryOne } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";

export const metadata = { title: "Confirmare email", robots: { index: false, follow: true } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const row = token
    ? await queryOne<{ id: number; user_id: number }>(
        "SELECT id, user_id FROM email_tokens WHERE token_hash = ? AND purpose = 'verify' AND used_at IS NULL AND expires_at > NOW()",
        [hashToken(token)],
      )
    : null;

  if (row) {
    await execute("UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?", [row.user_id]);
    await execute("UPDATE email_tokens SET used_at = NOW() WHERE id = ?", [row.id]);
  }

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold">{row ? "Email confirmat" : "Link invalid sau expirat"}</h1>
      <p className="mt-2 mb-6 text-muted">
        {row ? "Contul tău este activ." : "Din panou poți cere un nou email de confirmare."}
      </p>
      <ButtonLink href="/panou">Mergi la panou</ButtonLink>
    </div>
  );
}
