import { allPublished, plainText } from "@/lib/blog";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const base = siteUrl();
  const posts = await allPublished(50);
  const items = posts.map((p) => `
    <item>
      <title>${esc(p.title)}</title>
      <link>${base}/noutati/${p.slug}</link>
      <guid isPermaLink="true">${base}/noutati/${p.slug}</guid>
      ${p.publishedAt ? `<pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>` : ""}
      ${p.category ? `<category>${esc(p.category)}</category>` : ""}
      <description>${esc(p.excerpt || plainText(p.body).slice(0, 300))}</description>
    </item>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Noutăți · DevizConstruct.ro</title>
    <link>${base}/noutati</link>
    <atom:link href="${base}/noutati/rss.xml" rel="self" type="application/rss+xml" />
    <description>Articole despre devize, licitații și construcții.</description>
    <language>ro</language>${items}
  </channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
