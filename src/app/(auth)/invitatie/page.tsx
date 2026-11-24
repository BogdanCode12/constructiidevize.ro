import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { findInvitation } from "@/lib/invitations";
import { acceptInvitationAction, registerFromInvitationAction } from "./actions";

export const metadata = { title: "Invitație", robots: { index: false, follow: true } };

export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const inv = await findInvitation(token);
  if (!inv) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Invitație invalidă</h1>
        <p className="mt-2 text-muted">Linkul a expirat sau a fost deja folosit. Cere o invitație nouă.</p>
      </div>
    );
  }
  const user = await getCurrentUser();
  const next = `/invitatie?token=${encodeURIComponent(token)}`;
  return (
    <>
      <h1 className="text-2xl font-bold">Ai fost invitat în {inv.company_name}</h1>
      <p className="mt-1 mb-6 text-muted">Invitația este pentru <b>{inv.email}</b>, ca {inv.role === "admin" ? "administrator" : "membru"}.</p>
      {user ? (
        user.email === inv.email ? (
          <form action={acceptInvitationAction}>
            <input type="hidden" name="token" value={token} />
            <button className="w-full rounded-lg bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800">Acceptă și intră în firmă</button>
          </form>
        ) : (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm">
            Ești autentificat ca {user.email}. Ieși din cont și deschide din nou linkul cu adresa {inv.email}.
          </p>
        )
      ) : (
        <>
          <ActionForm action={registerFromInvitationAction} submitLabel="Creează cont și intră">
            <input type="hidden" name="token" value={token} />
            <Field label="Nume și prenume" name="name" autoComplete="name" />
            <Field label="Parolă" name="password" type="password" autoComplete="new-password" hint="Minim 8 caractere." />
          </ActionForm>
          <p className="mt-6 text-center text-sm text-muted">
            Ai deja cont cu {inv.email}?{" "}
            <Link href={`/autentificare?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-700 hover:underline">Autentifică-te</Link>
          </p>
        </>
      )}
    </>
  );
}
