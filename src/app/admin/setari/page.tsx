import { ActionForm } from "@/components/action-form";
import { Card, Field, PageHeader } from "@/components/ui";
import { query } from "@/lib/db";
import { mailConfigured, mailFrom, notifyAddress } from "@/lib/email";
import { getSettings, SETTING_LABELS, type Settings } from "@/lib/settings";
import { sendTestEmailAction, updateSettingsAction } from "../actions";

export const metadata = { title: "Setări · Admin" };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = {
  confirmare: "Confirmare cont", bun_venit: "Bun venit", resetare: "Resetare parolă", parola_schimbata: "Parolă schimbată",
  invitatie: "Invitație coleg", alerte: "Alerte termene", contact_confirmare: "Confirmare contact", admin_contact: "Contact → admin",
  admin_cont_nou: "Cont nou → admin", notificare: "Notificare", test: "Test", altul: "Altul",
};
const STATUS: Record<string, string> = { trimis: "bg-emerald-50 text-emerald-800", eroare: "bg-red-50 text-red-700", consola: "bg-canvas text-muted" };
const fmt = new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Bucharest" });

export default async function AdminSettingsPage() {
  const [settings, log] = await Promise.all([
    getSettings(),
    query<{ id: number; to_email: string; subject: string; kind: string; status: string; error: string | null; created_at: Date }>(
      "SELECT id, to_email, subject, kind, status, error, created_at FROM email_log ORDER BY id DESC LIMIT 25",
    ),
  ]);
  const ok = mailConfigured();
  return (
    <>
      <PageHeader title="Setări" subtitle="Valorile implicite ale platformei. Devizele existente își păstrează procentele." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <ActionForm action={updateSettingsAction} submitLabel="Salvează setările">
            {(Object.keys(SETTING_LABELS) as (keyof Settings)[]).map((k) => (
              <Field key={k} label={SETTING_LABELS[k]} name={k} defaultValue={String(settings[k])} />
            ))}
          </ActionForm>
        </Card>
        <Card>
          <h2 className="font-bold">E-mail</h2>
          <div className={`mt-3 rounded-lg px-3.5 py-2.5 text-sm ${ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
            {ok
              ? <>Configurat. Expeditor: <b>{mailFrom()}</b>. Notificările pentru admin merg la <b>{notifyAddress()}</b>.</>
              : <>Neconfigurat: e-mailurile nu pleacă (se scriu doar în jurnal), iar confirmarea contului nu e obligatorie. Adaugă în cPanel → Setup Node.js App: <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASSWORD</code>, apoi Restart.</>}
          </div>
          <p className="mt-3 text-sm text-muted">Cu e-mailul configurat, conturile noi trebuie să-și confirme adresa înainte să folosească platforma.</p>
          <div className="mt-4">
            <ActionForm action={sendTestEmailAction} submitLabel="Trimite e-mail de test" className="space-y-3">
              <Field label="Trimite către (gol = adresa ta)" name="to" type="email" required={false} />
            </ActionForm>
          </div>
        </Card>
      </div>
      <h2 className="mt-8 mb-3 text-lg font-bold">Ultimele e-mailuri</h2>
      <Card className="overflow-x-auto p-0">
        {log.length === 0 ? <p className="px-5 py-8 text-center text-muted">Niciun e-mail încă.</p> : (
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-ink/10 text-muted">
              <tr>{["Data", "Tip", "Către", "Subiect", "Status"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmt.format(new Date(l.created_at))}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">{KIND[l.kind] ?? l.kind}</td>
                  <td className="px-4 py-2.5">{l.to_email}</td>
                  <td className="max-w-72 px-4 py-2.5"><span className="line-clamp-1">{l.subject}</span></td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS[l.status]}`}>{l.status === "consola" ? "neconfigurat" : l.status}</span>
                    {l.error && <div className="mt-1 max-w-72 text-xs text-red-700">{l.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
