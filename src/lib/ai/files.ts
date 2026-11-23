import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { extname } from "node:path";
import { readUpload } from "../storage";

type Block = Anthropic.Beta.BetaContentBlockParam;

/** Limită de siguranță pentru o cerere (API-ul acceptă 32 MB). */
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

const IMAGE_TYPES: Record<string, "image/png" | "image/jpeg" | "image/webp" | "image/gif"> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
};

/** Text din .docx: paragrafele din word/document.xml. */
async function docxText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Text din .xlsx: fiecare foaie, rândurile cu valorile separate prin tab. */
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

function textDoc(title: string, text: string): Block {
  return { type: "document", title, source: { type: "text", media_type: "text/plain", data: text || "(document gol)" } };
}

async function blocksFor(name: string, buf: Buffer, depth = 0): Promise<Block[]> {
  const ext = extname(name).toLowerCase();
  if (ext === ".pdf") return [{ type: "document", title: name, source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } }];
  if (IMAGE_TYPES[ext]) return [
    { type: "text", text: `Imagine: ${name}` },
    { type: "image", source: { type: "base64", media_type: IMAGE_TYPES[ext], data: buf.toString("base64") } },
  ];
  if (ext === ".docx") return [textDoc(name, await docxText(buf))];
  if (ext === ".xlsx") return [textDoc(name, await xlsxText(buf))];
  if (ext === ".txt" || ext === ".csv") return [textDoc(name, buf.toString("utf8"))];
  if (ext === ".zip" && depth === 0) {
    const zip = await JSZip.loadAsync(buf);
    const out: Block[] = [];
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || entry.name.startsWith("__MACOSX")) continue;
      out.push(...(await blocksFor(`${name} › ${entry.name}`, await entry.async("nodebuffer"), depth + 1)));
    }
    return out;
  }
  return [{ type: "text", text: `(Fișierul ${name} are un format care nu poate fi citit automat: ${ext || "fără extensie"}.)` }];
}

export type StoredFile = { file_name: string; file_path: string; file_size: number };

/** Transformă fișierele proiectului în blocuri pentru Claude (PDF și imagini direct; Word/Excel/ZIP ca text). */
export async function fileBlocks(files: StoredFile[]): Promise<Block[]> {
  const total = files.reduce((s, f) => s + f.file_size, 0);
  if (total > MAX_TOTAL_BYTES) throw new Error("Fișierele selectate depășesc 24 MB împreună. Alege mai puține fișiere.");
  const blocks: Block[] = [];
  for (const f of files) blocks.push(...(await blocksFor(f.file_name, await readUpload(f.file_path))));
  return blocks;
}
