import { CatalogNew } from "@/components/catalog/pages";
import { companyCtx } from "@/components/catalog/contexts";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Resursă nouă" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tip?: string }> }) {
  const user = await requireUser();
  return <CatalogNew ctx={companyCtx(user.company?.id ?? null)} sp={await searchParams} />;
}
