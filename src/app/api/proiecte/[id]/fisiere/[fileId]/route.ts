import { getCurrentUser } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { readUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const user = await getCurrentUser();
  if (!user?.company) return new Response("Neautorizat", { status: 401 });
  const { id, fileId } = await params;
  const f = await queryOne<{ file_path: string; file_name: string; mime: string | null }>(
    "SELECT file_path, file_name, mime FROM project_files WHERE id = ? AND project_id = ? AND company_id = ?",
    [Number(fileId), Number(id), user.company.id],
  );
  if (!f) return new Response("Fișierul nu există", { status: 404 });
  try {
    return new Response(new Uint8Array(await readUpload(f.file_path)), {
      headers: {
        "Content-Type": f.mime ?? "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(f.file_name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Fișierul lipsește de pe server", { status: 410 });
  }
}
