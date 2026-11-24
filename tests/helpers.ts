import type { EstimateDoc, EstItem, EstResource } from "../src/lib/estimate/types";

let n = 0;
export const res = (o: Partial<EstResource> & Pick<EstResource, "type" | "name">): EstResource => ({
  key: `r${++n}`, resourceId: null, code: "", unit: "buc", norm: 1, waste: 0, price: 0, tariffKind: null, ...o,
});
export const item = (o: Partial<EstItem> & Pick<EstItem, "name">): EstItem => ({
  key: `i${++n}`, code: "", unit: "mc", quantity: 1, reviewNote: null, resources: [], ...o,
});
export const doc = (items: EstItem[], o: Partial<EstimateDoc> = {}): EstimateDoc => ({
  id: 1, name: "Test", projectId: 1, projectName: "P", overheadPct: 10, profitPct: 5, vatPct: 21, camPct: 2.25,
  overheadBase: "direct", profitBase: "direct_indirecte", rounding: "final", rulesDate: null, startDate: null, hoursPerDay: 8,
  chapters: [{ key: "c1", name: "Capitol", teamSize: 2, startDay: null, items }],
  ...o,
});
export const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
