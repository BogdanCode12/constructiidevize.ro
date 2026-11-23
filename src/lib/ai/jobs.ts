import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { execute, query, queryOne } from "../db";
import { getSettings } from "../settings";
import { AI_MODEL, AiError, callClaude, type Effort } from "./claude";
import { fileBlocks, type StoredFile } from "./files";
import { platformContext } from "./context";

export const SYSTEM_PROMPT = `Ești asistentul platformei ConstructiiDevize.ro pentru firme de construcții din România care pregătesc oferte pentru licitații publice (Legea 98/2016, SEAP/SICAP) și execută lucrări.

Lucrezi cu documentele încărcate de utilizator (caiete de sarcini, fișe de date, contracte, liste de cantități, planșe) și cu datele firmei și ale proiectului din platformă (dosarul firmei, devizele, termenele).

Cum răspunzi:
- În limba română, în Markdown (titluri, liste, tabele), clar și concret.
- Pentru fiecare afirmație despre documente, indică sursa: numele documentului și pagina sau secțiunea.
- Nu inventa cerințe, valori, articole de lege sau date despre firmă. Când o informație lipsește sau e neclară, spune asta explicit.
- Textele pe care le redactezi (propuneri tehnice, planuri, întrebări) sunt ciorne pe care utilizatorul le verifică și le asumă; marchează între [paranteze drepte] ce trebuie completat de om.
- Nu oferi consultanță juridică definitivă; semnalează când e nevoie de verificarea unui jurist sau a unui specialist atestat.`;

export type AiTask = { slug: string; name: string; description: string; prompt: string; effort: Effort; needs_files: number; active: number; position: number };

export async function listAiTasks(onlyActive = true): Promise<AiTask[]> {
  return query<AiTask>(`SELECT slug, name, description, prompt, effort, needs_files, active, position FROM ai_tasks ${onlyActive ? "WHERE active = 1" : ""} ORDER BY position, name`);
}

/** Cereri AI folosite luna aceasta de firmă (sarcini + mesaje de chat). */
export async function monthlyUsage(companyId: number): Promise<{ used: number; limit: number }> {
  const row = await queryOne<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM ai_jobs WHERE company_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01'))
          + (SELECT COUNT(*) FROM ai_chat_messages WHERE company_id = ? AND role = 'assistant' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS n`,
    [companyId, companyId],
  );
  return { used: Number(row?.n ?? 0), limit: (await getSettings()).ai_monthly_requests };
}

/** Lucrările rămase „în curs” după o repornire a serverului sunt marcate ca eșuate. */
export async function failStaleJobs(): Promise<void> {
  await execute("UPDATE ai_jobs SET status = 'error', error = 'Întrerupt (serverul a repornit). Rulează din nou.', finished_at = NOW() WHERE status IN ('queued','running') AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)");
  await execute("UPDATE ai_chat_messages SET status = 'error', content = 'Răspunsul a fost întrerupt. Trimite din nou întrebarea.' WHERE status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)");
}

async function projectFiles(companyId: number, projectId: number, ids?: number[]): Promise<StoredFile[]> {
  if (ids && ids.length === 0) return [];
  return query<StoredFile>(
    `SELECT file_name, file_path, file_size FROM project_files WHERE company_id = ? AND project_id = ? ${ids ? "AND id IN (?)" : ""} ORDER BY created_at, id`,
    ids ? [companyId, projectId, ids] : [companyId, projectId],
  );
}

/** Conținutul comun: documentele + datele din platformă (cu cache, ca să nu fie retaxate la fiecare mesaj). */
async function sharedContent(companyId: number, projectId: number, fileIds?: number[]): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const files = await projectFiles(companyId, projectId, fileIds);
  const blocks = await fileBlocks(files);
  blocks.push({
    type: "text",
    text: `# Date din platformă\n\n${await platformContext(companyId, projectId)}`,
    cache_control: { type: "ephemeral" },
  });
  return blocks;
}

