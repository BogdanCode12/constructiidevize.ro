import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PostEditor } from "@/components/blog/post-editor";
import { adminCategories, adminGetPost } from "@/lib/blog";
import { deletePostAction } from "@/lib/blog-actions";

export const metadata = { title: "Editare articol · Admin" };

export default async function EditPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvat?: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [p, categories, sp] = await Promise.all([adminGetPost(id), adminCategories(), searchParams]);
  if (!p) notFound();
  const live = p.status === "publicat" && p.publishedAt && new Date(p.publishedAt).getTime() <= Date.now();
  return (
    <>
      <Link href="/admin/noutati" className="text-sm font-semibold text-brand-700 hover:underline">← Noutăți</Link>
      <PageHeader title={p.title} subtitle={`${p.views} vizualizări`}>
        <div className="flex items-center gap-4 text-sm">
          {live && <a href={`/noutati/${p.slug}`} target="_blank" className="font-semibold text-brand-700 hover:underline">Vezi pe site ↗</a>}
          <form action={deletePostAction}>
            <input type="hidden" name="id" value={p.id} />
            <ConfirmSubmit message={`Ștergi definitiv articolul „${p.title}”?`}>Șterge</ConfirmSubmit>
          </form>
        </div>
      </PageHeader>
      {sp.salvat && <p className="mb-4 rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">Articolul a fost creat.</p>}
      <PostEditor key={p.updatedAt.toString()} categories={categories} post={{
        id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt ?? "", body: p.body, coverUrl: p.coverUrl ?? "", coverAlt: p.coverAlt ?? "",
        category: p.category ?? "", tags: p.tags.join(", "), metaTitle: p.metaTitle ?? "", metaDescription: p.metaDescription ?? "",
        authorName: p.authorName ?? "", status: p.status, publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : "",
      }} />
    </>
  );
}
