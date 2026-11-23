/** Normalizare pentru potrivirea articolelor: fără diacritice, litere mici, fără punctuație inutilă. */
export function normText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[^a-z0-9./ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const UNIT_SYNONYMS: Record<string, string> = {
  m3: "mc", "m.c": "mc", "m.c.": "mc", mc: "mc", "metru cub": "mc",
  m2: "mp", "m.p": "mp", "m.p.": "mp", mp: "mp",
  m: "ml", ml: "ml", "m.l": "ml", "m.l.": "ml", metru: "ml",
  buc: "buc", "buc.": "buc", bucata: "buc", bucati: "buc", b: "buc",
  kg: "kg", t: "t", to: "t", tona: "t", tone: "t",
  ora: "ora", ore: "ora", h: "ora", "ora-om": "ora", "ore-om": "ora",
  l: "l", litru: "l", litri: "l", set: "set", seturi: "set", km: "km", "100 mp": "100mp", "100mp": "100mp",
};

export function normUnit(u: string): string {
  const n = normText(u).replace(/\s+/g, " ");
  return UNIT_SYNONYMS[n] ?? UNIT_SYNONYMS[n.replace(/\./g, "")] ?? n.replace(/\./g, "");
}

export function normKey(name: string, unit: string): string {
  return `${normText(name).slice(0, 200)}|${normUnit(unit)}`;
}

const STOP = new Set(["din", "cu", "si", "pe", "la", "de", "in", "pentru", "sau", "al", "ale", "a", "ai", "tip", "inclusiv", "fara", "prin"]);

function tokens(s: string): { words: Set<string>; numbers: Set<string> } {
  const words = new Set<string>();
  const numbers = new Set<string>();
  for (const t of normText(s).split(" ")) {
    if (/\d/.test(t)) numbers.add(t.replace(/\.$/, ""));
    else if (t.length > 2 && !STOP.has(t)) words.add(t.length > 5 ? t.slice(0, 6) : t); // rădăcină aproximativă
  }
  return { words, numbers };
}

/** Asemănare 0..1 între două denumiri (Jaccard pe cuvinte; penalizare dacă dimensiunile/numerele diferă). */
export function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.words.size || !B.words.size) return 0;
  let inter = 0;
  for (const w of A.words) if (B.words.has(w)) inter++;
  // Media dintre Jaccard (cât de asemănătoare sunt în total) și acoperire (cât din denumirea mai scurtă
  // se regăsește în cea lungă) — ca „Beton C25/30 turnat în fundații continue” să găsească „Beton C25/30 în fundații”.
  const jaccard = inter / (A.words.size + B.words.size - inter);
  const overlap = inter / Math.min(A.words.size, B.words.size);
  let score = (jaccard + overlap) / 2;
  if (A.numbers.size && B.numbers.size) {
    const same = [...A.numbers].some((n) => B.numbers.has(n));
    if (!same) score *= 0.6;
  }
  return score;
}
