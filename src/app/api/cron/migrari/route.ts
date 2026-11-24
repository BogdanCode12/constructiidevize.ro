import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

/**
 * Aplică fișierele noi din sql/ (ca scripts/migrate.mjs). Apelat de GitHub Actions după fiecare publicare prin FTP:
 *   curl -X POST -H "Authorization: Bearer CRON_SECRET" https://domeniu.ro/api/cron/migrari
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Interzis", { status: 403 });

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
    multipleStatements: true,
  });
  const applied: string[] = [];
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(190) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const [rows] = await conn.query("SELECT name FROM schema_migrations");
    const done = new Set((rows as { name: string }[]).map((r) => r.name));
    const dir = join(process.cwd(), "sql");
    for (const file of readdirSync(dir).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort()) {
      if (done.has(file)) continue;
      await conn.query(readFileSync(join(dir, file), "utf8"));
      await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
      applied.push(file);
    }
    return Response.json({ ok: true, applied });
  } catch (err) {
    console.error("[migrari]", err);
    return Response.json({ ok: false, applied, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    await conn.end();
  }
}
