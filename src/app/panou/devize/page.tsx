import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Card, Field, PageHeader } from "@/components/ui";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { fmtMoney, recap } from "@/lib/estimate/calc";
import { loadEstimate } from "@/lib/estimate/repo";
import { createEstimateAction } from "./actions";

export const metadata = { title: "Devize" };

const fmt = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<{ proiect?: string }> }) {
  const user = await requireUser();
  const companyId = user.company?.id ?? 0;
  const { proiect } = await searchParams;

  const projects = await query<{ id: number; name: string }>(
    "SELECT id, name FROM projects WHERE company_id = ? AND status <> 'anulat' ORDER BY created_at DESC",
    [companyId],
  );
  const estimates = await query<{ id: number; name: string; project_name: string; updated_at: Date; items: number }>(
    `SELECT e.id, e.name, p.name AS project_name, e.updated_at,
            (SELECT COUNT(*) FROM estimate_items i JOIN estimate_chapters c ON c.id = i.chapter_id WHERE c.estimate_id = e.id) AS items
       FROM estimates e JOIN projects p ON p.id = e.project_id
      WHERE e.company_id = ? ORDER BY e.updated_at DESC`,
    [companyId],
  );
  // Totalul vine din același motor de calcul ca editorul (CAM, bazele și rotunjirile devizului).
  const totals = new Map<number, number>();
  for (const e of estimates) {
    const d = await loadEstimate(e.id, companyId);
    if (d) totals.set(e.id, recap(d).totalNoVat);
  }

  return (
    <>
      <PageHeader title="Devize" subtitle="Devize pe capitole și articole, desfăcute pe materiale, manoperă, utilaje și transport." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-x-auto p-0">
          {estimates.length === 0 ? (
            <p className="px-5 py-12 text-center text-muted">Niciun deviz încă. Creează-l pe primul din formular.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Deviz</th>
                  <th className="px-5 py-3 font-medium">Proiect</th>
                  <th className="px-5 py-3 text-right font-medium">Articole</th>
                  <th className="px-5 py-3 text-right font-medium">Total fără TVA</th>
                  <th className="px-5 py-3 font-medium">Modificat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {estimates.map((e) => {
                  const total = totals.get(e.id) ?? 0;
                  return (
                    <tr key={e.id} className="hover:bg-canvas">
                      <td className="px-5 py-3 font-medium"><Link href={`/panou/devize/${e.id}`} className="text-brand-700 hover:underline">{e.name}</Link></td>
                      <td className="px-5 py-3">{e.project_name}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{Number(e.items)}</td>
                      <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap">{fmtMoney(total)} lei</td>
                      <td className="px-5 py-3 whitespace-nowrap text-muted">{fmt.format(new Date(e.updated_at))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
        <Card className="h-fit">
          <h2 className="mb-4 font-bold">Deviz nou</h2>
          {projects.length === 0 ? (
            <p className="text-sm text-muted">
              Mai întâi <Link href="/panou/proiecte" className="font-semibold text-brand-700 underline">creează un proiect</Link>.
            </p>
          ) : (
            <ActionForm action={createEstimateAction} submitLabel="Creează și deschide">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Proiect</span>
                <select name="project_id" defaultValue={proiect} className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 outline-none focus:border-brand-500">
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <Field label="Denumire deviz" name="name" placeholder="ex: Deviz oferta — structură" />
            </ActionForm>
          )}
        </Card>
      </div>
    </>
  );
}
