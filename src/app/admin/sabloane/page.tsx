import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { listTemplates } from "@/lib/templates";

export const metadata = { title: "Șabloane · Admin" };

export default async function AdminTemplatesPage() {
  const templates = await listTemplates(false);
  return (
    <>
      <PageHeader title="Șabloane de documente" subtitle="Declarațiile și formularele pe care clienții le generează în Word, completate automat cu datele lor.">
        <Link href="/admin/sabloane/nou" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">+ Șablon nou</Link>
      </PageHeader>
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-3.5 text-sm">
              <span className="w-8 text-muted tabular-nums">{t.position}</span>
              <span className="w-28 shrink-0 text-xs font-medium text-muted uppercase">{t.category}</span>
              <Link href={`/admin/sabloane/${t.id}`} className="flex-1 font-medium text-brand-700 hover:underline">{t.name}</Link>
              {!t.active && <span className="rounded bg-canvas px-2 py-0.5 text-xs text-muted">inactiv</span>}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
