"use client";

import { useState } from "react";
import { ActionForm } from "../action-form";
import { addOfferAction } from "@/lib/resources/actions";
import { OfferFields } from "./offer-fields";

/** Buton „Adaugă preț” care deschide formularul de ofertă. */
export function OfferAddForm({ scope, resourceId, owner }: { scope: "global" | "company"; resourceId: number; owner: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="rounded-lg border-2 border-ink/15 px-4 py-2 text-sm font-semibold hover:border-ink/40">
        + {owner ? "Adaugă un preț nou" : "Adaugă prețul tău"}
      </button>
    );
  }
  return (
    <div className="rounded-xl border-2 border-ink/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold">{owner ? "Preț nou" : "Prețul tău"}</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:underline">Închide</button>
      </div>
      <ActionForm action={addOfferAction} submitLabel="Salvează prețul" resetOnSuccess>
        <input type="hidden" name="scope" value={scope} />
        <input type="hidden" name="resource_id" value={resourceId} />
        <OfferFields scope={scope} ownPrice={!owner} />
        {owner && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="make_current" defaultChecked className="size-4 accent-brand-700" />
            Folosește-l ca preț de referință
          </label>
        )}
      </ActionForm>
    </div>
  );
}
