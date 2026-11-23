import { getCurrentUser } from "@/lib/auth/session";
import { loadEstimate } from "@/lib/estimate/repo";
import { estimateWorkbook, safeFilename } from "@/lib/estimate/excel";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.company) return new Response("Neautorizat", { status: 401 });
  const doc = await loadEstimate(Number((await params).id), user.company.id);
  if (!doc) return new Response("Devizul nu există", { status: 404 });

  const buf = await estimateWorkbook(doc, { company: user.company.name, project: doc.projectName });
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeFilename(doc.name)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
