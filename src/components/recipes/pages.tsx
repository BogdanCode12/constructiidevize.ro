import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "../ui";
import { ConfirmSubmit } from "../confirm-submit";
import { getRecipe, listRecipeCategories, listRecipes } from "@/lib/recipes/list";
import { deleteRecipeAction, duplicateRecipeAction, promoteRecipeAction } from "@/lib/recipes/actions";
import type { RecipeStatus } from "@/lib/recipes/repo";
import { RecipeEditor } from "./recipe-editor";
import { RecipeStatusActions } from "./status-actions";

export type RecipeCtx = {
  scope: "global" | "company";
  companyId: number | null;
  /** Calea fișelor: /admin/retete sau /panou/resurse/retete. */
  base: string;
  /** Unde e lista (pentru „înapoi”). */
  listHref: string;
  admin: boolean;
};

const STATUS: Record<RecipeStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-amber-50 text-amber-800" },
  verificat: { label: "Verificat", cls: "bg-emerald-50 text-emerald-800" },
  depasit: { label: "Depășit", cls: "bg-canvas text-muted" },
};
export const RecipeBadge = ({ status }: { status: RecipeStatus }) => (
  <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS[status].cls}`}>{STATUS[status].label}</span>
);

const dateFmt = (d: Date | null) => (d ? new Intl.DateTimeFormat("ro-RO").format(new Date(d)) : "—");
const btnPrimary = "rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800";

type SP = { q?: string; categorie?: string; status?: string; proprietar?: string; istoric?: string };

export async function RecipeList({ ctx, sp, listPath }: { ctx: RecipeCtx; sp: SP; listPath: string }) {
  const status = ["draft", "verificat", "depasit"].includes(sp.status ?? "") ? (sp.status as RecipeStatus) : undefined;
  const owner = sp.proprietar === "global" || sp.proprietar === "firme" ? sp.proprietar : undefined;
  const [rows, categories] = await Promise.all([
    listRecipes({
      ...(ctx.admin ? { allCompanies: true, owner } : { companyId: ctx.companyId, includeGlobal: true }),
      q: sp.q?.trim() || undefined, category: sp.categorie || undefined, status, withHistory: sp.istoric === "1",
    }),
    listRecipeCategories(ctx.companyId),
  ]);
  const sel = "rounded-lg border-2 border-ink/10 bg-white px-3 py-2 text-sm";
  return (
    <>
      <form className="mb-4 flex flex-wrap gap-2" action={listPath}>
        {!ctx.admin && <input type="hidden" name="tab" value="retete" />}
        <input name="q" defaultValue={sp.q} placeholder="Caută denumire, cod, sursă" className="min-w-56 flex-1 rounded-lg border-2 border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />
        <select name="categorie" defaultValue={sp.categorie ?? ""} className={sel}>
          <option value="">Toate categoriile</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={sel}>
          <option value="">Toate statusurile</option>
          <option value="draft">Draft</option><option value="verificat">Verificate</option><option value="depasit">Depășite</option>
        </select>
        {ctx.admin && (
          <select name="proprietar" defaultValue={sp.proprietar ?? ""} className={sel}>
            <option value="">Globale + firme</option><option value="global">Doar globale</option><option value="firme">Doar ale firmelor</option>
          </select>
        )}
        <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">Filtrează</button>
        <Link href={`${ctx.base}/nou`} className={`${btnPrimary} ml-auto`}>+ Articol nou</Link>
      </form>
      <Card className="overflow-x-auto p-0">
        {rows.length === 0 ? <p className="px-5 py-10 text-center text-muted">Niciun articol găsit.</p> : (
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-ink/10 text-muted">
              <tr>{["Articol", "U.M.", "Resurse", "Sursa normei", "Folosiri", "Status"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className={r.status === "depasit" ? "opacity-60" : ""}>
                  <td className="px-4 py-2.5">
                    <Link href={`${ctx.base}/${r.id}`} className="font-medium hover:text-brand-700 hover:underline">{r.name}</Link>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                      {r.code && <span>{r.code}</span>}
                      {r.category && <span>{r.category}</span>}
                      <span>v{r.version}</span>
                      {r.company_id === null
                        ? <span className="rounded bg-brand-50 px-1.5 font-semibold text-brand-800">{ctx.admin ? "GLOBAL" : "catalog"}</span>
                        : ctx.admin && <span>{r.company}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{r.unit}</td>
                  <td className="px-4 py-2.5 tabular-nums">{Number(r.resources) || <span className="text-muted">—</span>}</td>
                  <td className="max-w-52 px-4 py-2.5 text-muted"><span className="line-clamp-2">{r.norm_source ?? "—"}{r.norm_version ? ` (${r.norm_version})` : ""}</span></td>
                  <td className="px-4 py-2.5 tabular-nums">{r.uses}</td>
                  <td className="px-4 py-2.5"><RecipeBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="mt-2 text-xs text-muted">
        Doar articolele cu resurse, nedepășite, sunt propuse automat în devize; cele în draft apar cu mențiunea „de verificat”.
        {" "}<Link href={`${listPath}?${new URLSearchParams({ ...(ctx.admin ? {} : { tab: "retete" }), istoric: "1" })}`} className="text-brand-700 hover:underline">Arată și versiunile vechi</Link>
      </p>
    </>
  );
}

export function RecipeNew({ ctx }: { ctx: RecipeCtx }) {
  return (
    <>
      <Link href={ctx.listHref} className="text-sm font-semibold text-brand-700 hover:underline">← Articole & Norme</Link>
      <PageHeader title="Articol nou" subtitle={ctx.scope === "global" ? "Se adaugă în baza globală, ca draft. Intră în uz după validare." : "Articol propriu al firmei, ca draft."} />
      <Card><RecipeEditor scope={ctx.scope} base={ctx.base} readOnly={false} /></Card>
    </>
  );
}

export async function RecipeDetailPage({ ctx, id, sp }: { ctx: RecipeCtx; id: string; sp: { versiune?: string } }) {
  const rid = Number(id);
  if (!Number.isInteger(rid) || rid <= 0) notFound();
  const r = await getRecipe(rid, ctx.companyId, ctx.admin);
  if (!r) notFound();
  const owner = ctx.scope === "global" ? r.companyId === null : r.companyId === ctx.companyId;
  const superseded = !!r.supersededBy;
  const readOnly = !owner || superseded;

  return (
    <>
      <Link href={ctx.listHref} className="text-sm font-semibold text-brand-700 hover:underline">← Articole & Norme</Link>
      <PageHeader title={r.name} subtitle={`${r.unit}${r.category ? ` · ${r.category}` : ""} · versiunea ${r.version}${r.companyId === null ? " · bază globală" : ""}`}>
        <RecipeBadge status={r.status} />
      </PageHeader>
      {sp.versiune === "noua" && r.status === "draft" && <p className="mb-4 rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">Ai creat versiunea {r.version} (draft). Verific-o și apoi validează-o; versiunea anterioară rămâne în uz până atunci.</p>}
      {superseded && (
        <p className="mb-4 rounded-lg bg-canvas px-3.5 py-2.5 text-sm">
          Aceasta e o versiune veche. <Link href={`${ctx.base}/${r.supersededBy}`} className="font-semibold text-brand-700 hover:underline">Deschide versiunea care a înlocuit-o</Link>.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px] [&>*]:min-w-0">
        <Card><RecipeEditor scope={ctx.scope} recipe={r} base={ctx.base} readOnly={readOnly} /></Card>
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-bold">Validare</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Status</dt><dd><RecipeBadge status={r.status} /></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Verificat la</dt><dd>{dateFmt(r.verifiedAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Verificat de</dt><dd>{r.verifiedBy ?? "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Folosiri</dt><dd>{r.uses}</dd></div>
              {r.missingPrices > 0 && <div className="pt-1 text-xs text-amber-800">{r.missingPrices} resurse fără preț în catalog.</div>}
            </dl>
            {owner && <div className="mt-4"><RecipeStatusActions scope={ctx.scope} id={r.id} status={r.status} superseded={superseded} /></div>}
            {!owner && <p className="mt-3 text-xs text-muted">Articol din baza DevizConstruct. Îl poți duplica în articolele firmei ca să-l adaptezi.</p>}
          </Card>
          <Card>
            <h2 className="mb-3 font-bold">Versiuni</h2>
            <ul className="space-y-1.5 text-sm">
              {r.versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  {v.id === r.id ? <b>v{v.version} (aceasta)</b> : <Link href={`${ctx.base}/${v.id}`} className="text-brand-700 hover:underline">v{v.version}</Link>}
                  <span className="flex items-center gap-2 text-xs text-muted">{dateFmt(v.updatedAt)} <RecipeBadge status={v.status} /></span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="mb-3 font-bold">Acțiuni</h2>
            <div className="flex flex-col items-start gap-2 text-sm">
              <form action={duplicateRecipeAction}>
                <input type="hidden" name="scope" value={ctx.scope} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="base" value={ctx.base} />
                <button className="font-semibold text-brand-700 hover:underline">{owner ? "Duplică articolul" : "Duplică în articolele firmei"}</button>
              </form>
              {ctx.admin && r.companyId !== null && (
                <form action={promoteRecipeAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="font-semibold text-brand-700 hover:underline">Preia în baza globală (ca draft)</button>
                </form>
              )}
              {(owner || ctx.admin) && (
                <form action={deleteRecipeAction}>
                  <input type="hidden" name="scope" value={ctx.scope} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="redirect" value={ctx.listHref} />
                  <ConfirmSubmit message={`Ștergi definitiv „${r.name}” (v${r.version})? Devizele existente nu sunt afectate.`}>Șterge această versiune</ConfirmSubmit>
                </form>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
