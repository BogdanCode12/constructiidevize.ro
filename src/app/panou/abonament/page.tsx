import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { PLAN_LABEL, PLANS } from "@/lib/plans";

export const metadata = { title: "Abonament" };

export default async function SubscriptionPage() {
  const user = await requireUser();
  const sub = user.company;
  return (
    <>
      <PageHeader title="Abonament" subtitle={sub ? `Plan curent: ${PLAN_LABEL[sub.plan]}` : undefined} />
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p.id} className={p.highlighted ? "border-brand-500 ring-2 ring-brand-100" : ""}>
            <div className="font-bold">{p.name}</div>
            <div className="mt-2 text-3xl font-bold">{p.monthly} <span className="text-base font-normal text-muted">lei/lună</span></div>
            <div className="text-sm text-muted">sau {p.yearly} lei/an · {p.users}</div>
            <ul className="mt-4 space-y-1.5 text-sm">
              {p.features.map((f) => <li key={f}>✓ {f}</li>)}
            </ul>
            <button disabled className="mt-5 w-full rounded-lg bg-brand-700 px-4 py-2.5 font-semibold text-white opacity-50">
              Plata online — în curând
            </button>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">Prețurile nu includ TVA. Plata prin Stripe și facturarea prin Oblio se activează în etapa următoare.</p>
    </>
  );
}
