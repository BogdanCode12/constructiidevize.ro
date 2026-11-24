import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "../ui";
import { ConfirmSubmit } from "../confirm-submit";
import { currentVat } from "@/lib/rules";
import { getResource, listCategories, listOffers, listResources } from "@/lib/resources/repo";
import { deleteResourceAction } from "@/lib/resources/actions";
import {
  RES_STATUS_LABEL, RES_TYPE_LABEL, TARIFF_KIND_LABEL, type ResStatus, type ResType,
} from "@/lib/estimate/types";
import { ResourceList, StatusBadge } from "./resource-list";
import { ResourceForm } from "./resource-form";
import { OffersPanel } from "./offers-panel";
import { ImportWizard } from "./import-wizard";
import { IMPORT_FIELDS } from "@/lib/resources/import-core";

export type CatalogCtx = {
  scope: "global" | "company";
  /** Firma care privește; null pentru admin (catalogul global). */
  companyId: number | null;
  basePath: string;
  types: ResType[];
  title: string;
  subtitle: string;
};

type SP = { tip?: string; categorie?: string; status?: string; q?: string };

const btnPrimary = "rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800";
const btnGhost = "rounded-lg border-2 border-ink/15 bg-white px-4 py-2 text-sm font-semibold hover:border-ink/40";

export async function CatalogList({ ctx, sp, header = true, children }: { ctx: CatalogCtx; sp: SP; header?: boolean; children?: React.ReactNode }) {
  const type = ctx.types.includes(sp.tip as ResType) ? (sp.tip as ResType) : undefined;
  const status = ["verificat", "neverificat", "inactiv", "expirat", "fara_pret"].includes(sp.status ?? "") ? (sp.status as ResStatus | "expirat" | "fara_pret") : undefined;
  const [resources, categories, vatPct] = await Promise.all([
    listResources({
      companyId: ctx.companyId, includeGlobal: true, types: type ? [type] : ctx.types, category: sp.categorie || undefined,
      status, q: sp.q?.trim() || undefined, includeInactive: ctx.scope === "global" || status === "inactiv",
    }),
    listCategories(ctx.companyId, type ? [type] : ctx.types),
    currentVat(),
  ]);
  return (
    <>
      {header && <PageHeader title={ctx.title} subtitle={ctx.subtitle} />}
      {children}
      <ResourceList
        resources={resources} basePath={ctx.basePath} types={ctx.types} categories={categories} vatPct={vatPct}
        scope={ctx.scope} filters={{ type, category: sp.categorie, status: sp.status, q: sp.q }}
        actions={<>
          <Link href={`${ctx.basePath}/import`} className={btnGhost}>Import Excel</Link>
          <Link href={`${ctx.basePath}/nou${type ? `?tip=${type}` : ""}`} className={btnPrimary}>+ Resursă nouă</Link>
        </>}
      />
    </>
  );
}

export function CatalogNew({ ctx, sp }: { ctx: CatalogCtx; sp: SP }) {
  const type = ctx.types.includes(sp.tip as ResType) ? (sp.tip as ResType) : undefined;
  return (
    <>
      <Link href={ctx.basePath} className="text-sm font-semibold text-brand-700 hover:underline">← {ctx.title}</Link>
      <PageHeader title="Resursă nouă" subtitle={ctx.scope === "global" ? "Se adaugă în catalogul global, vizibil tuturor firmelor." : "Se adaugă în resursele firmei tale."} />
      <Card className="max-w-3xl">
        <ResourceForm scope={ctx.scope} types={ctx.types} defaultType={type} redirectBase={ctx.basePath} />
      </Card>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <dt className="w-44 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}

export async function CatalogDetail({ ctx, id }: { ctx: CatalogCtx; id: string }) {
  const rid = Number(id);
  if (!Number.isInteger(rid) || rid <= 0) notFound();
  const r = await getResource(rid, ctx.companyId);
  if (!r || (ctx.scope === "global" && !r.global)) notFound();
  const owner = ctx.scope === "global" ? r.global : !r.global;
  const offers = await listOffers(rid, ctx.companyId);

  return (
    <>
      <Link href={ctx.basePath} className="text-sm font-semibold text-brand-700 hover:underline">← {ctx.title}</Link>
      <PageHeader title={r.name} subtitle={`${RES_TYPE_LABEL[r.type]}${r.category ? ` · ${r.category}` : ""} · ${r.unit}${r.code ? ` · cod ${r.code}` : ""}`}>
        <div className="flex items-center gap-2">
          <StatusBadge status={r.status} />
          {r.priceInfo?.expired && <StatusBadge status="expirat" />}
          {ctx.scope === "company" && r.global && <span className="rounded bg-canvas px-1.5 py-0.5 text-[11px] font-semibold uppercase text-muted">catalog DevizConstruct</span>}
        </div>
      </PageHeader>

      <div className="space-y-6">
        <OffersPanel resource={r} offers={offers} scope={ctx.scope} owner={owner} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] [&>*]:min-w-0">
          {owner ? (
            <Card>
              <h2 className="mb-4 font-bold">Date resursă</h2>
              <ResourceForm scope={ctx.scope} resource={r} types={ctx.types.includes(r.type) ? ctx.types : [r.type]} />
            </Card>
          ) : (
            <Card>
              <h2 className="mb-3 font-bold">Date resursă</h2>
              <dl className="divide-y divide-line">
                <InfoRow label="Specificații" value={r.specs} />
                <InfoRow label="Producător" value={r.producer} />
                <InfoRow label="Cod produs" value={r.productCode} />
                <InfoRow label="Tip tarif" value={r.tariffKind ? TARIFF_KIND_LABEL[r.tariffKind] : null} />
                <InfoRow label="Regiune" value={r.region} />
                <InfoRow label="Mobilizare" value={r.mobilizationCost !== null ? `${r.mobilizationCost} lei` : null} />
                <InfoRow label="Condiții" value={r.conditions} />
                <InfoRow label="Status în catalog" value={RES_STATUS_LABEL[r.status]} />
                <InfoRow label="Observații" value={r.notes} />
              </dl>
            </Card>
          )}
          {owner && (
            <Card>
              <h2 className="font-bold">Ștergere</h2>
              <p className="mt-1 mb-3 text-sm text-muted">
                Recomandat: în loc de ștergere, pune statusul <b>Inactiv</b> — resursa dispare din editor, dar istoricul rămâne.
                Devizele existente nu sunt afectate în niciun caz (păstrează prețurile cu care au fost calculate).
              </p>
              <form action={deleteResourceAction}>
                <input type="hidden" name="scope" value={ctx.scope} />
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="redirect" value={ctx.basePath} />
                <ConfirmSubmit message={`Ștergi definitiv „${r.name}” și tot istoricul prețurilor?`}>Șterge resursa</ConfirmSubmit>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

export function CatalogImport({ ctx }: { ctx: CatalogCtx }) {
  const fields = IMPORT_FIELDS.map((f) => ({ key: f.key, label: f.label, required: f.required }));
  return (
    <>
      <Link href={ctx.basePath} className="text-sm font-semibold text-brand-700 hover:underline">← {ctx.title}</Link>
      <PageHeader
        title="Import din Excel"
        subtitle="Încarci tabelul, alegi coloanele, verifici ce se schimbă și abia apoi salvezi. Prețurile verificate nu se înlocuiesc automat."
      />
      <ImportWizard scope={ctx.scope} types={ctx.types} basePath={ctx.basePath} fields={fields} />
    </>
  );
}
