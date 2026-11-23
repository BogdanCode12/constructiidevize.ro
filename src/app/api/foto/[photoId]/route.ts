import { getCurrentUser } from "@/lib/auth/session";
import { queryOne } from "@/lib/db";
import { readUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ photoId: string }> }) {
  const user = await getCurrentUser();
  if (!user?.company) return new Response("Neautorizat", { status: 401 });
  const p = await queryOne<{ file_path: string; mime: string | null }>(
    "SELECT file_path, mime FROM site_photos WHERE id = ? AND company_id = ?",
    [Number((await params).photoId), user.company.id],
  );
  if (!p) return new Response("Poza nu există", { status: 404 });
  try {
    return new Response(new Uint8Array(await readUpload(p.file_path)), {
      headers: { "Content-Type": p.mime ?? "image/jpeg", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Poza lipsește", { status: 410 });
  }
}
