import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. On Replit, open the Database pane to provision Postgres " +
      "(it injects DATABASE_URL automatically). Locally, add it to .env."
  );
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

// node-postgres emits 'error' on the pool whenever an idle client hits a network-level
// problem. Without a listener, that's an unhandled EventEmitter error and crashes the whole
// process — not just the request that was using it. Log and move on instead.
pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error (idle client):", err);
});

let initialized: Promise<void> | null = null;

/** Runs schema.sql (idempotent — every statement is CREATE ... IF NOT EXISTS). Call once before any query. */
export function ensureSchema(): Promise<void> {
  if (!initialized) {
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
    initialized = pool.query(schema).then(() => undefined);
  }
  return initialized;
}
