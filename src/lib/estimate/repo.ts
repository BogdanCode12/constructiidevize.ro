import "server-only";
import { randomUUID } from "node:crypto";
import { execute, query, queryOne, transaction } from "../db";
import { RES_TYPES, type EstimateDoc, type EstResource, type ResType } from "./types";

const k = () => randomUUID();

export async function loadEstimate(id: number, companyId: number): Promise<EstimateDoc | null> {
  const est = await queryOne<{
    id: number; name: string; project_id: number; project_name: string;
    overhead_pct: string; profit_pct: string; vat_pct: string; start_date: Date | string | null; hours_per_day: string;
  }>(
    `SELECT e.id, e.name, e.project_id, p.name AS project_name, e.overhead_pct, e.profit_pct, e.vat_pct,
            DATE_FORMAT(e.start_date, '%Y-%m-%d') AS start_date, e.hours_per_day
       FROM estimates e JOIN projects p ON p.id = e.project_id
      WHERE e.id = ? AND e.company_id = ?`,
    [id, companyId],
  );
  if (!est) return null;

  const chapters = await query<{ id: number; name: string; team_size: number; start_day: number | null }>(
    "SELECT id, name, team_size, start_day FROM estimate_chapters WHERE estimate_id = ? ORDER BY position, id",
    [id],
  );
  const items = await query<{ id: number; chapter_id: number; code: string | null; name: string; unit: string; quantity: string; review_note: string | null }>(
    `SELECT i.id, i.chapter_id, i.code, i.name, i.unit, i.quantity, i.review_note
       FROM estimate_items i JOIN estimate_chapters c ON c.id = i.chapter_id
      WHERE c.estimate_id = ? ORDER BY i.position, i.id`,
    [id],
  );
  const res = await query<{
    item_id: number; resource_id: number | null; type: ResType; code: string | null;
    name: string; unit: string; norm: string; waste_pct: string; price: string;
  }>(
    `SELECT r.item_id, r.resource_id, r.type, r.code, r.name, r.unit, r.norm, r.waste_pct, r.price
       FROM estimate_item_resources r
       JOIN estimate_items i ON i.id = r.item_id
       JOIN estimate_chapters c ON c.id = i.chapter_id
      WHERE c.estimate_id = ? ORDER BY r.position, r.id`,
    [id],
  );

  const resByItem = new Map<number, EstResource[]>();
  for (const r of res) {
    const list = resByItem.get(r.item_id) ?? [];
    list.push({
      key: k(), resourceId: r.resource_id, type: r.type, code: r.code ?? "", name: r.name,
      unit: r.unit, norm: Number(r.norm), waste: Number(r.waste_pct), price: Number(r.price),
    });
    resByItem.set(r.item_id, list);
  }

  return {
    id: est.id,
    name: est.name,
    projectId: est.project_id,
    projectName: est.project_name,
    overheadPct: Number(est.overhead_pct),
    profitPct: Number(est.profit_pct),
    vatPct: Number(est.vat_pct),
    startDate: est.start_date ? String(est.start_date) : null,
    hoursPerDay: Number(est.hours_per_day),
    chapters: chapters.map((c) => ({
      key: k(),
      name: c.name,
      teamSize: c.team_size,
      startDay: c.start_day,
      items: items
        .filter((i) => i.chapter_id === c.id)
        .map((i) => ({
          key: k(), code: i.code ?? "", name: i.name, unit: i.unit,
          quantity: Number(i.quantity), reviewNote: i.review_note, resources: resByItem.get(i.id) ?? [],
        })),
    })),
  };
}

const num = (v: unknown, min = -1e12, max = 1e12) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
};
const txt = (v: unknown, len: number) => String(v ?? "").trim().slice(0, len);

/** Salvează devizul complet (înlocuiește capitolele/articolele) într-o tranzacție. */
export async function saveEstimate(doc: EstimateDoc, companyId: number): Promise<void> {
  let itemCount = 0;
  for (const ch of doc.chapters) itemCount += ch.items.length;
  if (doc.chapters.length > 500 || itemCount > 5000) throw new Error("Deviz prea mare.");

  await transaction(async (conn) => {
    const owned = await queryOne<{ id: number }>(
      "SELECT id FROM estimates WHERE id = ? AND company_id = ? FOR UPDATE",
      [doc.id, companyId],
      conn,
    );
    if (!owned) throw new Error("Devizul nu există.");

    await execute(
      "UPDATE estimates SET name = ?, overhead_pct = ?, profit_pct = ?, vat_pct = ?, start_date = ?, hours_per_day = ? WHERE id = ?",
      [
        txt(doc.name, 190) || "Deviz", num(doc.overheadPct, 0, 1000), num(doc.profitPct, 0, 1000), num(doc.vatPct, 0, 100),
        doc.startDate && /^\d{4}-\d{2}-\d{2}$/.test(doc.startDate) ? doc.startDate : null, num(doc.hoursPerDay, 1, 24) || 8, doc.id,
      ],
      conn,
    );
    await execute("DELETE FROM estimate_chapters WHERE estimate_id = ?", [doc.id], conn);

    for (const [ci, ch] of doc.chapters.entries()) {
      const c = await execute(
        "INSERT INTO estimate_chapters (estimate_id, position, name, team_size, start_day) VALUES (?, ?, ?, ?, ?)",
        [
          doc.id, ci, txt(ch.name, 255) || `Capitol ${ci + 1}`, Math.round(num(ch.teamSize, 1, 1000)) || 1,
          ch.startDay === null || ch.startDay === undefined ? null : Math.round(num(ch.startDay, 0, 10000)),
        ],
        conn,
      );
      for (const [ii, it] of ch.items.entries()) {
        const i = await execute(
          "INSERT INTO estimate_items (chapter_id, position, code, name, unit, quantity, review_note) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [c.insertId, ii, txt(it.code, 40) || null, txt(it.name, 500) || "Articol", txt(it.unit, 20) || "buc", num(it.quantity, 0), txt(it.reviewNote, 255) || null],
          conn,
        );
        const rows = it.resources
          .filter((r) => RES_TYPES.includes(r.type))
          .slice(0, 200)
          .map((r, ri) => [
            i.insertId, ri, r.resourceId && Number.isInteger(r.resourceId) ? r.resourceId : null, r.type,
            txt(r.code, 40) || null, txt(r.name, 255) || "Resursă", txt(r.unit, 20) || "buc",
            num(r.norm, 0), Math.min(100, Math.max(0, num(r.waste, 0))), num(r.price, 0),
          ]);
        if (rows.length) {
          await execute(
            "INSERT INTO estimate_item_resources (item_id, position, resource_id, type, code, name, unit, norm, waste_pct, price) VALUES ?",
            [rows],
            conn,
          );
        }
      }
    }
  });
}
