/** Modelele care se pot alege din admin → Asistent AI. Prețuri în $ pe 1M tokeni (listă Anthropic). */
export const AI_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", input: 4, output: 20, note: "cea mai bună calitate; recomandat pentru devize și analize" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", input: 2, output: 10, note: "de 2× mai ieftin, foarte bun pentru majoritatea sarcinilor" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", input: 0.1, output: 0.5, note: "cel mai ieftin; potrivit pentru extrageri simple" },
] as const;

export type AiModelId = (typeof AI_MODELS)[number]["id"];

export const DEFAULT_AI_MODEL: AiModelId = "claude-opus-5-5";

export const isAiModel = (id: string): id is AiModelId => AI_MODELS.some((m) => m.id === id);

/** Prețul unui model după id-ul întors de API (poate fi și modelul de rezervă). */
export function modelPrice(id: string | null | undefined): { input: number; output: number } | null {
  const m = id ? AI_MODELS.find((x) => id === x.id || id.startsWith(`${x.id}-`)) : undefined;
  return m ? { input: m.input, output: m.output } : null;
}

/** Haiku nu are model de rezervă la refuz pe server: parametrul `fallbacks` se trimite doar celorlalte. */
export const supportsServerFallback = (id: string) => !id.startsWith("claude-haiku");
