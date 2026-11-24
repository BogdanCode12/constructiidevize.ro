"use server";

import { revalidatePath } from "next/cache";
import { execute, queryOne, transaction } from "../db";
import { requireAdmin, requireUser } from "../auth/session";
import { logActivity } from "../activity";
import { RES_TYPES, type ResType } from "../estimate/types";
import { parseTable, previewRows, type ImportRow, type ParsedTable, type PreviewRow } from "./import-core";
import { syncReferencePrice, today } from "./repo";

async function scopeOf(scope: unknown) {
  if (scope === "global") return { companyId: null as number | null, userId: (await requireAdmin()).id };
  const user = await requireUser();
  if (!user.company) throw new Error("Contul nu are o firmă.");
  return { companyId: user.company.id as number | null, userId: user.id };
}

const MAX_ROWS = 3000;
const isType = (t: unknown): t is ResType => RES_TYPES.includes(t as ResType);

export async function parseImportAction(data: FormData): Promise<ParsedTable | { error: string }> {
  await scopeOf(data.get("scope"));
  const file = data.get("file");
  const f = file instanceof File && file.size ? file : null;
  if (f && f.size > 8 * 1024 * 1024) return { error: "Fișierul depășește 8 MB." };
  if (f && !/\.(xlsx|csv|txt|tsv)$/i.test(f.name)) return { error: "Acceptăm fișiere .xlsx sau .csv. Din .xls, salvează întâi ca .xlsx." };
  try {
    const t = await parseTable(f, String(data.get("text") ?? ""));
    if (!t.rows.length) return { error: "Nu am găsit niciun rând în tabel." };
    if (t.rows.length > MAX_ROWS) return { error: `Maxim ${MAX_ROWS} de rânduri o dată. Împarte fișierul.` };
    return t;
  } catch (err) {
    console.error("[import]", err);
    return { error: "Fișierul nu a putut fi citit. Verifică formatul (.xlsx sau .csv)." };
  }
}

export async function previewImportAction(scope: string, type: string, rows: ImportRow[]): Promise<PreviewRow[] | { error: string }> {
  const { companyId } = await scopeOf(scope);
  if (!isType(type)) return { error: "Alege tipul resurselor." };
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) return { error: "Prea multe rânduri." };
  return previewRows(companyId, type, rows);
}

export type ApplyOptions = { obtainedAt: string; verified: boolean; supplier: string };

/**
 * Aplică importul pentru rândurile bifate. Resursele noi se creează; la cele existente prețul se adaugă în istoric
 * și devine preț de referință doar dacă prețul de referință actual NU e verificat (prețurile verificate nu se înlocuiesc automat).
 */
export async function applyImportAction(scope: string, type: string, rows: ImportRow[], opts: ApplyOptions): Promise<{ ok: string } | { error: string }> {
  const { companyId, userId } = await scopeOf(scope);
  if (!isType(type)) return { error: "Alege tipul resurselor." };
  if (!Array.isArray(rows) || !rows.length) return { error: "Niciun rând selectat." };
  if (rows.length > MAX_ROWS) return { error: "Prea multe rânduri." };
  const obtainedAt = /^\d{4}-\d{2}-\d{2}$/.test(opts.obtainedAt) && opts.obtainedAt <= today() ? opts.obtainedAt : today();
  const defSupplier = opts.supplier.trim().slice(0, 160) || null;
  const status = opts.verified ? "verificat" : "neverificat";

  const preview = await previewRows(companyId, type, rows);
  let created = 0, priced = 0, keptVerified = 0, skipped = 0;
  const touched = new Set<number>();

  await transaction(async (conn) => {
    for (const r of preview) {
      if (r.status === "invalid" || r.status === "dublura_fisier") { skipped++; continue; }
      let id: number;
      if (r.status === "existent" && r.existing) {
        id = r.existing.id;
        await execute(
          `UPDATE resources SET category = COALESCE(category, ?), producer = COALESCE(producer, ?), specs = COALESCE(specs, ?), code = COALESCE(code, ?)
            WHERE id = ? AND company_id <=> ?`,
          [r.category, r.producer, r.specs, r.code, id, companyId], conn,
        );
      } else {
        const ins = await execute(
          `INSERT INTO resources (company_id, type, category, code, name, unit, specs, producer, status, tariff_kind)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'neverificat', ?)`,
          [companyId, type, r.category, r.code, r.name, r.unit, r.specs, r.producer, type === "manopera" ? "comercial" : null], conn,
        );
        id = ins.insertId;
        created++;
      }
      if (r.price !== null) {
        const ins = await execute(
          `INSERT INTO resource_prices (resource_id, company_id, supplier, price, currency, exchange_rate, price_ron, source, obtained_at, valid_until, status, created_by)
           VALUES (?, ?, ?, ?, 'RON', 1, ?, 'import', ?, ?, ?, ?)`,
          [id, companyId, r.supplier ?? defSupplier, r.price, r.price, obtainedAt, r.validUntil, status, userId], conn,
        );
        priced++;
        const cur = await queryOne<{ verified: number | null }>(
          "SELECT (p.status = 'verificat') AS verified FROM resources r LEFT JOIN resource_prices p ON p.id = r.current_price_id WHERE r.id = ?",
          [id], conn,
        );
        if (cur?.verified === 1) keptVerified++;
        else await execute("UPDATE resources SET current_price_id = ? WHERE id = ?", [ins.insertId, id], conn);
        touched.add(id);
      }
    }
    for (const id of touched) await syncReferencePrice(id, conn);
  });

  await logActivity({ companyId, userId, action: "resurse.importate", details: { type, created, priced, keptVerified, skipped } });
  for (const p of ["/panou/resurse", "/admin/resurse", "/admin/manopera"]) revalidatePath(p);
  const parts = [`${created} resurse noi`, `${priced} prețuri adăugate în istoric`];
  if (keptVerified) parts.push(`${keptVerified} prețuri verificate păstrate ca referință (prețul nou a intrat doar în istoric)`);
  if (skipped) parts.push(`${skipped} rânduri sărite`);
  return { ok: `Import finalizat: ${parts.join(", ")}.` };
}
