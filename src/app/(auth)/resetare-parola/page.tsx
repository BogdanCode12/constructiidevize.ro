import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { resetPasswordAction } from "../actions";

export const metadata = { title: "Parolă nouă", robots: { index: false, follow: true } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <p>
        Link invalid. <Link href="/parola-uitata" className="text-brand-700 underline">Cere un link nou</Link>.
      </p>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-bold">Setează o parolă nouă</h1>
      <p className="mt-1 mb-6 text-muted">Vei fi deconectat de pe toate dispozitivele.</p>
      <ActionForm action={resetPasswordAction} submitLabel="Salvează parola">
        <input type="hidden" name="token" value={token} />
        <Field label="Parolă nouă" name="password" type="password" autoComplete="new-password" hint="Minim 8 caractere." />
      </ActionForm>
    </>
  );
}
