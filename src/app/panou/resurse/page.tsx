import { PageHeader } from "@/components/ui";
import { ResourceManager } from "@/components/resource-manager";
import { requireUser } from "@/lib/auth/session";
import { listResources } from "@/lib/resources/repo";
import { RES_TYPES, type ResType } from "@/lib/estimate/types";

export const metadata = { title: "Resurse" };

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ tip?: string; q?: string }> }) {
  const user = await requireUser();
  const { tip, q } = await searchParams;
  const type = RES_TYPES.includes(tip as ResType) ? (tip as ResType) : undefined;
  const resources = await listResources({ companyId: user.company?.id ?? null, includeGlobal: true, type, q: q?.trim() || undefined });
  return (
    <>
      <PageHeader
        title="Resurse"
        subtitle="Materialele, manopera, utilajele și transportul tău, cu prețurile tale. Resursele marcate „catalog” vin de la platformă."
      />
      <ResourceManager scope="company" resources={resources} basePath="/panou/resurse" type={type} q={q} />
    </>
  );
}
