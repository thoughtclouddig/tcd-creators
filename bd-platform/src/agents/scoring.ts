/**
 * Agent 10 — Opportunity Scoring
 *
 * Deterministic (no LLM) — every input is already a stored score from Agents 2-9, so this
 * is pure aggregation. Kept as its own agent because it has its own single responsibility:
 * turn nine independent audits into one weighted number the business can prioritize on.
 *
 * The formula intentionally does NOT just reward "biggest audience". Opportunity = audience
 * worth pursuing (size, growth, loyalty) AND a large infrastructure gap (weak ownership/
 * merch/community/website = more room for ThoughtCloud to build), weighted toward our
 * specific offering (AI opportunity, TopFan fit).
 */
import {
  allLatestAudits,
  getCreator,
  latestSnapshot,
  saveOpportunityScore,
} from "../db/repo.js";
import type { OpportunityBreakdown } from "../types.js";

const WEIGHTS = {
  audience_size: 0.15,
  growth: 0.1,
  audience_loyalty: 0.1,
  infrastructure_quality: 0.1, // direct — a decent base makes everything else easier to execute
  merch: 0.1, // inverted — a gap here is opportunity
  ownership: 0.1, // inverted
  community: 0.1, // inverted
  website: 0.1, // inverted
  ai_opportunity: 0.1, // direct
  topfan_fit: 0.05, // direct
} as const;

export interface ScoringResult {
  overall_score: number;
  priority: "High" | "Medium" | "Low";
  topfan_fit_score: number;
  estimated_revenue_opportunity: string;
  breakdown: OpportunityBreakdown;
}

export function runOpportunityScoring(creatorId: number): ScoringResult {
  const creator = getCreator(creatorId);
  if (!creator) throw new Error(`Creator ${creatorId} not found`);

  const audits = allLatestAudits(creatorId);
  const byAgent = Object.fromEntries(audits.map((a) => [a.agent, a]));
  const snapshot = latestSnapshot(creatorId);

  const websiteScore = byAgent.website?.score ?? 50;
  const ownershipScore = byAgent.ownership?.score ?? 50;
  const merchScore = byAgent.merch?.score ?? 50;
  const communityScore = byAgent.community?.score ?? 50;
  const aiScore = byAgent.ai_opportunity?.score ?? 50;
  const topfanScore = byAgent.topfan?.score ?? 50;
  const monetizationScore = byAgent.monetization?.score ?? 50;

  const audienceSize = normalizeAudienceSize(snapshot?.subscribers ?? creator.subscribers ?? 0);
  const growth = normalizeGrowth(snapshot?.momentum_score ?? 50);
  const audienceLoyalty = normalizeEngagement(snapshot?.engagement_rate ?? undefined);
  const infrastructureQuality = average([
    websiteScore,
    ownershipScore,
    merchScore,
    communityScore,
  ]);

  const breakdown: OpportunityBreakdown = {
    audience_size: Math.round(audienceSize),
    growth: Math.round(growth),
    audience_loyalty: Math.round(audienceLoyalty),
    infrastructure_quality: Math.round(infrastructureQuality),
    merch: Math.round(merchScore),
    ownership: Math.round(ownershipScore),
    community: Math.round(communityScore),
    website: Math.round(websiteScore),
    ai_opportunity: Math.round(aiScore),
    topfan_fit: Math.round(topfanScore),
  };

  const overall =
    WEIGHTS.audience_size * audienceSize +
    WEIGHTS.growth * growth +
    WEIGHTS.audience_loyalty * audienceLoyalty +
    WEIGHTS.infrastructure_quality * infrastructureQuality +
    WEIGHTS.merch * (100 - merchScore) +
    WEIGHTS.ownership * (100 - ownershipScore) +
    WEIGHTS.community * (100 - communityScore) +
    WEIGHTS.website * (100 - websiteScore) +
    WEIGHTS.ai_opportunity * aiScore +
    WEIGHTS.topfan_fit * topfanScore;

  const overallScore = Math.round(clamp(overall, 0, 100));
  const priority: ScoringResult["priority"] =
    overallScore >= 75 ? "High" : overallScore >= 50 ? "Medium" : "Low";

  const revenueOpportunity = estimateRevenueRange([
    byAgent.merch?.estimated_value_usd,
    byAgent.monetization?.estimated_value_usd,
    byAgent.ai_opportunity?.estimated_value_usd,
  ]);

  saveOpportunityScore(
    creatorId,
    overallScore,
    priority,
    Math.round(topfanScore),
    revenueOpportunity,
    breakdown
  );

  return {
    overall_score: overallScore,
    priority,
    topfan_fit_score: Math.round(topfanScore),
    estimated_revenue_opportunity: revenueOpportunity,
    breakdown,
  };
}

function normalizeAudienceSize(subscribers: number): number {
  if (subscribers <= 0) return 20; // unknown-but-plausible floor, not zero — avoids punishing missing data
  return clamp(Math.log10(Math.max(subscribers, 1)) * 16.6, 0, 100); // 10 -> 16, 10k -> 66, 1M -> 100
}

function normalizeGrowth(momentumScore: number): number {
  return clamp(momentumScore, 0, 100);
}

function normalizeEngagement(engagementRate?: number): number {
  if (engagementRate == null) return 50;
  return clamp(engagementRate * 2000, 0, 100); // 5% engagement -> 100
}

function average(nums: number[]): number {
  const valid = nums.filter((n) => Number.isFinite(n));
  if (valid.length === 0) return 50;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function estimateRevenueRange(values: (number | undefined | null)[]): string {
  const nums = values.filter((v): v is number => typeof v === "number" && v > 0);
  if (nums.length === 0) return "Insufficient data — run monetization/merch/AI audits first";
  const total = nums.reduce((a, b) => a + b, 0);
  const low = Math.round((total * 0.7) / 1000) * 1000;
  const high = Math.round((total * 1.3) / 1000) * 1000;
  return `$${formatK(low)}–$${formatK(high)}/yr`;
}

function formatK(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return `${n}`;
}
