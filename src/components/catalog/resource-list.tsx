import Link from "next/link";
import { Card } from "../ui";
import { RES_STATUS_LABEL, RES_TYPE_LABEL, RES_TYPE_PLURAL, type CatalogResource, type ResStatus, type ResType } from "@/lib/estimate/types";

const money = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const money2 = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFmt = (d: string | null) => (d ? new Intl.DateTimeFormat("ro-RO").format(new Date(`${d}T12:00:00`)) : "—");

export function StatusBadge({ status }: { status: ResStatus | "expirat" }) {
  const cls = {
    verificat: "bg-emerald-50 text-emerald-800",
    neverificat: "bg-amber-50 text-amber-800",
    inactiv: "bg-canvas text-muted",
    expirat: "bg-red-50 text-red-700",
  }[status];
  return <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{status === "expirat" ? "Preț expirat" : RES_STATUS_LABEL[status]}</span>;
}

export type ListFilters = { type?: ResType; category?: string; status?: string; q?: string };

/** Lista catalogului (admin sau firmă): filtre, tabel, legături spre fișa resursei. */
export function ResourceList({
  resources, basePath, types, categories, filters, vatPct, scope, actions,
}: {
  resources: CatalogResource[]; basePath: string; types: ResType[]; categories: string[]; filters: ListFilters;
  vatPct: number; scope: "global" | "company"; actions?: React.ReactNode;
}) {
  const qs = (patch: Partial<ListFilters>) => {
    const f = { ...filters, ...patch };
    const p = new URLSearchParams();
    if (f.type) p.set("tip", f.type);
    if (f.category) p.set("categorie", f.category);
    if (f.status) p.set("status", f.status);
    if (f.q) p.set("q", f.q);
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const pill = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium ${active ? "bg-ink text-white" : "border border-line bg-white hover:border-ink/30"}`;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {types.length > 1 && [undefined, ...types].map((t) => (
          <Link key={t ?? "all"} href={qs({ type: t, category: undefined })} className={pill(filters.type === t)}>
            {t ? RES_TYPE_PLURAL[t] : "Toate"}
          </Link>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">{actions}</div>
      </div>
      <form className="mb-4 flex flex-wrap gap-2" action={basePath}>
        {filters.type && <input type="hidden" name="tip" value={filters.type} />}
        <input name="q" defaultValue={filters.q} placeholder="Caută denumire, cod, categorie, producător"
          className="min-w-56 flex-1 rounded-lg border-2 border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />
        <select name="categorie" defaultValue={filters.category ?? ""} className="rounded-lg border-2 border-ink/10 bg-white px-3 py-2 text-sm">
          <option value="">Toate categoriile</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="status" defaultValue={filters.status ?? ""} className="rounded-lg border-2 border-ink/10 bg-white px-3 py-2 text-sm">
          <option value="">Toate statusurile</option>
          <option value="verificat">Verificate</option>
          <option value="neverificat">Neverificate</option>
          <option value="fara_pret">Fără preț</option>
          <option value="expirat">Preț expirat</option>
          <option value="inactiv">Inactive</option>
        </select>
        <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/85">Filtrează</button>
      </form>

      <Card className="overflow-x-auto p-0">
        {resources.length === 0 ? (
          <p className="px-5 py-12 text-center text-muted">Nicio resursă găsită.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-ink/10 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Denumire</th>
                <th className="px-4 py-3 font-medium">U.M.</th>
                <th className="px-4 py-3 text-right font-medium">Preț fără TVA</th>
                <th className="px-4 py-3 text-right font-medium">Cu TVA {vatPct}%</th>
                <th className="px-4 py-3 font-medium">Prețul din</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {resources.map((r) => {
                const p = r.priceInfo;
                return (
                  <tr key={r.id} className={r.status === "inactiv" ? "opacity-60" : ""}>
                    <td className="px-4 py-2.5">
                      <Link href={`${basePath}/${r.id}`} className="font-medium hover:text-brand-700 hover:underline">{r.name}</Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span>{RES_TYPE_LABEL[r.type]}</span>
                        {r.code && <span>· {r.code}</span>}
                        {r.category && <span>· {r.category}</span>}
                        {scope === "company" && r.global && <span className="rounded bg-canvas px-1.5 font-semibold uppercase">catalog</span>}
                        {p?.kind === "propriu" && <span className="rounded bg-brand-50 px-1.5 font-semibold text-brand-800">prețul tău</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{r.unit}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{p ? money.format(p.value) : <span className="text-muted">fără preț</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted">{p ? money2.format(p.value * (1 + vatPct / 100)) : "—"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">
                      {p ? dateFmt(p.obtainedAt) : "—"}
                      {p?.supplier && <div className="max-w-40 truncate text-xs">{p.supplier}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={r.status} />
                        {p?.expired && <StatusBadge status="expirat" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      {resources.length >= 500 && <p className="mt-2 text-sm text-muted">Se afișează primele 500. Folosește căutarea sau filtrele.</p>}
    </div>
  );
}
