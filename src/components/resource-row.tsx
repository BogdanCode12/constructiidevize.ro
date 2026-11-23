"use client";

import { useActionState, useState } from "react";
import { deleteResourceAction, saveResourceAction } from "@/lib/resources/actions";
import { RES_TYPE_LABEL, RES_TYPES, type CatalogResource } from "@/lib/estimate/types";

const money = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const cell = "rounded-md border border-line bg-white px-2 py-1.5 outline-none focus:border-brand-500";

export function ResourceRow({ resource: r, scope, editable }: { resource: CatalogResource; scope: "company" | "global"; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (prev: unknown, data: FormData) => {
    const res = await saveResourceAction(undefined, data);
    if (res?.ok) setEditing(false);
    return res;
  }, undefined);

  if (editing) {
    const formId = `res-${r.id}`;
    return (
      <tr className="bg-brand-50/40">
        <td className="px-4 py-2">
          <form id={formId} action={action}>
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="id" value={r.id} />
          </form>
          <select form={formId} name="type" defaultValue={r.type} className={cell}>
            {RES_TYPES.map((t) => <option key={t} value={t}>{RES_TYPE_LABEL[t]}</option>)}
          </select>
        </td>
        <td className="px-4 py-2"><input form={formId} name="code" defaultValue={r.code ?? ""} className={`${cell} w-24`} /></td>
        <td className="px-4 py-2">
          <input form={formId} name="name" defaultValue={r.name} required className={`${cell} w-full min-w-48`} />
          {state?.error && <div className="mt-1 text-xs text-red-700">{state.error}</div>}
        </td>
        <td className="px-4 py-2"><input form={formId} name="unit" defaultValue={r.unit} required className={`${cell} w-16`} /></td>
        <td className="px-4 py-2"><input form={formId} name="price" defaultValue={String(r.price).replace(".", ",")} inputMode="decimal" required className={`${cell} w-24 text-right`} /></td>
        <td className="px-4 py-2 whitespace-nowrap text-right">
          <button key="save" type="submit" form={formId} disabled={pending} className="font-semibold text-brand-700 hover:underline">Salvează</button>
          <button type="button" onClick={() => setEditing(false)} className="ml-3 text-muted hover:underline">Renunță</button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-2.5 whitespace-nowrap text-muted">{RES_TYPE_LABEL[r.type]}</td>
      <td className="px-4 py-2.5 whitespace-nowrap text-muted">{r.code ?? "—"}</td>
      <td className="px-4 py-2.5">
        {r.name}
        {r.global && scope === "company" && <span className="ml-2 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">catalog</span>}
        {r.notes && <div className="text-xs text-muted">{r.notes}</div>}
      </td>
      <td className="px-4 py-2.5">{r.unit}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{money.format(r.price)}</td>
      <td className="px-4 py-2.5 whitespace-nowrap text-right">
        {editable && (
          <>
            <button key="edit" type="button" onClick={(e) => { e.preventDefault(); setEditing(true); }} className="font-semibold text-brand-700 hover:underline">Editează</button>
            <form action={deleteResourceAction} className="ml-3 inline" onSubmit={(e) => { if (!confirm(`Ștergi „${r.name}”?`)) e.preventDefault(); }}>
              <input type="hidden" name="scope" value={scope} />
              <input type="hidden" name="id" value={r.id} />
              <button className="text-red-700 hover:underline">Șterge</button>
            </form>
          </>
        )}
      </td>
    </tr>
  );
}
