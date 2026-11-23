"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export type FormState = { error?: string; ok?: string } | undefined;

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-brand-700 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
    >
      {pending ? "Se trimite…" : label}
    </button>
  );
}

/** Formular legat de un server action; afișează erorile/confirmările întoarse de acesta. */
export function ActionForm({
  action, submitLabel, children, className = "space-y-4",
}: {
  action: (state: FormState, data: FormData) => Promise<FormState>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {state?.error && <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800" role="status">{state.ok}</p>}
      {children}
      <Submit label={submitLabel} />
    </form>
  );
}
