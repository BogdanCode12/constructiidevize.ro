/*
 * Formula cantității unui articol, ex.: „30[lungime gard] × 0,40[lățime] × 0,80[adâncime]” → 9,6.
 * Acceptă numere (cu virgulă sau punct zecimal), + − × / ( ), „x” sau „*” pentru înmulțire și, opțional,
 * o etichetă între paranteze drepte după fiecare număr (sursa dimensiunii). Nu se evaluează cod: parser propriu.
 */

export type Dim = { value: number; label: string | null };
export type FormulaResult =
  | { ok: true; value: number; dims: Dim[]; /** Expresia pentru Excel (fără etichete, cu punct zecimal). */ excel: string; pretty: string }
  | { ok: false; error: string };

type Tok = { t: "num"; v: number; raw: string; label: string | null } | { t: "op"; v: "+" | "-" | "*" | "/" } | { t: "(" } | { t: ")" };

const nf = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 4 });

function tokenize(src: string): Tok[] | string {
  const out: Tok[] = [];
  let i = 0;
  const s = src.replace(/ /g, " ");
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (/[0-9]/.test(c) || ((c === "," || c === ".") && /[0-9]/.test(s[i + 1] ?? ""))) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      let raw = s.slice(i, j);
      // „1.234,5” → 1234.5; „0,40” → 0.40; „2.5” → 2.5
      if (raw.includes(",") && raw.includes(".")) raw = raw.replace(/\./g, "").replace(",", ".");
      else raw = raw.replace(",", ".");
      if ((raw.match(/\./g) ?? []).length > 1) return `Număr nevalid: „${s.slice(i, j)}”.`;
      const v = Number(raw);
      if (!Number.isFinite(v)) return `Număr nevalid: „${s.slice(i, j)}”.`;
      i = j;
      while (s[i] === " ") i++;
      let label: string | null = null;
      if (s[i] === "[") {
        const end = s.indexOf("]", i);
        if (end < 0) return "Lipsește „]” după eticheta dimensiunii.";
        label = s.slice(i + 1, end).trim().slice(0, 80) || null;
        i = end + 1;
      }
      out.push({ t: "num", v, raw, label });
      continue;
    }
    if (c === "+" || c === "-") { out.push({ t: "op", v: c }); i++; continue; }
    if (c === "*" || c === "×" || c === "x" || c === "X" || c === "·") { out.push({ t: "op", v: "*" }); i++; continue; }
    if (c === "/" || c === ":" || c === "÷") { out.push({ t: "op", v: "/" }); i++; continue; }
    if (c === "(") { out.push({ t: "(" }); i++; continue; }
    if (c === ")") { out.push({ t: ")" }); i++; continue; }
    return `Caracter neașteptat: „${c}”. Folosește numere, + − × / și paranteze.`;
  }
  return out;
}

/** Evaluează formula. Gramatică: expr = term ((+|-) term)*; term = factor ((*|/) factor)*; factor = [-] (num | "(" expr ")"). */
export function evalFormula(src: string): FormulaResult {
  const text = src.trim();
  if (!text) return { ok: false, error: "Formula e goală." };
  if (text.length > 500) return { ok: false, error: "Formula e prea lungă." };
  const toks = tokenize(text);
  if (typeof toks === "string") return { ok: false, error: toks };
  let p = 0;
  const dims: Dim[] = [];
  let excel = "";
  let pretty = "";
  const fail = (m: string): never => { throw new Error(m); };

  const factor = (): number => {
    const t = toks[p];
    if (!t) fail("Formula se termină prea devreme.");
    if (t.t === "op" && t.v === "-") { p++; excel += "-"; pretty += "−"; return -factor(); }
    if (t.t === "num") {
      p++;
      dims.push({ value: t.v, label: t.label });
      excel += t.raw;
      pretty += nf.format(t.v);
      return t.v;
    }
    if (t.t === "(") {
      p++;
      excel += "(";
      pretty += "(";
      const v = expr();
      if (toks[p]?.t !== ")") fail("Lipsește „)”.");
      p++;
      excel += ")";
      pretty += ")";
      return v;
    }
    return fail("Lipsește un număr.");
  };
  const term = (): number => {
    let v = factor();
    while (toks[p]?.t === "op" && ((toks[p] as { v: string }).v === "*" || (toks[p] as { v: string }).v === "/")) {
      const op = (toks[p] as { v: string }).v;
      p++;
      excel += op;
      pretty += op === "*" ? " × " : " / ";
      const r = factor();
      if (op === "/" && r === 0) fail("Împărțire la zero.");
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (toks[p]?.t === "op" && ((toks[p] as { v: string }).v === "+" || (toks[p] as { v: string }).v === "-")) {
      const op = (toks[p] as { v: string }).v;
      p++;
      excel += op;
      pretty += op === "+" ? " + " : " − ";
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };

  try {
    const value = expr();
    if (p < toks.length) return { ok: false, error: "Formula are elemente în plus (verifică operatorii și parantezele)." };
    if (!Number.isFinite(value)) return { ok: false, error: "Rezultatul nu este un număr." };
    if (value < 0) return { ok: false, error: "Cantitatea rezultată e negativă." };
    return { ok: true, value: Math.round(value * 10000) / 10000, dims, excel, pretty };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Formula nu este validă." };
  }
}
