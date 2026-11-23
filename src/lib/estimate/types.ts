export type ResType = "material" | "manopera" | "utilaj" | "transport";

export const RES_TYPES: ResType[] = ["material", "manopera", "utilaj", "transport"];

export const RES_TYPE_LABEL: Record<ResType, string> = {
  material: "Material",
  manopera: "Manoperă",
  utilaj: "Utilaj",
  transport: "Transport",
};

export const RES_TYPE_PLURAL: Record<ResType, string> = {
  material: "Materiale",
  manopera: "Manoperă",
  utilaj: "Utilaje",
  transport: "Transport",
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

export type EstChapter = { key: string; name: string; items: EstItem[] };

export type EstimateDoc = {
  id: number;
  name: string;
  projectId: number;
  projectName: string;
  overheadPct: number;
  profitPct: number;
  vatPct: number;
  chapters: EstChapter[];
};
