import Link from "next/link";
import type { Post } from "@/lib/blog";

export const dateRo = (d: Date | null) => (d ? new Intl.DateTimeFormat("ro-RO", { dateStyle: "long", timeZone: "Europe/Bucharest" }).format(new Date(d)) : "");

export function PostCard({ post, large = false }: { post: Post; large?: boolean }) {
  return (
    <article className={`group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:border-ink/25 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,.35)] ${large ? "md:col-span-2 lg:col-span-3 lg:flex-row" : ""}`}>
      <Link href={`/noutati/${post.slug}`} className={`block overflow-hidden bg-canvas ${large ? "lg:w-1/2" : ""}`} tabIndex={-1} aria-hidden>
        {post.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverUrl} alt={post.coverAlt ?? ""} loading="lazy" className={`w-full object-cover transition duration-500 group-hover:scale-[1.03] ${large ? "aspect-[16/9] lg:h-full" : "aspect-[16/9]"}`} />
        ) : (
          <div className={`flex w-full items-center justify-center bg-[linear-gradient(135deg,#f4f4f2,#e9e9e6)] ${large ? "aspect-[16/9] lg:h-full" : "aspect-[16/9]"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/devizconstruct-mark.png" alt="" className="h-14 opacity-25" />
          </div>
        )}
      </Link>
      <div className={`flex flex-1 flex-col p-5 ${large ? "lg:justify-center lg:p-10" : ""}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {post.category && <span className="font-semibold uppercase tracking-wider text-brand-700">{post.category}</span>}
          <time dateTime={post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined}>{dateRo(post.publishedAt)}</time>
        </div>
        <h2 className={`mt-2 font-semibold leading-snug tracking-tight ${large ? "text-2xl sm:text-3xl" : "text-lg"}`}>
          <Link href={`/noutati/${post.slug}`} className="hover:text-brand-700">{post.title}</Link>
        </h2>
        {post.excerpt && <p className={`mt-2 text-muted ${large ? "text-base" : "line-clamp-3 text-sm"}`}>{post.excerpt}</p>}
        <Link href={`/noutati/${post.slug}`} className="mt-auto pt-4 text-sm font-semibold text-ink group-hover:text-brand-700">Citește articolul →</Link>
      </div>
    </article>
  );
}
