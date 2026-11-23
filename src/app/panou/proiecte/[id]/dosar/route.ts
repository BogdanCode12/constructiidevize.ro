import JSZip from "jszip";
import { getCurrentUser } from "@/lib/auth/session";
import { query, queryOne } from "@/lib/db";
import { loadEstimate } from "@/lib/estimate/repo";
import { estimateWorkbook, projectWorkbook, safeFilename } from "@/lib/estimate/excel";
import { buildContext, docFilename, listTemplates, renderTemplate, toDocx } from "@/lib/templates";
import { DOC_CATEGORIES, expiryStatus, type DocCategory } from "@/lib/documents";
import { readUpload } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import type { EstimateDoc } from "@/lib/estimate/types";

export const dynamic = "force-dynamic";

/** Dosarul complet al ofertei: devize Excel, declarații Word și documentele valabile ale firmei, într-o arhivă ZIP. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.company) return new Response("Neautorizat", { status: 401 });
  const companyId = user.company.id;
  const id = Number((await params).id);
  const project = await queryOne<{ name: string }>("SELECT name FROM projects WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!project) return new Response("Proiectul nu există", { status: 404 });

  const zip = new JSZip();
  const toc: string[] = [`Dosar ofertă — ${project.name}`, `Ofertant: ${user.company.name}`, `Generat: ${new Date().toLocaleString("ro-RO")}`, ""];
  const info = { company: user.company.name, project: project.name };

  // 1. Devize
  const ids = await query<{ id: number }>("SELECT id FROM estimates WHERE project_id = ? AND company_id = ? ORDER BY created_at", [id, companyId]);
  const docs = (await Promise.all(ids.map((e) => loadEstimate(e.id, companyId)))).filter((d): d is EstimateDoc => !!d);
  toc.push("01_Devize");
  if (docs.length) {
    zip.file(`01_Devize/F1_${safeFilename(project.name)}.xlsx`, await projectWorkbook(docs, info));
    toc.push(`  F1 — centralizator obiectiv`);
    for (const [i, d] of docs.entries()) {
      zip.file(`01_Devize/${String(i + 1).padStart(2, "0")}_${safeFilename(d.name)}.xlsx`, await estimateWorkbook(d, info));
      toc.push(`  ${d.name} (F2, F3, analize, C5–C9, F4, F5)`);
    }
  } else toc.push("  (niciun deviz)");

  // 2. Declarații și formulare
  toc.push("", "02_Declaratii");
  const ctx = await buildContext(companyId, id, docs[0]?.id ?? null);
  for (const [i, t] of (await listTemplates()).entries()) {
    zip.file(`02_Declaratii/${String(i + 1).padStart(2, "0")}_${docFilename(t.name)}`, await toDocx(renderTemplate(t.body, ctx)));
    toc.push(`  ${t.name}`);
  }

  // 3. Dosarul firmei (doar documentele valabile)
  toc.push("", "03_Dosar_firma");
  const files = await query<{ id: number; category: DocCategory; title: string; file_path: string; file_name: string; expires_at: Date | null }>(
    "SELECT id, category, title, file_path, file_name, expires_at FROM company_documents WHERE company_id = ? AND file_path IS NOT NULL ORDER BY category, title",
    [companyId],
  );
  const skipped: string[] = [];
  for (const f of files) {
    const st = expiryStatus(f.expires_at);
    if (st.tone === "expired") {
      skipped.push(`  ${f.title} — ${st.label}`);
      continue;
    }
    try {
      const folder = safeFilename(DOC_CATEGORIES[f.category]);
      zip.file(`03_Dosar_firma/${folder}/${f.id}_${f.file_name.replace(/[\\/:*?"<>|]+/g, "_")}`, await readUpload(f.file_path));
      toc.push(`  [${DOC_CATEGORIES[f.category]}] ${f.title}${st.days !== null ? ` (${st.label})` : ""}`);
    } catch {
      skipped.push(`  ${f.title} — fișier lipsă pe server`);
    }
  }
  if (skipped.length) toc.push("", "NEINCLUSE (de reînnoit):", ...skipped);
  toc.push("", "Verificați toate documentele cu cerințele din documentația de atribuire înainte de depunere.");
  zip.file("00_Cuprins.txt", toc.join("\r\n"));

  const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  await logActivity({ companyId, userId: user.id, action: "dosar.exportat", details: { projectId: id } });
  return new Response(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Dosar_${safeFilename(project.name)}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
