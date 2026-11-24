import { CatalogDetail } from "@/components/catalog/pages";
import { companyCtx } from "@/components/catalog/contexts";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Resursă" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  return <CatalogDetail ctx={companyCtx(user.company?.id ?? null)} id={(await params).id} />;
}
