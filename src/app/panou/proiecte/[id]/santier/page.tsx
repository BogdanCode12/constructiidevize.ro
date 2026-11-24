import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, Field } from "@/components/ui";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { fmtMoney } from "@/lib/estimate/calc";
import { projectFinance, TX_CATEGORIES } from "@/lib/site/finance";
import { SITUATION_STATUS, type SituationStatus } from "@/lib/site/situations";
import { JournalForm } from "./journal-form";
import {
  addSubcontractAction, addTransactionAction, deleteJournalAction, deleteSubcontractAction, deleteTransactionAction,
  newSituationAction, setContractAction,
} from "./actions";

export const metadata = { title: "Șantier" };

const TABS = [["situatii", "Situații de lucrări"], ["financiar", "Financiar"], ["subcontractori", "Subcontractanți"], ["jurnal", "Jurnal de șantier"]] as const;
const d = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });
const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")}%`;
const input = "w-full rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-brand-500";
const SUB_STATUS = { ofertat: "Ofertat", contractat: "Contractat", in_lucru: "În lucru", finalizat: "Finalizat" } as const;

export default async function SitePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; eroare?: string }> }) {
  const user = await requireUser();
  const companyId = user.company?.id ?? 0;
  const projectId = Number((await params).id);
  const sp = await searchParams;
  const tab = TABS.some(([t]) => t === sp.tab) ? sp.tab! : "situatii";
  const p = await queryOne<{ name: string; contract_estimate_id: number | null; contract_value: string | null; contract_date: string | null }>(
    "SELECT name, contract_estimate_id, contract_value, DATE_FORMAT(contract_date, '%Y-%m-%d') AS contract_date FROM projects WHERE id = ? AND company_id = ?",
    [projectId, companyId],
  );
  if (!p) notFound();
  const fin = await projectFinance(companyId, projectId);

  const kpis = [
    ["Valoare contract", `${fmtMoney(fin.contract)} lei`, "fără TVA"],
    ["Executat (situații)", `${fmtMoney(fin.executed)} lei`, pct(fin.progress)],
    ["Încasat", `${fmtMoney(fin.income)} lei`, `de încasat ${fmtMoney(Math.max(0, fin.receivable))}`],
    ["Cheltuit", `${fmtMoney(fin.spent)} lei`, `profit pe executat ${fmtMoney(fin.profitExecuted)}`],
  ];

  return (
    <>
      <Link href={`/panou/proiecte/${projectId}`} className="text-sm text-muted hover:text-ink">← {p.name}</Link>
      <h1 className="mt-1 mb-5 text-2xl font-bold sm:text-3xl">Șantier</h1>
      {sp.eroare === "contract" && <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm">Alege mai întâi devizul de contract (mai jos), apoi creează situația.</p>}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(([l, v, s]) => (
          <Card key={l}><div className="text-sm text-muted">{l}</div><div className="mt-1 text-xl font-bold tabular-nums">{v}</div><div className="text-xs text-muted">{s}</div></Card>
        ))}
      </div>
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([id, label]) => (
          <Link key={id} href={`/panou/proiecte/${projectId}/santier?tab=${id}`}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap ${tab === id ? "border-brand-700 text-brand-800" : "border-transparent text-muted hover:text-ink"}`}>{label}</Link>
        ))}
      </nav>
      {tab === "situatii" && <Situations projectId={projectId} companyId={companyId} contract={p} />}
      {tab === "financiar" && <Finance projectId={projectId} companyId={companyId} fin={fin} />}
      {tab === "subcontractori" && <Subcontracts projectId={projectId} companyId={companyId} />}
      {tab === "jurnal" && <Journal projectId={projectId} companyId={companyId} />}
    </>
  );
}

async function Situations({ projectId, companyId, contract }: { projectId: number; companyId: number; contract: { contract_estimate_id: number | null; contract_value: string | null; contract_date: string | null } }) {
  const [estimates, situations] = await Promise.all([
    query<{ id: number; name: string }>("SELECT id, name FROM estimates WHERE project_id = ? AND company_id = ? ORDER BY created_at", [projectId, companyId]),
    query<{ id: number; number: number; status: SituationStatus; period_from: Date | null; period_to: Date | null; value: string | null }>(
      `SELECT s.id, s.number, s.status, s.period_from, s.period_to,
              (SELECT SUM(l.qty_current * l.unit_price) FROM work_situation_lines l WHERE l.situation_id = s.id) AS value
         FROM work_situations s WHERE s.project_id = ? AND s.company_id = ? ORDER BY s.number DESC`,
      [projectId, companyId],
    ),
  ]);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] [&>*]:min-w-0">
      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <span className="font-semibold">Situații de lucrări</span>
          <form action={newSituationAction}>
            <input type="hidden" name="project_id" value={projectId} />
            <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">+ Situație nouă</button>
          </form>
        </div>
        {situations.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">Nicio situație încă. Fiecare situație preia articolele din devizul de contract; completezi doar cantitățile executate în perioadă.</p> : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {situations.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3"><Link href={`/panou/proiecte/${projectId}/santier/situatii/${s.id}`} className="font-semibold text-brand-700 hover:underline">Situația nr. {s.number}</Link></td>
                  <td className="px-5 py-3 text-muted">{s.period_from ? d.format(new Date(s.period_from)) : "—"} → {s.period_to ? d.format(new Date(s.period_to)) : "—"}</td>
                  <td className="px-5 py-3"><span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium">{SITUATION_STATUS[s.status]}</span></td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtMoney(Number(s.value ?? 0))} lei</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card className="h-fit">
        <h2 className="mb-1 font-bold">Contract</h2>
        <p className="mb-4 text-sm text-muted">Devizul după care se fac situațiile. Valoarea, dacă e diferită de deviz, o poți scrie manual.</p>
        <ActionForm action={setContractAction} submitLabel="Salvează contractul">
          <input type="hidden" name="project_id" value={projectId} />
          <select name="estimate_id" defaultValue={contract.contract_estimate_id ?? ""} className={input}>
            <option value="">— alege devizul —</option>
            {estimates.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <Field label="Valoare contract fără TVA (opțional)" name="contract_value" required={false} defaultValue={contract.contract_value ?? ""} />
          <Field label="Data contractului" name="contract_date" type="date" required={false} defaultValue={contract.contract_date ?? ""} />
        </ActionForm>
      </Card>
    </div>
  );
}

async function Finance({ projectId, companyId, fin }: { projectId: number; companyId: number; fin: Awaited<ReturnType<typeof projectFinance>> }) {
  const [txs, subs] = await Promise.all([
    query<{ id: number; kind: "incasare" | "cheltuiala"; category: keyof typeof TX_CATEGORIES; amount: string; tx_date: Date; description: string | null; document_no: string | null; sub: string | null }>(
      `SELECT t.id, t.kind, t.category, t.amount, t.tx_date, t.description, t.document_no, s.name AS sub
         FROM project_transactions t LEFT JOIN subcontractors s ON s.id = t.subcontractor_id
        WHERE t.project_id = ? AND t.company_id = ? ORDER BY t.tx_date DESC, t.id DESC LIMIT 300`,
      [projectId, companyId],
    ),
    query<{ id: number; name: string }>("SELECT id, name FROM subcontractors WHERE company_id = ? ORDER BY name", [companyId]),
  ]);
  const plan = fin.planned;
  const compare: [string, number | undefined, number][] = plan
    ? [["Materiale", plan.material, fin.spentBy.materiale ?? 0], ["Manoperă", plan.manopera, fin.spentBy.manopera ?? 0], ["Utilaje", plan.utilaje, fin.spentBy.utilaje ?? 0], ["Transport", plan.transport, fin.spentBy.transport ?? 0]]
    : [];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] [&>*]:min-w-0">
      <div className="space-y-6">
        {plan && (
          <Card>
            <h2 className="mb-3 font-bold">Cheltuieli: deviz față de realizat</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-muted"><tr><th className="py-1.5 font-medium">Categorie</th><th className="py-1.5 text-right font-medium">În deviz</th><th className="py-1.5 text-right font-medium">Cheltuit</th><th className="py-1.5 text-right font-medium">Consumat</th></tr></thead>
              <tbody className="divide-y divide-line">
                {compare.map(([l, a, b]) => (
                  <tr key={l}>
                    <td className="py-1.5">{l}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtMoney(a ?? 0)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtMoney(b)}</td>
                    <td className={`py-1.5 text-right tabular-nums ${a && b > a ? "font-semibold text-red-700" : ""}`}>{a ? pct(b / a) : "—"}</td>
                  </tr>
                ))}
                <tr className="font-semibold"><td className="py-1.5">Subcontractare + alte</td><td /><td className="py-1.5 text-right tabular-nums">{fmtMoney((fin.spentBy.subcontractare ?? 0) + (fin.spentBy.alte ?? 0))}</td><td /></tr>
              </tbody>
            </table>
            <p className="mt-3 text-sm">Profit pe bani încasați: <b className={fin.profitCash < 0 ? "text-red-700" : "text-brand-700"}>{fmtMoney(fin.profitCash)} lei</b> · pe lucrări executate: <b className={fin.profitExecuted < 0 ? "text-red-700" : "text-brand-700"}>{fmtMoney(fin.profitExecuted)} lei</b></p>
          </Card>
        )}
        <Card className="p-0">
          <div className="border-b border-line px-5 py-3.5 font-semibold">Încasări și cheltuieli</div>
          {txs.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">Nicio înregistrare.</p> : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {txs.map((t) => (
                  <tr key={t.id}>
                    <td className="px-5 py-2.5 whitespace-nowrap text-muted">{d.format(new Date(t.tx_date))}</td>
                    <td className="px-2 py-2.5">{TX_CATEGORIES[t.category]}<div className="text-xs text-muted">{[t.description, t.sub, t.document_no && `doc. ${t.document_no}`].filter(Boolean).join(" · ")}</div></td>
                    <td className={`px-2 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums ${t.kind === "incasare" ? "text-brand-700" : "text-red-700"}`}>{t.kind === "incasare" ? "+" : "−"}{fmtMoney(Number(t.amount))}</td>
                    <td className="px-5 py-2.5 text-right">
                      <form action={deleteTransactionAction}>
                        <input type="hidden" name="project_id" value={projectId} />
                        <input type="hidden" name="id" value={t.id} />
                        <ConfirmSubmit message="Ștergi înregistrarea?" className="text-muted hover:text-red-700">✕</ConfirmSubmit>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      <Card className="h-fit">
        <h2 className="mb-4 font-bold">Adaugă</h2>
        <ActionForm action={addTransactionAction} submitLabel="Adaugă" resetOnSuccess>
          <input type="hidden" name="project_id" value={projectId} />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"><input type="radio" name="kind" value="cheltuiala" defaultChecked className="accent-brand-700" />Cheltuială</label>
            <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"><input type="radio" name="kind" value="incasare" className="accent-brand-700" />Încasare</label>
          </div>
          <select name="category" className={input}>{Object.entries(TX_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <div className="grid grid-cols-2 gap-2">
            <input name="amount" required inputMode="decimal" placeholder="Suma fără TVA" className={input} />
            <input name="tx_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={input} />
          </div>
          <input name="description" placeholder="Descriere (ex: factură beton)" className={input} />
          <div className="grid grid-cols-2 gap-2">
            <input name="document_no" placeholder="Nr. document" className={input} />
            <select name="subcontractor_id" className={input}><option value="">— partener —</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}

async function Subcontracts({ projectId, companyId }: { projectId: number; companyId: number }) {
  const [rows, subs] = await Promise.all([
    query<{ id: number; scope: string; value: string; status: keyof typeof SUB_STATUS; name: string; phone: string | null; paid: string | null }>(
      `SELECT ps.id, ps.scope, ps.value, ps.status, s.name, s.phone,
              (SELECT SUM(t.amount) FROM project_transactions t WHERE t.project_id = ps.project_id AND t.subcontractor_id = s.id AND t.kind = 'cheltuiala') AS paid
         FROM project_subcontracts ps JOIN subcontractors s ON s.id = ps.subcontractor_id WHERE ps.project_id = ? ORDER BY ps.created_at`,
      [projectId],
    ),
    query<{ id: number; name: string }>("SELECT id, name FROM subcontractors WHERE company_id = ? ORDER BY name", [companyId]),
  ]);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] [&>*]:min-w-0">
      <Card className="p-0">
        <div className="border-b border-line px-5 py-3.5 font-semibold">Lucrări subcontractate</div>
        {rows.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">Nicio lucrare subcontractată.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted"><tr><th className="px-5 py-2 font-medium">Firmă</th><th className="px-2 py-2 font-medium">Lucrări</th><th className="px-2 py-2 text-right font-medium">Valoare</th><th className="px-2 py-2 text-right font-medium">Plătit</th><th /></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-2.5 font-medium">{r.name}<div className="text-xs text-muted">{SUB_STATUS[r.status]}{r.phone ? ` · ${r.phone}` : ""}</div></td>
                  <td className="px-2 py-2.5">{r.scope}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{fmtMoney(Number(r.value))}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{fmtMoney(Number(r.paid ?? 0))}</td>
                  <td className="px-5 py-2.5 text-right">
                    <form action={deleteSubcontractAction}>
                      <input type="hidden" name="project_id" value={projectId} />
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmSubmit message="Ștergi subcontractul?" className="text-muted hover:text-red-700">✕</ConfirmSubmit>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card className="h-fit">
        <h2 className="mb-1 font-bold">Atribuie lucrări</h2>
        {subs.length === 0 ? (
          <p className="text-sm text-muted">Adaugă mai întâi subcontractanții în <Link href="/panou/santier?tab=subcontractori" className="font-semibold text-brand-700 underline">Șantier → Subcontractanți</Link>.</p>
        ) : (
          <ActionForm action={addSubcontractAction} submitLabel="Adaugă" resetOnSuccess>
            <input type="hidden" name="project_id" value={projectId} />
            <select name="subcontractor_id" className={input}>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <textarea name="scope" rows={2} required placeholder="Lucrările atribuite (ex: instalații electrice)" className={input} />
            <div className="grid grid-cols-2 gap-2">
              <input name="value" inputMode="decimal" placeholder="Valoare fără TVA" className={input} />
              <select name="status" defaultValue="contractat" className={input}>{Object.entries(SUB_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </div>
          </ActionForm>
        )}
        <p className="mt-3 text-xs text-muted">Plățile către subcontractanți se înregistrează în Financiar, cu partenerul selectat.</p>
      </Card>
    </div>
  );
}

async function Journal({ projectId, companyId }: { projectId: number; companyId: number }) {
  const entries = await query<{ id: number; entry_date: Date; weather: string | null; workers: number | null; hours: string | null; activities: string | null; issues: string | null; author: string | null }>(
    `SELECT j.id, j.entry_date, j.weather, j.workers, j.hours, j.activities, j.issues, u.name AS author
       FROM site_journal j LEFT JOIN users u ON u.id = j.created_by WHERE j.project_id = ? AND j.company_id = ? ORDER BY j.entry_date DESC, j.id DESC LIMIT 100`,
    [projectId, companyId],
  );
  const photos = entries.length
    ? await query<{ id: number; journal_id: number; file_name: string }>("SELECT id, journal_id, file_name FROM site_photos WHERE journal_id IN (?) ORDER BY id", [entries.map((e) => e.id)])
    : [];
  const totals = entries.reduce((s, e) => ({ days: s.days + 1, hours: s.hours + Number(e.hours ?? 0) }), { days: 0, hours: 0 });
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] [&>*]:min-w-0">
      <div className="space-y-4">
        {entries.length > 0 && <p className="text-sm text-muted">{totals.days} rapoarte · {fmtMoney(totals.hours).replace(",00", "")} ore lucrate înregistrate</p>}
        {entries.length === 0 && <Card className="py-10 text-center text-sm text-muted">Niciun raport încă. Echipa poate completa raportul zilnic de pe telefon.</Card>}
        {entries.map((e) => (
          <Card key={e.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-semibold">{d.format(new Date(e.entry_date))}</div>
              <div className="text-sm text-muted">{[e.weather, e.workers !== null && `${e.workers} muncitori`, e.hours && `${Number(e.hours)} ore`, e.author].filter(Boolean).join(" · ")}</div>
            </div>
            {e.activities && <p className="mt-2 whitespace-pre-wrap text-sm">{e.activities}</p>}
            {e.issues && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm whitespace-pre-wrap">⚠ {e.issues}</p>}
            {photos.some((p) => p.journal_id === e.id) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {photos.filter((p) => p.journal_id === e.id).map((p) => (
                  <a key={p.id} href={`/api/foto/${p.id}`} target="_blank" title={p.file_name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/foto/${p.id}`} alt={p.file_name} className="size-24 rounded-lg border border-line object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
            <form action={deleteJournalAction} className="mt-3 text-right">
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="id" value={e.id} />
              <ConfirmSubmit message="Ștergi raportul cu pozele lui?" className="text-xs text-muted hover:text-red-700">Șterge</ConfirmSubmit>
            </form>
          </Card>
        ))}
      </div>
      <Card className="h-fit">
        <h2 className="mb-4 font-bold">Raport zilnic</h2>
        <JournalForm projectId={projectId} />
      </Card>
    </div>
  );
}
