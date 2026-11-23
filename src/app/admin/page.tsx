import { Card, PageHeader } from "@/components/ui";
import { query, queryOne } from "@/lib/db";
import Link from "next/link";
import { getPlans, STATUS_LABEL, type PlanId } from "@/lib/plans";

export const metadata = { title: "Admin" };

const fmt = new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short" });

export default async function AdminPage() {
  const totals = await queryOne<{ users: number; companies: number; paying: number; trial: number; projects: number }>(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM companies) AS companies,
            (SELECT COUNT(*) FROM subscriptions WHERE status = 'active' AND plan <> 'trial') AS paying,
            (SELECT COUNT(*) FROM subscriptions WHERE status = 'trialing') AS trial,
            (SELECT COUNT(*) FROM projects) AS projects`,
  );
  const users = await query<{
    id: number; name: string; email: string; role: string; email_verified_at: Date | null;
    created_at: Date; last_login_at: Date | null; company: string | null; plan: PlanId | null; status: string | null;
  }>(
    `SELECT u.id, u.name, u.email, u.role, u.email_verified_at, u.created_at, u.last_login_at,
            c.name AS company, s.plan, s.status
       FROM users u
       LEFT JOIN company_members cm ON cm.user_id = u.id AND cm.role = 'owner'
       LEFT JOIN companies c ON c.id = cm.company_id
       LEFT JOIN subscriptions s ON s.company_id = c.id
      ORDER BY u.created_at DESC LIMIT 100`,
  );

  const plans = await getPlans();
  const planName = (id: PlanId) => (id === "trial" ? "Probă" : plans.find((p) => p.id === id)?.name ?? id);

  const stats = [
    ["Utilizatori", totals?.users], ["Firme", totals?.companies], ["Abonați plătitori", totals?.paying],
    ["În probă", totals?.trial], ["Proiecte", totals?.projects],
  ] as const;

  return (
    <>
      <PageHeader title="Admin platformă" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map(([label, v]) => (
          <Card key={label}><div className="text-sm text-muted">{label}</div><div className="mt-1 text-2xl font-bold">{Number(v ?? 0)}</div></Card>
        ))}
      </div>
      <h2 className="mt-10 mb-4 text-lg font-bold">Utilizatori recenți</h2>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>{["Nume", "Email", "Firmă", "Plan", "Înregistrat", "Ultima logare"].map((h) => <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium whitespace-nowrap"><Link href={`/admin/utilizatori/${u.id}`} className="text-brand-700 hover:underline">{u.name}</Link>{u.role === "admin" && <span className="ml-2 rounded bg-ink px-1.5 text-[10px] text-white">ADMIN</span>}</td>
                <td className="px-4 py-3">{u.email}{!u.email_verified_at && <span className="ml-2 text-xs text-amber-700">neconfirmat</span>}</td>
                <td className="px-4 py-3">{u.company ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">{u.plan ? `${planName(u.plan)} · ${STATUS_LABEL[u.status ?? ""] ?? u.status}` : "—"}</td>
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
