/**
 * One-time data fix: before commit ceaeb91, Agent 13 (CRM) wrote status="contacted" the
 * moment outreach drafts were generated, even though nothing had actually been sent. That
 * bug is fixed for new writes, but rows created before the fix still have the stale value
 * sitting in the database. Since there is currently no UI action that sets status to
 * "contacted" (that's built later, for when a human actually marks it), every row with that
 * value today is guaranteed to be the bug, not a real contact event — safe to backfill once.
 *
 * Deliberately NOT part of schema.sql: that file re-runs on every server boot, and once a
 * real "mark as contacted" feature exists, re-running this blindly would silently revert
 * genuine status changes back to drafts_ready forever.
 *
 * Usage: npm run fix-crm-status
 */
import "dotenv/config";
import { pool } from "../db/client.js";

async function main() {
  const res = await pool.query(
    `UPDATE crm SET status = 'drafts_ready', updated_at = now() WHERE status = 'contacted'`
  );
  console.log(`Updated ${res.rowCount} row(s) from 'contacted' to 'drafts_ready'.`);
}

main()
  .catch((err) => {
    console.error("Fix failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
