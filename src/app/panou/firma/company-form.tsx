"use client";

import { useRef, useState, useTransition } from "react";
import { ActionForm } from "@/components/action-form";
import { anafLookupAction, updateCompanyProfileAction } from "./actions";
import type { Company } from "@/lib/company";

const input = "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 outline-none focus:border-brand-500 disabled:bg-canvas";

export function CompanyForm({ company, canEdit }: { company: Company; canEdit: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const set = (name: string, value: string) => {
    const el = ref.current?.querySelector<HTMLInputElement>(`[name="${name}"]`);
    if (el && value) el.value = value;
  };

  const lookup = () => {
    const cui = ref.current?.querySelector<HTMLInputElement>('[name="cui"]')?.value ?? "";
    setMsg(null);
    start(async () => {
      const res = await anafLookupAction(cui);
      if (!res.ok) return setMsg({ ok: false, text: res.error });
      const d = res.data;
      set("name", d.name);
      set("address", d.address);
      set("reg_com", d.regCom);
      set("phone", d.phone);
      set("caen", d.caen);
      set("county", d.county);
      setMsg({ ok: true, text: `Completat din ANAF: ${d.active}${d.vat ? " · plătitor de TVA" : ""}. Verifică și salvează.` });
    });
  };


  return (
    <div ref={ref}>
      <ActionForm action={updateCompanyProfileAction} submitLabel="Salvează datele firmei">
        <div className="flex items-end gap-2">
          <Field canEdit={canEdit} label="CUI" name="cui" value={company.cui} cls="flex-1" />
          {canEdit && (
            <button type="button" onClick={lookup} disabled={pending}
              className="h-[46px] shrink-0 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-brand-700 hover:border-brand-200 disabled:opacity-50">
              {pending ? "Se caută…" : "Completează din ANAF"}
            </button>
          )}
        </div>
        {msg && <p className={`rounded-lg px-3.5 py-2.5 text-sm ${msg.ok ? "bg-brand-50 text-brand-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
        <Field canEdit={canEdit} label="Denumire" name="name" value={company.name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field canEdit={canEdit} label="Nr. Reg. Com." name="reg_com" value={company.reg_com} />
          <Field canEdit={canEdit} label="Cod CAEN" name="caen" value={company.caen} />
        </div>
        <Field canEdit={canEdit} label="Adresa sediului" name="address" value={company.address} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field canEdit={canEdit} label="Județ" name="county" value={company.county} />
          <Field canEdit={canEdit} label="Telefon" name="phone" value={company.phone} />
          <Field canEdit={canEdit} label="Email" name="email" value={company.email} />
          <Field canEdit={canEdit} label="IBAN" name="iban" value={company.iban} />
          <Field canEdit={canEdit} label="Banca" name="bank" value={company.bank} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field canEdit={canEdit} label="Reprezentant legal" name="legal_rep" value={company.legal_rep} />
          <Field canEdit={canEdit} label="Funcția" name="legal_rep_role" value={company.legal_rep_role} />
        </div>
        {!canEdit && <p className="text-sm text-muted">Doar proprietarul sau administratorii firmei pot modifica aceste date.</p>}
      </ActionForm>
    </div>
  );
}

function Field({ label, name, value, cls = "", canEdit }: { label: string; name: keyof Company; value: string | null; cls?: string; canEdit: boolean }) {
  return (
    <label className={`block ${cls}`}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input name={name} defaultValue={value ?? ""} disabled={!canEdit} className={input} />
    </label>
  );
}
