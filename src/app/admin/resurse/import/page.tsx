import { CatalogImport } from "@/components/catalog/pages";
import { ADMIN_MATERIALE } from "@/components/catalog/contexts";

export const metadata = { title: "Import · Admin" };

export default function Page() {
  return <CatalogImport ctx={ADMIN_MATERIALE} />;
}
