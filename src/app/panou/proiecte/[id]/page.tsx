import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, Field } from "@/components/ui";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { loadEstimate } from "@/lib/estimate/repo";
import { fmtMoney, recap } from "@/lib/estimate/calc";
import { DEADLINE_TYPES } from "@/lib/deadlines";
import { STATUS_LABEL } from "../status";
import { addDeadlineAction, deleteDeadlineAction, deleteProjectAction, toggleDeadlineAction, updateProjectAction } from "./actions";

export const metadata = { title: "Proiect" };

const dt = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" });
const input = "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 outline-none focus:border-brand-500";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const companyId = user.company?.id ?? 0;
  const id = Number((await params).id);
  const p = await queryOne<{
    id: number; name: string; client_name: string | null; authority: string | null; notice_number: string | null;
    location: string | null; status: keyof typeof STATUS_LABEL; notes: string | null;
  }>("SELECT id, name, client_name, authority, notice_number, location, status, notes FROM projects WHERE id = ? AND company_id = ?", [id, companyId]);
  if (!p) notFound();

  const deadlines = await query<{ id: number; type: keyof typeof DEADLINE_TYPES; title: string; due_at: Date; done: number }>(
    "SELECT id, type, title, due_at, done FROM project_deadlines WHERE project_id = ? ORDER BY done, due_at",
    [id],
  );
  const estIds = await query<{ id: number }>("SELECT id FROM estimates WHERE project_id = ? AND company_id = ? ORDER BY created_at", [id, companyId]);
  const estimates = (await Promise.all(estIds.map((e) => loadEstimate(e.id, companyId)))).filter(Boolean).map((d) => ({ d: d!, r: recap(d!) }));
  const total = estimates.reduce((s, e) => s + e.r.totalNoVat, 0);
  const now = Date.now();

  return (
    <>
      <Link href="/panou/proiecte" className="text-sm text-muted hover:text-ink">← Proiecte</Link>
      <div className="mt-1 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{p.name}</h1>
          <p className="text-muted">{STATUS_LABEL[p.status]}{p.authority ? ` · ${p.authority}` : ""}{p.notice_number ? ` · ${p.notice_number}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/panou/proiecte/${id}/export`} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand-200">F1 Excel</a>
          <Link href={`/panou/documente?tab=declaratii&proiect=${id}`} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand-200">Declarații</Link>
          <a href={`/panou/proiecte/${id}/dosar`} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">Dosar complet (ZIP)</a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <span className="font-semibold">Devize (obiecte)</span>
              <Link href={`/panou/devize?proiect=${id}`} className="text-sm font-semibold text-brand-700 hover:underline">+ Deviz nou</Link>
            </div>
            {estimates.length === 0 ? <p className="px-5 py-8 text-center text-muted">Niciun deviz încă.</p> : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {estimates.map(({ d, r }) => (
                    <tr key={d.id}>
                      <td className="px-5 py-3"><Link href={`/panou/devize/${d.id}`} className="font-medium text-brand-700 hover:underline">{d.name}</Link></td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtMoney(r.totalNoVat)} lei</td>
                    </tr>
                  ))}
                  <tr className="font-semibold"><td className="px-5 py-3">Total fără TVA</td><td className="px-5 py-3 text-right tabular-nums">{fmtMoney(total)} lei</td></tr>
                </tbody>
              </table>
            )}
          </Card>

          <Card className="p-0">
            <div className="border-b border-line px-5 py-3.5 font-semibold">Termene</div>
            {deadlines.length === 0 ? <p className="px-5 py-6 text-sm text-muted">Adaugă termenul de depunere, de clarificări, de deschidere — primești alertă pe email înainte.</p> : (
              <ul className="divide-y divide-line text-sm">
                {deadlines.map((d) => {
                  const due = new Date(d.due_at).getTime();
                  const late = !d.done && due < now;
                  const soon = !d.done && !late && due - now < 3 * 86400_000;
                  return (
                    <li key={d.id} className={`flex flex-wrap items-center gap-3 px-5 py-3 ${d.done ? "opacity-50" : ""}`}>
                      <form action={toggleDeadlineAction}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <button title={d.done ? "Marchează ca nefăcut" : "Marchează ca făcut"}
                          className={`grid size-5 place-items-center rounded border ${d.done ? "border-brand-700 bg-brand-700 text-white" : "border-line"}`}>{d.done ? "✓" : ""}</button>
                      </form>
                      <span className="w-28 shrink-0 font-medium">{DEADLINE_TYPES[d.type]}</span>
                      <span className="flex-1">{d.title}</span>
                      <span className={`whitespace-nowrap ${late ? "font-semibold text-red-700" : soon ? "font-semibold text-amber-700" : "text-muted"}`}>{dt.format(new Date(d.due_at))}</span>
                      <form action={deleteDeadlineAction}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <button className="text-muted hover:text-red-700" title="Șterge">✕</button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="border-t border-line p-5">
              <ActionForm action={addDeadlineAction} submitLabel="Adaugă termen" resetOnSuccess className="flex flex-wrap gap-2 [&>button]:basis-full [&>p]:basis-full">
                <input type="hidden" name="project_id" value={id} />
                <select name="type" className={`${input} !w-44`}>{Object.entries(DEADLINE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <input name="title" placeholder="Detalii (opțional)" className={`${input} min-w-40 !w-auto flex-1`} />
                <input name="date" type="date" required className={`${input} !w-40`} />
                <input name="time" type="time" defaultValue="12:00" className={`${input} !w-32`} />
              </ActionForm>
            </div>
          </Card>
        </div>

        <Card className="h-fit">
          <h2 className="mb-4 font-bold">Date proiect</h2>
          <ActionForm action={updateProjectAction} submitLabel="Salvează">
            <input type="hidden" name="id" value={id} />
            <Field label="Denumire" name="name" defaultValue={p.name} />
            <Field label="Autoritate contractantă" name="authority" required={false} defaultValue={p.authority ?? ""} />
            <Field label="Nr. anunț / procedură SEAP" name="notice_number" required={false} defaultValue={p.notice_number ?? ""} />
            <Field label="Beneficiar" name="client_name" required={false} defaultValue={p.client_name ?? ""} />
            <Field label="Locație" name="location" required={false} defaultValue={p.location ?? ""} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Status</span>
              <select name="status" defaultValue={p.status} className={input}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Note</span>
              <textarea name="notes" rows={4} defaultValue={p.notes ?? ""} className={input} />
            </label>
          </ActionForm>
          <form action={deleteProjectAction} className="mt-5 border-t border-line pt-4">
            <input type="hidden" name="id" value={id} />
            <ConfirmSubmit message="Ștergi proiectul cu toate devizele și termenele lui?">Șterge proiectul</ConfirmSubmit>
          </form>
        </Card>
      </div>
    </>
  );
}
