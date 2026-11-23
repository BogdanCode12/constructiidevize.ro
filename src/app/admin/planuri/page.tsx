import { ActionForm } from "@/components/action-form";
import { Card, Field, PageHeader } from "@/components/ui";
import { getPlans } from "@/lib/plans";
import { updatePlanAction } from "../actions";

export const metadata = { title: "Planuri · Admin" };

export default async function AdminPlansPage() {
  const plans = await getPlans();
  return (
    <>
      <PageHeader title="Planuri & prețuri" subtitle="Ce modifici aici apare imediat pe pagina de prețuri și în contul clienților. Prețurile sunt fără TVA." />
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id}>
            <p className="mb-3 text-xs font-semibold uppercase text-muted">Plan „{p.id}”</p>
            <ActionForm action={updatePlanAction} submitLabel="Salvează planul">
              <input type="hidden" name="id" value={p.id} />
              <Field label="Nume afișat" name="name" defaultValue={p.name} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Lei / lună" name="monthly" defaultValue={String(p.monthly)} />
                <Field label="Lei / an" name="yearly" defaultValue={String(p.yearly)} />
              </div>
              <Field label="Număr maxim de utilizatori" name="max_users" defaultValue={String(p.maxUsers)} />
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Funcționalități (una pe rând)</span>
                <textarea name="features" rows={6} defaultValue={p.features.join("\n")}
                  className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="highlighted" defaultChecked={p.highlighted} className="size-4 accent-brand-700" /> Evidențiat („recomandat”)
              </label>
            </ActionForm>
          </Card>
        ))}
      </div>
    </>
  );
}
