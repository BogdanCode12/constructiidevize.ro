import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Card, PageHeader } from "@/components/ui";
import { applicable, getRecapTemplate, listRules, RULE_HELP, RULE_KEYS, RULE_LABEL, todayRo } from "@/lib/rules";
import { addRuleAction, deleteRuleAction, saveRecapTemplateAction, setRuleStatusAction, updateRuleTextAction } from "@/lib/rules-actions";
import { OVERHEAD_BASE_LABEL, PROFIT_BASE_LABEL, ROUNDING_LABEL, type OverheadBase, type ProfitBase, type RoundingMode } from "@/lib/estimate/types";

export const metadata = { title: "Reguli de calcul · Admin" };

const inputCls = "w-full rounded-lg border-2 border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500";
const dateFmt = (d: string | null) => (d ? new Intl.DateTimeFormat("ro-RO").format(new Date(`${d}T12:00:00`)) : "—");
const pct = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 4 });

export default async function RulesPage() {
  const [rules, tpl] = await Promise.all([listRules(), getRecapTemplate()]);
  const today = todayRo();
  return (
    <>
      <PageHeader
        title="Reguli de calcul"
        subtitle="TVA, CAM, cheltuieli indirecte și profit, cu baza legală și perioada de valabilitate. Un deviz nou copiază valorile aplicabile în ziua creării; devizele existente nu se modifică."
      />

      <div className="space-y-6">
        {RULE_KEYS.map((key) => {
          const list = rules.filter((r) => r.key === key);
          const cur = applicable(rules, key, today);
          return (
            <Card key={key}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <h2 className="font-bold">{RULE_LABEL[key]}</h2>
                  <p className="mt-1 text-sm text-muted">{RULE_HELP[key]}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted">Aplicabil azi</div>
                  <div className="text-2xl font-bold tabular-nums">{cur ? `${pct.format(cur.value)}%` : "—"}</div>
                  {cur && <div className={`text-xs font-semibold ${cur.status === "verificat" ? "text-emerald-700" : "text-amber-700"}`}>{cur.status === "verificat" ? "verificat" : "neverificat"}</div>}
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b-2 border-ink/10 text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">Valoare</th>
                      <th className="px-3 py-2 font-medium">Perioada</th>
                      <th className="px-3 py-2 font-medium">Bază legală / observații</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {list.map((r) => (
                      <tr key={r.id} className={cur?.id === r.id ? "bg-brand-50/40" : ""}>
                        <td className="px-3 py-2 font-semibold tabular-nums">{pct.format(r.value)}%</td>
                        <td className="px-3 py-2 whitespace-nowrap">{dateFmt(r.from)} – {r.to ? dateFmt(r.to) : "prezent"}</td>
                        <td className="min-w-72 px-3 py-2">
                          <details>
                            <summary className="cursor-pointer">
                              {r.legalBasis ?? (key === "tva" || key === "cam"
                                ? <span className="text-amber-800">bază legală necompletată</span>
                                : <span className="text-muted">fără bază legală (politica firmei / documentația de atribuire)</span>)}
                            </summary>
                            <ActionForm action={updateRuleTextAction} submitLabel="Salvează textul" className="mt-2 space-y-2">
                              <input type="hidden" name="id" value={r.id} />
                              <input name="legal_basis" defaultValue={r.legalBasis ?? ""} placeholder="Actul normativ, articolul" className={inputCls} />
                              <input name="notes" defaultValue={r.notes ?? ""} placeholder="Observații" className={inputCls} />
                            </ActionForm>
                          </details>
                          {r.notes && <div className="mt-0.5 text-xs text-muted">{r.notes}</div>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${r.status === "verificat" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                            {r.status === "verificat" ? "Verificat" : "Neverificat"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <form action={setRuleStatusAction} className="inline">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value={r.status === "verificat" ? "neverificat" : "verificat"} />
                            <button className="text-xs font-semibold text-brand-700 hover:underline" disabled={r.status !== "verificat" && (key === "tva" || key === "cam") && !r.legalBasis}>
                              {r.status === "verificat" ? "Marchează neverificat" : "Marchează verificat"}
                            </button>
                          </form>
                          {r.status === "neverificat" && (
                            <form action={deleteRuleAction} className="ml-3 inline">
                              <input type="hidden" name="id" value={r.id} />
                              <ConfirmSubmit message="Ștergi această valoare?" className="text-xs text-muted hover:text-red-700 hover:underline">Șterge</ConfirmSubmit>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <details className="mt-4 rounded-xl border-2 border-ink/10 p-4">
                <summary className="cursor-pointer text-sm font-semibold">+ Valoare nouă (de la o dată)</summary>
                <ActionForm action={addRuleAction} submitLabel="Adaugă valoarea" className="mt-3 space-y-3" resetOnSuccess>
                  <input type="hidden" name="rule_key" value={key} />
                  <div className="grid gap-3 sm:grid-cols-4">
                    <label className="block"><span className="mb-1 block text-xs font-medium">Valoare (%)</span><input name="value" required inputMode="decimal" className={inputCls} /></label>
                    <label className="block"><span className="mb-1 block text-xs font-medium">Se aplică de la</span><input type="date" name="effective_from" required defaultValue={today} className={inputCls} /></label>
                    <label className="block"><span className="mb-1 block text-xs font-medium">Până la (opțional)</span><input type="date" name="effective_to" className={inputCls} /></label>
                    <label className="block"><span className="mb-1 block text-xs font-medium">Status</span>
                      <select name="status" className={inputCls}><option value="neverificat">Neverificat</option><option value="verificat">Verificat</option></select>
                    </label>
                  </div>
                  <input name="legal_basis" placeholder={key === "tva" || key === "cam" ? "Baza legală (obligatorie pentru „verificat”)" : "Bază / justificare (opțional)"} className={inputCls} />
                  <input name="notes" placeholder="Observații" className={inputCls} />
                  <p className="text-xs text-muted">Valoarea curentă fără dată de sfârșit se închide automat cu o zi înainte de data aleasă.</p>
                </ActionForm>
              </details>
            </Card>
          );
        })}

        <Card>
          <h2 className="font-bold">Șablonul recapitulației</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Ordinea: materiale + manoperă + CAM (doar pe manopera la cost salarial) + utilaje + transport = cost direct → cheltuieli indirecte → profit →
            + echipamente tehnologice (fără indirecte și profit) → TVA. Se aplică devizelor noi; fiecare deviz își poate schimba bazele.
          </p>
          <ActionForm action={saveRecapTemplateAction} submitLabel="Salvează șablonul" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block"><span className="mb-1 block text-xs font-medium">Baza cheltuielilor indirecte</span>
                <select name="overhead_base" defaultValue={tpl.overheadBase} className={inputCls}>
                  {(Object.keys(OVERHEAD_BASE_LABEL) as OverheadBase[]).map((k) => <option key={k} value={k}>{OVERHEAD_BASE_LABEL[k]}</option>)}
                </select>
              </label>
              <label className="block"><span className="mb-1 block text-xs font-medium">Baza profitului</span>
                <select name="profit_base" defaultValue={tpl.profitBase} className={inputCls}>
                  {(Object.keys(PROFIT_BASE_LABEL) as ProfitBase[]).map((k) => <option key={k} value={k}>{PROFIT_BASE_LABEL[k]}</option>)}
                </select>
              </label>
              <label className="block"><span className="mb-1 block text-xs font-medium">Rotunjire</span>
                <select name="rounding" defaultValue={tpl.rounding} className={inputCls}>
                  {(Object.keys(ROUNDING_LABEL) as RoundingMode[]).map((k) => <option key={k} value={k}>{ROUNDING_LABEL[k]}</option>)}
                </select>
              </label>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
