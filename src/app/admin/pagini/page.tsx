import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { listPages } from "@/lib/pages";

export const metadata = { title: "Pagini · Admin" };

export default async function AdminPagesPage() {
  const pages = await listPages();
  return (
    <>
      <PageHeader title="Pagini" subtitle="Textele legale și de prezentare ale site-ului. Format Markdown: ## titlu, - listă, **îngroșat**, > notă." />
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {pages.map((p) => (
            <li key={p.slug} className="flex items-center justify-between px-5 py-3.5">
              <Link href={`/admin/pagini/${p.slug}`} className="font-medium text-brand-700 hover:underline">{p.title}</Link>
              <a href={`/${p.slug}`} target="_blank" className="text-sm text-muted hover:text-ink">/{p.slug} ↗</a>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
