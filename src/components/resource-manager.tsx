import Link from "next/link";
import { ActionForm } from "./action-form";
import { Card } from "./ui";
import { ResourceRow } from "./resource-row";
import { importResourcesAction, saveResourceAction } from "@/lib/resources/actions";
import { RES_TYPE_LABEL, RES_TYPE_PLURAL, RES_TYPES, type CatalogResource, type ResType } from "@/lib/estimate/types";

const inputCls = "w-full rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-brand-500";

export function TypeSelect({ name = "type", defaultValue }: { name?: string; defaultValue?: ResType }) {
  return (
    <select name={name} defaultValue={defaultValue ?? "material"} className={inputCls}>
      {RES_TYPES.map((t) => <option key={t} value={t}>{RES_TYPE_LABEL[t]}</option>)}
    </select>
  );
}

/** Listă + adăugare + import de resurse. Folosită în /panou/resurse (firma) și /admin/resurse (catalog global). */
export function ResourceManager({
  scope, resources, basePath, type, q,
}: {
  scope: "company" | "global"; resources: CatalogResource[]; basePath: string; type?: ResType; q?: string;
}) {
  const tabHref = (t?: ResType) => `${basePath}?${new URLSearchParams({ ...(t ? { tip: t } : {}), ...(q ? { q } : {}) })}`;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {[undefined, ...RES_TYPES].map((t) => (
            <Link key={t ?? "all"} href={tabHref(t)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${type === t ? "bg-brand-700 text-white" : "bg-white border border-line hover:border-brand-200"}`}>
              {t ? RES_TYPE_PLURAL[t] : "Toate"}
            </Link>
          ))}
          <form className="ml-auto flex gap-2" action={basePath}>
            {type && <input type="hidden" name="tip" value={type} />}
            <input name="q" defaultValue={q} placeholder="Caută denumire sau cod" className="w-56 rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
          </form>
        </div>
        <Card className="overflow-x-auto p-0">
          {resources.length === 0 ? (
            <p className="px-5 py-12 text-center text-muted">Nicio resursă găsită.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Tip</th>
                  <th className="px-4 py-3 font-medium">Cod</th>
                  <th className="px-4 py-3 font-medium">Denumire</th>
                  <th className="px-4 py-3 font-medium">U.M.</th>
                  <th className="px-4 py-3 text-right font-medium">Preț (lei)</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {resources.map((r) => (
                  <ResourceRow key={r.id} resource={r} scope={scope} editable={scope === "global" ? r.global : !r.global} />
                ))}
              </tbody>
            </table>
          )}
        </Card>
        {resources.length >= 500 && <p className="mt-2 text-sm text-muted">Se afișează primele 500. Folosește căutarea.</p>}
      </div>

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-bold">Resursă nouă</h2>
          <ActionForm action={saveResourceAction} submitLabel="Adaugă" resetOnSuccess>
            <input type="hidden" name="scope" value={scope} />
            <TypeSelect defaultValue={type} />
            <input name="name" required placeholder="Denumire" className={inputCls} />
            <div className="grid grid-cols-3 gap-2">
              <input name="code" placeholder="Cod" className={inputCls} />
              <input name="unit" required placeholder="U.M." className={inputCls} />
              <input name="price" required inputMode="decimal" placeholder="Preț" className={inputCls} />
            </div>
            <input name="notes" placeholder="Observații (opțional)" className={inputCls} />
          </ActionForm>
        </Card>
        <Card>
          <h2 className="font-bold">Import din Excel</h2>
          <p className="mt-1 mb-4 text-sm text-muted">Selectează în Excel coloanele <b>Cod, Denumire, U.M., Preț</b>, copiază și lipește aici.</p>
          <ActionForm action={importResourcesAction} submitLabel="Importă" resetOnSuccess>
            <input type="hidden" name="scope" value={scope} />
            <TypeSelect defaultValue={type} />
            <textarea name="text" required rows={6} placeholder={"MAT-100\tCiment\tkg\t0,75\nMAT-101\tNisip\tmc\t95"} className={`${inputCls} font-mono text-xs`} />
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
