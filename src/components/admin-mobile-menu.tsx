"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminNav } from "./admin-nav";

/** Meniul adminului pe telefon: buton „Meniu” care deschide lista completă. Se închide la schimbarea paginii. */
export function AdminMobileMenu() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Meniu"
        className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10">
        ☰ Meniu
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Închide meniul" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-white/10 bg-[#0c0c0d] px-3 py-4">
            <div className="mb-4 flex items-center justify-between px-2">
              <span className="text-sm font-semibold text-white">Admin</span>
              <button type="button" onClick={() => setOpen(false)} className="px-2 text-xl text-white/70 hover:text-white">✕</button>
            </div>
            <AdminNav vertical />
          </div>
        </div>
      )}
    </>
  );
}
