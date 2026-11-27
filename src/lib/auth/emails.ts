import "server-only";
import { execute } from "../db";
import { appUrl, emailLayout, notifyAdmin, sendMail } from "../email";
import { hashToken, newToken } from "./tokens";

export async function sendVerificationEmail(userId: number, email: string, name: string): Promise<void> {
  const token = newToken();
  // Un singur link valabil: cele vechi, nefolosite, se anulează.
  await execute("UPDATE email_tokens SET used_at = NOW() WHERE user_id = ? AND purpose = 'verify' AND used_at IS NULL", [userId]);
  await execute(
    "INSERT INTO email_tokens (user_id, token_hash, purpose, expires_at) VALUES (?, ?, 'verify', DATE_ADD(NOW(), INTERVAL 2 DAY))",
    [userId, hashToken(token)],
  );
  await sendMail(
    email,
    "Confirmă adresa de e-mail — DevizConstruct.ro",
    emailLayout(
      `Bun venit, ${escapeHtml(name)}!`,
      "<p>Mai ai un singur pas: confirmă adresa de e-mail ca să-ți activezi contul DevizConstruct.ro.</p><p style=\"color:#555\">Linkul este valabil 48 de ore.</p>",
      { label: "Confirmă adresa de e-mail", href: appUrl(`/confirmare-email?token=${token}`) },
      "Dacă nu ți-ai făcut tu cont pe DevizConstruct.ro, ignoră acest e-mail.",
    ),
    { kind: "confirmare" },
  );
}

export async function sendWelcomeEmail(email: string, name: string, trialDays: number | null): Promise<void> {
  const steps = [
    ["Completează datele firmei", "/panou/firma", "CUI-ul aduce automat datele din ANAF."],
    ["Adaugă prețurile tale", "/panou/resurse", "Materiale, manoperă, utilaje — din Excel sau de mână."],
    ["Fă primul deviz", "/panou/devize", "Importi lista de cantități (F3) și articolele se potrivesc automat."],
  ];
  await sendMail(
    email,
    "Contul tău DevizConstruct.ro este activ",
    emailLayout(
      `Contul tău este activ, ${escapeHtml(name)}`,
      `<p>Mulțumim că ai ales DevizConstruct.ro.${trialDays ? ` Ai <b>${trialDays} zile</b> de probă gratuită, cu toate funcțiile.` : ""}</p>
       <p style="margin:18px 0 6px;font-weight:600">Primii pași</p>
       <ol style="padding-left:20px;margin:0">${steps.map(([t, h, d]) => `<li style="margin:8px 0"><a href="${appUrl(h)}" style="color:#c71319;font-weight:600">${t}</a><br><span style="color:#555">${d}</span></li>`).join("")}</ol>
       <p style="margin-top:18px">Ai întrebări? Răspunde la acest e-mail sau scrie-ne din pagina de contact.</p>`,
      { label: "Intră în cont", href: appUrl("/panou") },
    ),
    { kind: "bun_venit" },
  );
}

export async function sendPasswordResetEmail(userId: number, email: string): Promise<void> {
  const token = newToken();
  await execute(
    "INSERT INTO email_tokens (user_id, token_hash, purpose, expires_at) VALUES (?, ?, 'reset', DATE_ADD(NOW(), INTERVAL 1 HOUR))",
    [userId, hashToken(token)],
  );
  await sendMail(
    email,
    "Resetare parolă — DevizConstruct.ro",
    emailLayout(
      "Resetare parolă",
      "<p>Am primit o cerere de resetare a parolei pentru contul tău. Linkul este valabil <b>o oră</b> și se poate folosi o singură dată.</p>",
      { label: "Setează o parolă nouă", href: appUrl(`/resetare-parola?token=${token}`) },
      "Dacă nu ai cerut tu resetarea, ignoră acest e-mail — parola rămâne neschimbată.",
    ),
    { kind: "resetare" },
  );
}

/** Confirmare de securitate după schimbarea parolei (din cont sau prin resetare). */
export async function sendPasswordChangedEmail(email: string): Promise<void> {
  const when = new Intl.DateTimeFormat("ro-RO", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Bucharest" }).format(new Date());
  await sendMail(
    email,
    "Parola a fost schimbată — DevizConstruct.ro",
    emailLayout(
      "Parola a fost schimbată",
      `<p>Parola contului tău DevizConstruct.ro a fost schimbată pe ${when}.</p><p>Dacă nu ai făcut tu această schimbare, resetează imediat parola și scrie-ne.</p>`,
      { label: "Resetează parola", href: appUrl("/parola-uitata") },
    ),
    { kind: "parola_schimbata" },
  ).catch((e) => console.error("[email] parola schimbata", e));
}

/** Notificare pentru administrator: cont nou pe platformă. */
export async function notifyNewAccount(name: string, email: string, company: string): Promise<void> {
  await notifyAdmin(
    `Cont nou: ${company}`,
    emailLayout(
      "Cont nou pe platformă",
      `<p><b>${escapeHtml(name)}</b> (${escapeHtml(email)}) a creat contul firmei <b>${escapeHtml(company)}</b>.</p>`,
      { label: "Vezi utilizatorii", href: appUrl("/admin/utilizatori") },
      "Notificare automată pentru administratorul DevizConstruct.ro.",
    ),
    { kind: "admin_cont_nou", replyTo: email },
  );
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
