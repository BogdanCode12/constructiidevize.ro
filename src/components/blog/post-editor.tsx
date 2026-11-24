"use client";

import { useEffect, useRef, useState } from "react";
import { ActionForm } from "../action-form";
import { Markdown } from "../markdown";
import { savePostAction, uploadBlogImageAction } from "@/lib/blog-actions";

export type PostDraft = {
  id?: number; slug: string; title: string; excerpt: string; body: string; coverUrl: string; coverAlt: string; category: string;
  tags: string; metaTitle: string; metaDescription: string; authorName: string; status: "draft" | "publicat"; publishedAt: string;
};

const input = "w-full rounded-lg border-2 border-ink/10 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-500";
const lbl = "mb-1.5 block text-sm font-medium";

function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={`text-xs ${n > max ? "text-red-700" : "text-muted"}`}>{n}/{max}</span>;
}

async function upload(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await uploadBlogImageAction(fd);
  if ("error" in r) throw new Error(r.error);
  return r.url;
}

/** Editorul unui articol: câmpuri SEO, imagine principală, text Markdown cu previzualizare și inserare de imagini. */
export function PostEditor({ post, categories }: { post: PostDraft; categories: string[] }) {
  const [title, setTitle] = useState(post.title);
  const [slug, setSlug] = useState(post.slug);
  const [slugTouched, setSlugTouched] = useState(!!post.id);
  const [body, setBody] = useState(post.body);
  const [excerpt, setExcerpt] = useState(post.excerpt);
  const [metaTitle, setMetaTitle] = useState(post.metaTitle);
  const [metaDesc, setMetaDesc] = useState(post.metaDescription);
  const [cover, setCover] = useState(post.coverUrl);
  const [tab, setTab] = useState<"scrie" | "vezi">("scrie");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  // Data se arată în ora locală a browserului și se trimite în UTC (ISO).
  const [localDate, setLocalDate] = useState("");
  useEffect(() => {
    if (!post.publishedAt) return;
    const d = new Date(post.publishedAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    setLocalDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }, [post.publishedAt]);
  const isoDate = localDate && !Number.isNaN(Date.parse(localDate)) ? new Date(localDate).toISOString() : "";

  const effSlug = slugTouched ? slug : slugify(title);
  const snippetTitle = metaTitle || title || "Titlul articolului";
  const snippetDesc = metaDesc || excerpt || body.replace(/[#>*_`!\[\]()]/g, "").slice(0, 160) || "Descrierea apare aici.";

  function insert(text: string) {
    const el = ta.current;
    const at = el ? el.selectionStart : body.length;
    setBody(body.slice(0, at) + text + body.slice(at));
    setTab("scrie");
  }

  async function onImage(f: File | undefined, kind: "cover" | "inline") {
    if (!f) return;
    setBusy(true); setErr(null);
    try {
      const url = await upload(f);
      if (kind === "cover") setCover(url);
      else insert(`\n\n![${f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")}](${url})\n\n`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Încărcarea a eșuat."); }
    setBusy(false);
  }

  const tool = (label: string, snippet: string) => (
    <button type="button" onClick={() => insert(snippet)} className="rounded-md border border-ink/10 bg-white px-2 py-1 text-xs font-semibold hover:border-ink/30">{label}</button>
  );

  return (
    <ActionForm action={savePostAction} submitLabel="Salvează articolul" className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px] [&>*]:min-w-0">
      {post.id && <input type="hidden" name="id" value={post.id} />}
      <div className="space-y-4 xl:row-span-3">
        <label className="block">
          <span className={lbl}>Titlu (H1)</span>
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required className={`${input} text-lg font-semibold`} placeholder="Ex: Cum se calculează CAM-ul într-un deviz de construcții" />
        </label>
        <label className="block">
          <span className={lbl}>Adresa paginii</span>
          <div className="flex items-center rounded-lg border-2 border-ink/10 bg-white text-sm focus-within:border-brand-500">
            <span className="pl-3.5 text-muted">/noutati/</span>
            <input name="slug" value={effSlug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} className="min-w-0 flex-1 bg-transparent py-2.5 pr-3.5 outline-none" />
          </div>
          <span className="mt-1 block text-xs text-muted">Scurtă, fără diacritice, cu cuvintele cheie. Dacă o schimbi după publicare, linkurile vechi nu mai merg.</span>
        </label>
        <label className="block">
          <span className={`${lbl} flex justify-between`}>Rezumat <Counter n={excerpt.length} max={300} /></span>
          <textarea name="excerpt" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className={input} placeholder="1–2 fraze: apare în lista de articole și ca descriere dacă nu completezi meta descrierea." />
        </label>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Conținut</span>
            <div className="flex rounded-lg border-2 border-ink/10 p-0.5 text-xs font-semibold">
              {(["scrie", "vezi"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-md px-3 py-1 ${tab === t ? "bg-ink text-white" : "text-muted"}`}>{t === "scrie" ? "Scrie" : "Previzualizare"}</button>
              ))}
            </div>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {tool("Subtitlu H2", "\n## Subtitlu\n")}
            {tool("H3", "\n### Subtitlu mic\n")}
            {tool("Îngroșat", "**text**")}
            {tool("Listă", "\n- primul punct\n- al doilea punct\n")}
            {tool("Link", "[textul linkului](https://)")}
            {tool("Notă", "\n> Notă importantă\n")}
            {tool("Tabel", "\n| Coloana 1 | Coloana 2 |\n| --- | --- |\n| valoare | valoare |\n")}
            <label className={`cursor-pointer rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-800 ${busy ? "opacity-50" : ""}`}>
              + Imagine în text
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={busy} onChange={(e) => { onImage(e.target.files?.[0], "inline"); e.target.value = ""; }} />
            </label>
          </div>
          <textarea ref={ta} name="body" rows={26} value={body} onChange={(e) => setBody(e.target.value)} required
            className={`${input} font-mono leading-relaxed ${tab === "vezi" ? "hidden" : ""}`}
            placeholder={"Scrie articolul aici.\n\n## Primul subtitlu\nText...\n\n- listă\n- listă"} />
          {tab === "vezi" && (
            <div className="min-h-96 rounded-lg border-2 border-ink/10 bg-white p-5">
              <h1 className="mb-4 text-3xl font-bold tracking-tight">{title || "Titlu"}</h1>
              <Markdown text={body} article />
            </div>
          )}
          <p className="mt-1 text-xs text-muted">Folosește subtitluri ## pentru secțiuni (ajută la SEO). Imaginile au nevoie de un text descriptiv între [ ].</p>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="space-y-3 rounded-xl border-2 border-ink/10 bg-white p-4">
          <p className="font-bold">Publicare</p>
          <label className="block"><span className={lbl}>Status</span>
            <select name="status" defaultValue={post.status} className={input}>
              <option value="draft">Draft (nevizibil)</option><option value="publicat">Publicat</option>
            </select>
          </label>
          <label className="block"><span className={lbl}>Data publicării</span>
            <input type="datetime-local" value={localDate} onChange={(e) => setLocalDate(e.target.value)} className={input} />
            <input type="hidden" name="published_at" value={isoDate} />
            <span className="mt-1 block text-xs text-muted">Goală = acum. O dată viitoare programează articolul.</span>
          </label>
          <label className="block"><span className={lbl}>Autor</span><input name="author_name" defaultValue={post.authorName} className={input} placeholder="Echipa DevizConstruct" /></label>
        </div>

        <div className="space-y-3 rounded-xl border-2 border-ink/10 bg-white p-4">
          <p className="font-bold">Imagine principală</p>
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="aspect-[16/9] w-full rounded-lg object-cover" />
          )}
          <input type="hidden" name="cover_url" value={cover} />
          <div className="flex flex-wrap gap-2 text-sm">
            <label className={`cursor-pointer rounded-lg bg-ink px-3 py-1.5 font-semibold text-white ${busy ? "opacity-50" : ""}`}>
              {cover ? "Schimbă" : "Încarcă imagine"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy} onChange={(e) => { onImage(e.target.files?.[0], "cover"); e.target.value = ""; }} />
            </label>
            {cover && <button type="button" onClick={() => setCover("")} className="font-semibold text-red-700 hover:underline">Scoate</button>}
          </div>
          <label className="block"><span className={lbl}>Text alternativ</span><input name="cover_alt" defaultValue={post.coverAlt} className={input} placeholder="Ce se vede în imagine" /></label>
          <p className="text-xs text-muted">Recomandat 1600×900 px, WEBP/JPG sub 500 KB.</p>
          {busy && <p className="text-xs text-muted">Se încarcă…</p>}
          {err && <p className="text-xs text-red-700">{err}</p>}
        </div>

        <div className="space-y-3 rounded-xl border-2 border-ink/10 bg-white p-4">
          <p className="font-bold">Categorie și etichete</p>
          <label className="block"><span className={lbl}>Categorie</span>
            <input name="category" list="post-cats" defaultValue={post.category} className={input} placeholder="Ex: Devize, Licitații, Legislație" />
            <datalist id="post-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="block"><span className={lbl}>Etichete</span><input name="tags" defaultValue={post.tags} className={input} placeholder="separate prin virgulă" /></label>
        </div>

        <div className="space-y-3 rounded-xl border-2 border-ink/10 bg-white p-4">
          <p className="font-bold">SEO (Google)</p>
          <label className="block"><span className={`${lbl} flex justify-between`}>Meta titlu <Counter n={metaTitle.length} max={60} /></span>
            <input name="meta_title" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className={input} placeholder="Gol = titlul articolului" />
          </label>
          <label className="block"><span className={`${lbl} flex justify-between`}>Meta descriere <Counter n={metaDesc.length} max={160} /></span>
            <textarea name="meta_description" rows={3} value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} className={input} placeholder="Gol = rezumatul" />
          </label>
          <div className="rounded-lg bg-[#fff] p-3 text-left ring-1 ring-ink/10" style={{ fontFamily: "Arial, sans-serif" }}>
            <p className="text-xs text-[#202124]">devizconstruct.ro › noutati › {effSlug || "…"}</p>
            <p className="mt-0.5 line-clamp-1 text-[17px] text-[#1a0dab]">{snippetTitle} · DevizConstruct.ro</p>
            <p className="mt-0.5 line-clamp-2 text-[13px] text-[#4d5156]">{snippetDesc}</p>
          </div>
        </div>
      </aside>
    </ActionForm>
  );
}
