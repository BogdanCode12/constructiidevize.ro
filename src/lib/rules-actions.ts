"use server";

import { revalidatePath } from "next/cache";
import { execute, queryOne, transaction } from "./db";
import { requireAdmin } from "./auth/session";
import { logActivity } from "./activity";
import { parseNum } from "./numbers";
import { RULE_KEYS, type RuleKey } from "./rules";
import type { FormState } from "@/components/action-form";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const dayBefore = (s: string) => new Date(Date.parse(`${s}T12:00:00Z`) - 86400_000).toISOString().slice(0, 10);

/**
 * Valoare nouă pentru o regulă, de la o dată. Perioada deschisă anterioară (fără dată de sfârșit) se închide
 * automat cu o zi înainte. Valorile vechi rămân în istoric; devizele existente nu se modifică.
 */
export async function addRuleAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const key = String(data.get("rule_key")) as RuleKey;
  if (!RULE_KEYS.includes(key)) return { error: "Regulă necunoscută." };
  const value = parseNum(data.get("value"));
  if (value === null || value < 0 || value > 100) return { error: "Valoarea trebuie să fie un procent între 0 și 100." };
  const from = String(data.get("effective_from") ?? "").trim();
  const to = String(data.get("effective_to") ?? "").trim() || null;
  if (!isDate(from)) return { error: "Completează data de la care se aplică." };
  if (to && (!isDate(to) || to < from)) return { error: "Data de sfârșit nu e validă." };
  const basis = String(data.get("legal_basis") ?? "").trim().slice(0, 300) || null;
  const status = data.get("status") === "verificat" ? "verificat" : "neverificat";
  if (status === "verificat" && (key === "tva" || key === "cam") && !basis) return { error: "Pentru TVA și CAM completează baza legală înainte de a marca valoarea ca verificată." };
  const notes = String(data.get("notes") ?? "").trim().slice(0, 500) || null;

  const clash = await queryOne<{ id: number }>(
    "SELECT id FROM calc_rules WHERE rule_key = ? AND effective_from = ?", [key, from],
  );
  if (clash) return { error: "Există deja o valoare care începe la aceeași dată. Modifică-o pe aceea sau alege altă dată." };

  await transaction(async (conn) => {
    await execute(
      "UPDATE calc_rules SET effective_to = ? WHERE rule_key = ? AND effective_to IS NULL AND effective_from < ?",
      [dayBefore(from), key, from], conn,
    );
    await execute(
      "INSERT INTO calc_rules (rule_key, value, legal_basis, effective_from, effective_to, status, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [key, value, basis, from, to, status, notes, admin.id], conn,
    );
  });
  await logActivity({ userId: admin.id, action: "admin.regula.adaugata", details: { key, value, from } });
  revalidatePath("/admin/reguli");
  return { ok: "Valoarea a fost adăugată. Se aplică devizelor create de la data respectivă." };
}

/** Marchează o valoare ca verificată sau o readuce la neverificat. */
export async function setRuleStatusAction(data: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(data.get("id"));
  const status = data.get("status") === "verificat" ? "verificat" : "neverificat";
  if (status === "verificat") {
    const r = await queryOne<{ rule_key: RuleKey; legal_basis: string | null }>("SELECT rule_key, legal_basis FROM calc_rules WHERE id = ?", [id]);
    if (!r || ((r.rule_key === "tva" || r.rule_key === "cam") && !r.legal_basis)) return;
  }
  await execute("UPDATE calc_rules SET status = ? WHERE id = ?", [status, id]);
  await logActivity({ userId: admin.id, action: "admin.regula.status", details: { id, status } });
  revalidatePath("/admin/reguli");
}

/** Corectează baza legală / observațiile unei valori (valoarea și perioada rămân, pentru istoric). */
export async function updateRuleTextAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = Number(data.get("id"));
  const basis = String(data.get("legal_basis") ?? "").trim().slice(0, 300) || null;
  const notes = String(data.get("notes") ?? "").trim().slice(0, 500) || null;
  await execute("UPDATE calc_rules SET legal_basis = ?, notes = ? WHERE id = ?", [basis, notes, id]);
  await logActivity({ userId: admin.id, action: "admin.regula.text", details: { id } });
  revalidatePath("/admin/reguli");
  return { ok: "Salvat." };
}

/** Șterge o valoare neverificată (introdusă greșit). Valorile verificate rămân în istoric. */
export async function deleteRuleAction(data: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(data.get("id"));
  await execute("DELETE FROM calc_rules WHERE id = ? AND status = 'neverificat'", [id]);
  await logActivity({ userId: admin.id, action: "admin.regula.stearsa", details: { id } });
  revalidatePath("/admin/reguli");
}

export async function saveRecapTemplateAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const vals: Record<string, string> = {
    recap_overhead_base: data.get("overhead_base") === "manopera" ? "manopera" : "direct",
    recap_profit_base: data.get("profit_base") === "direct" ? "direct" : "direct_indirecte",
    recap_rounding: data.get("rounding") === "pret_unitar" ? "pret_unitar" : "final",
  };
  for (const [k, v] of Object.entries(vals)) {
    await execute("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)", [k, v]);
  }
  await logActivity({ userId: admin.id, action: "admin.sablon_recap", details: vals });
  revalidatePath("/admin/reguli");
  return { ok: "Șablonul a fost salvat. Se aplică devizelor noi." };
}
