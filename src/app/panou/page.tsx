import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
import { BuildingAnim } from "@/components/building-anim";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { STATUS_LABEL } from "./proiecte/status";
import { DEADLINE_TYPES } from "@/lib/deadlines";
import { expiryStatus } from "@/lib/documents";

const dt = new Intl.DateTimeFormat("ro-RO", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const metadata = { title: "Dashboard" };

const START_OPTIONS: { icon: string; title: string; text: string; tag?: string; href?: string }[] = [
  { icon: "spark", title: "Din documente, cu asistentul", text: "Încarcă caietul de sarcini, planșe, PDF sau Excel.", tag: "Recomandat", href: "/panou/asistent" },
  { icon: "doc", title: "Din lista F3", text: "Importă lista de cantități; articolele se potrivesc automat cu baza ta.", href: "/panou/devize" },
  { icon: "calc", title: "Deviz de la zero", text: "Capitole și articole, cu bazele tale de resurse.", href: "/panou/devize" },
];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const user = await requireUser();
  const { email } = await searchParams;
  const companyId = user.company?.id ?? 0;

  const counts = await queryOne<{ total: number; active: number; bidding: number }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(status = 'in_executie'), 0) AS active,
            COALESCE(SUM(status IN ('ofertare','licitatie')), 0) AS bidding
       FROM projects WHERE company_id = ?`,
    [companyId],
  );
  const recent = await query<{ id: number; name: string; client_name: string | null; status: keyof typeof STATUS_LABEL; updated_at: Date }>(
    "SELECT id, name, client_name, status, updated_at FROM projects WHERE company_id = ? ORDER BY updated_at DESC LIMIT 5",
    [companyId],
  );

  const deadlines = await query<{ id: number; type: keyof typeof DEADLINE_TYPES; title: string; due_at: Date; project_id: number; project: string }>(
    `SELECT d.id, d.type, d.title, d.due_at, p.id AS project_id, p.name AS project
       FROM project_deadlines d JOIN projects p ON p.id = d.project_id
      WHERE p.company_id = ? AND d.done = 0 AND d.due_at < DATE_ADD(NOW(), INTERVAL 14 DAY)
      ORDER BY d.due_at LIMIT 8`,
    [companyId],
  );
  const expiring = await query<{ id: number; title: string; expires_at: Date }>(
    `SELECT id, title, expires_at FROM company_documents
      WHERE company_id = ? AND expires_at IS NOT NULL AND expires_at < DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      ORDER BY expires_at LIMIT 8`,
    [companyId],
  );

  const stats = [
    { label: "Proiecte", value: Number(counts?.total ?? 0) },
    { label: "În ofertare / licitație", value: Number(counts?.bidding ?? 0) },
    { label: "În execuție", value: Number(counts?.active ?? 0) },
  ];

  return (
    <>
      {email === "retrimis" && (
        <p className="mb-6 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">Ți-am retrimis emailul de confirmare.</p>
      )}
      <section className="grid items-center gap-6 rounded-2xl border-2 border-ink/10 bg-white p-5 sm:p-7 lg:grid-cols-[1fr_minmax(300px,460px)]">
        <div className="min-w-0">
          <PageHeader title={`Salut, ${user.name.split(" ")[0]}!`} subtitle={user.company?.name} />
          <div className="grid gap-3 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border-2 border-ink/10 px-4 py-3.5">
                <div className="text-sm text-muted">{s.label}</div>
                <div className="mt-1 text-3xl font-bold">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden border-ink/10 sm:block lg:border-l-2 lg:pl-6">
          <BuildingAnim className="mx-auto w-full max-w-[460px]" />
        </div>
      </section>

      {(deadlines.length > 0 || expiring.length > 0) && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="p-0">
            <div className="border-b border-line px-5 py-3 font-semibold">Termene în următoarele 14 zile</div>
            {deadlines.length === 0 ? <p className="px-5 py-4 text-sm text-muted">Niciun termen apropiat.</p> : (
              <ul className="divide-y divide-line text-sm">
                {deadlines.map((d) => {
                  const late = new Date(d.due_at).getTime() < Date.now();
                  return (
                    <li key={d.id} className="flex items-center gap-3 px-5 py-2.5">
                      <span className={`w-32 shrink-0 whitespace-nowrap ${late ? "font-semibold text-red-700" : "text-muted"}`}>{dt.format(new Date(d.due_at))}</span>
                      <Link href={`/panou/proiecte/${d.project_id}`} className="min-w-0 flex-1 truncate hover:underline">
                        <b>{DEADLINE_TYPES[d.type]}</b> · {d.project}{d.title ? ` — ${d.title}` : ""}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card className="p-0">
            <div className="border-b border-line px-5 py-3 font-semibold">Documente care expiră</div>
            {expiring.length === 0 ? <p className="px-5 py-4 text-sm text-muted">Toate documentele sunt valabile.</p> : (
              <ul className="divide-y divide-line text-sm">
                {expiring.map((d) => {
                  const st = expiryStatus(d.expires_at);
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <Link href="/panou/documente" className="truncate hover:underline">{d.title}</Link>
                      <span className={`shrink-0 text-xs font-semibold ${st.tone === "expired" ? "text-red-700" : "text-amber-700"}`}>{st.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      <h2 className="mt-10 mb-4 text-lg font-bold">Începe o ofertă nouă</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {START_OPTIONS.map((o) => (
          <Card key={o.title} className="relative">
            {o.tag && <span className="absolute top-4 right-4 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{o.tag}</span>}
            <span className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon name={o.icon} /></span>
            <div className="mt-3 font-semibold">{o.title}</div>
            <p className="mt-1 text-sm text-muted">{o.text}</p>
            {o.href ? (
              <Link href={o.href} className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">Începe →</Link>
            ) : (
              <p className="mt-3 text-xs font-medium text-muted">În curând</p>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-10 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Proiecte recente</h2>
        <Link href="/panou/proiecte" className="text-sm font-semibold text-brand-700 hover:underline">Toate proiectele</Link>
      </div>
      <Card className="p-0">
        {recent.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold">Niciun proiect încă</p>
            <Link href="/panou/proiecte" className="mt-3 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
              Creează primul proiect
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="truncate text-sm text-muted">{p.client_name ?? "—"}</div>
                </div>
                <span className="shrink-0 rounded-full bg-canvas px-2.5 py-1 text-xs font-medium">{STATUS_LABEL[p.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
