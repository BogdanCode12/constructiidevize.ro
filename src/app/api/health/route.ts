import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Verificare rapidă după publicare: aplicația rulează și vede baza de date. */
export async function GET() {
  try {
    await query("SELECT 1");
    return Response.json({ ok: true, db: true, time: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false, db: false }, { status: 503 });
  }
}