export async function runJob(jobId: number): Promise<void> {
  const job = await queryOne<{ company_id: number; project_id: number; task_slug: string; file_ids: string | number[] | null; instructions: string | null }>(
    "SELECT company_id, project_id, task_slug, file_ids, instructions FROM ai_jobs WHERE id = ?",
    [jobId],
  );
  if (!job) return;
  await execute("UPDATE ai_jobs SET status = 'running' WHERE id = ?", [jobId]);
  try {
    const task = await queryOne<AiTask>("SELECT slug, name, description, prompt, effort, needs_files, active, position FROM ai_tasks WHERE slug = ?", [job.task_slug]);
    if (!task) throw new AiError("Sarcina AI nu mai există.");
    const ids = typeof job.file_ids === "string" ? (JSON.parse(job.file_ids) as number[]) : job.file_ids ?? [];
    const content = await sharedContent(job.company_id, job.project_id, ids);
    content.push({
      type: "text",
      text: `# Sarcina: ${task.name}\n\n${task.prompt}${job.instructions ? `\n\n## Instrucțiuni suplimentare de la utilizator\n${job.instructions}` : ""}`,
    });
    const res = await callClaude({ system: SYSTEM_PROMPT, effort: task.effort, messages: [{ role: "user", content }] });
    await execute(
      "UPDATE ai_jobs SET status = 'done', output = ?, model = ?, input_tokens = ?, output_tokens = ?, finished_at = NOW() WHERE id = ?",
      [res.text, res.model, res.inputTokens, res.outputTokens, jobId],
    );
  } catch (err) {
    console.error("[ai] job", jobId, err);
    const msg = err instanceof AiError || err instanceof Error ? err.message : "Eroare necunoscută.";
    await execute("UPDATE ai_jobs SET status = 'error', error = ?, model = ?, finished_at = NOW() WHERE id = ?", [msg.slice(0, 500), AI_MODEL, jobId]);
  }
}

const MAX_CHAT_TURNS = 30;

export async function runChat(assistantMsgId: number): Promise<void> {
  const pending = await queryOne<{ company_id: number; project_id: number }>("SELECT company_id, project_id FROM ai_chat_messages WHERE id = ?", [assistantMsgId]);
  if (!pending) return;
  try {
    const history = await query<{ role: "user" | "assistant"; content: string }>(
      "SELECT role, content FROM ai_chat_messages WHERE project_id = ? AND id < ? AND status = 'done' ORDER BY id DESC LIMIT ?",
      [pending.project_id, assistantMsgId, MAX_CHAT_TURNS * 2],
    );
    history.reverse();
    while (history.length && history[0].role !== "user") history.shift();
    if (!history.length) throw new AiError("Nu există întrebare.");

    const shared = await sharedContent(pending.company_id, pending.project_id);
    const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m, i) =>
      i === 0 ? { role: "user", content: [...shared, { type: "text", text: m.content }] } : { role: m.role, content: m.content },
    );
    const res = await callClaude({
      system: `${SYSTEM_PROMPT}\n\nAcum răspunzi în chat la întrebările utilizatorului despre acest proiect. Răspunsurile să fie scurte și la obiect, cu sursa informației.`,
      effort: "medium",
      maxTokens: 32000,
      messages,
    });
    await execute(
      "UPDATE ai_chat_messages SET status = 'done', content = ?, input_tokens = ?, output_tokens = ? WHERE id = ?",
      [res.text, res.inputTokens, res.outputTokens, assistantMsgId],
    );
  } catch (err) {
    console.error("[ai] chat", assistantMsgId, err);
    const msg = err instanceof Error ? err.message : "Eroare necunoscută.";
    await execute("UPDATE ai_chat_messages SET status = 'error', content = ? WHERE id = ?", [msg.slice(0, 1000), assistantMsgId]);
  }
}
