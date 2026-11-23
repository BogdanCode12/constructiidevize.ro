import "server-only";
import nodemailer from "nodemailer";

export function appUrl(path = ""): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return base + path;
}

/** Trimite email prin SMTP-ul din cPanel. Fără SMTP_HOST, emailul e afișat în consolă (dev). */
export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.SMTP_HOST) {
    console.info(`[email] către ${to} — ${subject}\n${html.replace(/<[^>]+>/g, " ")}`);
    return;
  }
  const port = Number(process.env.SMTP_PORT ?? 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

export function emailLayout(title: string, body: string, cta?: { label: string; href: string }): string {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.href}" style="background:#0f5c63;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${cta.label}</a></p>
       <p style="font-size:13px;color:#666">Dacă butonul nu merge, copiază linkul: <br>${cta.href}</p>`
    : "";
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:auto;color:#1c2526">
    <h2 style="color:#0f5c63">${title}</h2>${body}${button}
    <p style="font-size:12px;color:#888;margin-top:36px">ConstructiiDevize.ro</p></div>`;
}
