import Link from "next/link";
import { SiteShell } from "@/components/site/shell";

export const metadata = { title: "Servicii", description: "Devize F1–F5 și C5–C9, import F3, asistent tehnic pentru licitații, dosar și declarații, management de șantier." };

const SECTIONS = [
  {
    id: "devize",
    eyebrow: "Devize",
    title: "Devize complete, cu formulele la vedere",
    text: "Construiești devizul pe capitole și articole, fiecare articol desfăcut pe materiale, manoperă, utilaje, transport și echipamente, cu norme și prețuri. Totalurile se calculează pe loc, iar la export primești formularele cerute la licitații.",
    points: [
      "Recapitulație cu cheltuieli indirecte, profit și TVA, cu procente editabile",
      "Export Excel cu formule reale: analize de preț → F3 → F2 → recapitulație",
      "Formularele F1–F5 și listele de consumuri C5–C9",
      "Import F3 din Excel sau lipit, potrivit automat cu rețetele firmei",
      "Verificări automate: cantități sau prețuri lipsă, dubluri, unități diferite",
      "Simulator de preț și profit, calcul de manoperă și grafic Gantt",
    ],
  },
  {
    id: "ai",
    eyebrow: "Asistent tehnic",
    title: "Un asistent care citește documentația pentru tine",
    text: "Încarci caietul de sarcini, fișa de date sau contractul, iar asistentul extrage cerințele, verifică ce lipsește din dosarul firmei și pregătește ciorne. Lucrează în limba română și indică sursa fiecărei informații.",
    points: [
      "Analiza caietului de sarcini: calificare, cerințe tehnice, documente, termene, riscuri",
      "Verificarea documentației și a eligibilității firmei",
      "Compararea versiunilor după clarificări sau erate",
      "Întrebări de clarificare pentru SEAP, argumentate",
      "Ciorne de propunere tehnică, plan SSM și plan al calității",
      "Analiza contractului: penalități, garanții, termene de plată",
      "Completarea devizului din baza de date, cu consum redus",
    ],
  },
  {
    id: "documente",
    eyebrow: "Dosar de licitație",
    title: "Dosarul firmei, mereu la zi",
    text: "Certificatele, autorizațiile, experiența similară, CV-urile și lista de utilaje stau într-un singur loc. Primești alertă înainte să expire ceva, iar declarațiile se completează automat cu datele firmei și ale ofertei.",
    points: [
      "Datele firmei preluate din ANAF după CUI",
      "Documente pe categorii, cu dată de expirare și alerte pe e-mail",
      "Declarații și formulare generate în Word",
      "Termene de depunere și clarificări pe fiecare proiect",
      "Dosar complet descărcat ca arhivă ZIP, cu cuprins",
    ],
  },
  {
    id: "santier",
    eyebrow: "Șantier",
    title: "După câștig, aceeași platformă urmărește execuția",
    text: "Devizul de contract devine baza situațiilor de lucrări. Introduci doar cantitățile executate, iar valorile, cumulatele și progresul se calculează singure. Vezi în orice moment cât ai încasat, cât ai cheltuit și cât câștigi.",
    points: [
      "Situații de lucrări lunare, cu cantități anterioare și cumulate",
      "Depășirile față de contract sunt semnalate",
      "Încasări și cheltuieli pe categorii, comparate cu devizul",
      "Subcontractanți, lucrări atribuite și plăți",
      "Jurnal de șantier zilnic, cu poze făcute de pe telefon",
    ],
  },
  {
    id: "echipa",
    eyebrow: "Echipă",
    title: "Toată echipa, în același proiect",
    text: "Inginerul, ofertantul și contabilul lucrează în contul firmei, fiecare cu rolul lui. Toate acțiunile importante rămân în jurnalul de activitate.",
    points: ["Invitații pe e-mail, roluri de administrator sau membru", "Mai multe firme pe același cont", "Jurnal de activitate", "Export și ștergere a datelor, oricând"],
  },
];

export default function ServicesPage() {
  return (
    <SiteShell>
      <section className="border-b border-line">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <p className="text-sm font-semibold tracking-wider text-brand-700 uppercase">Servicii</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Instrumente pentru fiecare etapă a unei lucrări
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">De la primul deviz până la ultima situație de lucrări. Alege din cuprins sau parcurge toată pagina.</p>
          <nav className="mt-10 flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-ink">{s.eyebrow}</a>
            ))}
          </nav>
        </div>
      </section>

      {SECTIONS.map((s, i) => (
        <section key={s.id} id={s.id} className={`scroll-mt-24 ${i % 2 ? "bg-canvas" : "bg-white"}`}>
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1fr] lg:py-24">
            <div>
              <p className="font-display text-sm font-semibold text-brand-700">{String(i + 1).padStart(2, "0")} — {s.eyebrow}</p>
              <h2 className="mt-3 font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{s.title}</h2>
              <p className="mt-5 text-lg leading-relaxed text-muted">{s.text}</p>
            </div>
            <ul className="grid content-start gap-3">
              {s.points.map((p) => (
                <li key={p} className="flex gap-4 rounded-xl border border-line bg-white px-5 py-4">
                  <span className="mt-0.5 h-5 w-1 shrink-0 rounded bg-brand-700" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <section className="bg-ink">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-8 px-4 py-14 sm:px-6">
          <h2 className="font-display text-3xl font-semibold text-white">Încearcă toate serviciile, gratuit.</h2>
          <div className="flex gap-3">
            <Link href="/inregistrare" className="rounded-lg bg-brand-700 px-6 py-3.5 font-semibold text-white hover:bg-brand-800">Creează cont</Link>
            <Link href="/preturi" className="rounded-lg border border-white/30 px-6 py-3.5 font-semibold text-white hover:bg-white/10">Prețuri</Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
