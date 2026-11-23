import "server-only";
import { cache } from "react";
import { query } from "./db";

export type PaidPlanId = "start" | "pro" | "firma";
export type PlanId = "trial" | PaidPlanId;

export const PAID_PLAN_IDS: PaidPlanId[] = ["start", "pro", "firma"];

export type Plan = {
  id: PaidPlanId;
  name: string;
  monthly: number;
  yearly: number;
  maxUsers: number;
  features: string[];
  highlighted: boolean;
};

/** Planurile de abonament (editabile din /admin/planuri). */
export const getPlans = cache(async (): Promise<Plan[]> => {
  const rows = await query<{
    id: PaidPlanId; name: string; monthly_price: string; yearly_price: string;
    max_users: number; features: string; highlighted: number;
  }>("SELECT id, name, monthly_price, yearly_price, max_users, features, highlighted FROM plans ORDER BY position, id");
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    monthly: Number(r.monthly_price),
    yearly: Number(r.yearly_price),
    maxUsers: r.max_users,
    features: r.features.split("\n").map((f) => f.trim()).filter(Boolean),
    highlighted: r.highlighted === 1,
  }));
});

export async function planLabel(id: PlanId): Promise<string> {
  if (id === "trial") return "Perioadă de probă";
  return (await getPlans()).find((p) => p.id === id)?.name ?? id;
}

export const usersLabel = (n: number) => (n === 1 ? "1 utilizator" : `${n} utilizatori`);

export const STATUS_LABEL: Record<string, string> = {
  trialing: "în probă",
  active: "activ",
  past_due: "plată restantă",
  canceled: "anulat",
  expired: "expirat",
};
