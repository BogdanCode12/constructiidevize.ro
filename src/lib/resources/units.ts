import { normUnit } from "../estimate/normalize";

/**
 * Unitățile de măsură uzuale. La salvare se uniformizează doar scrierea (m3 → mc, ore → ora);
 * nu se face nicio conversie de valori (kg ↔ t), pentru că ar schimba prețul unitar.
 */
export const UNIT_SUGGESTIONS = ["mc", "mp", "ml", "kg", "t", "buc", "l", "ora", "zi", "km", "t·km", "cursa", "set", "100mp"];

const KNOWN = new Set(["mc", "mp", "ml", "kg", "t", "buc", "l", "ora", "km", "set", "100mp"]);
const EXTRA: Record<string, string> = {
  "t km": "t·km", "t.km": "t·km", "tkm": "t·km", "tona km": "t·km", "t·km": "t·km",
  cursa: "cursa", curse: "cursa", zi: "zi", zile: "zi",
};

export function normalizeUnit(raw: string): string {
  const s = raw.trim().slice(0, 20);
  if (!s) return "";
  const low = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
  if (EXTRA[low]) return EXTRA[low];
  const n = normUnit(s);
  return KNOWN.has(n) ? n : s;
}
