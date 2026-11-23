"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";

export type FormState = { error?: string; ok?: string } | undefined;

/**
 * Formular legat de un server action; afișează erorile/confirmările întoarse de acesta.
 * Nu golește câmpurile după trimitere (ca să rămână valorile la eroare sau după salvare),
 * cu excepția formularelor de adăugare (`resetOnSuccess`).
 */
export function ActionForm({
  action, submitLabel, children, className = "space-y-4", resetOnSuccess = false,
}: {
  action: (state: FormState, data: FormData) => Promise<FormState>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {state?.error && <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800" role="status">{state.ok}</p>}
      {children}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-700 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
      >
        {pending ? "Se trimite…" : submitLabel}
      </button>
    </form>
  );
}
