import { CatalogDetail } from "@/components/catalog/pages";
import { ADMIN_MANOPERA } from "@/components/catalog/contexts";

export const metadata = { title: "Resursă · Admin" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <CatalogDetail ctx={ADMIN_MANOPERA} id={(await params).id} />;
}
