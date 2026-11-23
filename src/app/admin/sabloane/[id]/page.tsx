import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, Field } from "@/components/ui";
import { queryOne } from "@/lib/db";
import { PLACEHOLDERS } from "@/lib/templates";
import { deleteTemplateAction, saveTemplateAction } from "../../actions";

export const metadata = { title: "Editare șablon · Admin" };

export default async function AdminTemplatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvat?: string }> }) {
  const { id } = await params;
  const { salvat } = await searchParams;
  const isNew = id === "nou";
  const t = isNew
    ? { id: 0, name: "", category: "Declarații", body: "Operator economic: {{firma.denumire}}\nCUI: {{firma.cui}}\n\n# TITLU\n\nText...\n\nData: {{data}}\n\n{{firma.reprezentant}}, {{firma.functie}}", active: 1, position: 99 }
    : await queryOne<{ id: number; name: string; category: string; body: string; active: number; position: number }>(
        "SELECT id, name, category, body, active, position FROM document_templates WHERE id = ?",
        [Number(id)],
      );
  if (!t) notFound();

  return (
    <>
      <Link href="/admin/sabloane" className="text-sm text-muted hover:text-ink">← Șabloane</Link>
      <h1 className="mt-1 mb-6 text-2xl font-bold">{isNew ? "Șablon nou" : t.name}</h1>
      {salvat && <p className="mb-4 rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-800">Șablon creat.</p>}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <ActionForm action={saveTemplateAction} submitLabel="Salvează șablonul">
            <input type="hidden" name="id" value={t.id} />
            <Field label="Nume" name="name" defaultValue={t.name} />
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label="Categorie" name="category" defaultValue={t.category} />
              <Field label="Ordine" name="position" defaultValue={String(t.position)} />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Text</span>
              <textarea name="body" rows={24} defaultValue={t.body}
                className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 font-mono text-sm leading-relaxed outline-none focus:border-brand-500" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={t.active === 1} className="size-4 accent-brand-700" /> Activ (vizibil clienților)
            </label>
          </ActionForm>
          {!isNew && (
            <form action={deleteTemplateAction} className="mt-5 border-t border-line pt-4">
              <input type="hidden" name="id" value={t.id} />
              <ConfirmSubmit message="Ștergi definitiv acest șablon?">Șterge șablonul</ConfirmSubmit>
            </form>
          )}
        </Card>
        <Card className="h-fit text-sm">
          <h2 className="mb-2 font-bold">Format</h2>
          <ul className="mb-4 space-y-1 text-muted">
            <li><code className="text-ink"># Titlu</code> — titlu centrat</li>
            <li><code className="text-ink">## Subtitlu</code> — subtitlu centrat</li>
            <li>Rând gol — paragraf nou</li>
          </ul>
          <h2 className="mb-2 font-bold">Câmpuri automate</h2>
          <ul className="space-y-1">
            {PLACEHOLDERS.map(([k, label]) => (
              <li key={k}><code className="rounded bg-canvas px-1 text-xs text-ink">{`{{${k}}}`}</code> <span className="text-muted">{label}</span></li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Câmpurile necompletate apar ca „__________”, pentru completare de mână.</p>
        </Card>
      </div>
    </>
  );
}
