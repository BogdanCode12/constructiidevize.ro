import { runMigrations } from "@/lib/migrate";

export const dynamic = "force-dynamic";

/**
 * Migrările rulează automat la pornirea aplicației (src/instrumentation.ts). Ruta rămâne pentru rulare manuală:
 *   curl -X POST -H "Authorization: Bearer CRON_SECRET" https://domeniu.ro/api/cron/migrari
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Interzis", { status: 403 });
  try {
    return Response.json({ ok: true, applied: await runMigrations() });
  } catch (err) {
    console.error("[migrari]", err);
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
