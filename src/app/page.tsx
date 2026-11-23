import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui";
import { Icon } from "@/components/icon";
import { TRIAL_DAYS } from "@/lib/plans";

const FEATURES = [
  { icon: "spark", title: "Citire planuri cu AI", text: "Încarci DTAC, PTh, PDF sau Excel și primești antemăsurătoarea și lista de lucrări." },
  { icon: "calc", title: "Devize complete", text: "Materiale, manoperă și utilaje, cu export în formularele F1–F3 și C5–C9." },
  { icon: "clock", title: "Manoperă și ore de regie", text: "Din norme afli câți oameni și câte zile îți trebuie, cu grafic de execuție." },
  { icon: "doc", title: "Caiet de sarcini și declarații", text: "Documentele pentru licitație, precompletate din datele firmei tale." },
  { icon: "megaphone", title: "Licitații publice", text: "Găsești licitațiile potrivite și pornești devizul direct din dosar." },
  { icon: "helmet", title: "Management de șantier", text: "Jurnal, pontaj și situații de lucrări lunare, comparate cu devizul." },
];

export default function HomePage() {
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2 text-sm font-medium sm:gap-5">
          <Link href="/preturi" className="hidden text-muted hover:text-ink sm:inline">Prețuri</Link>
          <Link href="/autentificare" className="text-muted hover:text-ink">Intră în cont</Link>
          <ButtonLink href="/inregistrare">Încearcă gratuit</ButtonLink>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 text-center sm:px-8">
        <p className="mx-auto w-fit rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">Pentru firme de construcții</p>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          De la planuri la deviz și dosarul de licitație, <span className="text-brand-700">în câteva minute</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          Devize, calcul de manoperă, caiet de sarcini, declarații și management de șantier — într-o singură platformă, cu asistent AI.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/inregistrare">Începe gratuit {TRIAL_DAYS} zile</ButtonLink>
          <ButtonLink href="/preturi" variant="ghost">Vezi prețurile</ButtonLink>
        </div>
      </section>

      <section className="bg-canvas py-20">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-white p-6">
              <span className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon name={f.icon} /></span>
              <h3 className="mt-4 font-bold">{f.title}</h3>
              <p className="mt-1.5 text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-4 py-10 text-sm text-muted sm:px-8">
        <span>© {new Date().getFullYear()} ConstructiiDevize.ro</span>
        <span className="flex gap-5">
          <Link href="/termeni" className="hover:text-ink">Termeni</Link>
          <Link href="/confidentialitate" className="hover:text-ink">Confidențialitate</Link>
        </span>
      </footer>
    </div>
  );
}
