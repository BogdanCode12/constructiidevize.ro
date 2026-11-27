import Link from "next/link";
import { InstallAppButton } from "@/components/pwa";
import { Logo } from "@/components/logo";
import { Icon } from "@/components/icon";
import { Sidebar } from "@/components/sidebar";
import { requireUser } from "@/lib/auth/session";
import { ACCOUNT_LINKS, MODULES } from "@/lib/modules";
import { planLabel } from "@/lib/plans";
import { logoutAction, } from "./actions";
import { changeUnverifiedEmailAction, resendVerificationAction, resendVerificationFormAction } from "../(auth)/actions";
import { mailConfigured } from "@/lib/email";
import { VerifyGate } from "@/components/verify-gate";

export const dynamic = "force-dynamic";

function daysLeft(d: Date | null): number | null {
  if (!d) return null;
  return Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400_000));
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Cu e-mailul configurat, contul se folosește doar după confirmarea adresei (adminul platformei e scutit).
  if (!user.emailVerified && mailConfigured() && user.role !== "admin") {
    return (
      <div className="min-h-dvh bg-white px-4">
        <div className="mx-auto max-w-6xl pt-6"><Logo href="/" /></div>
        <VerifyGate email={user.email} resend={resendVerificationFormAction} change={changeUnverifiedEmailAction} logout={logoutAction} />
      </div>
    );
  }
  const sub = user.company;
  const trialDays = sub?.plan === "trial" ? daysLeft(sub.trialEndsAt) : null;

  const main = MODULES.map((m) => ({
    href: m.slug ? `/panou/${m.slug}` : "/panou",
    label: m.label,
    icon: m.icon,
    soon: !m.ready,
  }));
  const account = [
    ...ACCOUNT_LINKS.map((a) => ({ href: `/panou/${a.slug}`, label: a.label, icon: a.icon })),
    ...(user.role === "admin" ? [{ href: "/admin", label: "Admin platformă", icon: "shield" }] : []),
  ];

  const footer = (
    <div className="space-y-3">
      <InstallAppButton />
      {sub && (
        <Link href="/panou/abonament" className="block rounded-lg bg-canvas px-3 py-2.5 text-sm hover:bg-brand-50">
          <div className="flex items-center justify-between">
            <span className="text-muted">Plan</span>
            <span className="font-semibold text-brand-800">{await planLabel(sub.plan)}</span>
          </div>
          {trialDays !== null && (
            <div className="mt-1 text-xs text-muted">{trialDays > 0 ? `${trialDays} zile rămase` : "Perioada de probă a expirat"}</div>
          )}
        </Link>
      )}
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 font-semibold text-brand-800">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <div className="truncate font-semibold">{user.name}</div>
          <div className="truncate text-xs text-muted">{sub?.name}</div>
        </div>
        <form action={logoutAction}>
          <button title="Ieșire" className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink">
            <Icon name="logout" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
      <Sidebar main={main} account={account} footer={footer} header={<Logo href="/panou" />} />
      <main className="lg:pl-72">
        {!user.emailVerified && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent-500/30 bg-amber-50 px-6 py-2.5 text-sm">
            <span>Confirmă adresa <b>{user.email}</b> — ți-am trimis un link pe email.</span>
            <form action={resendVerificationAction}>
              <button className="font-semibold text-brand-700 hover:underline">Retrimite emailul</button>
            </form>
          </div>
        )}
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
