import Link from "next/link";
import { Logo } from "@/components/logo";
import { AdminNav } from "@/components/admin-nav";
import { AdminMobileMenu } from "@/components/admin-mobile-menu";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Panoul de admin: fundal negru, meniul complet într-o bară fixă în stânga (pe telefon: buton „Meniu”). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="admin-dark min-h-dvh overflow-x-hidden lg:pl-72">
      {/* telefon / tabletă */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0c0c0d] px-4 py-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Logo href="/admin" light className="h-6" />
          <span className="rounded bg-brand-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">ADMIN</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/panou" className="hidden text-sm font-semibold text-white/80 hover:text-white sm:inline">← Aplicație</Link>
          <AdminMobileMenu />
        </div>
      </header>

      {/* bara din stânga */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-white/10 bg-[#0c0c0d] lg:flex">
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

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
