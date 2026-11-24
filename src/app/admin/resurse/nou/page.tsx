import { CatalogNew } from "@/components/catalog/pages";
import { ADMIN_MATERIALE } from "@/components/catalog/contexts";

export const metadata = { title: "Resursă nouă · Admin" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tip?: string }> }) {
  return <CatalogNew ctx={ADMIN_MATERIALE} sp={await searchParams} />;
}
