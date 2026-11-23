"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DOC_CATEGORIES } from "@/lib/documents";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-brand-500";

export function UploadForm() {
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
          const res = await fetch("/api/documente", { method: "POST", body: new FormData(e.currentTarget) });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Încărcarea a eșuat." });
          ref.current?.reset();
          setMsg({ ok: true, text: "Document adăugat în dosar." });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-brand-50 text-brand-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <select name="category" className={input}>
        {Object.entries(DOC_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input name="title" required placeholder="Denumire (ex: Certificat ISO 9001)" className={input} />
      <div className="grid grid-cols-2 gap-2">
        <input name="issuer" placeholder="Emitent" className={input} />
        <input name="doc_number" placeholder="Număr" className={input} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">Emis la<input type="date" name="issued_at" className={`${input} mt-1 text-sm text-ink`} /></label>
        <label className="text-xs text-muted">Expiră la<input type="date" name="expires_at" className={`${input} mt-1 text-sm text-ink`} /></label>
      </div>
      <input name="notes" placeholder="Observații (opțional)" className={input} />
      <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.zip,.odt,.ods,.txt"
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700" />
      <button disabled={busy} className="w-full rounded-lg bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
        {busy ? "Se încarcă…" : "Adaugă în dosar"}
      </button>
    </form>
  );
}
