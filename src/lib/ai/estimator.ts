import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { execute, query, queryOne } from "../db";
import { normKey } from "../estimate/normalize";
import { listResources } from "../resources/repo";
import { recipeItem, refreshPrices, searchRecipes } from "../recipes/repo";
import { RES_TYPES, type EstResource, type ResType } from "../estimate/types";
import { AI_MODEL, AiError, type Effort } from "./claude";
import { SYSTEM_PROMPT } from "./jobs";
import { randomUUID } from "node:crypto";

export type EstimatorInput = { ref: string; code: string; name: string; unit: string };
export type EstimatorProposal = { ref: string; resources: EstResource[]; note: string };

const BATCH = 25;

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["articole"],
  properties: {
    articole: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "reteta_id", "resurse", "nota"],
        properties: {
          ref: { type: "string" },
          reteta_id: { anyOf: [{ type: "integer" }, { type: "null" }] },
          resurse: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["resursa_id", "tip", "denumire", "um", "norma"],
              properties: {
                resursa_id: { anyOf: [{ type: "integer" }, { type: "null" }] },
                tip: { type: "string", enum: RES_TYPES },
                denumire: { type: "string" },
                um: { type: "string" },
                norma: { type: "number" },
              },
            },
          },
          nota: { type: "string" },
        },
      },
    },
  },
} as const;

type Output = { articole: { ref: string; reteta_id: number | null; resurse: { resursa_id: number | null; tip: ResType; denumire: string; um: string; norma: number }[]; nota: string }[] };

/** Uneltele prin care AI-ul caută în baza platformei. Rezultate scurte, ca text, ca să consume puțini tokeni. */
function tools(companyId: number) {
  return [
    betaTool({
      name: "cauta_retete",
      description: "Caută articole de deviz gata descompuse (rețete) în baza platformei. Întoarce max. 6 rânduri: id|cod|denumire|U.M.|preț unitar lei.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["text", "um"],
        properties: { text: { type: "string", description: "2-4 cuvinte cheie din denumirea lucrării" }, um: { type: "string", description: "U.M. articolului sau șir gol" } },
      },
      strict: true,
      run: async ({ text, um }) => {
        const hits = await searchRecipes(companyId, text, um || undefined, 6);
        return hits.length ? hits.map((h) => `${h.id}|${h.code ?? ""}|${h.name}|${h.unit}|${h.unitPrice.toFixed(2)}`).join("\n") : "nimic găsit";
      },
    }),
    betaTool({
      name: "reteta",
      description: "Resursele unei rețete: resursa_id|tip|denumire|U.M.|normă|preț.",
      inputSchema: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "integer" } } },
      strict: true,
      run: async ({ id }) => {
        const it = await recipeItem(companyId, id);
        return it ? it.resources.map((r) => `${r.resourceId ?? ""}|${r.type}|${r.name}|${r.unit}|${r.norm}${r.waste ? `+${r.waste}%` : ""}|${r.price}`).join("\n") || "rețetă fără resurse" : "rețeta nu există";
      },
    }),
    betaTool({
      name: "cauta_resurse",
      description: "Caută resurse (materiale, manoperă, utilaje, transport, echipamente) în catalogul platformei și al firmei. Max. 8 rânduri: resursa_id|tip|denumire|U.M.|preț lei.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["text", "tip"],
        properties: { text: { type: "string", description: "1-3 cuvinte cheie" }, tip: { type: "string", enum: [...RES_TYPES, "orice"] } },
      },
      strict: true,
      run: async ({ text, tip }) => {
        const list = await listResources({
          companyId, includeGlobal: true, q: text, limit: 8,
          type: tip === "orice" ? undefined : (tip as ResType),
        });
        return list.length ? list.map((r) => `${r.id}|${r.type}|${r.name}|${r.unit}|${r.price === null ? "fără preț" : r.price}`).join("\n") : "nimic găsit";
      },
    }),
  ];
}

async function materialize(companyId: number, out: Output["articole"][number]): Promise<EstResource[]> {
  if (out.reteta_id && !out.resurse.length) return (await recipeItem(companyId, out.reteta_id))?.resources ?? [];
  const raw: EstResource[] = out.resurse.map((r) => ({
    key: randomUUID(), resourceId: r.resursa_id, type: r.tip, code: "", name: r.denumire, unit: r.um, norm: Math.max(0, r.norma), waste: 0, price: 0,
  }));
  return refreshPrices(companyId, raw);
}

/** Salvează potrivirea: globală (refolosibilă de orice firmă) dacă folosește doar resurse globale, altfel a firmei. */
async function cacheProposal(companyId: number, item: EstimatorInput, res: EstResource[]) {
  if (!res.length) return;
  const ids = res.map((r) => r.resourceId).filter((x): x is number => !!x);
  const globals = ids.length ? await query<{ id: number }>("SELECT id FROM resources WHERE id IN (?) AND company_id IS NULL", [ids]) : [];
  const allGlobal = ids.length === res.length && globals.length === ids.length;
  const key = normKey(item.name, item.unit);
  const owner = allGlobal ? null : companyId;
  await execute("DELETE FROM ai_match_cache WHERE company_id <=> ? AND norm_key = ?", [owner, key]);
  await execute("INSERT INTO ai_match_cache (company_id, norm_key, proposal) VALUES (?, ?, ?)", [owner, key, JSON.stringify(res)]);
}

