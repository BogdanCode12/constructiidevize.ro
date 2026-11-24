import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { loginAction } from "../actions";

export const metadata = { title: "Autentificare", robots: { index: false, follow: true } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; resetat?: string }> }) {
  if (await getCurrentUser()) redirect("/panou");
  const { next, resetat } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-bold">Intră în cont</h1>
      <p className="mt-1 mb-6 text-muted">Bine ai revenit.</p>
      {resetat && <p className="mb-4 rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">Parola a fost schimbată. Te poți autentifica.</p>}
      <ActionForm action={loginAction} submitLabel="Intră în cont">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Parolă" name="password" type="password" autoComplete="current-password" />
        <div className="text-right text-sm">
          <Link href="/parola-uitata" className="text-brand-700 hover:underline">Ai uitat parola?</Link>
        </div>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">
        Nu ai cont? <Link href="/inregistrare" className="font-semibold text-brand-700 hover:underline">Creează cont gratuit</Link>
      </p>
    </>
  );
}
