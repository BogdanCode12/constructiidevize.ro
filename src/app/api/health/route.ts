import { readFileSync } from "node:fs";
import { join } from "node:path";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Versiunea care rulează (scrisă de GitHub Actions în BUILD_SHA; citită o dată, la pornire). */
const BUILD = (() => {
  try {
    return readFileSync(join(process.cwd(), "BUILD_SHA"), "utf8").trim();
  } catch {
    return "local";
  }
})();

/** Verificare rapidă după publicare: aplicația rulează, vede baza de date și ce versiune are. */
export async function GET() {
  try {
    await query("SELECT 1");
    const m = await query<{ n: number }>("SELECT COUNT(*) AS n FROM schema_migrations").catch(() => [{ n: 0 }]);
    return Response.json({ ok: true, db: true, build: BUILD, migrations: Number(m[0]?.n ?? 0), time: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false, db: false, build: BUILD }, { status: 503 });
  }
}
