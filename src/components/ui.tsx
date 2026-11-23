import Link from "next/link";

export function Field({
  label, name, type = "text", required = true, autoComplete, placeholder, defaultValue, hint,
}: {
  label: string; name: string; type?: string; required?: boolean; autoComplete?: string;
  placeholder?: string; defaultValue?: string; hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        name={name} type={type} required={required} autoComplete={autoComplete}
        placeholder={placeholder} defaultValue={defaultValue}
        className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-100"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "ghost" }) {
  const cls =
    variant === "primary"
      ? "bg-brand-700 text-white hover:bg-brand-800"
      : "border border-line bg-white text-ink hover:border-brand-200";
  return (
    <Link href={href} className={`inline-flex items-center justify-center rounded-lg px-5 py-2.5 font-semibold transition ${cls}`}>
      {children}
    </Link>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border-2 border-ink/10 bg-white p-5 ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
