import type { MetadataRoute } from "next";
import { allPublished } from "@/lib/blog";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const fixed: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/servicii`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/abonamente`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/noutati`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/inregistrare`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/termeni`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/confidentialitate`, changeFrequency: "yearly", priority: 0.2 },
  ];
  let posts: MetadataRoute.Sitemap = [];
  try {
    posts = (await allPublished()).map((p) => ({
      url: `${base}/noutati/${p.slug}`, lastModified: new Date(p.updatedAt), changeFrequency: "monthly", priority: 0.7,
      ...(p.coverUrl ? { images: [p.coverUrl.startsWith("http") ? p.coverUrl : `${base}${p.coverUrl}`] } : {}),
    }));
  } catch { /* baza indisponibilă: măcar paginile fixe */ }
  return [...fixed, ...posts];
}
