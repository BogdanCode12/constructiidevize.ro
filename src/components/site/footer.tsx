import Link from "next/link";
import { Logo } from "../logo";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink text-white/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo light className="h-8" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed">
            Platformă pentru firme de construcții din România: devize, dosare de licitație și urmărirea execuției, într-un singur loc.
          </p>
        </div>
        <FooterCol title="Platformă" links={[["/servicii", "Servicii"], ["/abonamente", "Abonamente"], ["/noutati", "Noutăți"], ["/inregistrare", "Creează cont"], ["/autentificare", "Autentificare"]]} />
        <FooterCol title="Servicii" links={[["/servicii#devize", "Devize F1–F5, C5–C9"], ["/servicii#ai", "Asistent tehnic"], ["/servicii#documente", "Dosar de licitație"], ["/servicii#santier", "Șantier"]]} />
        <FooterCol title="Companie" links={[["/contact", "Contact"], ["/termeni", "Termeni și condiții"], ["/confidentialitate", "Confidențialitate"]]} />
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-4 py-6 text-xs sm:px-6">
          <span>© {year} DevizConstruct.ro. Toate drepturile rezervate.</span>
          <span>Documentele generate se verifică de specialiști înainte de depunere.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([href, label]) => <li key={href}><Link href={href} className="transition hover:text-white">{label}</Link></li>)}
      </ul>
    </div>
  );
}
