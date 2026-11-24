import { RecipeNew } from "@/components/recipes/pages";
import { companyRecipes } from "@/components/recipes/contexts";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Articol nou" };

export default async function Page() {
  const user = await requireUser();
  return <RecipeNew ctx={companyRecipes(user.company?.id ?? null)} />;
}
