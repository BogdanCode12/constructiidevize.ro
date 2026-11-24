"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { execute, queryOne } from "./db";
import { requireAdmin } from "./auth/session";
import { logActivity } from "./activity";
import { uploadRoot } from "./storage";
import { slugify } from "./blog";
import type { FormState } from "@/components/action-form";

function refresh(slug?: string) {
  revalidatePath("/noutati");
  revalidatePath("/admin/noutati");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/noutati/${slug}`);
}

const s = (d: FormData, k: string, n: number) => String(d.get(k) ?? "").trim().slice(0, n) || null;

/** Adaugă sau salvează un articol. Adresa (slug) se generează din titlu dacă e goală și trebuie să fie unică. */
export async function savePostAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = Number(data.get("id") || 0);
  const title = s(data, "title", 255);
  const body = String(data.get("body") ?? "").replace(/\r/g, "").trim();
  if (!title) return { error: "Completează titlul." };
  if (!body) return { error: "Scrie conținutul articolului." };
  const slug = slugify(String(data.get("slug") ?? "").trim() || title);
  const clash = await queryOne<{ id: number }>("SELECT id FROM posts WHERE slug = ? AND id <> ?", [slug, id]);
  if (clash) return { error: `Adresa „/noutati/${slug}” e folosită deja de alt articol. Schimb-o.` };

  const cover = s(data, "cover_url", 500);
  if (cover && !/^(\/media\/blog\/|https:\/\/)/.test(cover)) return { error: "Imaginea principală trebuie încărcată aici sau să fie o adresă https://." };
  const status = data.get("status") === "publicat" ? "publicat" : "draft";
  const dateRaw = String(data.get("published_at") ?? "").trim();
  const publishedAt = dateRaw && !Number.isNaN(Date.parse(dateRaw)) ? new Date(dateRaw) : status === "publicat" ? new Date() : null;

  const vals = {
    slug, title, body, excerpt: s(data, "excerpt", 500), cover_url: cover, cover_alt: s(data, "cover_alt", 255),
    category: s(data, "category", 80),
    tags: (String(data.get("tags") ?? "")).split(",").map((t) => t.trim()).filter(Boolean).join(", ").slice(0, 255) || null,
    meta_title: s(data, "meta_title", 190), meta_description: s(data, "meta_description", 300), author_name: s(data, "author_name", 120),
    status, published_at: publishedAt,
  };
  const cols = Object.keys(vals);
  let newId = id;
  if (id) {
    const old = await queryOne<{ slug: string }>("SELECT slug FROM posts WHERE id = ?", [id]);
    if (!old) return { error: "Articolul nu există." };
    await execute(`UPDATE posts SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, [...Object.values(vals), id]);
    if (old.slug !== slug) refresh(old.slug);
  } else {
    newId = (await execute(`INSERT INTO posts (${cols.join(", ")}, created_by) VALUES (${cols.map(() => "?").join(", ")}, ?)`, [...Object.values(vals), admin.id])).insertId;
  }
  await logActivity({ userId: admin.id, action: id ? "admin.articol.modificat" : "admin.articol.adaugat", details: { id: newId, slug, status } });
  refresh(slug);
  if (!id) redirect(`/admin/noutati/${newId}?salvat=1`);
  return { ok: status === "publicat" ? "Salvat și publicat." : "Salvat ca draft (nu e vizibil public)." };
}

export async function deletePostAction(data: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(data.get("id"));
  const p = await queryOne<{ slug: string }>("SELECT slug FROM posts WHERE id = ?", [id]);
  await execute("DELETE FROM posts WHERE id = ?", [id]);
  await logActivity({ userId: admin.id, action: "admin.articol.sters", details: { id } });
  refresh(p?.slug);
  redirect("/admin/noutati");
}

const IMG = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

/** Încarcă o imagine pentru blog (max. 5 MB). Întoarce adresa publică (/media/blog/…). */
export async function uploadBlogImageAction(data: FormData): Promise<{ url: string } | { error: string }> {
  await requireAdmin();
  const f = data.get("file");
  if (!(f instanceof File) || !f.size) return { error: "Alege o imagine." };
  const ext = extname(f.name).toLowerCase();
  if (!IMG.has(ext)) return { error: "Acceptăm JPG, PNG, WEBP sau GIF." };
  if (f.size > 5 * 1024 * 1024) return { error: "Imaginea depășește 5 MB. Micșoreaz-o înainte (ideal sub 500 KB, lățime 1600 px)." };
  const name = `${randomUUID()}${ext === ".jpeg" ? ".jpg" : ext}`;
  await mkdir(join(uploadRoot(), "blog"), { recursive: true });
  await writeFile(join(uploadRoot(), "blog", name), Buffer.from(await f.arrayBuffer()));
  return { url: `/media/blog/${name}` };
}
