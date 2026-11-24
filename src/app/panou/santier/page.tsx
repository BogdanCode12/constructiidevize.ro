import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, PageHeader } from "@/components/ui";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { fmtMoney } from "@/lib/estimate/calc";
import { projectFinance } from "@/lib/site/finance";
import { deleteSubcontractorAction, saveSubcontractorAction } from "./actions";

export const metadata = { title: "Șantier" };

const input = "w-full rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-brand-500";
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

export default async function SiteModulePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const companyId = user.company?.id ?? 0;
  const tab = (await searchParams).tab === "subcontractori" ? "subcontractori" : "lucrari";
  return (
    <>
      <PageHeader title="Șantier" subtitle="Lucrările în execuție: situații de lucrări, încasări și cheltuieli, subcontractanți, jurnal zilnic cu poze." />
      <nav className="mb-6 flex gap-1 border-b border-line">
        {[["lucrari", "Lucrări în execuție"], ["subcontractori", "Subcontractanți"]].map(([id, label]) => (
          <Link key={id} href={`/panou/santier?tab=${id}`}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium ${tab === id ? "border-brand-700 text-brand-800" : "border-transparent text-muted hover:text-ink"}`}>{label}</Link>
        ))}
      </nav>
      {tab === "lucrari" ? <Works companyId={companyId} /> : <Subcontractors companyId={companyId} />}
    </>
  );
}

async function Works({ companyId }: { companyId: number }) {
  const projects = await query<{ id: number; name: string; status: string }>(
    "SELECT id, name, status FROM projects WHERE company_id = ? AND (status = 'in_executie' OR contract_estimate_id IS NOT NULL) ORDER BY updated_at DESC",
    [companyId],
  );
  const rows = await Promise.all(projects.map(async (p) => ({ p, f: await projectFinance(companyId, p.id) })));
  const sum = rows.reduce((s, { f }) => ({ contract: s.contract + f.contract, executed: s.executed + f.executed, income: s.income + f.income, spent: s.spent + f.spent }), { contract: 0, executed: 0, income: 0, spent: 0 });
  return rows.length === 0 ? (
    <Card className="py-12 text-center text-muted">
      Nicio lucrare în execuție. Când câștigi o licitație, deschide proiectul → <b>Șantier</b> și alege devizul de contract.
    </Card>
  ) : (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-muted">
          <tr>{["Lucrare", "Contract", "Executat", "Progres", "Încasat", "De încasat", "Cheltuit", "Profit pe executat"].map((h) => <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(({ p, f }) => (
            <tr key={p.id} className="hover:bg-canvas">
              <td className="px-4 py-3 font-medium"><Link href={`/panou/proiecte/${p.id}/santier`} className="text-brand-700 hover:underline">{p.name}</Link></td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(f.contract)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(f.executed)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2"><div className="h-2 w-20 rounded bg-canvas"><div className="h-2 rounded bg-brand-600" style={{ width: pct(Math.min(1, f.progress)) }} /></div><span className="tabular-nums">{pct(f.progress)}</span></div>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(f.income)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(Math.max(0, f.receivable))}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(f.spent)}</td>
              <td className={`px-4 py-3 text-right font-semibold tabular-nums ${f.profitExecuted < 0 ? "text-red-700" : "text-brand-700"}`}>{fmtMoney(f.profitExecuted)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="px-4 py-3">Total</td>
            <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(sum.contract)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(sum.executed)}</td>
            <td className="px-4 py-3">{sum.contract ? pct(sum.executed / sum.contract) : "—"}</td>
            <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(sum.income)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(Math.max(0, sum.executed - sum.income))}</td>
            <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(sum.spent)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(sum.executed - sum.spent)}</td>
          </tr>
        </tbody>
      </table>
    </Card>
  );
}

async function Subcontractors({ companyId }: { companyId: number }) {
  const subs = await query<{ id: number; name: string; cui: string | null; specialty: string | null; contact: string | null; phone: string | null; email: string | null; projects: number; value: string | null }>(
    `SELECT s.id, s.name, s.cui, s.specialty, s.contact, s.phone, s.email,
            (SELECT COUNT(*) FROM project_subcontracts ps WHERE ps.subcontractor_id = s.id) AS projects,
            (SELECT SUM(ps.value) FROM project_subcontracts ps WHERE ps.subcontractor_id = s.id) AS value
       FROM subcontractors s WHERE s.company_id = ? ORDER BY s.name`,
    [companyId],
  );
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] [&>*]:min-w-0">
      <Card className="overflow-x-auto p-0">
        {subs.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted">Niciun subcontractant încă.</p> : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-muted"><tr>{["Firmă", "Specialitate", "Contact", "Lucrări", "Valoare", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {subs.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5 font-medium">{s.name}{s.cui && <div className="text-xs text-muted">CUI {s.cui}</div>}</td>
                  <td className="px-4 py-2.5">{s.specialty ?? "—"}</td>
                  <td className="px-4 py-2.5">{[s.contact, s.phone, s.email].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums">{Number(s.projects)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(Number(s.value ?? 0))}</td>
                  <td className="px-4 py-2.5 text-right">
                    <form action={deleteSubcontractorAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmSubmit message={`Ștergi ${s.name}? Se șterg și atribuirile lui din proiecte.`}>Șterge</ConfirmSubmit>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card className="h-fit">
        <h2 className="mb-4 font-bold">Subcontractant nou</h2>
        <ActionForm action={saveSubcontractorAction} submitLabel="Adaugă" resetOnSuccess>
          <input name="name" required placeholder="Denumire firmă" className={input} />
          <div className="grid grid-cols-2 gap-2">
            <input name="cui" placeholder="CUI" className={input} />
            <input name="specialty" placeholder="Specialitate" className={input} />
            <input name="contact" placeholder="Persoană de contact" className={input} />
            <input name="phone" placeholder="Telefon" className={input} />
          </div>
          <input name="email" type="email" placeholder="Email" className={input} />
          <input name="notes" placeholder="Observații" className={input} />
        </ActionForm>
      </Card>
    </div>
  );
}
