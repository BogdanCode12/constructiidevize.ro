import { Card } from "../ui";
import { setCurrentOfferAction, setOfferStatusAction } from "@/lib/resources/actions";
import { PRICE_SOURCE_LABEL, type CatalogResource, type PriceOffer } from "@/lib/estimate/types";
import { StatusBadge } from "./resource-list";
import { OfferAddForm } from "./offer-add-form";

const money = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const dateFmt = (d: string | null) => (d ? new Intl.DateTimeFormat("ro-RO").format(new Date(`${d}T12:00:00`)) : "—");

function OfferActions({ o, scope, canManage, canMakeCurrent }: { o: PriceOffer; scope: string; canManage: boolean; canMakeCurrent: boolean }) {
  if (!canManage) return null;
  const btn = "text-xs font-semibold text-brand-700 hover:underline";
  const form = (action: (d: FormData) => Promise<void>, extra: Record<string, string>, label: string, cls = btn) => (
    <form action={action}>
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="offer_id" value={o.id} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className={cls}>{label}</button>
    </form>
  );
  return (
    <div className="flex flex-col items-end gap-1">
      {canMakeCurrent && !o.current && o.status !== "inactiv" && form(setCurrentOfferAction, {}, "Folosește ca referință")}
      {o.status === "neverificat" && form(setOfferStatusAction, { status: "verificat" }, "Marchează verificat")}
      {o.status !== "inactiv"
        ? form(setOfferStatusAction, { status: "inactiv" }, "Dezactivează", "text-xs text-muted hover:text-red-700 hover:underline")
        : form(setOfferStatusAction, { status: "neverificat" }, "Reactivează")}
    </div>
  );
}

/**
 * Istoricul prețurilor unei resurse + adăugare ofertă.
 * `owner` = utilizatorul administrează resursa (adminul pe catalog, firma pe resursele ei) → alege prețul de referință.
 * Altfel (firmă pe o resursă din catalog): vede prețurile catalogului și își adaugă prețurile proprii.
 */
export function OffersPanel({
  resource, offers, scope, owner,
}: {
  resource: CatalogResource; offers: PriceOffer[]; scope: "global" | "company"; owner: boolean;
}) {
  const catalogOffers = offers.filter((o) => !o.own || owner);
  const ownOffers = owner ? [] : offers.filter((o) => o.own);

  const table = (list: PriceOffer[], canManage: boolean) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b-2 border-ink/10 text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Data</th>
            <th className="px-3 py-2 text-right font-medium">Preț fără TVA</th>
            <th className="px-3 py-2 font-medium">Furnizor / sursă</th>
            <th className="px-3 py-2 font-medium">Condiții</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {list.map((o) => (
            <tr key={o.id} className={o.status === "inactiv" ? "opacity-55" : o.current ? "bg-brand-50/40" : ""}>
              <td className="px-3 py-2 whitespace-nowrap">
                {dateFmt(o.obtainedAt)}
                {o.current && <div className="text-[11px] font-semibold text-brand-800">preț de referință</div>}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                <b>{money.format(o.priceRon)} lei</b>
                {o.currency !== "RON" && <div className="text-xs text-muted">{money.format(o.price)} {o.currency} × {o.exchangeRate.toFixed(4)}</div>}
              </td>
              <td className="px-3 py-2">
                {o.supplier ?? "—"}
                <div className="text-xs text-muted">
                  {PRICE_SOURCE_LABEL[o.source]}
                  {o.documentUrl && <> · <a href={o.documentUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">document</a></>}
                </div>
              </td>
              <td className="px-3 py-2 text-xs text-muted">
                {o.validUntil ? <span className={o.expired ? "font-semibold text-red-700" : ""}>valabil până la {dateFmt(o.validUntil)}</span> : "valabilitate necunoscută"}
                <div>transport {o.transportIncluded === null ? "necunoscut" : o.transportIncluded ? "inclus" : "neinclus"}{o.minQty ? ` · min. ${o.minQty} ${resource.unit}` : ""}</div>
                {o.notes && <div className="italic">{o.notes}</div>}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge status={o.status} />
                  {o.expired && o.status !== "inactiv" && <StatusBadge status="expirat" />}
                </div>
              </td>
              <td className="px-3 py-2"><OfferActions o={o} scope={scope} canManage={canManage} canMakeCurrent={owner} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {!owner && (
        <Card>
          <h2 className="font-bold">Prețul tău</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Prețurile negociate de firma ta. Au prioritate față de prețul de referință al platformei și nu sunt vizibile altor firme.
          </p>
          {ownOffers.length ? table(ownOffers, true) : <p className="mb-4 text-sm text-muted">Nu ai adăugat încă un preț propriu.</p>}
          <div className="mt-4"><OfferAddForm scope={scope} resourceId={resource.id} owner={false} /></div>
        </Card>
      )}
      <Card>
        <h2 className="font-bold">{owner ? "Prețuri și istoric" : "Prețul de referință DevizConstruct"}</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          {owner
            ? "Fiecare preț nou se adaugă în istoric; prețurile vechi nu se suprascriu. Prețul de referință e cel folosit implicit în devize."
            : "Prețul din catalogul platformei, cu sursa și data lui."}
        </p>
        {catalogOffers.length ? table(catalogOffers, owner) : <p className="text-sm text-muted">Niciun preț înregistrat.</p>}
        {owner && <div className="mt-5"><OfferAddForm scope={scope} resourceId={resource.id} owner /></div>}
      </Card>
    </div>
  );
}
