"use server";

import { execute } from "@/lib/db";
import { clientIp } from "@/lib/auth/session";
import { appUrl, emailLayout, notifyAdmin, sendMail } from "@/lib/email";
import { escapeHtml } from "@/lib/auth/emails";
import { recordAttempt, TOO_MANY, tooMany } from "@/lib/ratelimit";
import type { FormState } from "@/components/action-form";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function contactAction(_: FormState, data: FormData): Promise<FormState> {
  const v = (k: string, len: number) => String(data.get(k) ?? "").trim().slice(0, len);
  if (v("website", 10)) return { ok: "Mulțumim! Revenim în curând." }; // capcană pentru roboți
  const name = v("name", 120), email = v("email", 190).toLowerCase(), message = v("message", 5000);
  if (name.length < 2) return { error: "Completează numele." };
  if (!EMAIL_RE.test(email)) return { error: "Adresa de e-mail nu este validă." };
  if (message.length < 10) return { error: "Scrie-ne câteva detalii în mesaj." };
  const ip = (await clientIp()) ?? "necunoscut";
  if (await tooMany(`contact:ip:${ip}`, 5, 60)) return { error: TOO_MANY };
  await recordAttempt(`contact:ip:${ip}`);

  await execute("INSERT INTO contact_messages (name, email, company, phone, message, ip) VALUES (?, ?, ?, ?, ?, ?)",
    [name, email, v("company", 190) || null, v("phone", 40) || null, message, ip]);
  // Notificare către administrator (răspunsul merge direct la cel care a scris) + confirmare pentru expeditor.
  const html = emailLayout("Mesaj nou de pe site",
    `<p><b>${escapeHtml(name)}</b> (${escapeHtml(email)})${v("company", 190) ? `, ${escapeHtml(v("company", 190))}` : ""}${v("phone", 40) ? `, tel. ${escapeHtml(v("phone", 40))}` : ""}</p><p style="white-space:pre-line;background:#f6f6f4;border-radius:8px;padding:12px 14px">${escapeHtml(message)}</p><p style="color:#555">Răspunde direct la acest e-mail.</p>`,
    { label: "Vezi mesajele", href: appUrl("/admin/mesaje") }, "Notificare automată pentru administratorul DevizConstruct.ro.");
  await notifyAdmin(`Contact: ${name}`, html, { kind: "admin_contact", replyTo: email });
  await sendMail(email, "Am primit mesajul tău — DevizConstruct.ro",
    emailLayout(`Mulțumim, ${escapeHtml(name)}!`,
      `<p>Am primit mesajul tău și îți răspundem în cel mult o zi lucrătoare.</p><p style="white-space:pre-line;background:#f6f6f4;border-radius:8px;padding:12px 14px;color:#444">${escapeHtml(message.slice(0, 1500))}</p>`,
      undefined, "Ai primit acest e-mail pentru că ne-ai scris din pagina de contact DevizConstruct.ro."),
    { kind: "contact_confirmare" }).catch((e) => console.error("[contact] confirmare", e));
  return { ok: "Mulțumim! Am primit mesajul și revenim în cel mult o zi lucrătoare." };
}
