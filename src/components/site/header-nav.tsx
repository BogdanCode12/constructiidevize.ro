"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "../logo";

export const NAV = [
  { href: "/", label: "Acasă" },
  { href: "/servicii", label: "Servicii" },
  { href: "/abonamente", label: "Abonamente" },
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
    // Meniu plutitor: bară desprinsă de margini, rămâne sus la derulare
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className={`mx-auto max-w-7xl rounded-2xl border bg-white/90 backdrop-blur-xl transition-shadow duration-300 ${
        scrolled ? "border-line shadow-[0_12px_40px_-12px_rgba(0,0,0,.25)]" : "border-line/70 shadow-[0_8px_30px_-14px_rgba(0,0,0,.18)]"
      }`}>
        <div className="grid h-16 grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-5 lg:h-[72px] lg:grid-cols-[1fr_auto_1fr]">
          <Logo className="h-7 sm:h-8" />
          <nav className="hidden items-center justify-center gap-1 lg:flex" aria-label="Meniu principal">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}
                className={`relative rounded-md px-4 py-2 text-[15px] font-medium transition ${active(n.href) ? "text-ink" : "text-muted hover:text-ink"}`}>
                {n.label}
                {active(n.href) && <span className="absolute inset-x-4 -bottom-1 h-0.5 rounded bg-brand-700" />}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center justify-end gap-2 lg:flex">
            {user ? (
              <Link href="/panou" className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black">
                Contul meu
              </Link>
            ) : (
              <>
                <Link href="/autentificare" className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-ink/30">Autentificare</Link>
                <Link href="/inregistrare" className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800">
                  Creează cont gratuit
                </Link>
              </>
            )}
          </div>
          <button onClick={() => setOpen(!open)} className="col-start-3 justify-self-end rounded-lg p-2 lg:hidden" aria-label="Deschide meniul" aria-expanded={open}>
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
        {open && (
          <div className="border-t border-line px-4 pt-2 pb-4 lg:hidden">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={`block rounded-lg px-3 py-3 text-base font-medium ${active(n.href) ? "bg-canvas text-ink" : "text-muted"}`}>{n.label}</Link>
            ))}
            <div className="mt-3 grid gap-2">
              {user ? (
                <Link href="/panou" className="rounded-xl bg-ink px-4 py-3 text-center font-semibold text-white">Contul meu</Link>
              ) : (
                <>
                  <Link href="/autentificare" className="rounded-xl border border-line px-4 py-3 text-center font-semibold">Autentificare</Link>
                  <Link href="/inregistrare" className="rounded-xl bg-brand-700 px-4 py-3 text-center font-semibold text-white">Creează cont gratuit</Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
