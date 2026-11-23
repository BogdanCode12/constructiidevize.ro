import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
import { MODULES } from "@/lib/modules";

type Params = { params: Promise<{ modul: string }> };

function findModule(slug: string) {
  const m = MODULES.find((x) => x.slug === slug && !x.ready);
  return m && "description" in m ? m : null;
}

export async function generateMetadata({ params }: Params) {
  const m = findModule((await params).modul);
  return { title: m?.label ?? "Pagină inexistentă" };
}

export default async function ComingSoonPage({ params }: Params) {
  const m = findModule((await params).modul);
  if (!m) notFound();
  return (
    <>
      <PageHeader title={m.label} />
      <Card className="py-16 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Icon name={m.icon} className="size-7" />
        </span>
        <p className="mx-auto mt-4 max-w-md text-muted">{m.description}</p>
        <p className="mt-4 text-sm font-semibold text-brand-700">Modul în construcție</p>
      </Card>
    </>
  );
}
