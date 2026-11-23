import { notFound } from "next/navigation";
import { SiteShell } from "./site/shell";
import { Markdown } from "./markdown";
import { getPage } from "@/lib/pages";

/** Pagină de conținut (termeni, confidențialitate…), editabilă din /admin/pagini. */
export async function ContentPageView({ slug }: { slug: string }) {
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <SiteShell>
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-8">
      <h1 className="mb-2 font-display text-4xl font-semibold tracking-tight">{page.title}</h1>
      <p className="mb-8 text-sm text-muted">Actualizat la {new Intl.DateTimeFormat("ro-RO", { dateStyle: "long" }).format(new Date(page.updated_at))}</p>
      <Markdown text={page.body} />
    </div>
    </SiteShell>
  );
}
