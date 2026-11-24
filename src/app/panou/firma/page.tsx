import { ActionForm } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getCompany, listMemberships } from "@/lib/company";
import { CompanyForm } from "./company-form";
import {
  changeMemberRoleAction, inviteMemberAction, removeMemberAction, revokeInvitationAction, switchCompanyAction,
} from "./actions";

export const metadata = { title: "Firmă & utilizatori" };

const ROLE = { owner: "Proprietar", admin: "Administrator", member: "Membru" } as const;
const fmt = new Intl.DateTimeFormat("ro-RO", { dateStyle: "short" });

export default async function CompanyPage({ searchParams }: { searchParams: Promise<{ eroare?: string }> }) {
  const user = await requireUser();
  const { eroare } = await searchParams;
  if (!user.company) return <PageHeader title="Firmă & utilizatori" subtitle="Contul nu are o firmă asociată." />;
  const company = (await getCompany(user.company.id))!;
  const canManage = user.company.memberRole !== "member";

  const members = await query<{ id: number; name: string; email: string; role: keyof typeof ROLE; last_login_at: Date | null }>(
    `SELECT u.id, u.name, u.email, cm.role, u.last_login_at FROM company_members cm JOIN users u ON u.id = cm.user_id
      WHERE cm.company_id = ? ORDER BY cm.created_at`,
    [company.id],
  );
  const invites = canManage
    ? await query<{ id: number; email: string; role: string; expires_at: Date }>(
        "SELECT id, email, role, expires_at FROM invitations WHERE company_id = ? AND accepted_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC",
        [company.id],
      )
    : [];
  const memberships = await listMemberships(user.id);

  return (
    <>
      <PageHeader title="Firmă & utilizatori" subtitle="Datele firmei se folosesc automat în declarații, formulare și exporturi." />
      {eroare === "drepturi" && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm">Acțiunea cere rol de proprietar sau administrator al firmei.</p>}
      {memberships.length > 1 && (
        <Card className="mb-6 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">Lucrezi în firma:</span>
          {memberships.map((m) => (
            <form key={m.id} action={switchCompanyAction}>
              <input type="hidden" name="company_id" value={m.id} />
              <button className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${m.id === company.id ? "bg-brand-700 text-white" : "border border-line hover:border-brand-200"}`}>{m.name}</button>
            </form>
          ))}
        </Card>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px] [&>*]:min-w-0">
        <Card>
          <h2 className="mb-4 font-bold">Datele firmei</h2>
          <CompanyForm company={company} canEdit={canManage} />
        </Card>
        <div className="space-y-6">
          <Card className="p-0">
            <div className="border-b border-line px-5 py-3.5 font-semibold">Utilizatori ({members.length})</div>
            <ul className="divide-y divide-line">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{m.name}{m.id === user.id && <span className="text-muted"> (tu)</span>}</div>
                    <div className="truncate text-sm text-muted">{m.email}</div>
                  </div>
                  {canManage && m.role !== "owner" && m.id !== user.id ? (
                    <div className="flex shrink-0 items-center gap-2 text-sm">
                      <form action={changeMemberRoleAction}>
                        <input type="hidden" name="user_id" value={m.id} />
                        <input type="hidden" name="role" value={m.role === "admin" ? "member" : "admin"} />
                        <button className="rounded border border-line px-2 py-1 hover:border-brand-200" title="Schimbă rolul">{ROLE[m.role]} ⇄</button>
                      </form>
                      <form action={removeMemberAction}>
                        <input type="hidden" name="user_id" value={m.id} />
                        <ConfirmSubmit message={`Elimini pe ${m.name} din firmă?`}>Elimină</ConfirmSubmit>
                      </form>
                    </div>
                  ) : (
                    <span className="shrink-0 text-sm text-muted">{ROLE[m.role]}</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          {canManage && (
            <Card>
              <h2 className="mb-1 font-bold">Invită un coleg</h2>
              <p className="mb-4 text-sm text-muted">Inginerul, ofertantul sau contabilul lucrează în aceleași proiecte și devize.</p>
              <ActionForm action={inviteMemberAction} submitLabel="Trimite invitația" resetOnSuccess>
                <input name="email" type="email" required placeholder="email@firma.ro" className="w-full rounded-lg border border-line px-3.5 py-2.5 outline-none focus:border-brand-500" />
                <select name="role" className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5">
                  <option value="member">Membru — lucrează în proiecte și devize</option>
                  <option value="admin">Administrator — poate gestiona firma și colegii</option>
                </select>
              </ActionForm>
              {invites.length > 0 && (
                <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                  {invites.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{i.email} <span className="text-muted">· {i.role === "admin" ? "admin" : "membru"} · până la {fmt.format(new Date(i.expires_at))}</span></span>
                      <form action={revokeInvitationAction}>
                        <input type="hidden" name="id" value={i.id} />
                        <button className="text-red-700 hover:underline">Anulează</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
