import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui";
import { PlanCards } from "@/components/plan-cards";
import { getPlans } from "@/lib/plans";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Prețuri" };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [plans, { trial_days }] = await Promise.all([getPlans(), getSettings()]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between"><Logo /><ButtonLink href="/inregistrare">Încearcă gratuit</ButtonLink></header>
      <h1 className="mt-14 text-center text-4xl font-bold tracking-tight">Prețuri simple, fără surprize</h1>
      <p className="mt-3 mb-12 text-center text-muted">{trial_days} zile gratuit, fără card.</p>
      <PlanCards plans={plans} cta={{ label: "Începe gratuit", href: "/inregistrare" }} />
    </div>
  );
}
