import "server-only";
import { query } from "../db";
import { recap } from "../estimate/calc";
import { contractValue, executedValue } from "./situations";

export const TX_CATEGORIES = {
  situatie: "Încasare situație de lucrări",
  avans: "Avans",
  materiale: "Materiale",
  manopera: "Manoperă / salarii",
  utilaje: "Utilaje",
  transport: "Transport",
  subcontractare: "Subcontractare",
  alte: "Alte",
} as const;
export type TxCategory = keyof typeof TX_CATEGORIES;

export async function projectFinance(companyId: number, projectId: number) {
  const { value: contract, estimate } = await contractValue(companyId, projectId);
  const executed = await executedValue(projectId);
  const rows = await query<{ kind: "incasare" | "cheltuiala"; category: TxCategory; total: string }>(
    "SELECT kind, category, SUM(amount) AS total FROM project_transactions WHERE project_id = ? AND company_id = ? GROUP BY kind, category",
    [projectId, companyId],
  );
  const income = rows.filter((r) => r.kind === "incasare").reduce((s, r) => s + Number(r.total), 0);
  const spentBy: Partial<Record<TxCategory, number>> = {};
  for (const r of rows) if (r.kind === "cheltuiala") spentBy[r.category] = Number(r.total);
  const spent = Object.values(spentBy).reduce((s, v) => s + (v ?? 0), 0);
  const plan = estimate ? recap(estimate) : null;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return {
    contract, executed, income, spent, spentBy,
    receivable: r2(executed - income),
    progress: contract > 0 ? executed / contract : 0,
    profitCash: r2(income - spent),
    profitExecuted: r2(executed - spent),
    planned: plan ? { material: plan.direct.material, manopera: plan.direct.manopera, utilaje: plan.direct.utilaj, transport: plan.direct.transport, total: plan.directTotal + plan.overhead } : null,
  };
}
