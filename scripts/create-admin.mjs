// Face administrator de platformă un utilizator deja înregistrat:  npm run admin:create -- email@exemplu.ro
import mysql from "mysql2/promise";
import { dbConfig, loadEnv } from "./_env.mjs";

loadEnv();
const email = (process.argv[2] ?? "").toLowerCase().trim();
if (!email) {
  console.error("Folosire: npm run admin:create -- email@exemplu.ro");
  process.exit(1);
}
const conn = await mysql.createConnection(dbConfig());
const [res] = await conn.query("UPDATE users SET role = 'admin' WHERE email = ?", [email]);
console.log(res.affectedRows ? `${email} este acum administrator.` : `Nu există niciun cont cu emailul ${email}.`);
await conn.end();
