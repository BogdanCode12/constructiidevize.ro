"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Prezentare" },
  { href: "/admin/utilizatori", label: "Utilizatori" },
  { href: "/admin/planuri", label: "Planuri & prețuri" },
  { href: "/admin/resurse", label: "Catalog resurse" },
  { href: "/admin/retete", label: "Rețete" },
  { href: "/admin/sabloane", label: "Șabloane documente" },
  { href: "/admin/ai", label: "Asistent AI" },
  { href: "/admin/pagini", label: "Pagini" },
  { href: "/admin/setari", label: "Setări" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${active ? "border-brand-700 text-brand-800" : "border-transparent text-muted hover:text-ink"}`}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
