import dotenv from "dotenv";
import pg from "pg";
import { fileURLToPath } from "node:url";

dotenv.config({
  path:
    process.env.DOTENV_CONFIG_PATH ??
    fileURLToPath(new URL("../../../../.env", import.meta.url)),
});

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export async function closeDatabase() {
  await pool.end();
}
