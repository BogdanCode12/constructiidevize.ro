import { Card, PageHeader } from "@/components/ui";
import { query } from "@/lib/db";
import { toggleContactHandledAction } from "../actions";

export const metadata = { title: "Mesaje · Admin" };

const dt = new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short" });

export default async function AdminMessagesPage() {
  const rows = await query<{ id: number; name: string; email: string; company: string | null; phone: string | null; message: string; handled: number; created_at: Date }>(
    "SELECT id, name, email, company, phone, message, handled, created_at FROM contact_messages ORDER BY handled, id DESC LIMIT 200",
  );
  return (
    <>
      <PageHeader title="Mesaje de pe site" subtitle="Trimise din formularul de contact. Primești și notificare pe e-mail." />
      {rows.length === 0 ? <Card className="py-10 text-center text-muted">Niciun mesaj încă.</Card> : (
        <div className="space-y-3">
          {rows.map((m) => (
            <Card key={m.id} className={m.handled ? "opacity-60" : ""}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold">{m.name} <a href={`mailto:${m.email}`} className="font-normal text-brand-700 hover:underline">{m.email}</a></div>
                <div className="text-sm text-muted">{[m.company, m.phone, dt.format(new Date(m.created_at))].filter(Boolean).join(" · ")}</div>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">{m.message}</p>
              <form action={toggleContactHandledAction} className="mt-3">
                <input type="hidden" name="id" value={m.id} />
                <button className="text-sm font-semibold text-brand-700 hover:underline">{m.handled ? "Marchează ca nerezolvat" : "✓ Marchează ca rezolvat"}</button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
