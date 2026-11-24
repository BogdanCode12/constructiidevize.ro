import Link from "next/link";
import { SiteShell } from "@/components/site/shell";
import { Faq } from "@/components/site/faq";
import { getSettings } from "@/lib/settings";
import { getPlans } from "@/lib/plans";
import { getPage } from "@/lib/pages";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: "01", title: "Încarci documentația", text: "Caietul de sarcini, fișa de date și lista de cantități (F3), din PDF, Word sau Excel." },
  { n: "02", title: "Devizul se construiește din bază", text: "Articolele se potrivesc automat cu rețetele și resursele tale. Asistentul completează doar ce lipsește." },
  { n: "03", title: "Verifici și ajustezi", text: "Vezi ce e sigur și ce e de verificat, simulezi prețul și profitul, stabilești graficul." },
  { n: "04", title: "Exporți dosarul complet", text: "Devize F1–F5 și C5–C9 în Excel, declarații în Word și documentele firmei, într-o arhivă." },
];

const SERVICES = [
  { id: "devize", title: "Devize și formulare", text: "Capitole, articole și resurse cu norme și prețuri. Recapitulație, F1–F5, C5–C9, export Excel cu formule." },
  { id: "devize", title: "Import F3 automat", text: "Lista de cantități din Excel devine deviz în câteva secunde, potrivită cu baza ta de rețete." },
  { id: "ai", title: "Asistent tehnic pentru licitații", text: "Extrage cerințele din caietul de sarcini, verifică eligibilitatea și ce lipsește, pregătește clarificări." },
  { id: "documente", title: "Dosar și declarații", text: "Dosarul permanent al firmei cu alerte de expirare și declarații completate automat în Word." },
  { id: "devize", title: "Manoperă, grafic, profit", text: "Ore-om și durată pe capitole, grafic Gantt, simulator de preț și calculator de profit." },
  { id: "santier", title: "Șantier și situații de lucrări", text: "Situații lunare față de contract, încasări și cheltuieli, subcontractanți, jurnal cu poze." },
];

