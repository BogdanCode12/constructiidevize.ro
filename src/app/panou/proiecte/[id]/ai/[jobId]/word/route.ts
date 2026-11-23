import { getCurrentUser } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { markdownToDocx } from "@/lib/ai/docx";
import { docFilename } from "@/lib/templates";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; jobId: string }> }) {
  const user = await getCurrentUser();
  if (!user?.company) return new Response("Neautorizat", { status: 401 });
  const { id, jobId } = await params;
  const job = await queryOne<{ task_name: string; output: string | null; project_name: string }>(
    `SELECT j.task_name, j.output, p.name AS project_name FROM ai_jobs j JOIN projects p ON p.id = j.project_id
      WHERE j.id = ? AND j.project_id = ? AND j.company_id = ? AND j.status = 'done'`,
    [Number(jobId), Number(id), user.company.id],
  );
  if (!job) return new Response("Analiza nu există", { status: 404 });
  const buf = await markdownToDocx(`${job.task_name} — ${job.project_name}`, job.output ?? "");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${docFilename(`${job.task_name} ${job.project_name}`)}"`,
      "Cache-Control": "no-store",
    },
  });
}
