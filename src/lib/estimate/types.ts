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

export type CatalogResource = {
  id: number;
  global: boolean;
  type: ResType;
  code: string | null;
  name: string;
  unit: string;
  price: number;
  notes: string | null;
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
  price: number;
};

export type EstItem = {
  key: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
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
  startDate: string | null;
  hoursPerDay: number;
  chapters: EstChapter[];
};
