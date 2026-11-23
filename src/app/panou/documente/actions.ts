"use server";

import { revalidatePath } from "next/cache";
import { execute, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { deleteUpload } from "@/lib/storage";
import { logActivity } from "@/lib/activity";

export async function deleteDocumentAction(data: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.company) return;
  const id = Number(data.get("id"));
  const doc = await queryOne<{ file_path: string | null; title: string }>(
    "SELECT file_path, title FROM company_documents WHERE id = ? AND company_id = ?",
    [id, user.company.id],
  );
  if (!doc) return;
  await execute("DELETE FROM company_documents WHERE id = ? AND company_id = ?", [id, user.company.id]);
  if (doc.file_path) await deleteUpload(doc.file_path);
  await logActivity({ companyId: user.company.id, userId: user.id, action: "document.sters", details: { id, title: doc.title } });
  revalidatePath("/panou/documente");
  revalidatePath("/panou");
}
