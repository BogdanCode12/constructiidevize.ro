import { PageHeader } from "@/components/ui";
import { ResourceManager } from "@/components/resource-manager";
import { listResources } from "@/lib/resources/repo";
import { RES_TYPES, type ResType } from "@/lib/estimate/types";

export const metadata = { title: "Catalog resurse · Admin" };

export default async function AdminResourcesPage({ searchParams }: { searchParams: Promise<{ tip?: string; q?: string }> }) {
  const { tip, q } = await searchParams;
  const type = RES_TYPES.includes(tip as ResType) ? (tip as ResType) : undefined;
  const resources = await listResources({ companyId: null, includeGlobal: true, type, q: q?.trim() || undefined });
  return (
    <>
      <PageHeader title="Catalog global de resurse" subtitle="Resursele de aici sunt vizibile tuturor clienților, în pagina Resurse și în editorul de deviz." />
      <ResourceManager scope="global" resources={resources} basePath="/admin/resurse" type={type} q={q} />
    </>
  );
}
