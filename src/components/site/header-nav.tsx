"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "../logo";

export const NAV = [
  { href: "/", label: "Acasă" },
  { href: "/servicii", label: "Servicii" },
  { href: "/preturi", label: "Prețuri" },
  { href: "/contact", label: "Contact" },
];

export function HeaderNav({ user }: { user: { name: string } | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [path]);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <header className={`sticky top-0 z-40 bg-white/90 backdrop-blur transition-shadow ${scrolled ? "shadow-[0_1px_0_0_var(--color-line)]" : ""}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-6 lg:h-20">
        <Logo className="h-7 sm:h-8" />
        <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Meniu principal">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`relative rounded-md px-3.5 py-2 text-[15px] font-medium transition ${active(n.href) ? "text-ink" : "text-muted hover:text-ink"}`}>
              {n.label}
              {active(n.href) && <span className="absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded bg-brand-700" />}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {user ? (
            <Link href="/panou" className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black">
              Contul meu
            </Link>
          ) : (
            <>
              <Link href="/autentificare" className="rounded-lg px-4 py-2.5 text-sm font-semibold text-ink hover:bg-canvas">Autentificare</Link>
              <Link href="/inregistrare" className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800">
                Creează cont gratuit
              </Link>
            </>
          )}
        </div>
        <button onClick={() => setOpen(!open)} className="ml-auto rounded-lg p-2 lg:hidden" aria-label="Deschide meniul" aria-expanded={open}>
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
      {open && (
        <div className="border-t border-line bg-white px-4 pt-2 pb-5 lg:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`block rounded-lg px-3 py-3 text-base font-medium ${active(n.href) ? "bg-canvas text-ink" : "text-muted"}`}>{n.label}</Link>
          ))}
          <div className="mt-3 grid gap-2">
            {user ? (
              <Link href="/panou" className="rounded-lg bg-ink px-4 py-3 text-center font-semibold text-white">Contul meu</Link>
            ) : (
              <>
                <Link href="/autentificare" className="rounded-lg border border-line px-4 py-3 text-center font-semibold">Autentificare</Link>
                <Link href="/inregistrare" className="rounded-lg bg-brand-700 px-4 py-3 text-center font-semibold text-white">Creează cont gratuit</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
