import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { CatalogList } from "@/components/catalog/pages";
import { companyCtx } from "@/components/catalog/contexts";
import { RecipeList } from "@/components/recipes/pages";
import { companyRecipes } from "@/components/recipes/contexts";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Resurse" };

type SP = { tip?: string; q?: string; tab?: string; categorie?: string; status?: string; istoric?: string };

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const recipes = sp.tab === "retete";
  const tabs = (
    <nav className="mb-6 flex gap-1 border-b-2 border-ink/10">
      {[["resurse", "Resurse și prețuri"], ["retete", "Articole & rețete"]].map(([id, label]) => (
        <Link key={id} href={`/panou/resurse?tab=${id}`}
          className={`-mb-0.5 border-b-2 px-3 py-2.5 text-sm font-medium ${recipes === (id === "retete") ? "border-brand-700 text-brand-800" : "border-transparent text-muted hover:text-ink"}`}>{label}</Link>
      ))}
    </nav>
  );
  if (recipes) {
    return (
      <>
        <PageHeader title="Resurse" subtitle="Articolele sunt lucrări descompuse pe resurse (rețete de consum). La importul F3 se potrivesc automat, instant și fără cost. Salvezi articole și din editorul de deviz, cu ★." />
        {tabs}
        <RecipeList ctx={companyRecipes(user.company?.id ?? null)} sp={sp} listPath="/panou/resurse" />
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
