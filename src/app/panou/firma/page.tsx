import { Card, PageHeader } from "@/components/ui";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Firmă & utilizatori" };

const ROLE = { owner: "Proprietar", admin: "Administrator", member: "Membru" } as const;

export default async function CompanyPage() {
  const user = await requireUser();
  const members = await query<{ id: number; name: string; email: string; role: keyof typeof ROLE }>(
    `SELECT u.id, u.name, u.email, cm.role FROM company_members cm JOIN users u ON u.id = cm.user_id
      WHERE cm.company_id = ? ORDER BY cm.created_at`,
    [user.company?.id ?? 0],
  );
  return (
    <>
      <PageHeader title="Firmă & utilizatori" subtitle={user.company?.name} />
      <Card className="p-0">
        <div className="border-b border-line px-5 py-3.5 font-semibold">Utilizatori</div>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="font-medium">{m.name}</div>
                <div className="text-sm text-muted">{m.email}</div>
              </div>
              <span className="text-sm text-muted">{ROLE[m.role]}</span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-4 text-sm text-muted">Datele firmei (CUI cu completare din ANAF) și invitarea colegilor urmează în pasul următor.</p>
    </>
  );
}
