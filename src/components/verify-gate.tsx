"use client";

import { useActionState, useState } from "react";
import { ActionForm, type FormState } from "./action-form";

/** Ecranul afișat în cont până la confirmarea adresei de e-mail (când trimiterea de e-mailuri e configurată). */
export function VerifyGate({ email, resend, change, logout }: {
  email: string;
  resend: () => Promise<FormState>;
  change: (s: FormState, d: FormData) => Promise<FormState>;
  logout: () => Promise<void>;
}) {
  const [state, act, pending] = useActionState(resend, undefined);
  const [edit, setEdit] = useState(false);
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-50 text-2xl text-brand-700">✉</div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">Confirmă adresa de e-mail</h1>
      <p className="mt-3 text-muted">
        Ți-am trimis un link de confirmare pe <b className="text-ink">{email}</b>. Deschide e-mailul și apasă „Confirmă adresa de e-mail”.
        Dacă nu-l găsești, uită-te și în dosarul <b>Spam</b> sau <b>Promoții</b>.
      </p>
      {state?.ok && <p className="mt-5 rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800" role="status">{state.ok}</p>}
      {state?.error && <p className="mt-5 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{state.error}</p>}
      <form action={act} className="mt-6">
        <button disabled={pending} className="rounded-lg bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
          {pending ? "Se trimite…" : "Retrimite e-mailul"}
        </button>
      </form>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
        <button onClick={() => setEdit(!edit)} className="font-semibold text-brand-700 hover:underline">Am greșit adresa</button>
        <form action={logout}><button className="text-muted hover:text-ink">Ieșire din cont</button></form>
      </div>
      {edit && (
        <div className="mt-5 rounded-xl border-2 border-ink/10 p-4 text-left">
          <ActionForm action={change} submitLabel="Schimbă adresa și trimite linkul">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Adresa corectă</span>
              <input name="email" type="email" required className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 outline-none focus:border-brand-500" />
            </label>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
