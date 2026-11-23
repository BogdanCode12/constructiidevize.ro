import { PageHeader } from "@/components/ui";
import { PlanCards } from "@/components/plan-cards";
import { requireUser } from "@/lib/auth/session";
import { getPlans, planLabel } from "@/lib/plans";

export const metadata = { title: "Abonament" };

export default async function SubscriptionPage() {
  const user = await requireUser();
  const plans = await getPlans();
  return (
    <>
      <PageHeader title="Abonament" subtitle={user.company ? `Plan curent: ${await planLabel(user.company.plan)}` : undefined} />
      <PlanCards plans={plans} cta={{ label: "Plata online — în curând" }} />
      <p className="mt-4 text-sm text-muted">Plata prin Stripe și facturarea prin Oblio se activează în etapa următoare.</p>
    </>
  );
}
