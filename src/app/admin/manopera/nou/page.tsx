import { CatalogNew } from "@/components/catalog/pages";
import { ADMIN_MANOPERA } from "@/components/catalog/contexts";

export const metadata = { title: "Resursă nouă · Admin" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tip?: string }> }) {
  return <CatalogNew ctx={ADMIN_MANOPERA} sp={await searchParams} />;
}
