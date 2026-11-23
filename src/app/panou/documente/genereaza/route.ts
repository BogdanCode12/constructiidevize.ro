import { getCurrentUser } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { buildContext, docFilename, renderTemplate, toDocx } from "@/lib/templates";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/** Generează un document Word dintr-un șablon, cu datele firmei, proiectului și devizului. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.company) return new Response("Neautorizat", { status: 401 });
  const url = new URL(req.url);
  const tpl = await queryOne<{ id: number; name: string; body: string }>(
    "SELECT id, name, body FROM document_templates WHERE id = ? AND active = 1",
    [Number(url.searchParams.get("sablon"))],
  );
  if (!tpl) return new Response("Șablonul nu există", { status: 404 });
  const projectId = Number(url.searchParams.get("proiect")) || null;
  const estimateId = Number(url.searchParams.get("deviz")) || null;

  const ctx = await buildContext(user.company.id, projectId, estimateId);
  const buf = await toDocx(renderTemplate(tpl.body, ctx));
  await logActivity({ companyId: user.company.id, userId: user.id, action: "document.generat", details: { template: tpl.name, projectId } });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${docFilename(tpl.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
