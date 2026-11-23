import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { execute, queryOne } from "@/lib/db";
import { isAllowedFile, MAX_UPLOAD_BYTES, saveUpload } from "@/lib/storage";
import { PROJECT_FILE_LABELS } from "@/lib/ai/labels";

export const dynamic = "force-dynamic";

/** Încărcare documente ale proiectului (caiet de sarcini, contract, planșe…), mai multe odată. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.company) return Response.json({ error: "Neautorizat" }, { status: 401 });
  const projectId = Number((await params).id);
  const p = await queryOne("SELECT id FROM projects WHERE id = ? AND company_id = ?", [projectId, user.company.id]);
  if (!p) return Response.json({ error: "Proiectul nu există" }, { status: 404 });

  const data = await req.formData();
  const label = String(data.get("label") ?? "altele");
  if (!(label in PROJECT_FILE_LABELS)) return Response.json({ error: "Tip de document invalid." }, { status: 400 });
  const files = data.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return Response.json({ error: "Alege cel puțin un fișier." }, { status: 400 });
  for (const f of files) {
    if (f.size > MAX_UPLOAD_BYTES) return Response.json({ error: `${f.name} depășește 25 MB.` }, { status: 400 });
    if (!isAllowedFile(f.name)) return Response.json({ error: `${f.name}: tip de fișier nepermis.` }, { status: 400 });
  }
  for (const f of files) {
    const s = await saveUpload(user.company.id, f);
    await execute(
      "INSERT INTO project_files (company_id, project_id, label, file_path, file_name, file_size, mime, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [user.company.id, projectId, label, s.path, s.name, s.size, s.mime, user.id],
    );
  }
  revalidatePath(`/panou/proiecte/${projectId}/ai`);
  return Response.json({ ok: true, count: files.length });
}
