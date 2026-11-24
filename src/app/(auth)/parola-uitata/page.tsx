import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { forgotPasswordAction } from "../actions";

export const metadata = { title: "Parolă uitată", robots: { index: false, follow: true } };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Ai uitat parola?</h1>
      <p className="mt-1 mb-6 text-muted">Îți trimitem pe email un link pentru o parolă nouă.</p>
      <ActionForm action={forgotPasswordAction} submitLabel="Trimite linkul">
        <Field label="Email" name="email" type="email" autoComplete="email" />
      </ActionForm>
      <p className="mt-6 text-center text-sm">
        <Link href="/autentificare" className="text-brand-700 hover:underline">Înapoi la autentificare</Link>
      </p>
    </>
  );
}
