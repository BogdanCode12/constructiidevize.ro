import { RecipeDetailPage } from "@/components/recipes/pages";
import { ADMIN_RECIPES } from "@/components/recipes/contexts";

export const metadata = { title: "Articol · Admin" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ versiune?: string }> }) {
  return <RecipeDetailPage ctx={ADMIN_RECIPES} id={(await params).id} sp={await searchParams} />;
}
