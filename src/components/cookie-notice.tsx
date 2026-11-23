"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "cd_cookie_notice";

/** Informare despre cookie-uri: folosim doar cookie-uri strict necesare, deci nu e nevoie de consimțământ, doar de informare. */
export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(!localStorage.getItem(KEY));
    } catch {
      setShow(false);
    }
  }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm shadow-lg">
      <span className="flex-1">Folosim doar cookie-uri strict necesare (autentificare). Nu folosim cookie-uri de analiză sau publicitate. <Link href="/confidentialitate" className="text-brand-700 underline">Detalii</Link></span>
      <button
        onClick={() => {
          try { localStorage.setItem(KEY, "1"); } catch { /* fără stocare: doar ascundem */ }
          setShow(false);
        }}
        className="rounded-lg bg-brand-700 px-4 py-1.5 font-semibold text-white hover:bg-brand-800"
      >
        Am înțeles
      </button>
    </div>
  );
}
