import { notFound } from "next/navigation";
import { Logo } from "./logo";
import { Markdown } from "./markdown";
import { getPage } from "@/lib/pages";

/** Pagină de conținut (termeni, confidențialitate…), editabilă din /admin/pagini. */
export async function ContentPageView({ slug }: { slug: string }) {
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
      <Logo />
      <h1 className="mt-12 mb-2 text-3xl font-bold">{page.title}</h1>
      <p className="mb-8 text-sm text-muted">Actualizat la {new Intl.DateTimeFormat("ro-RO", { dateStyle: "long" }).format(new Date(page.updated_at))}</p>
      <Markdown text={page.body} />
    </div>
  );
}
