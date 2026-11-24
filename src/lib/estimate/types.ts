export type ResType = "material" | "manopera" | "utilaj" | "transport" | "echipament";

export const RES_TYPES: ResType[] = ["material", "manopera", "utilaj", "transport", "echipament"];

/** Categoriile de construcții-montaj (C+M), pe care se aplică cheltuielile indirecte și profitul. */
export const CM_TYPES: ResType[] = ["material", "manopera", "utilaj", "transport"];

export const RES_TYPE_LABEL: Record<ResType, string> = {
  material: "Material",
  manopera: "Manoperă",
  utilaj: "Utilaj",
  transport: "Transport",
  echipament: "Echipament",
};

export const RES_TYPE_PLURAL: Record<ResType, string> = {
  material: "Materiale",
  manopera: "Manoperă",
  utilaj: "Utilaje",
  transport: "Transport",
  echipament: "Echipamente",
};

export type OverheadBase = "direct" | "manopera";
export type ProfitBase = "direct_indirecte" | "direct";
export type RoundingMode = "final" | "pret_unitar";
export const OVERHEAD_BASE_LABEL: Record<OverheadBase, string> = { direct: "% din costul direct C+M", manopera: "% din manoperă (inclusiv CAM)" };
export const PROFIT_BASE_LABEL: Record<ProfitBase, string> = { direct_indirecte: "% din direct + indirecte", direct: "% din costul direct" };
export const ROUNDING_LABEL: Record<RoundingMode, string> = {
  final: "Fără rotunjiri intermediare (doar la afișare)",
  pret_unitar: "Prețul unitar pe categorii rotunjit la 2 zecimale (ca în F3)",
};

export type ResStatus = "neverificat" | "verificat" | "inactiv";
export type TariffKind = "cost_salarial" | "echipa" | "comercial";
export type PriceSource = "manual" | "import" | "oferta_furnizor" | "negociat";

export const RES_STATUS_LABEL: Record<ResStatus, string> = { neverificat: "Neverificat", verificat: "Verificat", inactiv: "Inactiv" };
export const TARIFF_KIND_LABEL: Record<TariffKind, string> = {
  cost_salarial: "Cost salarial (fără CAM)",
  echipa: "Tarif de echipă",
  comercial: "Tarif comercial (include contribuțiile)",
};
export const PRICE_SOURCE_LABEL: Record<PriceSource, string> = {
  manual: "Introdus manual",
  import: "Import",
  oferta_furnizor: "Ofertă furnizor",
  negociat: "Preț negociat",
};

/** Grupurile din admin: „Materiale & Prețuri” și „Manoperă & Utilaje”. */
export const RES_GROUPS = {
  materiale: { label: "Materiale & Prețuri", types: ["material", "echipament"] as ResType[] },
  manopera: { label: "Manoperă & Utilaje", types: ["manopera", "utilaj", "transport"] as ResType[] },
};
export type ResGroup = keyof typeof RES_GROUPS;

/** Prețul folosit pentru o resursă (în lei, fără TVA) și de unde vine. */
export type ResPrice = {
  offerId: number | null;
  value: number;
  /** „propriu” = prețul negociat al firmei; „referinta” = oferta aleasă în catalog. */
  kind: "propriu" | "referinta";
  supplier: string | null;
  source: PriceSource | null;
  status: ResStatus | null;
  obtainedAt: string | null;
  validUntil: string | null;
  expired: boolean;
  transportIncluded: boolean | null;
};

export type CatalogResource = {
  id: number;
  global: boolean;
  type: ResType;
  category: string | null;
  code: string | null;
  name: string;
  unit: string;
  specs: string | null;
  producer: string | null;
  productCode: string | null;
  status: ResStatus;
  tariffKind: TariffKind | null;
  region: string | null;
  mobilizationCost: number | null;
  conditions: string | null;
  notes: string | null;
  /** Prețul aplicabil (propriu al firmei, altfel cel de referință). null = fără preț. */
  price: number | null;
  priceInfo: ResPrice | null;
};

export type PriceOffer = {
  id: number;
  resourceId: number;
  own: boolean;
  supplier: string | null;
  price: number;
  currency: string;
  exchangeRate: number;
  priceRon: number;
  source: PriceSource;
  documentUrl: string | null;
  obtainedAt: string;
  validUntil: string | null;
  expired: boolean;
  transportIncluded: boolean | null;
  minQty: number | null;
  status: ResStatus;
  notes: string | null;
  current: boolean;
  createdAt: string;
};

/** Resursă folosită într-un articol: consum (normă) pe unitatea articolului × preț unitar. */
export type EstResource = {
  key: string;
  resourceId: number | null;
  type: ResType;
  code: string;
  name: string;
  unit: string;
  norm: number;
  /** Pierderi tehnologice (%), separat de consum: consum efectiv = norm × (1 + waste/100). */
  waste: number;
  price: number;
  /** La manoperă: tipul tarifului (copiat din catalog). CAM se aplică doar pe „cost_salarial”. */
  tariffKind?: TariffKind | null;
  /** Oferta din catalog cu care a fost preluat prețul (pentru valabilitate / status). */
  offerId?: number | null;
  /** Preț introdus manual în deviz (nu se actualizează automat din catalog). */
  priceManual?: boolean;
};

export type F3Ref = { code: string; name: string; unit: string; quantity: number };

export type EstItem = {
  key: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  /** Formula cantității (ex. „30[lungime] × 0,40 × 0,80”); când există, cantitatea se calculează din ea. */
  qtyFormula?: string | null;
  /** Sursa dimensiunilor și ipotezele folosite. */
  qtyNote?: string | null;
  /** Cantitate estimată (date insuficiente) — necesită verificare. */
  qtyEstimated?: boolean;
  /** Datele originale din F3-ul autorității (la import); nu se modifică, servesc la verificare. */
  f3?: F3Ref | null;
  /** Notă „de verificat” pusă de import / AI; dispare când utilizatorul confirmă. */
  reviewNote: string | null;
  resources: EstResource[];
};

export type EstChapter = {
  key: string;
  name: string;
  /** Nr. de muncitori pe capitol (pentru durată / grafic). */
  teamSize: number;
  /** Ziua de început (de la începutul lucrării); null = imediat după capitolul anterior. */
  startDay: number | null;
  items: EstItem[];
};

export type EstimateDoc = {
  id: number;
  name: string;
  projectId: number;
  projectName: string;
  overheadPct: number;
  profitPct: number;
  vatPct: number;
  /** CAM (%), aplicat doar pe manopera cu tarif „cost salarial”. */
  camPct: number;
  /** Baza cheltuielilor indirecte: costul direct C+M sau doar manopera (+CAM). */
  overheadBase: OverheadBase;
  /** Baza profitului: direct + indirecte sau doar directul. */
  profitBase: ProfitBase;
  /** „final” = fără rotunjiri intermediare; „pret_unitar” = prețul unitar pe categorii rotunjit la 2 zecimale. */
  rounding: RoundingMode;
  /** Data regulilor (TVA, CAM, procente) cu care a fost creat devizul. */
  rulesDate: string | null;
  startDate: string | null;
  hoursPerDay: number;
  chapters: EstChapter[];
};
