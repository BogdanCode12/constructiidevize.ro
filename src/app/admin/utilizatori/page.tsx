import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { query } from "@/lib/db";
import { getPlans, STATUS_LABEL, type PlanId } from "@/lib/plans";

export const metadata = { title: "Utilizatori · Admin" };

const fmt = new Intl.DateTimeFormat("ro-RO", { dateStyle: "short" });

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = q?.trim();
  const plans = await getPlans();
  const planName = (id: PlanId) => (id === "trial" ? "Probă" : plans.find((p) => p.id === id)?.name ?? id);
  const users = await query<{
    id: number; name: string; email: string; role: string; email_verified_at: Date | null; created_at: Date;
    last_login_at: Date | null; company: string | null; plan: PlanId | null; status: string | null; trial_ends_at: Date | null;
  }>(
    `SELECT u.id, u.name, u.email, u.role, u.email_verified_at, u.created_at, u.last_login_at,
            c.name AS company, s.plan, s.status, s.trial_ends_at
       FROM users u
       LEFT JOIN company_members cm ON cm.user_id = u.id
       LEFT JOIN companies c ON c.id = cm.company_id
       LEFT JOIN subscriptions s ON s.company_id = c.id
      ${term ? "WHERE u.name LIKE ? OR u.email LIKE ? OR c.name LIKE ? OR c.cui LIKE ?" : ""}
      GROUP BY u.id ORDER BY u.created_at DESC LIMIT 300`,
    term ? Array(4).fill(`%${term}%`) : [],
  );

  return (
    <>
      <PageHeader title="Utilizatori" subtitle={`${users.length} afișați`}>
        <form>
          <input name="q" defaultValue={q} placeholder="Caută nume, email, firmă, CUI" className="w-72 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />
        </form>
      </PageHeader>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>{["Nume", "Email", "Firmă", "Abonament", "Înregistrat", "Ultima logare"].map((h) => <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-canvas">
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <Link href={`/admin/utilizatori/${u.id}`} className="text-brand-700 hover:underline">{u.name}</Link>
                  {u.role === "admin" && <span className="ml-2 rounded bg-ink px-1.5 text-[10px] text-white">ADMIN</span>}
                </td>
                <td className="px-4 py-3">{u.email}{!u.email_verified_at && <span className="ml-2 text-xs text-amber-700">neconfirmat</span>}</td>
                <td className="px-4 py-3">{u.company ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {u.plan ? `${planName(u.plan)} · ${STATUS_LABEL[u.status ?? ""] ?? u.status}` : "—"}
                  {u.plan === "trial" && u.trial_ends_at && <div className="text-xs text-muted">până la {fmt.format(new Date(u.trial_ends_at))}</div>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{fmt.format(new Date(u.created_at))}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{u.last_login_at ? fmt.format(new Date(u.last_login_at)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
