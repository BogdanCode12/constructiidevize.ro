import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";

/**
 * Aplică fișierele noi din sql/ (001_…, 002_…), în ordine, o singură dată fiecare (evidența în schema_migrations).
 * Rulează automat la pornirea aplicației (src/instrumentation.ts), deci după fiecare publicare.
 */
export async function runMigrations(): Promise<string[]> {
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
    // Un singur proces aplică migrările, chiar dacă pornesc mai multe în același timp.
    const [lock] = await conn.query("SELECT GET_LOCK('devizbuild_migrations', 60) AS ok");
    if ((lock as { ok: number }[])[0]?.ok !== 1) throw new Error("Nu am obținut blocarea pentru migrări.");
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
    await conn.query("SELECT RELEASE_LOCK('devizbuild_migrations')");
    return applied;
  } finally {
    await conn.end();
  }
}
