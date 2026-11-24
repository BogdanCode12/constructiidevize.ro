import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { uploadRoot } from "@/lib/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

/** Imaginile blogului (încărcate din admin, păstrate în afara aplicației). Nume strict: uuid + extensie. */
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = file.match(/^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/);
  if (!m) return new Response("Nu există", { status: 404 });
  try {
    const buf = await readFile(join(uploadRoot(), "blog", file));
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": TYPES[m[1]], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Nu există", { status: 404 });
  }
}
