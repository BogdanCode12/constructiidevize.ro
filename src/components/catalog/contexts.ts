import { RES_GROUPS, RES_TYPES } from "@/lib/estimate/types";
import type { CatalogCtx } from "./pages";

export const ADMIN_MATERIALE: CatalogCtx = {
  scope: "global", companyId: null, basePath: "/admin/resurse", types: RES_GROUPS.materiale.types,
  title: RES_GROUPS.materiale.label,
  subtitle: "Catalogul global de materiale și echipamente, cu ofertele de preț și istoricul lor. Vizibil tuturor firmelor.",
};

export const ADMIN_MANOPERA: CatalogCtx = {
  scope: "global", companyId: null, basePath: "/admin/manopera", types: RES_GROUPS.manopera.types,
  title: RES_GROUPS.manopera.label,
  subtitle: "Meserii și tarife orare, utilaje și transport, cu sursa și data fiecărui tarif. Vizibil tuturor firmelor.",
};

export const companyCtx = (companyId: number | null): CatalogCtx => ({
  scope: "company", companyId, basePath: "/panou/resurse", types: RES_TYPES,
  title: "Prețuri & materiale",
  subtitle: "Materialele, manopera, utilajele și transportul, cu prețurile tale. Cele marcate „catalog” vin de la platformă; pe ele îți poți pune prețul negociat.",
});
