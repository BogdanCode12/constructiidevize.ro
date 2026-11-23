import Link from "next/link";

export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-bold tracking-tight">
      <span className="grid size-9 place-items-center rounded-lg bg-brand-700 text-white">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />
        </svg>
      </span>
      <span className={light ? "text-white" : "text-ink"}>
        Constructii<span className="text-brand-600">Devize</span>
        <span className="text-muted font-normal">.ro</span>
      </span>
    </Link>
  );
}
