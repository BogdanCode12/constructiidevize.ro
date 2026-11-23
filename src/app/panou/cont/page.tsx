import { ActionForm } from "@/components/action-form";
import { Card, Field, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { changePasswordAction, deleteAccountAction, updateProfileAction } from "./actions";

export const metadata = { title: "Contul meu" };

const dt = new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short" });

export default async function AccountPage() {
  const user = await requireUser();
  const sessions = await query<{ created_at: Date; ip: string | null; user_agent: string | null }>(
    "SELECT created_at, ip, user_agent FROM sessions WHERE user_id = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 10",
    [user.id],
  );
  return (
    <>
      <PageHeader title="Contul meu" subtitle={user.email} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-bold">Profil</h2>
          <ActionForm action={updateProfileAction} submitLabel="Salvează">
            <Field label="Nume și prenume" name="name" defaultValue={user.name} />
          </ActionForm>
        </Card>
        <Card>
          <h2 className="mb-4 font-bold">Schimbă parola</h2>
          <ActionForm action={changePasswordAction} submitLabel="Schimbă parola" resetOnSuccess>
            <Field label="Parola actuală" name="current" type="password" autoComplete="current-password" />
            <Field label="Parola nouă" name="next" type="password" autoComplete="new-password" hint="Minim 8 caractere." />
          </ActionForm>
        </Card>
        <Card>
          <h2 className="mb-1 font-bold">Datele mele</h2>
          <p className="mb-4 text-sm text-muted">Descarcă tot ce ai în platformă (cont, firme, proiecte, devize, documente, activitate), într-un fișier JSON.</p>
          <a href="/api/cont/export" className="inline-block rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand-200">Descarcă datele mele</a>
          <h3 className="mt-6 mb-2 font-semibold">Sesiuni active</h3>
          <ul className="space-y-1 text-sm text-muted">
            {sessions.map((s, i) => <li key={i}>{dt.format(new Date(s.created_at))} · {s.ip ?? "IP necunoscut"} · {(s.user_agent ?? "").slice(0, 60)}</li>)}
          </ul>
        </Card>
        <Card className="border-red-200">
          <h2 className="mb-1 font-bold text-red-700">Șterge contul</h2>
          <p className="mb-4 text-sm text-muted">
            Firmele în care ești singurul utilizator se șterg definitiv, cu proiectele, devizele și fișierele lor. În firmele cu alți colegi, rolul de proprietar trece la un coleg.
          </p>
          <ActionForm action={deleteAccountAction} submitLabel="Șterge definitiv contul">
            <Field label="Parola" name="password" type="password" autoComplete="current-password" />
            <Field label="Scrie STERGE pentru confirmare" name="confirm" />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
