import { CatalogList } from "@/components/catalog/pages";
import { ADMIN_MANOPERA } from "@/components/catalog/contexts";

export const metadata = { title: `${ADMIN_MANOPERA.title} · Admin` };

export default async function Page({ searchParams }: { searchParams: Promise<{ tip?: string; categorie?: string; status?: string; q?: string }> }) {
  return <CatalogList ctx={ADMIN_MANOPERA} sp={await searchParams} />;
}
