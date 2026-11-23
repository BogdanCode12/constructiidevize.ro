import "server-only";
import { queryOne, query } from "./db";

export type ContentPage = { slug: string; title: string; body: string; updated_at: Date };

export async function getPage(slug: string): Promise<ContentPage | null> {
  return queryOne<ContentPage>("SELECT slug, title, body, updated_at FROM pages WHERE slug = ?", [slug]);
}

export async function listPages(): Promise<ContentPage[]> {
  return query<ContentPage>("SELECT slug, title, body, updated_at FROM pages ORDER BY title");
}
