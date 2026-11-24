import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/shell";
import { PostCard } from "@/components/blog/post-card";
import { listPublished, PAGE_SIZE, publishedCategories } from "@/lib/blog";

export const dynamic = "force-dynamic";

type SP = { pagina?: string; categorie?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const qs = new URLSearchParams({ ...(sp.categorie ? { categorie: sp.categorie } : {}), ...(page > 1 ? { pagina: String(page) } : {}) }).toString();
  const title = sp.categorie ? `Noutăți: ${sp.categorie}` : "Noutăți din construcții";
  return {
    title: page > 1 ? `${title} (pagina ${page})` : title,
    description: "Articole despre devize de construcții, licitații publice, legislație, prețuri și organizarea lucrărilor, scrise pentru firme de construcții din România.",
    alternates: { canonical: `/noutati${qs ? `?${qs}` : ""}`, types: { "application/rss+xml": "/noutati/rss.xml" } },
    openGraph: { type: "website", title, url: "/noutati", siteName: "DevizConstruct.ro", locale: "ro_RO", images: ["/opengraph-image.jpg"] },
  };
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const [{ posts, total }, cats] = await Promise.all([listPublished({ page, category: sp.categorie || undefined }), publishedCategories()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number, c = sp.categorie) => {
    const q = new URLSearchParams({ ...(c ? { categorie: c } : {}), ...(p > 1 ? { pagina: String(p) } : {}) }).toString();
    return `/noutati${q ? `?${q}` : ""}`;
  };
  const chip = (on: boolean) => `rounded-full border px-4 py-1.5 text-sm font-medium transition ${on ? "border-ink bg-ink text-white" : "border-line hover:border-ink"}`;

  return (
    <SiteShell>
      <section className="border-b border-line">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <p className="text-sm font-semibold tracking-wider text-brand-700 uppercase">Noutăți</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">Noutăți din construcții</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">Devize, licitații publice, legislație și prețuri — explicate pe înțelesul firmelor de construcții.</p>
          {cats.length > 0 && (
            <nav className="mt-8 flex flex-wrap gap-2" aria-label="Categorii">
              <Link href="/noutati" className={chip(!sp.categorie)}>Toate</Link>
              {cats.map((c) => <Link key={c.name} href={href(1, c.name)} className={chip(sp.categorie === c.name)}>{c.name}</Link>)}
            </nav>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        {posts.length === 0 ? (
          <p className="py-16 text-center text-muted">În curând publicăm primele articole.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((p, i) => <PostCard key={p.id} post={p} large={i === 0 && page === 1 && !sp.categorie} />)}
          </div>
        )}
        {pages > 1 && (
          <nav className="mt-12 flex flex-wrap items-center justify-center gap-2" aria-label="Pagini">
            {page > 1 && <Link href={href(page - 1)} rel="prev" className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Înapoi</Link>}
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={href(n)} aria-current={n === page ? "page" : undefined}
                className={`min-w-10 rounded-lg border px-3 py-2 text-center text-sm font-semibold ${n === page ? "border-ink bg-ink text-white" : "border-line hover:border-ink"}`}>{n}</Link>
            ))}
            {page < pages && <Link href={href(page + 1)} rel="next" className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-ink">Înainte →</Link>}
          </nav>
        )}
      </section>
    </SiteShell>
  );
}
