import { CatalogList } from "@/components/catalog/pages";
import { ADMIN_MATERIALE } from "@/components/catalog/contexts";

export const metadata = { title: `${ADMIN_MATERIALE.title} · Admin` };

export default async function Page({ searchParams }: { searchParams: Promise<{ tip?: string; categorie?: string; status?: string; q?: string }> }) {
  return <CatalogList ctx={ADMIN_MATERIALE} sp={await searchParams} />;
}
