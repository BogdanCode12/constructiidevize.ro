import "server-only";
import { query, queryOne } from "../db";
import { getCompany } from "../company";
import { loadEstimate } from "../estimate/repo";
import { fmtMoney, fmtQty, itemUnitPrice, recap, schedule } from "../estimate/calc";
import { DOC_CATEGORIES, expiryStatus, type DocCategory } from "../documents";
import { DEADLINE_TYPES } from "../deadlines";
import { listTemplates } from "../templates";
import type { EstimateDoc } from "../estimate/types";

const MAX_ITEMS = 400;

/** Datele din platformă despre firmă și proiect, ca text pentru asistentul AI. */
export async function platformContext(companyId: number, projectId: number): Promise<string> {
  const [c, p] = await Promise.all([
    getCompany(companyId),
    queryOne<{ name: string; client_name: string | null; authority: string | null; notice_number: string | null; location: string | null; status: string; notes: string | null }>(
      "SELECT name, client_name, authority, notice_number, location, status, notes FROM projects WHERE id = ? AND company_id = ?",
      [projectId, companyId],
    ),
  ]);
  const lines: string[] = [];
  lines.push("## Firma ofertantă");
  lines.push(`Denumire: ${c?.name ?? "-"}; CUI: ${c?.cui ?? "-"}; Reg. Com.: ${c?.reg_com ?? "-"}; CAEN: ${c?.caen ?? "-"}; adresa: ${c?.address ?? "-"}; reprezentant: ${c?.legal_rep ?? "-"} (${c?.legal_rep_role ?? "-"})`);

  const docs = await query<{ category: DocCategory; title: string; issuer: string | null; doc_number: string | null; expires_at: Date | null; notes: string | null }>(
    "SELECT category, title, issuer, doc_number, expires_at, notes FROM company_documents WHERE company_id = ? ORDER BY category, title",
    [companyId],
  );
  lines.push("", "## Dosarul firmei (documente încărcate în platformă)");
  if (!docs.length) lines.push("(niciun document încărcat)");
  for (const d of docs) {
    const st = expiryStatus(d.expires_at);
    lines.push(`- [${DOC_CATEGORIES[d.category]}] ${d.title}${d.issuer ? `, emitent ${d.issuer}` : ""}${d.doc_number ? `, nr. ${d.doc_number}` : ""} — ${st.label}${d.notes ? ` (${d.notes})` : ""}`);
  }

  const tpls = await listTemplates();
  lines.push("", "## Declarații și formulare disponibile ca șabloane", ...tpls.map((t) => `- ${t.name}`));

  lines.push("", "## Proiectul");
  lines.push(`Denumire: ${p?.name ?? "-"}; autoritate contractantă: ${p?.authority ?? "-"}; nr. anunț: ${p?.notice_number ?? "-"}; beneficiar: ${p?.client_name ?? "-"}; locație: ${p?.location ?? "-"}; status: ${p?.status ?? "-"}`);
  if (p?.notes) lines.push(`Note: ${p.notes}`);

  const deadlines = await query<{ type: keyof typeof DEADLINE_TYPES; title: string; due_at: Date; done: number }>(
    "SELECT type, title, due_at, done FROM project_deadlines WHERE project_id = ? ORDER BY due_at",
    [projectId],
  );
  if (deadlines.length) {
    lines.push("", "## Termene");
    for (const d of deadlines) lines.push(`- ${DEADLINE_TYPES[d.type]}${d.title ? ` (${d.title})` : ""}: ${new Date(d.due_at).toLocaleString("ro-RO")}${d.done ? " — rezolvat" : ""}`);
  }

  const ids = await query<{ id: number }>("SELECT id FROM estimates WHERE project_id = ? AND company_id = ? ORDER BY created_at", [projectId, companyId]);
  const ests = (await Promise.all(ids.map((e) => loadEstimate(e.id, companyId)))).filter((d): d is EstimateDoc => !!d);
  lines.push("", "## Devizele proiectului");
  if (!ests.length) lines.push("(niciun deviz)");
  let count = 0;
  for (const e of ests) {
    const r = recap(e);
    const days = Math.max(0, ...schedule(e).map((s) => s.end));
    lines.push(`### ${e.name}`);
    lines.push(`Total fără TVA: ${fmtMoney(r.totalNoVat)} lei (direct C+M ${fmtMoney(r.directTotal)}, indirecte ${e.overheadPct}%, profit ${e.profitPct}%, echipamente ${fmtMoney(r.equipment)}); TVA ${e.vatPct}%; manoperă ${fmtQty(r.laborHours)} ore-om; durată estimată ${days} zile lucrătoare.`);
    e.chapters.forEach((ch, ci) => {
      lines.push(`Cap. ${ci + 1} ${ch.name}`);
      ch.items.forEach((it, ii) => {
        if (count++ >= MAX_ITEMS) return;
        lines.push(`  ${ci + 1}.${ii + 1} ${it.code ? `[${it.code}] ` : ""}${it.name} — ${fmtQty(it.quantity)} ${it.unit} × ${fmtMoney(itemUnitPrice(it))} lei`);
      });
    });
  }
  if (count > MAX_ITEMS) lines.push(`(…și încă ${count - MAX_ITEMS} articole neincluse)`);
  return lines.join("\n");
}
