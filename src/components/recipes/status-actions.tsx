"use client";

import { startTransition, useActionState } from "react";
import { setRecipeStatusAction } from "@/lib/recipes/actions";
import type { RecipeStatus } from "@/lib/recipes/repo";

/** Butoanele de status ale unui articol: validare, scoatere din uz, redeschidere. */
export function RecipeStatusActions({ scope, id, status, superseded }: { scope: string; id: number; status: RecipeStatus; superseded: boolean }) {
  const [state, action, pending] = useActionState(setRecipeStatusAction, undefined);
  if (superseded) return null;
  const go = (to: RecipeStatus) => {
    const d = new FormData();
    d.set("scope", scope);
    d.set("id", String(id));
    d.set("status", to);
    startTransition(() => action(d));
  };
  return (
    <div className="space-y-2">
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{state.ok}</p>}
      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <button type="button" disabled={pending} onClick={() => go("verificat")}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
            Validează articolul
          </button>
        )}
        {status !== "depasit" && (
          <button type="button" disabled={pending} onClick={() => { if (confirm("Scoți articolul din uz? Nu va mai fi propus în devize.")) go("depasit"); }}
            className="rounded-lg border-2 border-ink/15 px-4 py-2 text-sm font-semibold hover:border-ink/40 disabled:opacity-50">
            Scoate din uz (normă depășită)
          </button>
        )}
        {status === "depasit" && (
          <button type="button" disabled={pending} onClick={() => go("draft")}
            className="rounded-lg border-2 border-ink/15 px-4 py-2 text-sm font-semibold hover:border-ink/40 disabled:opacity-50">
            Redeschide ca draft
          </button>
        )}
      </div>
    </div>
  );
}
