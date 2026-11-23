import { revalidatePath } from "next/cache";
import { extname } from "node:path";
import { getCurrentUser } from "@/lib/auth/session";
import { execute, queryOne } from "@/lib/db";
import { saveUpload } from "@/lib/storage";
import { parseNum } from "@/lib/numbers";

export const dynamic = "force-dynamic";

const IMG = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);

/** Raport zilnic de șantier, cu poze (de pe telefon). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.company) return Response.json({ error: "Neautorizat" }, { status: 401 });
  const projectId = Number((await params).id);
  if (!(await queryOne("SELECT id FROM projects WHERE id = ? AND company_id = ?", [projectId, user.company.id])))
    return Response.json({ error: "Proiectul nu există" }, { status: 404 });

  const d = await req.formData();
  const date = String(d.get("entry_date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Alege data." }, { status: 400 });
  const txt = (k: string, len: number) => String(d.get(k) ?? "").trim().slice(0, len) || null;
  const photos = d.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of photos) {
    if (!IMG.has(extname(f.name).toLowerCase())) return Response.json({ error: `${f.name}: doar poze (JPG, PNG, WEBP, HEIC).` }, { status: 400 });
    if (f.size > 15 * 1024 * 1024) return Response.json({ error: `${f.name} depășește 15 MB.` }, { status: 400 });
  }
  if (photos.length > 20) return Response.json({ error: "Maxim 20 de poze la un raport." }, { status: 400 });

  const workers = parseNum(d.get("workers"));
  const hours = parseNum(d.get("hours"));
  const entry = await execute(
    "INSERT INTO site_journal (company_id, project_id, entry_date, weather, workers, hours, activities, issues, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [user.company.id, projectId, date, txt("weather", 80), workers !== null ? Math.round(workers) : null, hours, txt("activities", 5000), txt("issues", 5000), user.id],
  );
  for (const f of photos) {
    // Pozele stau separat, pe firmă, în afara aplicației (vezi lib/storage).
    const file = await saveUpload(user.company.id, f);
    await execute("INSERT INTO site_photos (company_id, journal_id, file_path, file_name, mime) VALUES (?, ?, ?, ?, ?)",
      [user.company.id, entry.insertId, file.path, file.name, file.mime]);
  }
  revalidatePath(`/panou/proiecte/${projectId}/santier`);
  return Response.json({ ok: true, photos: photos.length });
}
