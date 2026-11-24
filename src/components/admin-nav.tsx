"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Platformă",
    links: [
      { href: "/admin", label: "Prezentare" },
      { href: "/admin/utilizatori", label: "Utilizatori" },
      { href: "/admin/planuri", label: "Planuri & prețuri" },
      { href: "/admin/mesaje", label: "Mesaje" },
    ],
  },
  {
    title: "Date tehnice",
    links: [
      { href: "/admin/resurse", label: "Materiale & Prețuri" },
      { href: "/admin/manopera", label: "Manoperă & Utilaje" },
      { href: "/admin/retete", label: "Articole & Norme" },
      { href: "/admin/reguli", label: "Reguli de calcul" },
    ],
  },
  {
    title: "Conținut",
    links: [
      { href: "/admin/sabloane", label: "Șabloane documente" },
      { href: "/admin/pagini", label: "Pagini" },
    ],
  },
  {
    title: "Sistem",
    links: [
      { href: "/admin/ai", label: "Asistent AI" },
      { href: "/admin/setari", label: "Setări" },
    ],
  },
];

const isActive = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

/** Meniul adminului: vertical (bara din dreapta, pe ecrane mari) sau orizontal (pe telefon). */
export function AdminNav({ vertical = false }: { vertical?: boolean }) {
  const path = usePathname();
  if (vertical) {
    return (
      <nav className="space-y-5">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">{g.title}</p>
            <ul className="space-y-0.5">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}
                    className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${isActive(path, l.href) ? "bg-brand-700 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    );
  }
  return (
    <nav className="flex gap-1 overflow-x-auto">
      {GROUPS.flatMap((g) => g.links).map((l) => (
        <Link key={l.href} href={l.href}
          className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${isActive(path, l.href) ? "border-brand-700 text-white" : "border-transparent text-white/60 hover:text-white"}`}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
