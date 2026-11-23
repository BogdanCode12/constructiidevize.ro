import { Card, PageHeader } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { listRecipes } from "@/lib/recipes/list";
import { deleteRecipeAdminAction, promoteRecipeAction } from "../actions";

export const metadata = { title: "Rețete · Admin" };

export default async function AdminRecipesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const rows = await listRecipes({ allCompanies: true, q: q?.trim() || undefined });
  return (
    <>
      <PageHeader title="Rețete de articole" subtitle="Articole gata descompuse pe resurse. Cele globale sunt găsite automat la importul F3 al oricărui client, fără AI. Rețetele firmelor pot fi promovate în catalogul global.">
        <form><input name="q" defaultValue={q} placeholder="Caută denumire sau cod" className="w-64 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" /></form>
      </PageHeader>
      <p className="mb-4 text-sm text-muted">Ca să creezi o rețetă globală: deschide un deviz, completează articolul și apasă <b>★G</b> pe rândul lui.</p>
      <Card className="overflow-x-auto p-0">
        {rows.length === 0 ? <p className="px-5 py-10 text-center text-muted">Nicio rețetă încă.</p> : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>{["Denumire", "U.M.", "Resurse", "Folosiri", "Proprietar", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">{r.code && <span className="mr-2 text-xs text-muted">{r.code}</span>}{r.name}</td>
                  <td className="px-4 py-2.5">{r.unit}</td>
                  <td className="px-4 py-2.5 tabular-nums">{Number(r.resources)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.uses}</td>
                  <td className="px-4 py-2.5">{r.company_id ? r.company : <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-800">GLOBAL</span>}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    {r.company_id && (
                      <form action={promoteRecipeAction} className="mr-3 inline">
                        <input type="hidden" name="id" value={r.id} />
                        <button className="font-semibold text-brand-700 hover:underline">Fă globală</button>
                      </form>
                    )}
                    <form action={deleteRecipeAdminAction} className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmSubmit message={`Ștergi rețeta „${r.name}”?`}>Șterge</ConfirmSubmit>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
