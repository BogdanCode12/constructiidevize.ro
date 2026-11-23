import { ButtonLink } from "./ui";
import { usersLabel, type Plan } from "@/lib/plans";

const lei = (n: number) => new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(n);

export function PlanCards({ plans, cta }: { plans: Plan[]; cta: { label: string; href?: string } }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {plans.map((p) => (
        <div key={p.id} className={`flex flex-col rounded-2xl border bg-white p-7 ${p.highlighted ? "border-brand-500 ring-4 ring-brand-100" : "border-line"}`}>
          <div className="text-lg font-bold">{p.name}</div>
          <div className="mt-3 text-4xl font-bold">{lei(p.monthly)}<span className="text-base font-normal text-muted"> lei/lună + TVA</span></div>
          <div className="mt-1 text-sm text-muted">sau {lei(p.yearly)} lei/an · {usersLabel(p.maxUsers)}</div>
          <ul className="mt-6 flex-1 space-y-2 text-sm">{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
          <div className="mt-7">
            {cta.href ? (
              <ButtonLink href={cta.href} variant={p.highlighted ? "primary" : "ghost"}>{cta.label}</ButtonLink>
            ) : (
              <button disabled className="w-full rounded-lg bg-brand-700 px-4 py-2.5 font-semibold text-white opacity-50">{cta.label}</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
