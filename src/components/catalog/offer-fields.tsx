"use client";

import { useState, useTransition } from "react";
import { exchangeRateAction } from "@/lib/resources/actions";
import { PRICE_SOURCE_LABEL, type PriceSource } from "@/lib/estimate/types";
import { COUNTIES } from "@/lib/counties";

const inputCls = "w-full rounded-lg border-2 border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500";
const todayRo = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bucharest" }).format(new Date());

function L({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

/** Câmpurile unei oferte de preț (fără TVA). `optional` = la crearea resursei, prețul poate lipsi. */
export function OfferFields({ scope, optional = false, ownPrice = false }: { scope: "global" | "company"; optional?: boolean; ownPrice?: boolean }) {
  const [currency, setCurrency] = useState("RON");
  const [rate, setRate] = useState("");
  const [rateInfo, setRateInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const loadRate = (c: string) =>
    start(async () => {
      const r = await exchangeRateAction(c);
      if (r) {
        setRate(r.rate.toFixed(4).replace(".", ","));
        setRateInfo(`Curs BNR din ${new Intl.DateTimeFormat("ro-RO").format(new Date(`${r.date}T12:00:00`))}`);
      } else setRateInfo("Cursul BNR nu a putut fi preluat; completează-l manual.");
    });

  const sources: PriceSource[] = ownPrice ? ["negociat", "oferta_furnizor", "manual"] : scope === "global" ? ["oferta_furnizor", "manual", "import"] : ["oferta_furnizor", "negociat", "manual"];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <L label="Preț unitar fără TVA">
          <input name="price" required={!optional} inputMode="decimal" placeholder="ex. 485,50" className={inputCls} />
        </L>
        <L label="Monedă">
          <select name="currency" value={currency} className={inputCls}
            onChange={(e) => { setCurrency(e.target.value); setRate(""); setRateInfo(null); if (e.target.value !== "RON") loadRate(e.target.value); }}>
            <option value="RON">RON</option><option value="EUR">EUR</option><option value="USD">USD</option>
          </select>
        </L>
        {currency !== "RON" ? (
          <L label={`Curs (lei / 1 ${currency})`} hint={pending ? "Se preia cursul BNR…" : rateInfo ?? undefined}>
            <input name="exchange_rate" required inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className={inputCls} />
          </L>
        ) : <div />}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <L label="Zona prețului" hint="Unde e valabil prețul. Devizele din acel județ îl folosesc primul.">
          <select name="county" defaultValue="" className={inputCls}>
            <option value="">Toată țara</option>
            {COUNTIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </L>
        <L label="Furnizor"><input name="supplier" placeholder="ex. Depozitul X" className={inputCls} /></L>
        <L label="Sursa prețului">
          <select name="source" defaultValue={sources[0]} className={inputCls}>
            {sources.map((s) => <option key={s} value={s}>{PRICE_SOURCE_LABEL[s]}</option>)}
          </select>
        </L>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <L label="Data obținerii"><input type="date" name="obtained_at" defaultValue={todayRo()} max={todayRo()} className={inputCls} /></L>
        <L label="Valabil până la" hint="Gol = necunoscut."><input type="date" name="valid_until" className={inputCls} /></L>
        <L label="Transport inclus">
          <select name="transport_included" defaultValue="" className={inputCls}>
            <option value="">Necunoscut</option><option value="da">Da</option><option value="nu">Nu</option>
          </select>
        </L>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <L label="Cantitate minimă" hint="Pentru care e valabil prețul."><input name="min_qty" inputMode="decimal" className={inputCls} /></L>
        <L label="Link justificativ" className="sm:col-span-2"><input name="document_url" type="url" placeholder="https://…" className={inputCls} /></L>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <L label="Verificare">
          <select name="price_status" defaultValue="neverificat" className={inputCls}>
            <option value="neverificat">Neverificat</option><option value="verificat">Verificat</option>
          </select>
        </L>
        <L label="Observații" className="sm:col-span-2"><input name="price_notes" className={inputCls} /></L>
      </div>
    </div>
  );
}
