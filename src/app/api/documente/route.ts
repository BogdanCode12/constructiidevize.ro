import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { execute } from "@/lib/db";
import { isAllowedFile, MAX_UPLOAD_BYTES, saveUpload } from "@/lib/storage";
import { DOC_CATEGORIES, type DocCategory } from "@/lib/documents";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const date = (v: FormDataEntryValue | null) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const txt = (v: FormDataEntryValue | null, len: number) => (typeof v === "string" ? v.trim().slice(0, len) : "") || null;

/** Încărcare document în dosarul firmei (multipart/form-data). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.company) return Response.json({ error: "Neautorizat" }, { status: 401 });
  const data = await req.formData();
  const title = txt(data.get("title"), 255);
  const category = String(data.get("category") ?? "altele");
  if (!title) return Response.json({ error: "Completează denumirea documentului." }, { status: 400 });
  if (!(category in DOC_CATEGORIES)) return Response.json({ error: "Categorie invalidă." }, { status: 400 });

  const file = data.get("file");
  let stored: Awaited<ReturnType<typeof saveUpload>> | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "Fișierul depășește 25 MB." }, { status: 400 });
    if (!isAllowedFile(file.name)) return Response.json({ error: "Tip de fișier nepermis (PDF, imagini, Word, Excel, ZIP)." }, { status: 400 });
    stored = await saveUpload(user.company.id, file);
  }

  const res = await execute(
    `INSERT INTO company_documents (company_id, category, title, issuer, doc_number, issued_at, expires_at, notes, file_path, file_name, file_size, mime, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.company.id, category as DocCategory, title, txt(data.get("issuer"), 190), txt(data.get("doc_number"), 80),
      date(data.get("issued_at")), date(data.get("expires_at")), txt(data.get("notes"), 500),
      stored?.path ?? null, stored?.name ?? null, stored?.size ?? null, stored?.mime ?? null, user.id,
    ],
  );
  await logActivity({ companyId: user.company.id, userId: user.id, action: "document.incarcat", details: { id: res.insertId, title } });
  revalidatePath("/panou/documente");
  revalidatePath("/panou");
  return Response.json({ ok: true, id: res.insertId });
}