export default async function HomePage() {
  const [{ trial_days }, plans, hero, faq] = await Promise.all([getSettings(), getPlans(), getPage("acasa"), getPage("intrebari-frecvente")]);
  const from = plans.length ? Math.min(...plans.map((p) => p.monthly)) : null;

  return (
    <SiteShell>
      {/* HERO — fundal: clădirea din schiță în clădire finisată (public/brand/hero-building.webp) */}
      <section className="relative isolate overflow-hidden bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/hero-building.webp" srcSet="/brand/hero-building-960.webp 960w, /brand/hero-building.webp 1672w"
          sizes="(min-width: 1024px) 75vw, 100vw" alt="" aria-hidden fetchPriority="high"
          className="hero-zoom pointer-events-none absolute top-0 right-0 -z-10 hidden h-full w-[76%] object-cover object-center lg:block" />
        {/* pe ecrane mari: textul stă pe alb, iar clădirea se pierde treptat în fundal */}
        <div className="pointer-events-none absolute inset-0 -z-10 hidden bg-[linear-gradient(90deg,#fff_0%,#fff_30%,rgba(255,255,255,.86)_46%,rgba(255,255,255,0)_70%)] lg:block" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 hidden h-40 bg-gradient-to-t from-white to-transparent lg:block" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-6 sm:px-6 sm:pt-14 lg:min-h-[720px] lg:grid-cols-[1.05fr_1fr] lg:pt-16 lg:pb-20">
          <div className="animate-rise">
            <h1 className="text-[2.1rem] leading-[1.08] font-semibold tracking-[-0.03em] text-ink sm:text-5xl lg:text-[3.7rem]">
              {hero?.title ?? "Devize corecte. Dosare complete. Lucrări sub control."}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:mt-6 sm:text-lg">{hero?.body}</p>
            <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
              <Link href="/inregistrare" className="rounded-lg bg-brand-700 px-6 py-3.5 text-center font-semibold text-white shadow-[0_10px_30px_-10px_rgba(199,19,25,.6)] transition hover:bg-brand-800">
                Începe gratuit {trial_days} zile
              </Link>
              <Link href="/servicii" className="rounded-lg border border-ink/15 bg-white px-6 py-3.5 text-center font-semibold text-ink transition hover:border-ink/40">
                Vezi serviciile
              </Link>
            </div>
            <ul className="mt-7 grid max-w-xl gap-2 text-sm text-muted sm:mt-8 sm:grid-cols-2">
              {["Fără card la înscriere", "Excel cu formule verificabile", "Formulare F1–F5 și C5–C9", "Datele firmei din ANAF, automat"].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check /> {t}</li>
              ))}
            </ul>
          </div>
          {/* pe telefon și tabletă: clădirea întreagă, sub text, ieșind lin din alb */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/hero-building-960.webp" alt="" aria-hidden
            className="-mx-4 w-[calc(100%+2rem)] max-w-none object-cover sm:-mx-6 sm:w-[calc(100%+3rem)] lg:hidden [mask-image:linear-gradient(180deg,transparent_0%,#000_22%,#000_80%,transparent_100%)]" />
        </div>
      </section>

      {/* FAPTE */}
      <section className="border-y-2 border-ink/15 bg-white">
        <div className="mx-auto grid max-w-7xl divide-y-2 divide-ink/10 px-4 sm:px-6 md:grid-cols-4 md:divide-x-2 md:divide-y-0">
          {[
            ["crane", "F1–F5 · C5–C9", "formularele cerute la licitațiile publice"],
            ["", "Import F3", "din Excel sau lipit, potrivit automat cu baza ta"],
            ["", "Asistent tehnic", "citește caiete de sarcini și contracte"],
            ["building", "Export complet", "Excel, Word și arhivă ZIP a dosarului"],
          ].map(([icon, a, b]) => (
            <div key={a} className="flex items-start gap-4 py-7 md:px-8 md:first:pl-0">
              {icon && (
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-ink/15 text-ink">
                  {icon === "crane" ? <CraneIcon /> : <BuildingIcon />}
                </span>
              )}
              <div>
                <div className="text-xl font-semibold text-ink">{a}</div>
                <div className="mt-1 text-sm text-muted">{b}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CUM FUNCȚIONEAZĂ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <SectionTitle eyebrow="Cum funcționează" title="De la documentație la ofertă, în patru pași" />
        <ol className="mt-14 grid gap-8 md:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="relative border-t-2 border-ink pt-6">
              <span className="absolute -top-[2px] left-0 h-[2px] w-10 bg-brand-700" />
              <div className="text-sm font-semibold text-brand-700">{s.n}</div>
              <h3 className="mt-2 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* SERVICII */}
      <section className="bg-canvas py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionTitle eyebrow="Servicii" title="Tot ce îți trebuie pentru ofertare și execuție" />
            <Link href="/servicii" className="font-semibold text-ink underline decoration-brand-700 decoration-2 underline-offset-4 hover:text-brand-700">Toate serviciile →</Link>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Link key={s.title} href={`/servicii#${s.id}`} className="group bg-white p-7 transition hover:bg-white/60">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-muted transition group-hover:translate-x-1 group-hover:text-brand-700">→</span>
                </div>
                <h3 className="mt-6 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* DEVIZ DIN BAZĂ */}
      <section className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28 [&>*]:min-w-0">
        <div>
          <SectionTitle eyebrow="Diferența DevizBuild" title="Devizul vine din baza ta de date, nu din ghicit" />
          <p className="mt-6 text-lg leading-relaxed text-muted">
            Fiecare articol importat se caută întâi în rețetele firmei și în catalogul platformei. Ce se găsește sigur intră direct în deviz, ce seamănă e marcat pentru verificare, iar asistentul tehnic completează doar restul, căutând tot în baza de date.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              ["Prețurile tale", "Resursele și rețetele firmei au prioritate; prețurile se actualizează din catalog."],
              ["Verificabil", "Vezi pentru fiecare articol de unde vine și cât de sigură e potrivirea."],
              ["Din ce în ce mai rapid", "Fiecare articol aprobat devine rețetă și e recunoscut automat data viitoare."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-4">
                <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-ink text-white"><Check light /></span>
                <div><div className="font-semibold">{t}</div><div className="text-muted">{d}</div></div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-white p-2 shadow-[0_30px_80px_-40px_rgba(0,0,0,.35)]">
          <div className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3 text-sm">
            <span className="font-semibold">Import F3 · Lot 2 — Corp B</span>
            <span className="text-muted">exemplu · 184 articole</span>
          </div>
          <ul className="divide-y divide-line text-sm">
            {[
              ["✓", "text-ink", "Zidărie din blocuri ceramice 25 cm", "mc", "Rețeta firmei"],
              ["✓", "text-ink", "Beton C25/30 în fundații", "mc", "Rețeta firmei"],
              ["!", "text-amber-600", "Beton clasa C25/30 turnat în fundații continue", "mc", "Propus · 70% asemănare"],
              ["✓", "text-ink", "Armături din oțel PC52", "kg", "Catalog platformă"],
              ["✦", "text-brand-700", "Termoizolație cu vată bazaltică 15 cm", "mp", "Completat de asistent din bază"],
            ].map(([icon, color, name, um, src]) => (
              <li key={name} className="flex items-center gap-3 px-4 py-3">
                <span className={`grid size-6 shrink-0 place-items-center rounded-full bg-canvas font-semibold ${color}`}>{icon}</span>
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <span className="w-8 text-muted">{um}</span>
                <span className={`hidden w-44 text-right text-xs sm:block ${color}`}>{src}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-3 gap-2 p-2 text-center text-sm">
            <div className="rounded-lg bg-canvas py-3"><div className="text-2xl font-semibold">158</div><div className="text-xs text-muted">potrivite sigur</div></div>
            <div className="rounded-lg bg-canvas py-3"><div className="text-2xl font-semibold text-amber-600">13</div><div className="text-xs text-muted">de verificat</div></div>
            <div className="rounded-lg bg-canvas py-3"><div className="text-2xl font-semibold text-brand-700">13</div><div className="text-xs text-muted">completate de asistent</div></div>
          </div>
        </div>
      </section>

      {/* DE LA OFERTĂ LA ȘANTIER */}
      <section className="bg-ink py-20 text-white lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionTitle eyebrow="Un singur loc" title="De la ofertă la ultima situație de lucrări" dark />
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              ["Ofertare", ["Deviz pe capitole și articole", "Simulator de preț și profit", "Verificări automate ale devizului"]],
              ["Licitație", ["Analiza automată a caietului de sarcini", "Declarații și formulare în Word", "Dosar complet într-o arhivă"]],
              ["Execuție", ["Situații de lucrări lunare", "Încasări, cheltuieli și profit real", "Jurnal de șantier cu poze"]],
            ].map(([t, items]) => (
              <div key={t as string} className="border-t border-white/15 pt-6">
                <h3 className="text-2xl font-semibold">{t}</h3>
                <ul className="mt-4 space-y-2.5 text-white/70">
                  {(items as string[]).map((i) => <li key={i} className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-600" />{i}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PREȚURI + FAQ */}
      <section className="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:py-28">
        <div>
          <SectionTitle eyebrow="Prețuri" title="Simplu, lunar sau anual" />
          <p className="mt-6 text-lg text-muted">
            {trial_days} zile gratuit, fără card.{from !== null && <> Abonamentele pornesc de la <b className="text-ink">{from} lei/lună</b> + TVA.</>}
          </p>
          <Link href="/preturi" className="mt-8 inline-block rounded-lg bg-ink px-6 py-3.5 font-semibold text-white hover:bg-black">Vezi planurile</Link>
        </div>
        {faq && <Faq markdown={faq.body} />}
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-brand-700 px-8 py-14 text-white sm:px-14">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff14_1px,transparent_1px),linear-gradient(to_bottom,#ffffff14_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="relative flex flex-wrap items-center justify-between gap-8">
            <div>
              <h2 className="text-3xl font-semibold sm:text-4xl">Pregătește următoarea ofertă în DevizBuild.</h2>
              <p className="mt-3 text-white/80">Cont gratuit în mai puțin de un minut.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/inregistrare" className="rounded-lg bg-white px-6 py-3.5 font-semibold text-ink hover:bg-white/90">Creează cont gratuit</Link>
              <Link href="/contact" className="rounded-lg border border-white/40 px-6 py-3.5 font-semibold text-white hover:bg-white/10">Vorbește cu noi</Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function SectionTitle({ eyebrow, title, dark }: { eyebrow: string; title: string; dark?: boolean }) {
  return (
    <div className="max-w-2xl">
      <p className={`text-sm font-semibold tracking-wider uppercase ${dark ? "text-brand-500" : "text-brand-700"}`}>{eyebrow}</p>
      <h2 className={`mt-3 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
    </div>
  );
}

function Check({ light }: { light?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-4 shrink-0 ${light ? "text-white" : "text-brand-700"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}

/** Macara turn (simbol de șantier). */
function CraneIcon() {
  return (
    <svg viewBox="0 0 32 32" className="size-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 29V7M13 29V7M9 11l4 4M13 11l-4 4M9 17l4 4M13 17l-4 4M9 23l4 4M13 23l-4 4" />
      <path d="M3 7h27M9 7l2-4 2 4M11 3l15 4M11 3L5 7" />
      <path d="M24 7v9" />
      <path d="M21.5 16h5v3.5h-5z" fill="#c71319" stroke="#c71319" />
      <path d="M3 7v3h4V7M6 29h10" />
    </svg>
  );
}

/** Clădire în construcție, cu schelă. */
function BuildingIcon() {
  return (
    <svg viewBox="0 0 32 32" className="size-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 29V11l9-6 9 6v18" />
      <path d="M3 29h26" />
      <path d="M9 15h3v3H9zM16 15h3v3h-3zM9 21h3v3H9z" />
      <path d="M16 21h3v8h-3z" fill="#c71319" stroke="#c71319" />
      <path d="M26 29V13M29 29V13M26 17h3M26 22h3M24 13h6" />
    </svg>
  );
}
