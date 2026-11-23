export type PlanId = "trial" | "start" | "pro" | "firma";

export const TRIAL_DAYS = 14;

export const PLANS: {
  id: Exclude<PlanId, "trial">;
  name: string;
  monthly: number;
  yearly: number;
  users: string;
  features: string[];
  highlighted?: boolean;
}[] = [
  {
    id: "start",
    name: "Start",
    monthly: 99,
    yearly: 990,
    users: "1 utilizator",
    features: ["Devize nelimitate", "Export Excel și PDF (F1–F3, C5–C9)", "Declarații precompletate", "Baze proprii de resurse"],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 249,
    yearly: 2490,
    users: "3 utilizatori",
    highlighted: true,
    features: ["Tot din Start", "Asistent AI: citire planuri DTAC / PTh, PDF, Excel", "Calcul manoperă și ore de regie", "Caiet de sarcini generat", "Management de șantier"],
  },
  {
    id: "firma",
    name: "Firmă",
    monthly: 499,
    yearly: 4990,
    users: "10 utilizatori",
    features: ["Tot din Pro", "Roluri și permisiuni", "Situații de lucrări lunare", "Suport prioritar"],
  },
];

export const PLAN_LABEL: Record<PlanId, string> = {
  trial: "Perioadă de probă",
  start: "Start",
  pro: "Pro",
  firma: "Firmă",
};
