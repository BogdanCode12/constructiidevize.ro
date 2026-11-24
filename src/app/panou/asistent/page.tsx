import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { aiConfigured } from "@/lib/ai/claude";
import { listAiTasks, monthlyUsage } from "@/lib/ai/jobs";

export const metadata = { title: "Asistent tehnic" };

const dt = new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short" });

export default async function AssistantPage() {
  const user = await requireUser();
  const companyId = user.company?.id ?? 0;
  const [projects, recent, tasks, usage] = await Promise.all([
    query<{ id: number; name: string; files: number; jobs: number }>(
      `SELECT p.id, p.name,
              (SELECT COUNT(*) FROM project_files f WHERE f.project_id = p.id) AS files,
              (SELECT COUNT(*) FROM ai_jobs j WHERE j.project_id = p.id) AS jobs
         FROM projects p WHERE p.company_id = ? AND p.status <> 'anulat' ORDER BY p.updated_at DESC`,
      [companyId],
    ),
    query<{ id: number; project_id: number; project: string; task_name: string; status: string; created_at: Date }>(
      `SELECT j.id, j.project_id, p.name AS project, j.task_name, j.status, j.created_at
         FROM ai_jobs j JOIN projects p ON p.id = j.project_id WHERE j.company_id = ? ORDER BY j.id DESC LIMIT 10`,
      [companyId],
    ),
    listAiTasks(),
    monthlyUsage(companyId),
  ]);

  return (
    <>
      <PageHeader title="Asistent tehnic" subtitle={`Încarci documentele licitației, iar asistentul analizează cerințele, verifică dosarul și redactează ciorne. Cereri luna aceasta: ${usage.used} din ${usage.limit}.`} />
      {!aiConfigured() && <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm">Asistentul tehnic nu este activat încă pe platformă.</p>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px] [&>*]:min-w-0">
        <Card className="p-0">
          <div className="border-b border-line px-5 py-3.5 font-semibold">Alege proiectul</div>
          {projects.length === 0 ? (
            <p className="px-5 py-8 text-center text-muted">Creează mai întâi un <Link href="/panou/proiecte" className="font-semibold text-brand-700 underline">proiect</Link>.</p>
          ) : (
            <ul className="divide-y divide-line">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <Link href={`/panou/proiecte/${p.id}/ai`} className="flex-1 font-medium text-brand-700 hover:underline">{p.name}</Link>
                  <span className="text-sm text-muted">{Number(p.files)} documente · {Number(p.jobs)} analize</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-bold">Ce poate face</h2>
            <ul className="space-y-2 text-sm">
              {tasks.map((t) => <li key={t.slug}><b>{t.name}</b> — <span className="text-muted">{t.description}</span></li>)}
              <li><b>Chat pe proiect</b> — <span className="text-muted">întrebări libere despre documente, deviz și dosar.</span></li>
            </ul>
          </Card>
          {recent.length > 0 && (
            <Card className="p-0">
              <div className="border-b border-line px-5 py-3 font-semibold">Analize recente</div>
              <ul className="divide-y divide-line text-sm">
                {recent.map((j) => (
                  <li key={j.id} className="px-5 py-2.5">
                    <Link href={`/panou/proiecte/${j.project_id}/ai/${j.id}`} className="font-medium text-brand-700 hover:underline">{j.task_name}</Link>
                    <div className="text-muted">{j.project} · {dt.format(new Date(j.created_at))}</div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
