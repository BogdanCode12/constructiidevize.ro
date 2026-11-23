import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Markdown } from "@/components/markdown";
import { Card } from "@/components/ui";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { aiConfigured } from "@/lib/ai/claude";
import { failStaleJobs, listAiTasks, monthlyUsage } from "@/lib/ai/jobs";
import { PROJECT_FILE_LABELS, type ProjectFileLabel } from "@/lib/ai/labels";
import { ChatForm, Poller, ProjectFilesUpload } from "./client";
import { clearChatAction, deleteProjectFileAction, startAiJobAction } from "./actions";

export const metadata = { title: "Asistent AI" };

const dt = new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short" });
const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);
const STATUS = { queued: "în așteptare", running: "lucrează…", done: "gata", error: "eroare" } as const;

export default async function ProjectAiPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const companyId = user.company?.id ?? 0;
  const projectId = Number((await params).id);
  const tab = (await searchParams).tab === "chat" ? "chat" : "analize";
  const project = await queryOne<{ name: string }>("SELECT name FROM projects WHERE id = ? AND company_id = ?", [projectId, companyId]);
  if (!project) notFound();
  await failStaleJobs();

  const [files, tasks, jobs, usage, chat] = await Promise.all([
    query<{ id: number; label: ProjectFileLabel; file_name: string; file_size: number; created_at: Date }>(
      "SELECT id, label, file_name, file_size, created_at FROM project_files WHERE project_id = ? AND company_id = ? ORDER BY created_at, id",
      [projectId, companyId],
    ),
    listAiTasks(),
    query<{ id: number; task_name: string; status: keyof typeof STATUS; created_at: Date; error: string | null }>(
      "SELECT id, task_name, status, created_at, error FROM ai_jobs WHERE project_id = ? AND company_id = ? ORDER BY id DESC LIMIT 30",
      [projectId, companyId],
    ),
    monthlyUsage(companyId),
    query<{ id: number; role: "user" | "assistant"; content: string; status: "done" | "pending" | "error"; created_at: Date }>(
      "SELECT id, role, content, status, created_at FROM ai_chat_messages WHERE project_id = ? AND company_id = ? ORDER BY id",
      [projectId, companyId],
    ),
  ]);
  const configured = aiConfigured();
  const running = jobs.some((j) => j.status === "queued" || j.status === "running") || chat.some((m) => m.status === "pending");

  return (
    <>
      <Poller active={running} />
      <Link href={`/panou/proiecte/${projectId}`} className="text-sm text-muted hover:text-ink">← {project.name}</Link>
      <div className="mt-1 mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Asistent AI</h1>
        <span className="text-sm text-muted">Cereri AI luna aceasta: <b className="text-ink">{usage.used}</b> din {usage.limit}</span>
      </div>
      {!configured && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm">Asistentul AI nu este activat încă pe platformă. Poți încărca documentele; analizele vor fi disponibile după activare.</p>
      )}
      <nav className="mb-6 flex gap-1 border-b border-line">
        {[["analize", "Documente & analize"], ["chat", "Întreabă AI-ul"]].map(([id, label]) => (
          <Link key={id} href={`/panou/proiecte/${projectId}/ai?tab=${id}`}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium ${tab === id ? "border-brand-700 text-brand-800" : "border-transparent text-muted hover:text-ink"}`}>{label}</Link>
        ))}
      </nav>

      {tab === "analize" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Card>
              <h2 className="mb-1 font-bold">Rulează o analiză</h2>
              <p className="mb-4 text-sm text-muted">AI-ul citește documentele bifate împreună cu datele din platformă (firma, dosarul, devizele, termenele).</p>
              <ActionForm action={startAiJobAction} submitLabel="Pornește analiza">
                <input type="hidden" name="project_id" value={projectId} />
                <div className="grid gap-2 sm:grid-cols-2">
                  {tasks.map((t, i) => (
                    <label key={t.slug} className="flex cursor-pointer gap-3 rounded-lg border border-line p-3 hover:border-brand-200 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                      <input type="radio" name="task" value={t.slug} defaultChecked={i === 0} className="mt-1 accent-brand-700" />
                      <span>
                        <span className="block font-semibold">{t.name}</span>
                        <span className="block text-sm text-muted">{t.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium">Documente de analizat</legend>
                  {files.length === 0 ? <p className="text-sm text-muted">Încarcă mai întâi documentele licitației (în dreapta).</p> : (
                    <div className="space-y-1.5">
                      {files.map((f) => (
                        <label key={f.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="file_ids" value={f.id} defaultChecked className="size-4 accent-brand-700" />
                          <span>{f.file_name}</span><span className="text-muted">· {PROJECT_FILE_LABELS[f.label]}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Instrucțiuni suplimentare (opțional)</span>
                  <textarea name="instructions" rows={2} placeholder="Ex: concentrează-te pe capitolul de instalații electrice"
                    className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500" />
                </label>
              </ActionForm>
            </Card>

            <Card className="p-0">
              <div className="border-b border-line px-5 py-3.5 font-semibold">Analize rulate</div>
              {jobs.length === 0 ? <p className="px-5 py-6 text-sm text-muted">Nicio analiză încă.</p> : (
                <ul className="divide-y divide-line text-sm">
                  {jobs.map((j) => (
                    <li key={j.id} className="flex items-center gap-3 px-5 py-3">
                      <Link href={`/panou/proiecte/${projectId}/ai/${j.id}`} className="flex-1 font-medium text-brand-700 hover:underline">{j.task_name}</Link>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${j.status === "done" ? "bg-brand-50 text-brand-800" : j.status === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{STATUS[j.status]}</span>
                      <span className="text-muted">{dt.format(new Date(j.created_at))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <h2 className="mb-4 font-bold">Documentele licitației</h2>
              <ProjectFilesUpload projectId={projectId} />
            </Card>
            {files.length > 0 && (
              <Card className="p-0">
                <ul className="divide-y divide-line text-sm">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 px-4 py-2.5">
                      <a href={`/api/proiecte/${projectId}/fisiere/${f.id}`} target="_blank" className="min-w-0 flex-1 truncate text-brand-700 hover:underline" title={f.file_name}>{f.file_name}</a>
                      <span className="shrink-0 text-xs text-muted">{size(f.file_size)}</span>
                      <form action={deleteProjectFileAction}>
                        <input type="hidden" name="project_id" value={projectId} />
                        <input type="hidden" name="id" value={f.id} />
                        <ConfirmSubmit message={`Ștergi ${f.file_name}?`} className="text-muted hover:text-red-700">✕</ConfirmSubmit>
                      </form>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card className="flex flex-col p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="text-sm text-muted">AI-ul vede documentele proiectului ({files.length}), devizele, termenele și dosarul firmei.</span>
            {chat.length > 0 && (
              <form action={clearChatAction}>
                <input type="hidden" name="project_id" value={projectId} />
                <ConfirmSubmit message="Ștergi conversația?" className="text-sm text-muted hover:text-red-700">Conversație nouă</ConfirmSubmit>
              </form>
            )}
          </div>
          <div className="min-h-64 space-y-4 px-5 py-5">
            {chat.length === 0 && <p className="py-10 text-center text-muted">Întreabă orice despre proiect: „Ce documente îmi lipsesc?”, „Care e termenul de depunere?”, „Cât beton am în deviz?”</p>}
            {chat.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.role === "user" ? "bg-brand-700 text-white" : m.status === "error" ? "bg-red-50 text-red-700" : "border border-line bg-white"}`}>
                  {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p>
                    : m.status === "pending" ? <p className="animate-pulse text-muted">Citesc documentele și pregătesc răspunsul…</p>
                    : <Markdown text={m.content} />}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-line p-4">
            <ChatForm projectId={projectId} disabled={!configured} />
          </div>
        </Card>
      )}
      <p className="mt-4 text-xs text-muted">Răspunsurile AI pot conține erori. Verifică întotdeauna cu documentele originale înainte de a le folosi în ofertă.</p>
    </>
  );
}
