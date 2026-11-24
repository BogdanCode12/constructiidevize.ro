import type { RecipeCtx } from "./pages";

export const ADMIN_RECIPES: RecipeCtx = { scope: "global", companyId: null, base: "/admin/retete", listHref: "/admin/retete", admin: true };

export const companyRecipes = (companyId: number | null): RecipeCtx => ({
  scope: "company", companyId, base: "/panou/resurse/retete", listHref: "/panou/resurse?tab=retete", admin: false,
});
