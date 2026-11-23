// Aplică fișierele din sql/ (001_…, 002_…) care nu au fost încă rulate.
// Alternativ: le poți importa manual, în ordine, din phpMyAdmin.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { dbConfig, loadEnv } from "./_env.mjs";

loadEnv();
const dir = join(process.cwd(), "sql");
const conn = await mysql.createConnection({ ...dbConfig(), multipleStatements: true });

await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(190) NOT NULL PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

const [rows] = await conn.query("SELECT name FROM schema_migrations");
const done = new Set(rows.map((r) => r.name));
const files = readdirSync(dir).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();

let applied = 0;
for (const file of files) {
  if (done.has(file)) continue;
  process.stdout.write(`→ ${file} … `);
  await conn.query(readFileSync(join(dir, file), "utf8"));
  await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
  console.log("ok");
  applied++;
}
console.log(applied ? `${applied} migrări aplicate.` : "Baza de date este la zi.");
await conn.end();
