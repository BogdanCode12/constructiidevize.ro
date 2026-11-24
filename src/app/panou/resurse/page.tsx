import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { listRecipes } from "@/lib/recipes/list";
import { deleteCompanyRecipeAction } from "@/lib/resources/actions";
import { CatalogList } from "@/components/catalog/pages";
import { companyCtx } from "@/components/catalog/contexts";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Resurse" };

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ tip?: string; q?: string; tab?: string; categorie?: string; status?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { q, tab } = sp;
  const tabs = (
    <nav className="mb-6 flex gap-1 border-b border-line">
      {[["resurse", "Resurse"], ["retete", "Rețete de articole"]].map(([id, label]) => (
        <Link key={id} href={`/panou/resurse?tab=${id}`}
          className={`border-b-2 px-3 py-2.5 text-sm font-medium ${(tab === "retete") === (id === "retete") ? "border-brand-700 text-brand-800" : "border-transparent text-muted hover:text-ink"}`}>{label}</Link>
      ))}
    </nav>
  );
  if (tab === "retete") {
    const rows = await listRecipes({ companyId: user.company?.id ?? null, includeGlobal: true, q: q?.trim() || undefined });
    return (
      <>
        <PageHeader title="Resurse" subtitle="Rețetele sunt articole gata descompuse pe resurse. La importul F3 se potrivesc automat, instant și fără cost. Salvezi rețete din editorul de deviz cu ★." />
        {tabs}
        <Card className="overflow-x-auto p-0">
          {rows.length === 0 ? <p className="px-5 py-10 text-center text-muted">Nicio rețetă încă. În editorul de deviz, apasă ★ pe un articol completat ca să-l salvezi.</p> : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted"><tr>{["Denumire", "U.M.", "Resurse", "Folosiri", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">{r.code && <span className="mr-2 text-xs text-muted">{r.code}</span>}{r.name}{!r.company_id && <span className="ml-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">catalog</span>}</td>
                    <td className="px-4 py-2.5">{r.unit}</td>
                    <td className="px-4 py-2.5 tabular-nums">{Number(r.resources)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{r.uses}</td>
                    <td className="px-4 py-2.5 text-right">
                      {r.company_id && (
                        <form action={deleteCompanyRecipeAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <ConfirmSubmit message={`Ștergi rețeta „${r.name}”?`}>Șterge</ConfirmSubmit>
                        </form>
                      )}
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
  const ctx = companyCtx(user.company?.id ?? null);
  return (
    <>
      <PageHeader title={ctx.title} subtitle={ctx.subtitle} />
      {tabs}
      <CatalogList ctx={ctx} sp={sp} header={false} />
    </>
  );
}
