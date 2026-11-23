import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, Field, PageHeader } from "@/components/ui";
import { query, queryOne } from "@/lib/db";
import { getPlans } from "@/lib/plans";
import { requireAdmin } from "@/lib/auth/session";
import {
  deleteUserAction, logoutUserEverywhereAction, updateCompanyAction, updateSubscriptionAction, updateUserAction,
} from "../../actions";

export const metadata = { title: "Editare utilizator · Admin" };

const sel = "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 outline-none focus:border-brand-500";
const d = (v: Date | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");
const fmt = new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short" });

export default async function AdminUserPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ deconectat?: string }>;
}) {
  const me = await requireAdmin();
  const id = Number((await params).id);
  const { deconectat } = await searchParams;
  const u = await queryOne<{ id: number; name: string; email: string; role: string; email_verified_at: Date | null; created_at: Date; last_login_at: Date | null }>(
    "SELECT id, name, email, role, email_verified_at, created_at, last_login_at FROM users WHERE id = ?",
    [id],
  );
  if (!u) notFound();

  const companies = await query<{
    id: number; name: string; cui: string | null; reg_com: string | null; address: string | null; county: string | null; phone: string | null;
    member_role: string; plan: string | null; status: string | null; billing_interval: string | null;
    trial_ends_at: Date | null; current_period_end: Date | null; projects: number; estimates: number;
  }>(
    `SELECT c.id, c.name, c.cui, c.reg_com, c.address, c.county, c.phone, cm.role AS member_role,
            s.plan, s.status, s.billing_interval, s.trial_ends_at, s.current_period_end,
            (SELECT COUNT(*) FROM projects p WHERE p.company_id = c.id) AS projects,
            (SELECT COUNT(*) FROM estimates e WHERE e.company_id = c.id) AS estimates
       FROM company_members cm JOIN companies c ON c.id = cm.company_id
       LEFT JOIN subscriptions s ON s.company_id = c.id
      WHERE cm.user_id = ?`,
    [id],
  );
  const activity = await query<{ action: string; created_at: Date; ip: string | null }>(
    "SELECT action, created_at, ip FROM activity_log WHERE user_id = ? ORDER BY id DESC LIMIT 15",
    [id],
  );
  const plans = await getPlans();

  return (
    <>
      <Link href="/admin/utilizatori" className="text-sm text-muted hover:text-ink">← Utilizatori</Link>
      <PageHeader title={u.name} subtitle={`Înregistrat ${fmt.format(new Date(u.created_at))} · ultima logare ${u.last_login_at ? fmt.format(new Date(u.last_login_at)) : "—"}`} />
      {deconectat && <p className="mb-4 rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-800">Utilizatorul a fost deconectat de pe toate dispozitivele.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-bold">Cont</h2>
          <ActionForm action={updateUserAction} submitLabel="Salvează contul">
            <input type="hidden" name="id" value={u.id} />
            <Field label="Nume" name="name" defaultValue={u.name} />
            <Field label="Email" name="email" type="email" defaultValue={u.email} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Rol</span>
              <select name="role" defaultValue={u.role} className={sel}>
                <option value="user">Utilizator</option>
                <option value="admin">Administrator platformă</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="verified" defaultChecked={!!u.email_verified_at} className="size-4 accent-brand-700" /> Email confirmat
            </label>
          </ActionForm>
          <div className="mt-6 flex flex-wrap gap-4 border-t border-line pt-4 text-sm">
            <form action={logoutUserEverywhereAction}>
              <input type="hidden" name="id" value={u.id} />
              <button className="font-semibold text-brand-700 hover:underline">Deconectează de pe toate dispozitivele</button>
            </form>
            {u.id !== me.id && (
              <form action={deleteUserAction}>
                <input type="hidden" name="id" value={u.id} />
                <ConfirmSubmit message={`Ștergi definitiv contul lui ${u.name}? Se șterg și firmele în care e singurul membru, cu proiectele și devizele lor.`}>Șterge contul</ConfirmSubmit>
              </form>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">Activitate recentă</h2>
          {activity.length === 0 ? <p className="text-sm text-muted">Nimic încă.</p> : (
            <ul className="space-y-1.5 text-sm">
              {activity.map((a, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{a.action}</span>
                  <span className="whitespace-nowrap text-muted">{fmt.format(new Date(a.created_at))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {companies.map((c) => (
          <Card key={c.id} className="lg:col-span-2">
            <h2 className="font-bold">Firmă: {c.name}</h2>
            <p className="mb-4 text-sm text-muted">Rol în firmă: {c.member_role} · {Number(c.projects)} proiecte · {Number(c.estimates)} devize</p>
            <div className="grid gap-8 lg:grid-cols-2">
              <ActionForm action={updateSubscriptionAction} submitLabel="Salvează abonamentul">
                <input type="hidden" name="company_id" value={c.id} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Plan</span>
                    <select name="plan" defaultValue={c.plan ?? "trial"} className={sel}>
                      <option value="trial">Perioadă de probă</option>
                      {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Status</span>
                    <select name="status" defaultValue={c.status ?? "trialing"} className={sel}>
                      <option value="trialing">În probă</option>
                      <option value="active">Activ</option>
                      <option value="past_due">Plată restantă</option>
                      <option value="canceled">Anulat</option>
                      <option value="expired">Expirat</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">Facturare</span>
                    <select name="interval" defaultValue={c.billing_interval ?? ""} className={sel}>
                      <option value="">—</option>
                      <option value="month">Lunar</option>
                      <option value="year">Anual</option>
                    </select>
                  </label>
                  <div />
                  <Field label="Probă până la" name="trial_ends_at" type="date" required={false} defaultValue={d(c.trial_ends_at)} />
                  <Field label="Plătit până la" name="current_period_end" type="date" required={false} defaultValue={d(c.current_period_end)} />
                </div>
              </ActionForm>
              <ActionForm action={updateCompanyAction} submitLabel="Salvează firma">
                <input type="hidden" name="company_id" value={c.id} />
                <Field label="Denumire" name="company_name" defaultValue={c.name} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CUI" name="cui" required={false} defaultValue={c.cui ?? ""} />
                  <Field label="Nr. Reg. Com." name="reg_com" required={false} defaultValue={c.reg_com ?? ""} />
                  <Field label="Județ" name="county" required={false} defaultValue={c.county ?? ""} />
                  <Field label="Telefon" name="phone" required={false} defaultValue={c.phone ?? ""} />
                </div>
                <Field label="Adresă" name="address" required={false} defaultValue={c.address ?? ""} />
              </ActionForm>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

