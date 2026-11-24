import "server-only";

/** Cursul oficial BNR (lei pentru o unitate de monedă), din fișierul public zilnic. Memorat 6 ore. */
let cache: { at: number; date: string; rates: Record<string, number> } | null = null;

export async function bnrRates(): Promise<{ date: string; rates: Record<string, number> } | null> {
  if (cache && Date.now() - cache.at < 6 * 3600_000) return cache;
  try {
    const res = await fetch("https://www.bnr.ro/nbrfxrates.xml", { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return cache;
    const xml = await res.text();
    const date = xml.match(/<Cube date="(\d{4}-\d{2}-\d{2})"/)?.[1] ?? "";
    const rates: Record<string, number> = {};
    for (const m of xml.matchAll(/<Rate currency="([A-Z]{3})"(?: multiplier="(\d+)")?>([\d.]+)<\/Rate>/g)) {
      rates[m[1]] = Number(m[3]) / Number(m[2] ?? 1);
    }
    if (!rates.EUR) return cache;
    cache = { at: Date.now(), date, rates };
    return cache;
  } catch {
    return cache;
  }
}
