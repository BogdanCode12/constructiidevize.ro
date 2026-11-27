import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { execute } from "./db";

export function appUrl(path = ""): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return base + path;
}

/** E-mailul e configurat când există SMTP_HOST (cPanel → Setup Node.js App → variabile). */
export const mailConfigured = () => !!process.env.SMTP_HOST;

const smtpUser = () => process.env.SMTP_USER ?? "";
/** Expeditorul: MAIL_FROM sau „DevizConstruct.ro <SMTP_USER>”. */
export const mailFrom = () => process.env.MAIL_FROM || (smtpUser() ? `"DevizConstruct.ro" <${smtpUser()}>` : "");
/** Unde ajung notificările pentru administrator (cont nou, mesaje de contact): ADMIN_EMAIL sau SMTP_USER. */
export const notifyAddress = () => process.env.ADMIN_EMAIL || smtpUser() || null;

let transport: Transporter | null = null;
function getTransport(): Transporter {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: smtpUser(), pass: process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS },
      pool: true,
      maxConnections: 2,
    });
  }
  return transport;
}

const toText = (html: string) =>
  html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|h\d|div|tr)>/gi, "\n").replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, "\n\n").trim();

async function log(to: string, subject: string, kind: string, status: "trimis" | "eroare" | "consola", error?: string) {
  await execute("INSERT INTO email_log (to_email, subject, kind, status, error) VALUES (?, ?, ?, ?, ?)",
    [to.slice(0, 190), subject.slice(0, 255), kind.slice(0, 40), status, error?.slice(0, 500) ?? null]).catch(() => {});
}

/**
 * Trimite un e-mail prin SMTP-ul din cPanel și îl trece în jurnal. Fără SMTP_HOST (dezvoltare) e afișat în consolă.
 * Aruncă eroare dacă trimiterea eșuează (apelantul decide dacă o ignoră).
 */
export async function sendMail(to: string, subject: string, html: string, opts: { kind?: string; replyTo?: string } = {}): Promise<void> {
  const kind = opts.kind ?? "altul";
  if (!mailConfigured()) {
    console.info(`[email] către ${to} — ${subject}\n${toText(html)}`);
    await log(to, subject, kind, "consola");
    return;
  }
  try {
    await getTransport().sendMail({ from: mailFrom(), to, subject, html, text: toText(html), replyTo: opts.replyTo });
    await log(to, subject, kind, "trimis");
  } catch (err) {
    await log(to, subject, kind, "eroare", err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/** Notificare către administratorul platformei (nu blochează fluxul dacă eșuează). */
export async function notifyAdmin(subject: string, html: string, opts: { kind?: string; replyTo?: string } = {}): Promise<void> {
  const to = notifyAddress();
  if (!to) return;
  await sendMail(to, subject, html, { kind: opts.kind ?? "notificare", replyTo: opts.replyTo }).catch((e) => console.error("[email] notificare", e));
}

/** Șablonul comun: siglă, titlu, text, buton opțional, subsol. Stiluri inline (clienții de e-mail ignoră CSS-ul). */
export function emailLayout(title: string, body: string, cta?: { label: string; href: string }, footnote?: string): string {
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td style="background:#c71319;border-radius:8px">
         <a href="${cta.href}" style="display:inline-block;padding:13px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px">${cta.label}</a>
       </td></tr></table>
       <p style="font-size:12px;color:#777;margin:0 0 8px">Dacă butonul nu funcționează, copiază linkul în browser:<br><span style="color:#444;word-break:break-all">${cta.href}</span></p>`
    : "";
  return `<!doctype html><html lang="ro"><body style="margin:0;padding:0;background:#f4f4f2">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e6e6e3">
        <tr><td style="padding:26px 32px 0">
          <a href="${appUrl("/")}"><img src="${appUrl("/brand/devizconstruct-logo.png")}" alt="DevizConstruct.ro" width="190" style="display:block;border:0;height:auto"></a>
        </td></tr>
        <tr><td style="padding:22px 32px 30px;font-family:Inter,Helvetica,Arial,sans-serif;color:#0c0c0d;font-size:15px;line-height:1.6">
          <h1 style="font-size:21px;line-height:1.3;margin:0 0 14px;color:#0c0c0d">${title}</h1>
          ${body}${button}
        </td></tr>
      </table>
      <p style="max-width:560px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#888;line-height:1.5;margin:16px auto 0">
        ${footnote ?? "Ai primit acest e-mail pentru că ai un cont pe DevizConstruct.ro."}<br>
        <a href="${appUrl("/")}" style="color:#888">devizconstruct.ro</a> · <a href="${appUrl("/contact")}" style="color:#888">Contact</a>
      </p>
    </td></tr>
  </table></body></html>`;
}
