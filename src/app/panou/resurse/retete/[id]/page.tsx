import { RecipeDetailPage } from "@/components/recipes/pages";
import { companyRecipes } from "@/components/recipes/contexts";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Articol" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ versiune?: string }> }) {
  const user = await requireUser();
  return <RecipeDetailPage ctx={companyRecipes(user.company?.id ?? null)} id={(await params).id} sp={await searchParams} />;
}
