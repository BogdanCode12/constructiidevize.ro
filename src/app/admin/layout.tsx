import Link from "next/link";
import { Logo } from "@/components/logo";
import { AdminNav } from "@/components/admin-nav";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Panoul de admin: fundal negru, meniul complet într-o bară fixă în dreapta (pe telefon: meniu orizontal sus). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="admin-dark min-h-dvh lg:pr-72">
      {/* telefon / tabletă */}
      <header className="border-b border-white/10 bg-[#0c0c0d] lg:hidden">
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="flex min-w-0 items-center gap-2"><Logo href="/admin" light className="h-6" /><span className="rounded bg-brand-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">ADMIN</span></div>
          <Link href="/panou" className="shrink-0 whitespace-nowrap text-sm font-semibold text-white/80 hover:text-white">← Aplicație</Link>
        </div>
        <div className="px-2 pt-2"><AdminNav /></div>
      </header>

      {/* bara din dreapta */}
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-72 flex-col border-l border-white/10 bg-[#0c0c0d] lg:flex">
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <Logo href="/admin" light className="h-7" />
          <span className="rounded bg-brand-700 px-2 py-0.5 text-[11px] font-semibold text-white">ADMIN</span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4"><AdminNav vertical /></div>
        <div className="border-t border-white/10 px-5 py-4 text-sm">
          <div className="truncate text-white/80">{admin.name}</div>
          <div className="truncate text-xs text-white/45">{admin.email}</div>
          <Link href="/panou" className="mt-3 inline-block font-semibold text-white hover:text-white/70">← Înapoi în aplicație</Link>
        </div>
      </aside>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
