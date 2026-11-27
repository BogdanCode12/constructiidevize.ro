"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global { interface Window { __dcInstall?: InstallEvent | null } }

/** Înregistrează service worker-ul și reține cererea de instalare a browserului (poate veni înainte de afișarea butonului). */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__dcInstall = e as InstallEvent;
      window.dispatchEvent(new Event("dc-install-ready"));
    };
    const onInstalled = () => { window.__dcInstall = null; window.dispatchEvent(new Event("dc-install-ready")); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  return null;
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: window-controls-overlay)").matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Butonul „Instalează aplicația”: în Chrome / Edge / Android deschide fereastra de instalare a browserului;
 * pe iPhone / iPad arată pașii (Safari nu are buton de instalare). Ascuns dacă aplicația rulează deja instalată.
 */
export function InstallAppButton({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<"none" | "prompt" | "ios">("none");
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const sync = () => {
      if (isStandalone()) return setMode("none");
      if (window.__dcInstall) return setMode("prompt");
      setMode(isIos() ? "ios" : "none");
    };
    sync();
    window.addEventListener("dc-install-ready", sync);
    return () => window.removeEventListener("dc-install-ready", sync);
  }, []);

  if (mode === "none") return null;
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (mode === "ios") return setHelp(true);
          const ev = window.__dcInstall;
          if (!ev) return;
          await ev.prompt();
          const { outcome } = await ev.userChoice;
          if (outcome === "accepted") { window.__dcInstall = null; setMode("none"); }
        }}
        className={`flex w-full items-center gap-2.5 rounded-lg border-2 border-ink/10 bg-white px-3 py-2 text-left text-sm font-semibold hover:border-brand-500 ${className}`}
      >
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-brand-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4M12 7v6m-3-3 3 3 3-3" />
        </svg>
        <span className="min-w-0">Instalează aplicația<span className="block text-xs font-normal text-muted">pe calculator sau telefon</span></span>
      </button>
      {help && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/30 p-4 sm:place-items-center" onClick={() => setHelp(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Instalează pe iPhone / iPad</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
              <li>Deschide devizconstruct.ro în <b>Safari</b>.</li>
              <li>Apasă butonul <b>Partajează</b> (pătratul cu săgeata în sus).</li>
              <li>Alege <b>Adaugă pe ecranul principal</b>, apoi <b>Adaugă</b>.</li>
            </ol>
            <p className="mt-3 text-sm text-muted">Aplicația apare cu iconița DevizConstruct și se deschide pe tot ecranul.</p>
            <button type="button" onClick={() => setHelp(false)} className="mt-4 w-full rounded-lg bg-brand-700 py-2.5 font-semibold text-white">Am înțeles</button>
          </div>
        </div>
      )}
    </>
  );
}
