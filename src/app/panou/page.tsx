import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { STATUS_LABEL } from "./proiecte/status";

export const metadata = { title: "Dashboard" };

const START_OPTIONS: { icon: string; title: string; text: string; tag?: string; href?: string }[] = [
  { icon: "spark", title: "Din documente, cu AI", text: "Încarcă planuri DTAC / PTh, PDF sau Excel.", tag: "Recomandat" },
  { icon: "doc", title: "Din lista F3", text: "Pornește de la listele de cantități ale licitației." },
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
      <PageHeader title={`Salut, ${user.name.split(" ")[0]}!`} subtitle={user.company?.name} />

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <div className="text-sm text-muted">{s.label}</div>
            <div className="mt-1 text-3xl font-bold">{s.value}</div>
          </Card>
        ))}
      </div>

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
