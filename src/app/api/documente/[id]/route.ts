import { getCurrentUser } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { readUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Descărcarea unui document din dosarul firmei (doar membrii firmei). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.company) return new Response("Neautorizat", { status: 401 });
  const doc = await queryOne<{ file_path: string | null; file_name: string | null; mime: string | null }>(
    "SELECT file_path, file_name, mime FROM company_documents WHERE id = ? AND company_id = ?",
    [Number((await params).id), user.company.id],
  );
  if (!doc?.file_path) return new Response("Documentul nu există", { status: 404 });
  try {
    const buf = await readUpload(doc.file_path);
    const name = doc.file_name ?? "document";
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": doc.mime ?? "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Fișierul lipsește de pe server", { status: 410 });
  }
}
