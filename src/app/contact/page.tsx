import { SiteShell } from "@/components/site/shell";
import { ActionForm } from "@/components/action-form";
import { Markdown } from "@/components/markdown";
import { getPage } from "@/lib/pages";
import { contactAction } from "./actions";

export const metadata = {
  title: "Contact",
  description: "Scrie-ne despre devize, licitații sau abonamente DevizConstruct.ro. Îți răspundem cât mai repede.",
  alternates: { canonical: "/contact" },
};
export const dynamic = "force-dynamic";

const input = "w-full rounded-lg border border-line bg-white px-4 py-3 outline-none transition focus:border-ink";

export default async function ContactPage() {
  const info = await getPage("contact");
  return (
    <SiteShell>
      <section className="mx-auto grid max-w-7xl gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:py-24">
        <div>
          <p className="text-sm font-semibold tracking-wider text-brand-700 uppercase">Contact</p>
          <h1 className="mt-3 font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">Hai să vorbim despre lucrările tale</h1>
          <p className="mt-5 text-lg text-muted">Vrei o demonstrație, ai o întrebare despre formulare sau despre import? Scrie-ne și revenim în cel mult o zi lucrătoare.</p>
          {info && <div className="mt-10 rounded-2xl border border-line bg-canvas p-6"><Markdown text={info.body} /></div>}
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-[0_30px_80px_-50px_rgba(0,0,0,.4)] sm:p-8">
          <ActionForm action={contactAction} submitLabel="Trimite mesajul" resetOnSuccess className="space-y-4 [&>button]:bg-ink [&>button]:py-3 [&>button]:hover:bg-black">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">Nume<input name="name" required autoComplete="name" className={`${input} mt-1.5`} /></label>
              <label className="block text-sm font-medium">E-mail<input name="email" type="email" required autoComplete="email" className={`${input} mt-1.5`} /></label>
              <label className="block text-sm font-medium">Firmă<input name="company" autoComplete="organization" className={`${input} mt-1.5`} /></label>
              <label className="block text-sm font-medium">Telefon<input name="phone" autoComplete="tel" className={`${input} mt-1.5`} /></label>
            </div>
            <label className="block text-sm font-medium">Mesaj<textarea name="message" required rows={6} className={`${input} mt-1.5`} placeholder="Cu ce te putem ajuta?" /></label>
            <p className="text-xs text-muted">Datele trimise se folosesc doar pentru a-ți răspunde. Detalii în politica de confidențialitate.</p>
          </ActionForm>
        </div>
      </section>
    </SiteShell>
  );
}
