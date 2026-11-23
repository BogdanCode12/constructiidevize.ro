import { getCurrentUser } from "@/lib/auth/session";
import { query, queryOne } from "@/lib/db";
import { loadEstimate } from "@/lib/estimate/repo";
import { projectWorkbook, safeFilename } from "@/lib/estimate/excel";
import type { EstimateDoc } from "@/lib/estimate/types";

export const dynamic = "force-dynamic";

/** F1 — centralizatorul proiectului (toate devizele lui). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.company) return new Response("Neautorizat", { status: 401 });
  const id = Number((await params).id);
  const project = await queryOne<{ name: string }>("SELECT name FROM projects WHERE id = ? AND company_id = ?", [id, user.company.id]);
  if (!project) return new Response("Proiectul nu există", { status: 404 });

  const ids = await query<{ id: number }>("SELECT id FROM estimates WHERE project_id = ? AND company_id = ? ORDER BY created_at", [id, user.company.id]);
  const docs = (await Promise.all(ids.map((e) => loadEstimate(e.id, user.company!.id)))).filter((d): d is EstimateDoc => !!d);
  const buf = await projectWorkbook(docs, { company: user.company.name, project: project.name });
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="F1_${safeFilename(project.name)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
