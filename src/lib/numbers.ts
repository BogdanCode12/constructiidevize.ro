/** Interpretează numere scrise românește sau din Excel: „1.234,56”, „1234,56”, „1234.56”. */
export function parseNum(input: unknown): number | null {
  let s = String(input ?? "").trim().replace(/\s|lei|ron/gi, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
