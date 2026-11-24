import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { PostEditor } from "@/components/blog/post-editor";
import { adminCategories } from "@/lib/blog";

export const metadata = { title: "Articol nou · Admin" };

export default async function NewPostPage() {
  return (
    <>
      <Link href="/admin/noutati" className="text-sm font-semibold text-brand-700 hover:underline">← Noutăți</Link>
      <PageHeader title="Articol nou" />
      <PostEditor categories={await adminCategories()} post={{
        slug: "", title: "", excerpt: "", body: "", coverUrl: "", coverAlt: "", category: "", tags: "",
        metaTitle: "", metaDescription: "", authorName: "", status: "draft", publishedAt: "",
      }} />
    </>
  );
}
