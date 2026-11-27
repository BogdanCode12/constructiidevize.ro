"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { execute, query, transaction } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { parseNum } from "@/lib/numbers";
import { PAID_PLAN_IDS, type PaidPlanId } from "@/lib/plans";
import { saveSetting, SETTING_DEFAULTS, type Settings } from "@/lib/settings";
import type { FormState } from "@/components/action-form";
import { AI_MODELS, isAiModel } from "@/lib/ai/models";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const s = (d: FormData, k: string) => String(d.get(k) ?? "").trim();
const dateOrNull = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v} 23:59:59` : null);

export async function updateUserAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = Number(data.get("id"));
  const name = s(data, "name").slice(0, 120);
  const email = s(data, "email").toLowerCase();
  const role = s(data, "role") === "admin" ? "admin" : "user";
  const verified = data.get("verified") === "on";
  if (!name) return { error: "Numele este obligatoriu." };
  if (!EMAIL_RE.test(email)) return { error: "Email invalid." };
  if (id === admin.id && role !== "admin") return { error: "Nu îți poți scoate singur drepturile de admin." };
  try {
    await execute(
      `UPDATE users SET name = ?, email = ?, role = ?,
         email_verified_at = CASE WHEN ? THEN COALESCE(email_verified_at, NOW()) ELSE NULL END
       WHERE id = ?`,
      [name, email, role, verified, id],
    );
  } catch (err) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") return { error: "Emailul e folosit de alt cont." };
    throw err;
  }
  await logActivity({ userId: admin.id, action: "admin.utilizator.modificat", details: { id } });
  revalidatePath("/admin", "layout");
  return { ok: "Utilizator salvat." };
}

export async function updateSubscriptionAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const companyId = Number(data.get("company_id"));
  const plan = s(data, "plan");
  const status = s(data, "status");
  if (!["trial", ...PAID_PLAN_IDS].includes(plan)) return { error: "Plan invalid." };
  if (!["trialing", "active", "past_due", "canceled", "expired"].includes(status)) return { error: "Status invalid." };
  const interval = ["month", "year"].includes(s(data, "interval")) ? s(data, "interval") : null;
  await execute(
    `INSERT INTO subscriptions (company_id, plan, status, billing_interval, trial_ends_at, current_period_end)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE plan = VALUES(plan), status = VALUES(status), billing_interval = VALUES(billing_interval),
       trial_ends_at = VALUES(trial_ends_at), current_period_end = VALUES(current_period_end)`,
    [companyId, plan, status, interval, dateOrNull(s(data, "trial_ends_at")), dateOrNull(s(data, "current_period_end"))],
  );
  await logActivity({ companyId, userId: admin.id, action: "admin.abonament.modificat", details: { plan, status } });
  revalidatePath("/admin", "layout");
  return { ok: "Abonament salvat." };
}

export async function updateCompanyAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = Number(data.get("company_id"));
  const name = s(data, "company_name").slice(0, 190);
  if (!name) return { error: "Numele firmei este obligatoriu." };
  await execute("UPDATE companies SET name = ?, cui = ?, reg_com = ?, address = ?, county = ?, phone = ? WHERE id = ?", [
    name, s(data, "cui").slice(0, 20) || null, s(data, "reg_com").slice(0, 40) || null, s(data, "address").slice(0, 255) || null,
    s(data, "county").slice(0, 60) || null, s(data, "phone").slice(0, 40) || null, id,
  ]);
  await logActivity({ companyId: id, userId: admin.id, action: "admin.firma.modificata" });
  revalidatePath("/admin", "layout");
  return { ok: "Firmă salvată." };
}

export async function logoutUserEverywhereAction(data: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(data.get("id"));
  await execute("DELETE FROM sessions WHERE user_id = ?", [id]);
  redirect(`/admin/utilizatori/${id}?deconectat=1`);
}

/** Șterge contul și firmele în care era singurul membru (cu proiectele și devizele lor). */
export async function deleteUserAction(data: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(data.get("id"));
  if (id === admin.id) redirect(`/admin/utilizatori/${id}`);
  await transaction(async (conn) => {
    const solo = await query<{ company_id: number }>(
      `SELECT cm.company_id FROM company_members cm
        WHERE cm.user_id = ? AND (SELECT COUNT(*) FROM company_members x WHERE x.company_id = cm.company_id) = 1`,
      [id],
      conn,
    );
    if (solo.length) await execute("DELETE FROM companies WHERE id IN (?)", [solo.map((r) => r.company_id)], conn);
    await execute("DELETE FROM users WHERE id = ?", [id], conn);
  });
  await logActivity({ userId: admin.id, action: "admin.utilizator.sters", details: { id } });
  revalidatePath("/admin", "layout");
  redirect("/admin/utilizatori");
}

export async function updatePlanAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = s(data, "id") as PaidPlanId;
  if (!PAID_PLAN_IDS.includes(id)) return { error: "Plan invalid." };
  const name = s(data, "name").slice(0, 60);
  const monthly = parseNum(data.get("monthly"));
  const yearly = parseNum(data.get("yearly"));
  const maxUsers = Math.round(parseNum(data.get("max_users")) ?? 0);
  const features = s(data, "features").split(/\r?\n/).map((f) => f.trim()).filter(Boolean).join("\n");
  if (!name) return { error: "Numele este obligatoriu." };
  if (monthly === null || yearly === null || monthly < 0 || yearly < 0) return { error: "Prețuri invalide." };
  if (maxUsers < 1) return { error: "Numărul de utilizatori trebuie să fie cel puțin 1." };
  await execute(
    "UPDATE plans SET name = ?, monthly_price = ?, yearly_price = ?, max_users = ?, features = ?, highlighted = ? WHERE id = ?",
    [name, monthly, yearly, maxUsers, features, data.get("highlighted") === "on" ? 1 : 0, id],
  );
  await logActivity({ userId: admin.id, action: "admin.plan.modificat", details: { id, monthly, yearly } });
  revalidatePath("/", "layout");
  return { ok: `Planul „${name}” a fost salvat.` };
}

export async function updateSettingsAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const limits: Record<keyof Settings, [number, number]> = {
    trial_days: [0, 365],
    ai_monthly_requests: [0, 100000], ai_price_input_per_mtok: [0, 1000], ai_price_output_per_mtok: [0, 1000],
  };
  const values: Partial<Settings> = {};
  for (const key of Object.keys(SETTING_DEFAULTS) as (keyof Settings)[]) {
    const n = parseNum(data.get(key));
    const [min, max] = limits[key];
    if (n === null || n < min || n > max) return { error: `Valoare invalidă la „${key}” (între ${min} și ${max}).` };
    values[key] = key === "trial_days" || key === "ai_monthly_requests" ? Math.round(n) : n;
  }
  for (const [k, v] of Object.entries(values)) await saveSetting(k as keyof Settings, v as number);
  await logActivity({ userId: admin.id, action: "admin.setari.modificate", details: values });
  revalidatePath("/", "layout");
  return { ok: "Setări salvate." };
}

export async function saveTemplateAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = Number(data.get("id") || 0);
  const name = s(data, "name").slice(0, 190);
  const category = s(data, "category").slice(0, 60) || "Declarații";
  const body = String(data.get("body") ?? "").replace(/\r/g, "").trim();
  const position = Math.round(parseNum(data.get("position")) ?? 0);
  const active = data.get("active") === "on" ? 1 : 0;
  if (!name) return { error: "Numele este obligatoriu." };
  if (!body) return { error: "Textul șablonului este gol." };
  if (id) {
    await execute("UPDATE document_templates SET name = ?, category = ?, body = ?, position = ?, active = ? WHERE id = ?", [name, category, body, position, active, id]);
  } else {
    const res = await execute("INSERT INTO document_templates (name, category, body, position, active) VALUES (?, ?, ?, ?, ?)", [name, category, body, position, active]);
    await logActivity({ userId: admin.id, action: "admin.sablon.creat", details: { id: res.insertId, name } });
    redirect(`/admin/sabloane/${res.insertId}?salvat=1`);
  }
  await logActivity({ userId: admin.id, action: "admin.sablon.modificat", details: { id, name } });
  revalidatePath("/admin/sabloane");
  return { ok: "Șablon salvat." };
}

export async function deleteTemplateAction(data: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = Number(data.get("id"));
  await execute("DELETE FROM document_templates WHERE id = ?", [id]);
  await logActivity({ userId: admin.id, action: "admin.sablon.sters", details: { id } });
  revalidatePath("/admin/sabloane");
  redirect("/admin/sabloane");
}

export async function updateAiTaskAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const slug = s(data, "slug");
  const name = s(data, "name").slice(0, 120);
  const description = s(data, "description").slice(0, 255);
  const prompt = String(data.get("prompt") ?? "").replace(/\r/g, "").trim();
  const effort = s(data, "effort");
  if (!name || !prompt) return { error: "Numele și instrucțiunile sunt obligatorii." };
  if (!["low", "medium", "high", "xhigh", "max"].includes(effort)) return { error: "Nivel de efort invalid." };
  await execute(
    "UPDATE ai_tasks SET name = ?, description = ?, prompt = ?, effort = ?, needs_files = ?, send_originals = ?, active = ?, position = ? WHERE slug = ?",
    [name, description, prompt, effort, data.get("needs_files") === "on" ? 1 : 0, data.get("send_originals") === "on" ? 1 : 0, data.get("active") === "on" ? 1 : 0, Math.round(parseNum(data.get("position")) ?? 0), slug],
  );
  await logActivity({ userId: admin.id, action: "admin.ai.modificat", details: { slug } });
  revalidatePath("/admin/ai");
  return { ok: `„${name}” salvat.` };
}

export async function savePageAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const slug = s(data, "slug");
  const title = s(data, "title").slice(0, 190);
  const body = String(data.get("body") ?? "").replace(/\r/g, "").trim();
  if (!title || !body) return { error: "Titlul și textul sunt obligatorii." };
  const res = await execute("UPDATE pages SET title = ?, body = ? WHERE slug = ?", [title, body, slug]);
  if (!res.affectedRows) return { error: "Pagina nu există." };
  await logActivity({ userId: admin.id, action: "admin.pagina.modificata", details: { slug } });
  revalidatePath(`/${slug}`);
  return { ok: "Pagina a fost salvată." };
}

export async function toggleContactHandledAction(data: FormData): Promise<void> {
  await requireAdmin();
  await execute("UPDATE contact_messages SET handled = 1 - handled WHERE id = ?", [Number(data.get("id"))]);
  revalidatePath("/admin/mesaje");
}

/** Modelul asistentului (setarea `ai_model`); se aplică de la următoarea cerere, fără repornire. */
export async function setAiModelAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const model = s(data, "model");
  if (!isAiModel(model)) return { error: "Model necunoscut." };
  await execute(
    "INSERT INTO settings (`key`, `value`) VALUES ('ai_model', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
    [model],
  );
  await logActivity({ userId: admin.id, action: "admin.ai.model", details: { model } });
  revalidatePath("/admin/ai");
  return { ok: `Model schimbat: ${AI_MODELS.find((m) => m.id === model)?.label}. Se aplică de la următoarea cerere.` };
}
