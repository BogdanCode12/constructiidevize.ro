import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { registerAction } from "../actions";

export const metadata = { title: "Creează cont" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/panou");
  const { trial_days } = await getSettings();
  return (
    <>
      <h1 className="text-2xl font-bold">Creează cont</h1>
      <p className="mt-1 mb-6 text-muted">{trial_days} zile gratuit, fără card.</p>
      <ActionForm action={registerAction} submitLabel="Creează cont">
        <Field label="Nume și prenume" name="name" autoComplete="name" />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        <Field label="Numele firmei" name="company" autoComplete="organization" placeholder="ex: SC Construct SRL" />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Parolă" name="password" type="password" autoComplete="new-password" hint="Minim 8 caractere." />
        <label className="flex items-start gap-2.5 text-sm text-muted">
          <input type="checkbox" name="terms" required className="mt-0.5 size-4 accent-brand-700" />
          <span>
            Sunt de acord cu <Link href="/termeni" className="text-brand-700 underline">termenii</Link> și{" "}
            <Link href="/confidentialitate" className="text-brand-700 underline">politica de confidențialitate</Link>.
          </span>
        </label>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">
        Ai deja cont? <Link href="/autentificare" className="font-semibold text-brand-700 hover:underline">Intră în cont</Link>
      </p>
    </>
  );
}
