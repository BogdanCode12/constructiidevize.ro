import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";

export const metadata = { title: "Prețuri" };

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between"><Logo /><ButtonLink href="/inregistrare">Încearcă gratuit</ButtonLink></header>
      <h1 className="mt-14 text-center text-4xl font-bold tracking-tight">Prețuri simple, fără surprize</h1>
      <p className="mt-3 text-center text-muted">{TRIAL_DAYS} zile gratuit, fără card. Plata anuală: 2 luni gratuite.</p>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.id} className={`rounded-2xl border bg-white p-7 ${p.highlighted ? "border-brand-500 ring-4 ring-brand-100" : "border-line"}`}>
            <div className="text-lg font-bold">{p.name}</div>
            <div className="mt-3 text-4xl font-bold">{p.monthly}<span className="text-base font-normal text-muted"> lei/lună + TVA</span></div>
            <div className="mt-1 text-sm text-muted">sau {p.yearly} lei/an · {p.users}</div>
            <ul className="mt-6 space-y-2 text-sm">{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
            <div className="mt-7"><ButtonLink href="/inregistrare" variant={p.highlighted ? "primary" : "ghost"}>Începe gratuit</ButtonLink></div>
          </div>
        ))}
      </div>
    </div>
  );
}
