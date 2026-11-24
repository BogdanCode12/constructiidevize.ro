import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Card, Field, PageHeader } from "@/components/ui";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { createProjectAction } from "../actions";
import { STATUS_LABEL } from "./status";

export const metadata = { title: "Proiecte" };

const fmt = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await query<{
    id: number; name: string; client_name: string | null; location: string | null;
    status: keyof typeof STATUS_LABEL; created_at: Date;
  }>(
    "SELECT id, name, client_name, location, status, created_at FROM projects WHERE company_id = ? ORDER BY created_at DESC",
    [user.company?.id ?? 0],
  );

  return (
    <>
      <PageHeader title="Proiecte" subtitle="Fiecare lucrare sau licitație e un proiect: aici vor sta devizele, documentele și șantierul." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] [&>*]:min-w-0">
        <Card className="overflow-x-auto p-0">
          {projects.length === 0 ? (
            <p className="px-5 py-12 text-center text-muted">Niciun proiect încă. Creează-l pe primul din formular.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Proiect</th>
                  <th className="px-5 py-3 font-medium">Beneficiar</th>
                  <th className="px-5 py-3 font-medium">Locație</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Creat</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 font-medium"><Link href={`/panou/proiecte/${p.id}`} className="text-brand-700 hover:underline">{p.name}</Link></td>
                    <td className="px-5 py-3">{p.client_name ?? "—"}</td>
                    <td className="px-5 py-3">{p.location ?? "—"}</td>
                    <td className="px-5 py-3"><span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium">{STATUS_LABEL[p.status]}</span></td>
                    <td className="px-5 py-3 whitespace-nowrap text-muted">{fmt.format(new Date(p.created_at))}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-right"><Link href={`/panou/devize?proiect=${p.id}`} className="font-semibold text-brand-700 hover:underline">+ Deviz</Link>
                      <a href={`/panou/proiecte/${p.id}/export`} className="ml-4 font-semibold text-brand-700 hover:underline" title="Centralizator F1 pe obiectiv">F1</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card className="h-fit">
          <h2 className="mb-4 font-bold">Proiect nou</h2>
          <ActionForm action={createProjectAction} submitLabel="Creează proiect" resetOnSuccess>
            <Field label="Denumire" name="name" placeholder="ex: Reabilitare școala nr. 3" />
            <Field label="Beneficiar" name="client" required={false} placeholder="ex: Primăria Cluj-Napoca" />
            <Field label="Locație" name="location" required={false} placeholder="ex: Cluj-Napoca, jud. Cluj" />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