let client: Anthropic | null = null;

async function runBatch(companyId: number, items: EstimatorInput[], prompt: string, effort: Effort) {
  client ??= new Anthropic({ maxRetries: 3, timeout: 10 * 60 * 1000 });
  const list = items.map((i) => `${i.ref}|${i.code}|${i.name}|${i.unit}`).join("\n");
  const runner = client.beta.messages.toolRunner({
    model: AI_MODEL,
    max_tokens: 16000,
    max_iterations: 25,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort, format: { type: "json_schema", schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> } },
    system: [{ type: "text", text: `${SYSTEM_PROMPT}\n\n${prompt}`, cache_control: { type: "ephemeral" } }],
    tools: tools(companyId),
    messages: [{ role: "user", content: `Articole (ref|cod|denumire|U.M.):\n${list}` }],
  });
  let inputTokens = 0;
  let outputTokens = 0;
  let last: Anthropic.Beta.BetaMessage | null = null;
  for await (const msg of runner) {
    const u = msg.usage;
    inputTokens += (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    outputTokens += u.output_tokens ?? 0;
    last = msg;
  }
  if (!last) throw new AiError("Asistentul nu a răspuns.");
  if (last.stop_reason === "refusal") throw new AiError("Asistentul nu a putut procesa articolele.");
  const text = last.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let parsed: Output;
  try {
    parsed = JSON.parse(text) as Output;
  } catch {
    throw new AiError("Răspunsul asistentului nu a putut fi citit. Reîncearcă.");
  }
  return { parsed, inputTokens, outputTokens };
}

/** Propuneri simulate (AI_MOCK=1): caută în bază primul cuvânt relevant, fără apel la API. */
async function mockBatch(companyId: number, items: EstimatorInput[]): Promise<Output> {
  const articole: Output["articole"] = [];
  for (const it of items) {
    const word = it.name.split(/\s+/).find((w) => w.length > 4) ?? it.name;
    const [mat] = await listResources({ companyId, includeGlobal: true, q: word.slice(0, 6), type: "material", limit: 1 });
    const [man] = await listResources({ companyId, includeGlobal: true, q: "necalificat", type: "manopera", limit: 1 });
    articole.push({
      ref: it.ref, reteta_id: null,
      resurse: [
        ...(mat ? [{ resursa_id: mat.id, tip: "material" as const, denumire: mat.name, um: mat.unit, norma: 1 }] : []),
        ...(man ? [{ resursa_id: man.id, tip: "manopera" as const, denumire: man.name, um: man.unit, norma: 0.5 }] : []),
      ],
      nota: "Propunere simulată (AI_MOCK=1)",
    });
  }
  return { articole };
}

export async function runEstimatorJob(jobId: number): Promise<void> {
  const job = await queryOne<{ company_id: number; instructions: string }>("SELECT company_id, instructions FROM ai_jobs WHERE id = ?", [jobId]);
  if (!job) return;
  await execute("UPDATE ai_jobs SET status = 'running' WHERE id = ?", [jobId]);
  try {
    const items = JSON.parse(job.instructions) as EstimatorInput[];
    const task = await queryOne<{ prompt: string; effort: Effort }>("SELECT prompt, effort FROM ai_tasks WHERE slug = 'deviz_ai'");
    const proposals: EstimatorProposal[] = [];
    let tin = 0;
    let tout = 0;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      let out: Output;
      if (process.env.AI_MOCK === "1") out = await mockBatch(job.company_id, batch);
      else {
        if (!process.env.ANTHROPIC_API_KEY) throw new AiError("Asistentul tehnic nu este configurat.");
        const r = await runBatch(job.company_id, batch, task?.prompt ?? "", task?.effort ?? "low");
        out = r.parsed;
        tin += r.inputTokens;
        tout += r.outputTokens;
      }
      for (const a of out.articole) {
        const src = batch.find((b) => b.ref === a.ref);
        if (!src) continue;
        const resources = await materialize(job.company_id, a);
        proposals.push({ ref: a.ref, resources, note: `Propus de asistent — verifică. ${a.nota}`.slice(0, 255) });
        await cacheProposal(job.company_id, src, resources);
      }
    }
    await execute(
      "UPDATE ai_jobs SET status = 'done', output = ?, model = ?, input_tokens = ?, output_tokens = ?, finished_at = NOW() WHERE id = ?",
      [JSON.stringify(proposals), process.env.AI_MOCK === "1" ? "mock" : AI_MODEL, tin, tout, jobId],
    );
  } catch (err) {
    console.error("[ai] estimator", jobId, err);
    let msg = err instanceof Error ? err.message : "Eroare necunoscută.";
    if (err instanceof Anthropic.APIError && !(err instanceof AiError)) msg = `Asistentul a răspuns cu eroare (${err.status ?? "rețea"}).`;
    await execute("UPDATE ai_jobs SET status = 'error', error = ?, finished_at = NOW() WHERE id = ?", [msg.slice(0, 500), jobId]);
  }
}
