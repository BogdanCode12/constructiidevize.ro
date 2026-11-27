import "server-only";
import { execute, query, queryOne } from "./db";
import { appUrl, emailLayout, sendMail } from "./email";
import { escapeHtml } from "./auth/emails";
import { DEADLINE_TYPES } from "./deadlines";

/**
 * Alerte pe e-mail: documente care expiră (30 / 7 / 1 zile, expirat) și termene de licitație (3 zile / 24 h).
 * Fiecare alertă se trimite o singură dată (alert_log). Rulează zilnic din aplicație (vezi startDailyAlerts).
 */
export async function runAlerts(): Promise<{ alerts: number; emails: number }> {
  const docs = await query<{ id: number; company_id: number; title: string; expires_at: Date; days: number }>(
    `SELECT id, company_id, title, expires_at, DATEDIFF(expires_at, CURDATE()) AS days
       FROM company_documents WHERE expires_at IS NOT NULL AND DATEDIFF(expires_at, CURDATE()) BETWEEN -1 AND 30`,
  );
  const deadlines = await query<{ id: number; company_id: number; type: keyof typeof DEADLINE_TYPES; title: string; due_at: Date; project: string; hours: number }>(
    `SELECT d.id, p.company_id, d.type, d.title, d.due_at, p.name AS project, TIMESTAMPDIFF(HOUR, NOW(), d.due_at) AS hours
       FROM project_deadlines d JOIN projects p ON p.id = d.project_id
      WHERE d.done = 0 AND d.due_at > NOW() AND d.due_at < DATE_ADD(NOW(), INTERVAL 3 DAY)`,
  );

  type Line = { company: number; key: string; html: string };
  const lines: Line[] = [];
  for (const d of docs) {
    // Praguri: 30 / 7 / 1 zile / expirat — fiecare se trimite o singură dată, chiar dacă cron-ul sare o zi.
    const days = Number(d.days);
    const bucket = days < 0 ? "expirat" : days <= 1 ? "1" : days <= 7 ? "7" : "30";
    const when = days < 0 ? "a expirat" : days === 0 ? "expiră azi" : `expiră în ${days} zile`;
    lines.push({ company: d.company_id, key: `doc:${d.id}:${bucket}`, html: `Documentul <b>${escapeHtml(d.title)}</b> ${when}.` });
  }
  for (const d of deadlines) {
    const bucket = Number(d.hours) <= 24 ? "1" : "3";
    const when = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bucharest" }).format(new Date(d.due_at));
    lines.push({
      company: d.company_id, key: `deadline:${d.id}:${bucket}`,
      html: `<b>${DEADLINE_TYPES[d.type]}</b> — ${escapeHtml(d.project)}${d.title ? ` (${escapeHtml(d.title)})` : ""}: ${when}.`,
    });
  }

  // Filtrează alertele deja trimise.
  const keys = lines.map((l) => l.key);
  const sent = keys.length ? new Set((await query<{ alert_key: string }>("SELECT alert_key FROM alert_log WHERE alert_key IN (?)", [keys])).map((r) => r.alert_key)) : new Set<string>();
  const fresh = lines.filter((l) => !sent.has(l.key));

  let emails = 0;
  for (const companyId of new Set(fresh.map((l) => l.company))) {
    const items = fresh.filter((l) => l.company === companyId);
    const recipients = await query<{ email: string }>(
      "SELECT u.email FROM company_members cm JOIN users u ON u.id = cm.user_id WHERE cm.company_id = ? AND cm.role IN ('owner','admin')",
      [companyId],
    );
    const html = emailLayout("Ai termene și documente de urmărit", `<ul>${items.map((i) => `<li style="margin:6px 0">${i.html}</li>`).join("")}</ul>`, {
      label: "Deschide platforma", href: appUrl("/panou"),
    });
    for (const r of recipients) {
      await sendMail(r.email, "Alerte: termene și documente — DevizConstruct.ro", html, { kind: "alerte" }).catch((e) => console.error("[alerte]", e));
      emails++;
    }
    await execute("INSERT IGNORE INTO alert_log (alert_key) VALUES ?", [items.map((i) => [i.key])]);
  }
  return { alerts: fresh.length, emails };
}

const todayRo = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date());
const hourRo = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", hour: "2-digit", hour12: false }).format(new Date()));

/** O dată pe zi, după ora 8 (ora României). Blocarea în MySQL împiedică dublarea când rulează mai multe procese. */
async function dailyTick() {
  if (hourRo() < 8) return;
  const day = todayRo();
  const last = await queryOne<{ value: string }>("SELECT `value` FROM settings WHERE `key` = 'alerts_last_day'");
  if (last?.value === day) return;
  const lock = await queryOne<{ ok: number }>("SELECT GET_LOCK('devizconstruct_alerts', 0) AS ok");
  if (lock?.ok !== 1) return;
  try {
    const again = await queryOne<{ value: string }>("SELECT `value` FROM settings WHERE `key` = 'alerts_last_day'");
    if (again?.value === day) return;
    await execute("INSERT INTO settings (`key`, `value`) VALUES ('alerts_last_day', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)", [day]);
    const r = await runAlerts();
    console.log(`[alerte] ${day}: ${r.alerts} alerte, ${r.emails} e-mailuri`);
  } finally {
    await queryOne("SELECT RELEASE_LOCK('devizconstruct_alerts')");
  }
}

let started = false;
/** Pornit la startul serverului (instrumentation.ts): verifică la fiecare 30 de minute dacă alertele zilei au plecat. */
export function startDailyAlerts() {
  if (started) return;
  started = true;
  const tick = () => dailyTick().catch((e) => console.error("[alerte]", e));
  setTimeout(tick, 60_000);
  setInterval(tick, 30 * 60_000).unref();
}
