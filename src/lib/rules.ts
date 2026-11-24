import "server-only";
import { cache } from "react";
import { query } from "./db";
import type { OverheadBase, ProfitBase, RoundingMode } from "./estimate/types";

/*
 * Regulile de calcul (TVA, CAM, indirecte, profit) au valoare, bază legală și perioadă de valabilitate.
 * Nu sunt constante în cod: la crearea unui deviz se copiază valorile aplicabile în ziua respectivă.
 */

export type RuleKey = "tva" | "cam" | "indirecte" | "profit";
export const RULE_KEYS: RuleKey[] = ["tva", "cam", "indirecte", "profit"];
export const RULE_LABEL: Record<RuleKey, string> = {
  tva: "TVA (cota standard)",
  cam: "CAM — contribuția asiguratorie pentru muncă",
  indirecte: "Cheltuieli indirecte (implicit)",
  profit: "Profit (implicit)",
};
export const RULE_HELP: Record<RuleKey, string> = {
  tva: "Se aplică pe totalul fără TVA. Există cote reduse și excepții legale, pe care le alege utilizatorul în deviz.",
  cam: "Se aplică doar pe manopera cu tarif „cost salarial”. Nu se adaugă peste tarifele comerciale, care includ deja contribuțiile.",
  indirecte: "Valoare propusă la devizele noi; se poate modifica pe fiecare deviz. Nu există un procent legal obligatoriu.",
  profit: "Valoare propusă la devizele noi; se poate modifica pe fiecare deviz. Plafonul poate fi cerut de documentația de atribuire.",
};

export type CalcRule = {
  id: number; key: RuleKey; value: number; legalBasis: string | null; from: string; to: string | null;
  status: "neverificat" | "verificat"; notes: string | null; createdAt: Date;
};

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function listRules(): Promise<CalcRule[]> {
  const rows = await query<{
    id: number; rule_key: RuleKey; value: string; legal_basis: string | null; effective_from: Date; effective_to: Date | null;
    status: "neverificat" | "verificat"; notes: string | null; created_at: Date;
  }>("SELECT * FROM calc_rules ORDER BY FIELD(rule_key, 'tva', 'cam', 'indirecte', 'profit'), effective_from DESC, id DESC");
  return rows.map((r) => ({
    id: r.id, key: r.rule_key, value: Number(r.value), legalBasis: r.legal_basis, from: ymd(r.effective_from)!, to: ymd(r.effective_to),
    status: r.status, notes: r.notes, createdAt: r.created_at,
  }));
}

/** Regula aplicabilă la o dată (YYYY-MM-DD): cea mai recentă intrată în vigoare și neexpirată. */
export function applicable(rules: CalcRule[], key: RuleKey, date: string): CalcRule | null {
  return rules.find((r) => r.key === key && r.from <= date && (!r.to || r.to >= date)) ?? null;
}

export type RecapTemplate = { overheadBase: OverheadBase; profitBase: ProfitBase; rounding: RoundingMode };

export const getRecapTemplate = cache(async (): Promise<RecapTemplate> => {
  const rows = await query<{ key: string; value: string }>(
    "SELECT `key`, `value` FROM settings WHERE `key` IN ('recap_overhead_base', 'recap_profit_base', 'recap_rounding')",
  );
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return {
    overheadBase: m.get("recap_overhead_base") === "manopera" ? "manopera" : "direct",
    profitBase: m.get("recap_profit_base") === "direct" ? "direct" : "direct_indirecte",
    rounding: m.get("recap_rounding") === "pret_unitar" ? "pret_unitar" : "final",
  };
});

export const todayRo = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest" }).format(new Date());

/** Valorile pentru un deviz nou (copiate în deviz; nu se mai schimbă când se schimbă regulile). */
export async function estimateDefaults(date = todayRo()) {
  const [rules, tpl] = await Promise.all([listRules(), getRecapTemplate()]);
  const v = (k: RuleKey, fallback: number) => applicable(rules, k, date)?.value ?? fallback;
  return {
    vatPct: v("tva", 21), camPct: v("cam", 2.25), overheadPct: v("indirecte", 10), profitPct: v("profit", 5),
    ...tpl, rulesDate: date,
  };
}

/** TVA aplicabil azi (pentru afișarea prețurilor cu TVA în catalog). */
export async function currentVat(): Promise<number> {
  return applicable(await listRules(), "tva", todayRo())?.value ?? 21;
}
