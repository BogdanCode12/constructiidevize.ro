import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { adminListPosts } from "@/lib/blog";

export const metadata = { title: "Noutăți · Admin" };

const fmt = (d: Date | null) => (d ? new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" }).format(new Date(d)) : "—");

export default async function AdminBlogPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const posts = await adminListPosts(q?.trim() || undefined);
  const now = Date.now();
  return (
    <>
      <PageHeader title="Noutăți" subtitle="Articolele blogului (pagina /noutati). Draft = nevizibil; publicat cu dată viitoare = programat.">
        <Link href="/admin/noutati/nou" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">+ Articol nou</Link>
      </PageHeader>
      <form className="mb-4 flex gap-2" action="/admin/noutati">
        <input name="q" defaultValue={q} placeholder="Caută după titlu sau categorie" className="min-w-0 flex-1 rounded-lg border-2 border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />
        <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">Caută</button>
      </form>
      <Card className="overflow-x-auto p-0">
        {posts.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted">Niciun articol încă. <Link href="/admin/noutati/nou" className="font-semibold text-brand-700 hover:underline">Scrie primul articol</Link>.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-ink/10 text-muted">
              <tr>{["Articol", "Categorie", "Status", "Data", "Vizualizări"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {posts.map((p) => {
                const scheduled = p.status === "publicat" && p.publishedAt && new Date(p.publishedAt).getTime() > now;
                const badge = p.status === "draft" ? ["Draft", "bg-amber-50 text-amber-800"] : scheduled ? ["Programat", "bg-sky-50 text-sky-800"] : ["Publicat", "bg-emerald-50 text-emerald-800"];
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/noutati/${p.id}`} className="font-medium hover:text-brand-700 hover:underline">{p.title}</Link>
                      <div className="text-xs text-muted">/noutati/{p.slug}</div>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{p.category ?? "—"}</td>
                    <td className="px-4 py-2.5"><span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${badge[1]}`}>{badge[0]}</span></td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmt(p.publishedAt ?? p.createdAt)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{p.views}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
