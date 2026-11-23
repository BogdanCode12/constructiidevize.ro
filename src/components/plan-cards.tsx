import { ButtonLink } from "./ui";
import { usersLabel, type Plan } from "@/lib/plans";

const lei = (n: number) => new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(n);

export function PlanCards({ plans, cta }: { plans: Plan[]; cta: { label: string; href?: string } }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {plans.map((p) => (
        <div key={p.id} className={`relative flex flex-col rounded-2xl border p-7 ${p.highlighted ? "border-ink bg-ink text-white shadow-2xl" : "border-line bg-white"}`}>
          {p.highlighted && <span className="absolute -top-3 left-7 rounded-full bg-brand-700 px-3 py-1 text-xs font-semibold text-white">Recomandat</span>}
          <div className="font-display text-xl font-semibold">{p.name}</div>
          <div className="mt-4 font-display text-5xl font-semibold tracking-tight">{lei(p.monthly)}<span className={`ml-1 text-base font-normal ${p.highlighted ? "text-white/60" : "text-muted"}`}>lei/lună</span></div>
          <div className={`mt-1 text-sm ${p.highlighted ? "text-white/60" : "text-muted"}`}>+ TVA · sau {lei(p.yearly)} lei/an · {usersLabel(p.maxUsers)}</div>
          <ul className="mt-7 flex-1 space-y-2.5 text-sm">
            {p.features.map((f) => (
              <li key={f} className="flex gap-2.5"><span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${p.highlighted ? "bg-brand-500" : "bg-brand-700"}`} />{f}</li>
            ))}
          </ul>
          <div className="mt-8">
            {cta.href ? (
              p.highlighted ? (
                <a href={cta.href} className="block rounded-lg bg-brand-700 px-5 py-3 text-center font-semibold text-white hover:bg-brand-800">{cta.label}</a>
              ) : (
                <ButtonLink href={cta.href} variant="ghost">{cta.label}</ButtonLink>
              )
            ) : (
              <button disabled className={`w-full rounded-lg px-4 py-3 font-semibold opacity-60 ${p.highlighted ? "bg-white text-ink" : "bg-ink text-white"}`}>{cta.label}</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
