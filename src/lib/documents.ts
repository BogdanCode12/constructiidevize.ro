export const DOC_CATEGORIES = {
  certificat: "Certificate (ISO, ANRE, ISC…)",
  autorizatie: "Autorizații și atestate",
  experienta: "Experiență similară",
  personal: "Personal și CV-uri",
  utilaj: "Utilaje și dotări",
  financiar: "Documente financiare",
  altele: "Altele",
} as const;

export type DocCategory = keyof typeof DOC_CATEGORIES;

export function expiryStatus(expires: Date | string | null): { label: string; tone: "ok" | "soon" | "expired" | "none"; days: number | null } {
  if (!expires) return { label: "fără expirare", tone: "none", days: null };
  const d = new Date(typeof expires === "string" ? `${expires.slice(0, 10)}T00:00:00` : expires);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400_000);
  if (days < 0) return { label: `expirat de ${-days} zile`, tone: "expired", days };
  if (days <= 30) return { label: days === 0 ? "expiră azi" : `expiră în ${days} zile`, tone: "soon", days };
  return { label: `valabil până la ${new Intl.DateTimeFormat("ro-RO").format(d)}`, tone: "ok", days };
}
