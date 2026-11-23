import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, normalize, extname } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Fișierele încărcate stau în afara folderului aplicației (care e suprascris la fiecare publicare).
 * Pe cPanel: implicit ~/constructiidevize-uploads; se poate schimba cu UPLOAD_DIR.
 */
export function uploadRoot(): string {
  return process.env.UPLOAD_DIR || join(homedir(), "constructiidevize-uploads");
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".txt", ".odt", ".ods"]);

export function isAllowedFile(name: string) {
  return ALLOWED.has(extname(name).toLowerCase());
}

export async function saveUpload(companyId: number, file: File): Promise<{ path: string; size: number; mime: string; name: string }> {
  const ext = extname(file.name).toLowerCase();
  const rel = join(String(companyId), `${randomUUID()}${ext}`);
  const abs = join(uploadRoot(), rel);
  await mkdir(join(uploadRoot(), String(companyId)), { recursive: true });
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return { path: rel, size: file.size, mime: file.type || "application/octet-stream", name: file.name.slice(0, 255) };
}

function safeAbs(rel: string) {
  const clean = normalize(rel).replace(/^(\.\.[/\\])+/, "");
  return join(uploadRoot(), clean);
}

export async function readUpload(rel: string): Promise<Buffer> {
  return readFile(safeAbs(rel));
}

export async function deleteUpload(rel: string): Promise<void> {
  await unlink(safeAbs(rel)).catch(() => undefined);
}
