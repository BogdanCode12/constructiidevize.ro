import "server-only";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader } from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var __cdDbPool: Pool | undefined;
}

/** Pool unic de conexiuni MySQL/MariaDB (refolosit și la hot-reload în dev). */
export function pool(): Pool {
  if (!globalThis.__cdDbPool) {
    globalThis.__cdDbPool = mysql.createPool({
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectionLimit: 10,
      charset: "utf8mb4",
      timezone: "Z",
      waitForConnections: true,
    });
  }
  return globalThis.__cdDbPool;
}

type Params = unknown[];
type Conn = Pool | PoolConnection;

export async function query<T>(sql: string, params: Params = [], conn: Conn = pool()): Promise<T[]> {
  const [rows] = await conn.query(sql, params as never);
  return rows as T[];
}

export async function queryOne<T>(sql: string, params: Params = [], conn: Conn = pool()): Promise<T | null> {
  const rows = await query<T>(sql, params, conn);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: Params = [], conn: Conn = pool()): Promise<ResultSetHeader> {
  const [res] = await conn.query(sql, params as never);
  return res as ResultSetHeader;
}

export async function transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
