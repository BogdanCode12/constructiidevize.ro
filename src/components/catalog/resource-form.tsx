"use client";

import { useState } from "react";
import { ActionForm } from "../action-form";
import { saveResourceAction } from "@/lib/resources/actions";
import { UNIT_SUGGESTIONS } from "@/lib/resources/units";
import {
  RES_STATUS_LABEL, RES_TYPE_LABEL, TARIFF_KIND_LABEL, type CatalogResource, type ResStatus, type ResType, type TariffKind,
} from "@/lib/estimate/types";
import { OfferFields } from "./offer-fields";

export const inputCls = "w-full rounded-lg border-2 border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500";

export function L({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const CATEGORY_SUGGESTIONS: Record<ResType, string[]> = {
  material: ["Agregate", "Ciment și lianți", "Beton", "Armătură", "Cofraje și lemn", "Zidărie", "Mortare și tencuieli", "Termoizolații",
    "Hidroizolații", "Finisaje", "Vopsele", "Metal", "Instalații sanitare", "Instalații electrice", "Instalații termice", "Altele"],
  manopera: ["Construcții", "Finisaje", "Instalații", "Necalificat"],
  utilaj: ["Terasamente", "Betonare", "Ridicat", "Compactare", "Altele"],
  transport: ["Auto", "Materiale vrac", "Pământ", "Altele"],
  echipament: ["Termic", "Electric", "Sanitar", "Ventilație", "Altele"],
};

/** Fișa unei resurse: date tehnice + câmpurile specifice tipului. La adăugare, opțional și primul preț. */
export function ResourceForm({
  scope, resource, types, defaultType, redirectBase,
}: {
  scope: "global" | "company"; resource?: CatalogResource; types: ResType[]; defaultType?: ResType; redirectBase?: string;
}) {
  const [type, setType] = useState<ResType>(resource?.type ?? defaultType ?? types[0]);
  const r = resource;
  return (
    <ActionForm action={saveResourceAction} submitLabel={r ? "Salvează modificările" : "Adaugă resursa"}>
      <input type="hidden" name="scope" value={scope} />
      {r && <input type="hidden" name="id" value={r.id} />}
      {!r && redirectBase && <input type="hidden" name="redirect" value={redirectBase} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <L label="Tip">
          <select name="type" value={type} onChange={(e) => setType(e.target.value as ResType)} className={inputCls}>
            {types.map((t) => <option key={t} value={t}>{RES_TYPE_LABEL[t]}</option>)}
          </select>
        </L>
        <L label="Categorie">
          <input name="category" list={`cat-${type}`} defaultValue={r?.category ?? ""} placeholder="ex. Beton" className={inputCls} />
          <datalist id={`cat-${type}`}>{CATEGORY_SUGGESTIONS[type].map((c) => <option key={c} value={c} />)}</datalist>
        </L>
        <L label="Status">
          <select name="status" defaultValue={r?.status ?? "neverificat"} className={inputCls}>
            {(["neverificat", "verificat", "inactiv"] as ResStatus[]).map((s) => <option key={s} value={s}>{RES_STATUS_LABEL[s]}</option>)}
          </select>
        </L>
      </div>

      <L label="Denumire standardizată">
        <input name="name" required defaultValue={r?.name ?? ""} placeholder="ex. Beton C25/30 XC2 S3" className={inputCls} />
      </L>
      <div className="grid gap-3 sm:grid-cols-3">
        <L label="Cod intern"><input name="code" defaultValue={r?.code ?? ""} className={inputCls} /></L>
        <L label="Unitate de măsură" hint="Se uniformizează scrierea (m3 → mc), fără conversii.">
          <input name="unit" required list="units" defaultValue={r?.unit ?? ""} className={inputCls} />
          <datalist id="units">{UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}</datalist>
        </L>
        {type === "material" || type === "echipament" ? (
          <L label="Producător"><input name="producer" defaultValue={r?.producer ?? ""} className={inputCls} /></L>
        ) : <div />}
      </div>

      {(type === "material" || type === "echipament") && (
        <div className="grid gap-3 sm:grid-cols-3">
          <L label="Cod produs (producător)"><input name="product_code" defaultValue={r?.productCode ?? ""} className={inputCls} /></L>
          <L label="Specificații tehnice" className="sm:col-span-2">
            <input name="specs" defaultValue={r?.specs ?? ""} placeholder="ex. clasă expunere, granulație, densitate, λ" className={inputCls} />
          </L>
        </div>
      )}

      {type === "manopera" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <L label="Tip tarif" hint="CAM (2,25%) se adaugă doar la „cost salarial”. Tarifele comerciale includ deja contribuțiile.">
            <select name="tariff_kind" required defaultValue={r?.tariffKind ?? ""} className={inputCls}>
              <option value="" disabled>Alege…</option>
              {(Object.keys(TARIFF_KIND_LABEL) as TariffKind[]).map((k) => <option key={k} value={k}>{TARIFF_KIND_LABEL[k]}</option>)}
            </select>
          </L>
          <L label="Regiune (opțional)"><input name="region" defaultValue={r?.region ?? ""} placeholder="ex. București-Ilfov" className={inputCls} /></L>
        </div>
      )}

      {type === "utilaj" && (
        <L label="Mobilizare / transport utilaj (lei, separat)" hint="Se adaugă o singură dată pe lucrare, nu pe oră. Lasă gol dacă e inclus în tarif.">
          <input name="mobilization_cost" inputMode="decimal" defaultValue={r?.mobilizationCost != null ? String(r.mobilizationCost).replace(".", ",") : ""} className={inputCls} />
        </L>
      )}

      <L label={type === "transport" ? "Condiții de aplicare (distanță, încărcare)" : "Condiții de aplicare / tarifare"}>
        <input name="conditions" defaultValue={r?.conditions ?? ""} className={inputCls}
          placeholder={type === "transport" ? "ex. pe distanțe sub 30 km, încărcare manuală" : type === "utilaj" ? "ex. minim 4 ore facturate" : ""} />
      </L>
      <L label="Observații"><input name="notes" defaultValue={r?.notes ?? ""} className={inputCls} /></L>

      {!r && (
        <details className="rounded-xl border-2 border-ink/10 p-4">
          <summary className="cursor-pointer text-sm font-semibold">Primul preț (opțional)</summary>
          <p className="mt-2 mb-3 text-xs text-muted">Poți adăuga prețul și după, din fișa resursei. Fără preț, resursa apare „fără preț” în deviz.</p>
          <OfferFields scope={scope} optional />
        </details>
      )}
    </ActionForm>
  );
}
