import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — the PostgreSQL database is required.");
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}

let initialized: Promise<void> | null = null;

export function initDb(): Promise<void> {
  if (!initialized) {
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
    initialized = pool.query(schema).then(() => undefined);
  }
  return initialized;
}
