import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { queryOne } from "../db";
import { DEFAULT_AI_MODEL, isAiModel, supportsServerFallback } from "./models";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** Modelul ales din admin → Asistent AI (setarea `ai_model`); altfel AI_MODEL din mediu; altfel Opus 5.5. */
export async function getAiModel(): Promise<string> {
  try {
    const r = await queryOne<{ value: string }>("SELECT `value` FROM settings WHERE `key` = 'ai_model'");
    if (r && isAiModel(r.value)) return r.value;
  } catch { /* baza indisponibilă: valoarea implicită */ }
  return process.env.AI_MODEL || DEFAULT_AI_MODEL;
}

/** Parametrii de model comuni: modelul + (unde există) reluarea automată pe un model de rezervă la refuz. */
export async function modelParams() {
  const model = await getAiModel();
  return supportsServerFallback(model)
    ? { model, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : { model };
}

/** Asistentul e activ când există ANTHROPIC_API_KEY (sau AI_MOCK=1 pentru teste fără cost). */
export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY || process.env.AI_MOCK === "1";
}

export class AiError extends Error {}

export type AiResult = { text: string; model: string; inputTokens: number; outputTokens: number };

let client: Anthropic | null = null;
function getClient() {
  // Cheia se citește din ANTHROPIC_API_KEY (variabilă de mediu în cPanel).
  client ??= new Anthropic({ maxRetries: 3, timeout: 15 * 60 * 1000 });
  return client;
}

export async function callClaude(opts: {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  effort: Effort;
  maxTokens?: number;
}): Promise<AiResult> {
  if (process.env.AI_MOCK === "1") return mockAnswer(opts.messages);
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError("Asistentul tehnic nu este configurat (lipsește ANTHROPIC_API_KEY).");

  try {
    // Streaming: răspunsurile lungi (propuneri tehnice, analize) pot dura câteva minute.
    // `fallbacks: "default"`: dacă modelul refuză o cerere, API-ul o reia automat pe un model de rezervă.
    const stream = getClient().beta.messages.stream({
      ...(await modelParams()),
      max_tokens: opts.maxTokens ?? 64000,
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort },
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: opts.messages,
    });
    const msg = await stream.finalMessage();

    if (msg.stop_reason === "refusal") {
      throw new AiError("Asistentul nu a putut procesa această cerere. Reformulează sau alege alte documente.");
    }
    let text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n\n").trim();
    if (msg.stop_reason === "max_tokens") text += "\n\n_(Răspunsul a fost întrerupt la limita de lungime. Cere continuarea în chat.)_";
    const u = msg.usage;
    return {
      text: text || "_(Răspuns gol.)_",
      model: msg.model,
      inputTokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
      outputTokens: u.output_tokens ?? 0,
    };
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new AiError("Cheia API a asistentului nu este validă.");
    if (err instanceof Anthropic.RateLimitError) throw new AiError("Prea multe cereri către asistent în acest moment. Reîncearcă peste câteva minute.");
    if (err instanceof Anthropic.BadRequestError) throw new AiError(`Cererea nu a fost acceptată: ${err.message.slice(0, 300)}`);
    if (err instanceof Anthropic.APIError) throw new AiError(`Asistentul a răspuns cu eroare (${err.status ?? "rețea"}). Reîncearcă.`);
    throw err;
  }
}

/** Răspuns simulat pentru teste (AI_MOCK=1): nu apelează API-ul și nu costă nimic. */
async function mockAnswer(messages: Anthropic.Beta.BetaMessageParam[]): Promise<AiResult> {
  await new Promise((r) => setTimeout(r, 800));
  const last = messages[messages.length - 1];
  const blocks = typeof last.content === "string" || !last.content ? [] : last.content;
  const docs = blocks.filter((b) => b.type === "document").map((b) => ("title" in b ? b.title : "") || "document");
  const ask = blocks.filter((b) => b.type === "text").map((b) => ("text" in b ? b.text : "")).pop() ?? String(last.content);
  return {
    text: [
      "## Răspuns simulat (AI_MOCK=1)",
      "",
      `Am primit **${docs.length}** documente: ${docs.join(", ") || "niciunul"}.`,
      "",
      "| Cerință | Status | Sursă |",
      "|---|---|---|",
      "| Experiență similară | de verificat | Fișa de date, pag. 4 |",
      "| Certificat ISO 9001 | îndeplinit | dosarul firmei |",
      "",
      "- Primul punct al analizei",
      "- Al doilea punct, cu **text îngroșat**",
      "",
      `Ultima instrucțiune (primele 120 de caractere): „${ask.slice(0, 120)}”`,
    ].join("\n"),
    model: "mock",
    inputTokens: 1000,
    outputTokens: 200,
  };
}
