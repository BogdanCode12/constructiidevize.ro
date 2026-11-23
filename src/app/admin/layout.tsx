import Link from "next/link";
import { Logo } from "@/components/logo";
import { AdminNav } from "@/components/admin-nav";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-4 sm:px-8">
          <div className="flex items-center gap-3"><Logo href="/admin" /><span className="rounded bg-ink px-2 py-0.5 text-xs font-semibold text-white">ADMIN</span></div>
          <Link href="/panou" className="text-sm font-semibold text-brand-700 hover:underline">Înapoi în aplicație</Link>
        </div>
        <div className="mx-auto max-w-6xl px-4 pt-2 sm:px-8"><AdminNav /></div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
