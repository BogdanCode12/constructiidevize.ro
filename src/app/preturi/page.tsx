import { SiteShell } from "@/components/site/shell";
import { PlanCards } from "@/components/plan-cards";
import { Faq } from "@/components/site/faq";
import { getPlans } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { getPage } from "@/lib/pages";

export const metadata = { title: "Prețuri" };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [plans, { trial_days }, faq] = await Promise.all([getPlans(), getSettings(), getPage("intrebari-frecvente")]);
  return (
    <SiteShell>
      <section className="border-b border-line bg-canvas">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wider text-brand-700 uppercase">Prețuri</p>
            <h1 className="mt-3 font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">Un abonament, toată platforma</h1>
            <p className="mt-5 text-lg text-muted">{trial_days} zile gratuit, fără card. Plata anuală te costă cât 10 luni.</p>
          </div>
          <div className="mt-14"><PlanCards plans={plans} cta={{ label: "Începe gratuit", href: "/inregistrare" }} /></div>
          <p className="mt-6 text-sm text-muted">Prețurile nu includ TVA. Funcțiile AI au o limită lunară de cereri pe firmă, inclusă în abonament.</p>
        </div>
      </section>
      {faq && (
        <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <h2 className="font-display text-3xl font-semibold tracking-tight">Întrebări frecvente</h2>
          <Faq markdown={faq.body} />
        </section>
      )}
    </SiteShell>
  );
}
