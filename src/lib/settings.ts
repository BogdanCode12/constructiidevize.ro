import "server-only";
import { cache } from "react";
import { execute, query } from "./db";

export type Settings = {
  trial_days: number;
  default_overhead_pct: number;
  default_profit_pct: number;
  default_vat_pct: number;
  ai_monthly_requests: number;
  ai_price_input_per_mtok: number;
  ai_price_output_per_mtok: number;
};

export const SETTING_DEFAULTS: Settings = {
  trial_days: 14,
  default_overhead_pct: 10,
  default_profit_pct: 5,
  default_vat_pct: 21,
  ai_monthly_requests: 200,
  ai_price_input_per_mtok: 4,
  ai_price_output_per_mtok: 20,
};

export const SETTING_LABELS: Record<keyof Settings, string> = {
  trial_days: "Zile perioadă de probă (conturi noi)",
  default_overhead_pct: "Cheltuieli indirecte implicite (%)",
  default_profit_pct: "Profit implicit (%)",
  default_vat_pct: "TVA implicit (%)",
  ai_monthly_requests: "Cereri AI pe lună, per firmă",
  ai_price_input_per_mtok: "Preț AI intrare ($ / 1M tokeni) — pentru estimarea costului",
  ai_price_output_per_mtok: "Preț AI ieșire ($ / 1M tokeni) — pentru estimarea costului",
};

/** Setările platformei (editabile din /admin/setari). */
export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await query<{ key: string; value: string }>("SELECT `key`, `value` FROM settings");
  const out = { ...SETTING_DEFAULTS };
  for (const r of rows) {
    if (r.key in out && Number.isFinite(Number(r.value))) out[r.key as keyof Settings] = Number(r.value);
  }
  return out;
});

export async function saveSetting(key: keyof Settings, value: number): Promise<void> {
  await execute(
    "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
    [key, String(value)],
  );
}
