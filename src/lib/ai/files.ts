import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { extname } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { execute } from "../db";
import { readUpload } from "../storage";
import { normText } from "../estimate/normalize";

type Block = Anthropic.Beta.BetaContentBlockParam;

/*
 * Economie de tokeni: textul fiecărui document se extrage O SINGURĂ DATĂ (la încărcare) și se salvează în
 * project_files.extracted_text. La analize și în chat se trimite textul (mult mai ieftin decât PDF-ul, care
 * se taxează și ca imagine pe fiecare pagină). PDF-ul original se trimite doar pentru documente scanate
 * (fără text) sau când sarcina AI cere explicit originalele (ai_tasks.send_originals).
 */

const MAX_TOTAL_BYTES = 24 * 1024 * 1024;
/** Sub atâtea caractere pe pagină, PDF-ul e considerat scanat → se trimite originalul. */
const MIN_CHARS_PER_PAGE = 150;

const IMAGE_TYPES: Record<string, "image/png" | "image/jpeg" | "image/webp" | "image/gif"> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
};

async function docxText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  return xml
    .replace(/<w:tab\/>/g, "\t").replace(/<\/w:p>/g, "\n").replace(/<w:br\/>/g, "\n").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}

async function xlsxText(buf: Buffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const parts: string[] = [];
  wb.eachSheet((ws) => {
    parts.push(`### Foaia „${ws.name}”`);
    ws.eachRow((row) => {
      const vals = (row.values as unknown[]).slice(1).map((v) => {
        if (v === null || v === undefined) return "";
        if (typeof v === "object") {
          const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
          if (o.richText) return o.richText.map((r) => r.text).join("");
          return String(o.result ?? o.text ?? "");
        }
        return String(v);
      });
      if (vals.some((x) => x.trim())) parts.push(vals.join("\t"));
    });
  });
  return parts.join("\n");
}

async function pdfText(buf: Buffer): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  return {
    pages: totalPages,
    text: text.map((t, i) => `--- pagina ${i + 1} ---\n${t.replace(/[ \t]+/g, " ").trim()}`).join("\n\n"),
  };
}

export type Extracted = { text: string; pages: number | null };

/** Textul unui fișier (PDF pe pagini, Word, Excel, TXT, ZIP cu fișierele din el). Imaginile nu au text. */
export async function extractFileText(name: string, buf: Buffer, depth = 0): Promise<Extracted> {
  const ext = extname(name).toLowerCase();
  try {
    if (ext === ".pdf") return pdfText(buf);
    if (ext === ".docx") return { text: await docxText(buf), pages: null };
    if (ext === ".xlsx") return { text: await xlsxText(buf), pages: null };
    if (ext === ".txt" || ext === ".csv") return { text: buf.toString("utf8"), pages: null };
    if (ext === ".zip" && depth === 0) {
      const zip = await JSZip.loadAsync(buf);
      const parts: string[] = [];
      let pages = 0;
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || entry.name.startsWith("__MACOSX")) continue;
        const e = await extractFileText(entry.name, await entry.async("nodebuffer"), 1);
        if (e.text.trim()) parts.push(`=== ${entry.name} ===\n${e.text}`);
        pages += e.pages ?? 0;
      }
      return { text: parts.join("\n\n"), pages: pages || null };
    }
  } catch (err) {
    console.error("[extract]", name, err);
  }
  return { text: "", pages: null };
}

/** Are textul extras suficient conținut ca să înlocuiască originalul? */
function textIsUsable(name: string, e: Extracted): boolean {
  if (IMAGE_TYPES[extname(name).toLowerCase()]) return false;
  if (!e.text.trim()) return false;
  if (e.pages) return e.text.length / e.pages >= MIN_CHARS_PER_PAGE;
  return true;
}

export type StoredFile = {
  id: number; file_name: string; file_path: string; file_size: number;
  extracted_text: string | null; extracted_pages: number | null;
};

/** Textul salvat al fișierului; pentru fișierele vechi îl extrage acum și îl salvează. */
export async function ensureExtracted(f: StoredFile): Promise<Extracted> {
  if (f.extracted_text !== null) return { text: f.extracted_text, pages: f.extracted_pages };
  const e = await extractFileText(f.file_name, await readUpload(f.file_path));
  await execute("UPDATE project_files SET extracted_text = ?, extracted_pages = ? WHERE id = ?", [e.text, e.pages, f.id]);
  return e;
}

