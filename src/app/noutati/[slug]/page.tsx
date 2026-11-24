import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { SiteShell } from "@/components/site/shell";
import { Markdown } from "@/components/markdown";
import { PostCard, dateRo } from "@/components/blog/post-card";
import { countView, getPublishedPost, plainText, readingMinutes, relatedPosts } from "@/lib/blog";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type P = { params: Promise<{ slug: string }> };

const description = (p: { metaDescription: string | null; excerpt: string | null; body: string }) =>
  p.metaDescription || p.excerpt || plainText(p.body).slice(0, 158);

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const p = await getPublishedPost((await params).slug);
  if (!p) return { title: "Articol negăsit" };
  const desc = description(p);
  const url = `/noutati/${p.slug}`;
  const images = p.coverUrl ? [{ url: p.coverUrl, alt: p.coverAlt ?? p.title }] : ["/opengraph-image.jpg"];
  return {
    title: p.metaTitle || p.title,
    description: desc,
    keywords: p.tags.length ? p.tags : undefined,
    alternates: { canonical: url },
    authors: p.authorName ? [{ name: p.authorName }] : undefined,
    openGraph: {
      type: "article", url, title: p.metaTitle || p.title, description: desc, images, locale: "ro_RO", siteName: "DevizConstruct.ro",
      publishedTime: p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined,
      modifiedTime: new Date(p.updatedAt).toISOString(), section: p.category ?? undefined, tags: p.tags,
    },
    twitter: { card: p.coverUrl ? "summary_large_image" : "summary", title: p.metaTitle || p.title, description: desc },
  };
}

export default async function PostPage({ params }: P) {
  const p = await getPublishedPost((await params).slug);
  if (!p) notFound();
  after(() => countView(p.id).catch(() => {}));
  const related = await relatedPosts(p);
  const base = siteUrl();
  const abs = (u: string) => (u.startsWith("http") ? u : `${base}${u}`);

  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "BlogPosting",
      headline: p.title, description: description(p), inLanguage: "ro-RO",
      mainEntityOfPage: { "@type": "WebPage", "@id": `${base}/noutati/${p.slug}` },
      ...(p.coverUrl ? { image: [abs(p.coverUrl)] } : {}),
      datePublished: p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined,
      dateModified: new Date(p.updatedAt).toISOString(),
      author: p.authorName ? { "@type": "Person", name: p.authorName } : { "@type": "Organization", name: "DevizConstruct.ro", url: base },
      publisher: { "@type": "Organization", name: "DevizConstruct.ro", url: base, logo: { "@type": "ImageObject", url: `${base}/brand/devizconstruct-logo.png` } },
      ...(p.category ? { articleSection: p.category } : {}),
      ...(p.tags.length ? { keywords: p.tags.join(", ") } : {}),
      wordCount: p.body.split(/\s+/).filter(Boolean).length,
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Acasă", item: `${base}/` },
        { "@type": "ListItem", position: 2, name: "Noutăți", item: `${base}/noutati` },
        { "@type": "ListItem", position: 3, name: p.title, item: `${base}/noutati/${p.slug}` },
      ],
    },
  ];

  return (
    <SiteShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article>
        <header className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 lg:pt-14">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <Link href="/" className="hover:text-ink">Acasă</Link><span>/</span>
            <Link href="/noutati" className="hover:text-ink">Noutăți</Link>
            {p.category && <><span>/</span><Link href={`/noutati?categorie=${encodeURIComponent(p.category)}`} className="hover:text-ink">{p.category}</Link></>}
          </nav>
          <h1 className="mt-5 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">{p.title}</h1>
          {p.excerpt && <p className="mt-5 text-lg leading-relaxed text-muted sm:text-xl">{p.excerpt}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line pb-6 text-sm text-muted">
            {p.authorName && <span className="font-medium text-ink">{p.authorName}</span>}
            <time dateTime={p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined}>{dateRo(p.publishedAt)}</time>
            <span>{readingMinutes(p.body)} min de citit</span>
          </div>
        </header>
        {p.coverUrl && (
          <figure className="mx-auto mt-8 max-w-5xl px-4 sm:px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.coverUrl} alt={p.coverAlt ?? p.title} fetchPriority="high" className="aspect-[16/9] w-full rounded-2xl object-cover" />
          </figure>
        )}
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-12">
          <Markdown text={p.body} article />
          {p.tags.length > 0 && (
            <ul className="mt-10 flex flex-wrap gap-2 border-t border-line pt-6">
              {p.tags.map((t) => <li key={t} className="rounded-full bg-canvas px-3 py-1 text-xs font-medium text-muted">#{t}</li>)}
            </ul>
          )}
        </div>
      </article>

      <section className="bg-ink">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">Faci devize pentru licitații?</h2>
            <p className="mt-1 text-white/70">Devize F1–F5 și C5–C9, dosar de licitație și situații de lucrări, într-un singur loc.</p>
          </div>
          <Link href="/inregistrare" className="rounded-lg bg-brand-700 px-6 py-3.5 font-semibold text-white hover:bg-brand-800">Creează cont gratuit</Link>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Citește și</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{related.map((r) => <PostCard key={r.id} post={r} />)}</div>
        </section>
      )}
    </SiteShell>
  );
}
