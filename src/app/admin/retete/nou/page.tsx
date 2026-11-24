import { RecipeNew } from "@/components/recipes/pages";
import { ADMIN_RECIPES } from "@/components/recipes/contexts";

export const metadata = { title: "Articol nou · Admin" };

export default function Page() {
  return <RecipeNew ctx={ADMIN_RECIPES} />;
}
