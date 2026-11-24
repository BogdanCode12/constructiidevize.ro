import { CatalogImport } from "@/components/catalog/pages";
import { companyCtx } from "@/components/catalog/contexts";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Import resurse" };

export default async function Page() {
  const user = await requireUser();
  return <CatalogImport ctx={companyCtx(user.company?.id ?? null)} />;
}
