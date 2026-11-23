"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { PROJECT_FILE_LABELS } from "@/lib/ai/labels";
import { sendChatAction } from "./actions";

/** Reîmprospătează pagina cât timp AI-ul lucrează. */
export function Poller({ active, every = 3000 }: { active: boolean; every?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), every);
    return () => clearInterval(t);
  }, [active, every, router]);
  return null;
}

export function ProjectFilesUpload({ projectId }: { projectId: number }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      ref={ref}
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          const res = await fetch(`/api/proiecte/${projectId}/fisiere`, { method: "POST", body: new FormData(e.currentTarget) });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Încărcarea a eșuat." });
          ref.current?.reset();
          setMsg({ ok: true, text: `${json.count} fișier(e) încărcat(e).` });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-brand-50 text-brand-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <select name="label" className="w-full rounded-lg border border-line bg-white px-3 py-2">
        {Object.entries(PROJECT_FILE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input type="file" name="files" multiple required accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.jpg,.jpeg,.png,.webp,.txt"
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700" />
      <button disabled={busy} className="w-full rounded-lg bg-brand-700 px-4 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
        {busy ? "Se încarcă…" : "Încarcă documentele"}
      </button>
      <p className="text-xs text-muted">PDF, Word, Excel, ZIP sau imagini (planșe scanate), maxim 25 MB fiecare.</p>
    </form>
  );
}

export function ChatForm({ projectId, disabled }: { projectId: number; disabled: boolean }) {
  const [state, action, pending] = useActionState(sendChatAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-2"
    >
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <input type="hidden" name="project_id" value={projectId} />
      <div className="flex gap-2">
        <textarea
          name="message"
          rows={2}
          required
          disabled={disabled}
          placeholder="Ex: Ce documente îmi lipsesc? Cât mă costă betonul? Ce materiale pot înlocui?"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className="flex-1 resize-none rounded-lg border border-line bg-white px-3.5 py-2.5 outline-none focus:border-brand-500 disabled:bg-canvas"
        />
        <button disabled={pending || disabled} className="self-end rounded-lg bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
          Trimite
        </button>
      </div>
    </form>
  );
}
