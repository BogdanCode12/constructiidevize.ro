"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "./icon";

type Item = { href: string; label: string; icon: string; soon?: boolean };

export function Sidebar({ main, account, footer, header }: {
  main: Item[]; account: Item[]; footer: React.ReactNode; header: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const link = (it: Item) => {
    const active = it.href === "/panou" ? pathname === "/panou" : pathname.startsWith(it.href);
    return (
      <Link
        key={it.href}
        href={it.href}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition ${
          active ? "bg-brand-50 font-semibold text-brand-800" : "text-ink/80 hover:bg-canvas hover:text-ink"
        }`}
      >
        <Icon name={it.icon} className={`size-5 ${active ? "text-brand-700" : "text-muted"}`} />
        <span className="flex-1">{it.label}</span>
        {it.soon && <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted">curând</span>}
      </Link>
    );
  };

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
        {header}
        <button onClick={() => setOpen(!open)} aria-label="Meniu" className="rounded-lg p-2 hover:bg-canvas">
          <Icon name="menu" />
        </button>
      </div>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r-2 border-ink/10 bg-white transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5">{header}</div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {main.map(link)}
          <p className="px-3 pt-5 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Cont</p>
          {account.map(link)}
        </nav>
        <div className="border-t border-line p-4">{footer}</div>
      </aside>
    </>
  );
}
