---
name: Postgres migration decisions
description: Why and how the app moved from SQLite to Replit PostgreSQL (Aug 2026)
---

- **Rule:** all database access is async through the `pg` Pool repo layer; every caller must `await`. Schema (`schema.sql`) is applied idempotently by `initDb()` at server/CLI startup — there is no separate migration step.
- **Why:** SQLite lived on the deployment filesystem and was wiped on every republish; the user explicitly chose Replit PostgreSQL so data persists.
- **How to apply:** new tables go in `schema.sql` with `CREATE TABLE IF NOT EXISTS`; timestamps come back from `pg` as JS `Date` objects (not strings) — don't do string `.startsWith()` date comparisons.
- Python 3.11 was only installed to compile better-sqlite3; it's no longer required but left in place (harmless).
