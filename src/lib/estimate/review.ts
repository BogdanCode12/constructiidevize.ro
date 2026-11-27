import type { EstimateDoc } from "./types";

/** Nota pusă de asistent (sau de o potrivire salvată a asistentului) pe un articol încă neverificat. */
export const isAssistantNote = (note: string | null | undefined) => !!note && /asistent/i.test(note);

export type PendingReview = { where: string; code: string; name: string; unit: string; note: string; assistant: boolean };

/** Articolele care încă au o notă „de verificat” (se șterge cu „✓ Am verificat”). */
export function pendingReview(doc: EstimateDoc): PendingReview[] {
  const out: PendingReview[] = [];
  doc.chapters.forEach((ch, ci) => ch.items.forEach((it, ii) => {
    if (it.reviewNote) out.push({ where: `${ci + 1}.${ii + 1}`, code: it.code, name: it.name, unit: it.unit, note: it.reviewNote, assistant: isAssistantNote(it.reviewNote) });
  }));
  return out;
}
