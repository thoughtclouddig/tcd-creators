/**
 * Agent 13 — CRM
 *
 * Initializes/updates the CRM row for a creator once outreach exists to track. Status
 * transitions (contacted, replied, meeting_booked, ...) are driven by the dashboard/human
 * review, not by this agent — its job here is just to seed the row with a defensible
 * opportunity value and close probability so the pipeline view is never empty.
 */
import { ensureCrmRow, getCrm, latestOpportunityScore, updateCrm } from "../db/repo.js";

const PRIORITY_CLOSE_PROBABILITY: Record<string, number> = {
  High: 25,
  Medium: 12,
  Low: 5,
};

export function runCrmInit(creatorId: number) {
  ensureCrmRow(creatorId);
  const score = latestOpportunityScore(creatorId);
  if (score) {
    const opportunityValue = parseRevenueMidpoint(score.estimated_revenue_opportunity);
    updateCrm(creatorId, {
      status: "contacted",
      opportunity_value_usd: opportunityValue ?? undefined,
      close_probability_pct: PRIORITY_CLOSE_PROBABILITY[score.priority] ?? 10,
    });
  }
  return getCrm(creatorId);
}

function parseRevenueMidpoint(range: string): number | undefined {
  const matches = range.match(/\$(\d+(?:\.\d+)?)k/gi);
  if (!matches || matches.length === 0) return undefined;
  const nums = matches.map((m) => parseFloat(m.replace(/[$k]/gi, "")) * 1000);
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}
