import { PageHeader } from "@/components/ui";
import { RecipeList } from "@/components/recipes/pages";
import { ADMIN_RECIPES } from "@/components/recipes/contexts";

export const metadata = { title: "Articole & Norme · Admin" };


export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; categorie?: string; status?: string; proprietar?: string; istoric?: string }> }) {
  return (
    <>
      <PageHeader
        title="Articole & Norme"
        subtitle="Articolele de lucrări cu rețetele lor de consum (materiale, manoperă, utilaje, transport), sursa normei și versiunile. Articolele noi intră în uz doar după validare."
      />
      <RecipeList ctx={ADMIN_RECIPES} sp={await searchParams} listPath="/admin/retete" />
    </>
  );
}
