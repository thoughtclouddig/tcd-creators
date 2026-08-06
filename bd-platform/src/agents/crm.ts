/**
 * Agent 13 — CRM
 *
 * Initializes/updates the CRM row for a creator once outreach drafts exist to track. This
 * agent NEVER marks a creator as contacted — nothing in this system sends anything. It seeds
 * status as "drafts_ready" (outreach copy exists and is waiting on human review/approval), and
 * every later transition (contacted, replied, meeting_booked, ...) only happens when a human
 * actually does that thing and updates it — never automatically.
 *
 * The pipeline runner catches and logs each agent's errors independently, so this step still
 * runs even if Agent 12 (Outreach Writer) failed above it -- only claim "drafts_ready" if
 * outreach rows actually made it to the DB, otherwise the status lies about what's ready.
 */
import { ensureCrmRow, getCrm, latestOpportunityScore, listOutreach, updateCrm } from "../db/repo.js";
import { STAGE_CLOSE_PROBABILITY } from "../lib/crmStages.js";

export async function runCrmInit(creatorId: number) {
  await ensureCrmRow(creatorId);
  const score = await latestOpportunityScore(creatorId);
  const outreach = await listOutreach(creatorId);
  if (score && outreach.length > 0) {
    const opportunityValue = parseRevenueMidpoint(score.estimated_revenue_opportunity);
    await updateCrm(creatorId, {
      status: "drafts_ready",
      opportunity_value_usd: opportunityValue ?? undefined,
      close_probability_pct: STAGE_CLOSE_PROBABILITY.drafts_ready,
    });
  }
  return await getCrm(creatorId);
}

function parseRevenueMidpoint(range: string): number | undefined {
  const matches = range.match(/\$(\d+(?:\.\d+)?)k/gi);
  if (!matches || matches.length === 0) return undefined;
  const nums = matches.map((m) => parseFloat(m.replace(/[$k]/gi, "")) * 1000);
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}