function textDoc(title: string, text: string): Block {
  return { type: "document", title, source: { type: "text", media_type: "text/plain", data: text || "(document gol)" } };
}

async function originalBlocks(name: string, buf: Buffer, depth = 0): Promise<Block[]> {
  const ext = extname(name).toLowerCase();
  if (ext === ".pdf") return [{ type: "document", title: name, source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } }];
  if (IMAGE_TYPES[ext]) return [{ type: "text", text: `Imagine: ${name}` }, { type: "image", source: { type: "base64", media_type: IMAGE_TYPES[ext], data: buf.toString("base64") } }];
  if (ext === ".zip" && depth === 0) {
    const zip = await JSZip.loadAsync(buf);
    const out: Block[] = [];
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || entry.name.startsWith("__MACOSX")) continue;
      out.push(...(await originalBlocks(`${name} › ${entry.name}`, await entry.async("nodebuffer"), 1)));
    }
    return out;
  }
  const e = await extractFileText(name, buf, depth);
  return e.text ? [textDoc(name, e.text)] : [{ type: "text", text: `(Fișierul ${name} nu poate fi citit automat.)` }];
}

/**
 * Blocurile pentru Claude. Implicit: textul extras (ieftin); originalul doar pentru scanări/imagini
 * sau când `originals` e true.
 */
export async function fileBlocks(files: StoredFile[], originals = false): Promise<Block[]> {
  const blocks: Block[] = [];
  let rawBytes = 0;
  for (const f of files) {
    const e = await ensureExtracted(f);
    if (!originals && textIsUsable(f.file_name, e)) {
      blocks.push(textDoc(f.file_name, e.text));
      continue;
    }
    rawBytes += f.file_size;
    if (rawBytes > MAX_TOTAL_BYTES) throw new Error("Documentele scanate selectate depășesc 24 MB împreună. Alege mai puține fișiere.");
    blocks.push(...(await originalBlocks(f.file_name, await readUpload(f.file_path))));
  }
  return blocks;
}

/** Cât text trimitem în chat (aprox. 4 caractere = 1 token → ~40.000 tokeni). */
const CHAT_CHAR_BUDGET = 160_000;

/**
 * Pentru chat: dacă documentele sunt mari, trimite doar fragmentele relevante pentru întrebare
 * (scor după cuvintele comune), în ordinea din document. Documentele mici se trimit întregi.
 */
export async function chatBlocks(files: StoredFile[], question: string): Promise<Block[]> {
  const docs: { name: string; text: string }[] = [];
  for (const f of files) {
    const e = await ensureExtracted(f);
    if (e.text.trim()) docs.push({ name: f.file_name, text: e.text });
  }
  const total = docs.reduce((s, d) => s + d.text.length, 0);
  if (total <= CHAT_CHAR_BUDGET) return docs.map((d) => textDoc(d.name, d.text));

  const qWords = new Set(normText(question).split(" ").filter((w) => w.length > 3).map((w) => w.slice(0, 6)));
  type Chunk = { doc: number; idx: number; text: string; score: number };
  const chunks: Chunk[] = [];
  docs.forEach((d, di) => {
    const parts = d.text.split(/\n{2,}/);
    let buf = "";
    let idx = 0;
    const flush = () => {
      if (!buf.trim()) return;
      const words = normText(buf).split(" ").map((w) => w.slice(0, 6));
      const score = words.reduce((s, w) => s + (qWords.has(w) ? 1 : 0), 0);
      chunks.push({ doc: di, idx: idx++, text: buf, score });
      buf = "";
    };
    for (const p of parts) {
      if (buf.length + p.length > 2000) flush();
      buf += (buf ? "\n\n" : "") + p;
    }
    flush();
  });
  const picked = [...chunks].sort((a, b) => b.score - a.score);
  const keep = new Set<Chunk>();
  let used = 0;
  for (const c of picked) {
    if (used + c.text.length > CHAT_CHAR_BUDGET) continue;
    keep.add(c);
    used += c.text.length;
  }
  return docs
    .map((d, di) => {
      const sel = chunks.filter((c) => c.doc === di && keep.has(c)).sort((a, b) => a.idx - b.idx);
      return sel.length ? textDoc(`${d.name} (fragmente relevante)`, sel.map((c) => c.text).join("\n\n[…]\n\n")) : null;
    })
    .filter((b): b is Block => !!b);
}
