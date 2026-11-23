"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const input = "w-full rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-brand-500";

/** Raport zilnic de șantier — gândit să fie completat și de pe telefon, cu poze din cameră. */
export function JournalForm({ projectId }: { projectId: number }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form
      ref={ref}
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          const res = await fetch(`/api/proiecte/${projectId}/jurnal`, { method: "POST", body: new FormData(e.currentTarget) });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Salvarea a eșuat." });
          ref.current?.reset();
          setMsg({ ok: true, text: `Raport salvat${json.photos ? ` cu ${json.photos} poze` : ""}.` });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-brand-50 text-brand-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input type="date" name="entry_date" defaultValue={today} required className={input} />
        <input name="weather" placeholder="Vreme (ex: senin, 18°C)" className={input} />
        <input name="workers" inputMode="numeric" placeholder="Nr. muncitori" className={input} />
        <input name="hours" inputMode="decimal" placeholder="Ore lucrate (total)" className={input} />
      </div>
      <textarea name="activities" rows={3} placeholder="Lucrări executate azi" className={input} />
      <textarea name="issues" rows={2} placeholder="Probleme, întârzieri, dispoziții de șantier (opțional)" className={input} />
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Poze (se pot face direct cu camera telefonului)</span>
        <input type="file" name="photos" multiple accept="image/*" capture="environment"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700" />
      </label>
      <button disabled={busy} className="w-full rounded-lg bg-brand-700 px-4 py-2.5 font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
        {busy ? "Se salvează…" : "Salvează raportul zilei"}
      </button>
    </form>
  );
}
