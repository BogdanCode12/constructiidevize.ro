import { getCurrentUser } from "@/lib/auth/session";
import { loadSituation, situationWorkbook } from "@/lib/site/situations";
import { safeFilename } from "@/lib/estimate/excel";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const user = await getCurrentUser();
  if (!user?.company) return new Response("Neautorizat", { status: 401 });
  const { id, sid } = await params;
  const s = await loadSituation(Number(sid), user.company.id);
  if (!s || s.projectId !== Number(id)) return new Response("Situația nu există", { status: 404 });
  const buf = await situationWorkbook(s, user.company.name);
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Situatia_${s.number}_${safeFilename(s.projectName)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
