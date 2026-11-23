import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Markdown } from "@/components/markdown";
import { Card } from "@/components/ui";
import { queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { failStaleJobs } from "@/lib/ai/jobs";
import { Poller } from "../client";
import { deleteJobAction } from "../actions";

export const metadata = { title: "Analiză AI" };

export default async function AiJobPage({ params }: { params: Promise<{ id: string; jobId: string }> }) {
  const user = await requireUser();
  const { id, jobId } = await params;
  await failStaleJobs();
  const job = await queryOne<{ id: number; task_name: string; status: string; output: string | null; error: string | null; created_at: Date; finished_at: Date | null; instructions: string | null; project_name: string }>(
    `SELECT j.id, j.task_name, j.status, j.output, j.error, j.created_at, j.finished_at, j.instructions, p.name AS project_name
       FROM ai_jobs j JOIN projects p ON p.id = j.project_id
      WHERE j.id = ? AND j.project_id = ? AND j.company_id = ?`,
    [Number(jobId), Number(id), user.company?.id ?? 0],
  );
  if (!job) notFound();
  const working = job.status === "queued" || job.status === "running";
  const secs = job.finished_at ? Math.round((new Date(job.finished_at).getTime() - new Date(job.created_at).getTime()) / 1000) : null;

  return (
    <>
      <Poller active={working} />
      <Link href={`/panou/proiecte/${id}/ai`} className="text-sm text-muted hover:text-ink">← Asistent AI · {job.project_name}</Link>
      <div className="mt-1 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{job.task_name}</h1>
          <p className="text-sm text-muted">
            {new Date(job.created_at).toLocaleString("ro-RO")}{secs !== null ? ` · ${secs < 60 ? `${secs} s` : `${Math.round(secs / 60)} min`}` : ""}
            {job.instructions ? ` · „${job.instructions.slice(0, 80)}”` : ""}
          </p>
        </div>
        <div className="flex gap-3">
          {job.status === "done" && (
            <a href={`/panou/proiecte/${id}/ai/${job.id}/word`} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">Descarcă Word</a>
          )}
          <form action={deleteJobAction}>
            <input type="hidden" name="project_id" value={id} />
            <input type="hidden" name="id" value={job.id} />
            <ConfirmSubmit message="Ștergi această analiză?" className="rounded-lg border border-line bg-white px-4 py-2 text-sm text-red-700 hover:border-red-200">Șterge</ConfirmSubmit>
          </form>
        </div>
      </div>
      <Card>
        {working ? (
          <div className="py-16 text-center">
            <div className="mx-auto size-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" />
            <p className="mt-4 font-semibold">AI-ul citește documentele și lucrează la analiză…</p>
            <p className="mt-1 text-sm text-muted">Poate dura câteva minute pentru documentații mari. Poți părăsi pagina — rezultatul rămâne salvat.</p>
          </div>
        ) : job.status === "error" ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700">{job.error}</p>
        ) : (
          <Markdown text={job.output ?? ""} />
        )}
      </Card>
      <p className="mt-4 text-xs text-muted">Text generat de AI — verifică-l cu documentele originale și asumă-l înainte de folosire.</p>
    </>
  );
}
