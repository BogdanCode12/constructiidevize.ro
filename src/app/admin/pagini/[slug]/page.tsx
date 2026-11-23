import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Card, Field } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { getPage } from "@/lib/pages";
import { savePageAction } from "../../actions";

export const metadata = { title: "Editare pagină · Admin" };

export default async function AdminPageEdit({ params }: { params: Promise<{ slug: string }> }) {
  const page = await getPage((await params).slug);
  if (!page) notFound();
  return (
    <>
      <Link href="/admin/pagini" className="text-sm text-muted hover:text-ink">← Pagini</Link>
      <h1 className="mt-1 mb-6 text-2xl font-bold">{page.title}</h1>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <ActionForm action={savePageAction} submitLabel="Salvează pagina">
            <input type="hidden" name="slug" value={page.slug} />
            <Field label="Titlu" name="title" defaultValue={page.title} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Text (Markdown)</span>
              <textarea name="body" rows={28} defaultValue={page.body} className="w-full rounded-lg border border-line px-3.5 py-2.5 font-mono text-sm outline-none focus:border-brand-500" />
            </label>
          </ActionForm>
        </Card>
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase text-muted">Previzualizare (versiunea salvată)</p>
          <Markdown text={page.body} />
        </Card>
      </div>
    </>
  );
}
