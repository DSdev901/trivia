import "./load-env.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
});

export async function migrate() {
  const sql = await readFile(path.join(ROOT, "schema.sql"), "utf8");
  await pool.query(sql);
}

export function query(text, params) {
  return pool.query(text, params);
}

export function end() {
  return pool.end();
}
