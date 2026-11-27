/** Județele României (cod auto) grupate pe regiunile de dezvoltare — pentru prețurile pe zone. */
export const REGIONS = {
  NE: "Nord-Est", SE: "Sud-Est", SM: "Sud-Muntenia", SV: "Sud-Vest Oltenia",
  V: "Vest", NV: "Nord-Vest", C: "Centru", BI: "București-Ilfov",
} as const;
export type RegionCode = keyof typeof REGIONS;

export const COUNTIES: { code: string; name: string; region: RegionCode }[] = [
  { code: "AB", name: "Alba", region: "C" }, { code: "AR", name: "Arad", region: "V" }, { code: "AG", name: "Argeș", region: "SM" },
  { code: "BC", name: "Bacău", region: "NE" }, { code: "BH", name: "Bihor", region: "NV" }, { code: "BN", name: "Bistrița-Năsăud", region: "NV" },
  { code: "BT", name: "Botoșani", region: "NE" }, { code: "BR", name: "Brăila", region: "SE" }, { code: "BV", name: "Brașov", region: "C" },
  { code: "B", name: "București", region: "BI" }, { code: "BZ", name: "Buzău", region: "SE" }, { code: "CL", name: "Călărași", region: "SM" },
  { code: "CS", name: "Caraș-Severin", region: "V" }, { code: "CJ", name: "Cluj", region: "NV" }, { code: "CT", name: "Constanța", region: "SE" },
  { code: "CV", name: "Covasna", region: "C" }, { code: "DB", name: "Dâmbovița", region: "SM" }, { code: "DJ", name: "Dolj", region: "SV" },
  { code: "GL", name: "Galați", region: "SE" }, { code: "GR", name: "Giurgiu", region: "SM" }, { code: "GJ", name: "Gorj", region: "SV" },
  { code: "HR", name: "Harghita", region: "C" }, { code: "HD", name: "Hunedoara", region: "V" }, { code: "IL", name: "Ialomița", region: "SM" },
  { code: "IS", name: "Iași", region: "NE" }, { code: "IF", name: "Ilfov", region: "BI" }, { code: "MM", name: "Maramureș", region: "NV" },
  { code: "MH", name: "Mehedinți", region: "SV" }, { code: "MS", name: "Mureș", region: "C" }, { code: "NT", name: "Neamț", region: "NE" },
  { code: "OT", name: "Olt", region: "SV" }, { code: "PH", name: "Prahova", region: "SM" }, { code: "SJ", name: "Sălaj", region: "NV" },
  { code: "SM", name: "Satu Mare", region: "NV" }, { code: "SB", name: "Sibiu", region: "C" }, { code: "SV", name: "Suceava", region: "NE" },
  { code: "TR", name: "Teleorman", region: "SM" }, { code: "TM", name: "Timiș", region: "V" }, { code: "TL", name: "Tulcea", region: "SE" },
  { code: "VL", name: "Vâlcea", region: "SV" }, { code: "VS", name: "Vaslui", region: "NE" }, { code: "VN", name: "Vrancea", region: "SE" },
];

const BY_CODE = new Map(COUNTIES.map((c) => [c.code, c]));
export const isCounty = (code: string | null | undefined): code is string => !!code && BY_CODE.has(code);
export const countyName = (code: string | null | undefined) => (code && BY_CODE.get(code)?.name) || null;
export const regionOf = (code: string | null | undefined) => (code ? BY_CODE.get(code)?.region ?? null : null);
export const regionName = (code: string | null | undefined) => { const r = regionOf(code); return r ? REGIONS[r] : null; };
/** Județele din aceeași regiune de dezvoltare (inclusiv cel dat). */
export const regionCounties = (code: string) => { const r = regionOf(code); return r ? COUNTIES.filter((c) => c.region === r).map((c) => c.code) : [code]; };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^(judetul|jud\.?|municipiul|mun\.?)\s+/, "").replace(/[^a-z]/g, "");
/** Recunoaște un județ după cod („BZ”) sau nume („Buzău”, „JUD. BUZAU”, „Municipiul București”). */
export function parseCounty(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim();
  const up = t.toUpperCase();
  if (BY_CODE.has(up)) return up;
  const n = norm(t);
  if (!n) return null;
  if (n.startsWith("bucuresti") || n.startsWith("sector")) return "B";
  return COUNTIES.find((c) => norm(c.name) === n)?.code ?? COUNTIES.find((c) => n.includes(norm(c.name)))?.code ?? null;
}

/** Eticheta zonei unei oferte: județul sau „toată țara”. */
export const zoneLabel = (code: string | null | undefined) => countyName(code) ?? "toată țara";

/** Eticheta sursei prețului aplicat: al cui e prețul și pentru ce zonă (ex: „prețul tău · Buzău”, „catalog · Brăila”). */
export function priceOriginLabel(p: { kind: "propriu" | "zona" | "referinta"; county: string | null } | null | undefined): string {
  if (!p) return "fără preț";
  const where = p.county ? countyName(p.county) : null;
  if (p.kind === "propriu") return where ? `prețul tău · ${where}` : "prețul tău";
  if (p.kind === "zona") return `catalog · ${where ?? "zonă"}`;
  return where ? `referință · ${where}` : "referință națională";
}
