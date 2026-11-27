import { COUNTIES } from "@/lib/counties";

/** Alegerea județului (zona de prețuri). Componentă server/client fără stare. */
export function CountySelect({ name = "county", label = "Județul lucrării", defaultValue, hint, emptyLabel = "— alege —" }: {
  name?: string; label?: string; defaultValue?: string | null; hint?: string; emptyLabel?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <select name={name} defaultValue={defaultValue ?? ""} className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-100">
        <option value="">{emptyLabel}</option>
        {COUNTIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
