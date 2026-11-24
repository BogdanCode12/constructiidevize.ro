import "server-only";
import { cache } from "react";
import { execute, query, queryOne } from "./db";

export type PostStatus = "draft" | "publicat";

export type Post = {
  id: number; slug: string; title: string; excerpt: string | null; body: string; coverUrl: string | null; coverAlt: string | null;
  category: string | null; tags: string[]; metaTitle: string | null; metaDescription: string | null; authorName: string | null;
  status: PostStatus; publishedAt: Date | null; updatedAt: Date; createdAt: Date; views: number;
};

type Row = {
  id: number; slug: string; title: string; excerpt: string | null; body: string; cover_url: string | null; cover_alt: string | null;
  category: string | null; tags: string | null; meta_title: string | null; meta_description: string | null; author_name: string | null;
  status: PostStatus; published_at: Date | null; updated_at: Date; created_at: Date; views: number;
};

const map = (r: Row): Post => ({
  id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt, body: r.body, coverUrl: r.cover_url, coverAlt: r.cover_alt,
  category: r.category, tags: (r.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
  metaTitle: r.meta_title, metaDescription: r.meta_description, authorName: r.author_name,
  status: r.status, publishedAt: r.published_at, updatedAt: r.updated_at, createdAt: r.created_at, views: r.views,
});

/** Articolele vizibile public: publicate și cu data publicării ajunsă (se pot programa). */
const LIVE = "status = 'publicat' AND published_at IS NOT NULL AND published_at <= UTC_TIMESTAMP()";

export const PAGE_SIZE = 9;

export async function listPublished(opts: { page?: number; category?: string } = {}): Promise<{ posts: Post[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const where = [LIVE];
  const params: unknown[] = [];
  if (opts.category) { where.push("category = ?"); params.push(opts.category); }
  const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM posts WHERE ${where.join(" AND ")}`, params);
  const rows = await query<Row>(
    `SELECT * FROM posts WHERE ${where.join(" AND ")} ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  return { posts: rows.map(map), total: Number(n) };
}

export async function publishedCategories(): Promise<{ name: string; n: number }[]> {
  const rows = await query<{ name: string; n: number }>(
    `SELECT category AS name, COUNT(*) AS n FROM posts WHERE ${LIVE} AND category IS NOT NULL AND category <> '' GROUP BY category ORDER BY n DESC, name`,
  );
  return rows.map((r) => ({ name: r.name, n: Number(r.n) }));
}

export const getPublishedPost = cache(async (slug: string): Promise<Post | null> => {
  const r = await queryOne<Row>(`SELECT * FROM posts WHERE slug = ? AND ${LIVE}`, [slug]);
  return r ? map(r) : null;
});

export async function relatedPosts(p: Post, limit = 3): Promise<Post[]> {
  const rows = await query<Row>(
    `SELECT * FROM posts WHERE ${LIVE} AND id <> ? ORDER BY (category <=> ?) DESC, published_at DESC LIMIT ?`,
    [p.id, p.category, limit],
  );
  return rows.map(map);
}

export async function countView(id: number): Promise<void> {
  await execute("UPDATE posts SET views = views + 1 WHERE id = ?", [id]);
}

/** Toate articolele publicate (pentru sitemap și RSS). */
export async function allPublished(limit = 1000): Promise<Post[]> {
  return (await query<Row>(`SELECT * FROM posts WHERE ${LIVE} ORDER BY published_at DESC LIMIT ?`, [limit])).map(map);
}

// ---------- admin ----------

export async function adminListPosts(q?: string): Promise<Post[]> {
  const rows = await query<Row>(
    `SELECT * FROM posts ${q ? "WHERE title LIKE ? OR category LIKE ?" : ""} ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT 500`,
    q ? [`%${q}%`, `%${q}%`] : [],
  );
  return rows.map(map);
}

export async function adminGetPost(id: number): Promise<Post | null> {
  const r = await queryOne<Row>("SELECT * FROM posts WHERE id = ?", [id]);
  return r ? map(r) : null;
}

/** Adresă curată din titlu: fără diacritice, cu cratime, ex. „Cum faci un deviz F3” → „cum-faci-un-deviz-f3”. */
export function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "articol";
}

/** Minute de citire (~200 de cuvinte pe minut). */
export const readingMinutes = (body: string) => Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200));

/** Textul simplu al unui Markdown (pentru descrieri automate). */
export const plainText = (md: string) =>
  md.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[#>*_`|]/g, "").replace(/\s+/g, " ").trim();

export async function adminCategories(): Promise<string[]> {
  return (await query<{ c: string }>("SELECT DISTINCT category AS c FROM posts WHERE category IS NOT NULL AND category <> '' ORDER BY c")).map((r) => r.c);
}
