/**
 * Shared runner for Agents 4-9 (Ownership, Merch, Monetization, Community, AI Opportunity,
 * TopFan). Each of those agents differs only in its system prompt and the evidence it hands
 * Claude — the schema, DB write, and error handling are identical, so it lives here once.
 */
import { getCreator, latestAudit, latestSnapshot, saveAudit } from "../db/repo.js";
import { fetchSiteSnapshot, type SiteSnapshot } from "../lib/website.js";
import { structuredCall } from "../lib/claude.js";
import { AUDIT_RESULT_SCHEMA } from "./schemas.js";
import type { AuditAgent, AuditResult } from "../types.js";

interface GenericAuditPayload {
  score: number;
  summary: string;
  findings: { label: string; detail: string }[];
  recommendations: { title: string; detail: string; estimated_impact?: string }[];
  estimated_value_usd?: number;
}

export interface AuditContext {
  creatorName: string;
  website: string | null;
  site: SiteSnapshot | null;
  audience: ReturnType<typeof latestSnapshot>;
  priorFindings: Record<string, unknown>;
}

export async function runGenericAudit(
  creatorId: number,
  agent: AuditAgent,
  systemPrompt: string,
  buildPrompt: (ctx: AuditContext) => string,
  opts: { needsSite?: boolean; needsPriorAgents?: AuditAgent[] } = {}
): Promise<AuditResult> {
  const creator = getCreator(creatorId);
  if (!creator) throw new Error(`Creator ${creatorId} not found`);

  const site =
    opts.needsSite !== false && creator.website
      ? await fetchSiteSnapshot(creator.website)
      : null;

  const priorFindings: Record<string, unknown> = {};
  for (const priorAgent of opts.needsPriorAgents ?? []) {
    const row = latestAudit(creatorId, priorAgent);
    if (row) priorFindings[priorAgent] = JSON.parse(row.findings_json || "[]");
  }

  const ctx: AuditContext = {
    creatorName: creator.name,
    website: creator.website,
    site,
    audience: latestSnapshot(creatorId),
    priorFindings,
  };

  const payload = await structuredCall<GenericAuditPayload>({
    system: systemPrompt,
    prompt: buildPrompt(ctx),
    schema: AUDIT_RESULT_SCHEMA,
    toolName: `emit_${agent}_audit`,
    maxTokens: 2200,
  });

  const result: AuditResult = {
    agent,
    score: payload.score,
    summary: payload.summary,
    findings: payload.findings,
    recommendations: payload.recommendations,
    estimated_value_usd: payload.estimated_value_usd,
    raw: { context_used: { hadSite: !!site, hadAudience: !!ctx.audience } },
  };

  saveAudit(creatorId, result);
  return result;
}

export function siteEvidenceBlock(site: SiteSnapshot | null): string {
  if (!site) return "No website on file — evaluate based on general category knowledge and say so explicitly.";
  if (site.error) return `Website failed to load ("${site.error}") — factor that in directly.`;
  return `
Nav links: ${site.navLinks.join(", ") || "(none)"}
Email capture detected: ${site.hasEmailCaptureForm}
Search detected: ${site.hasSearchInput}
Membership/premium language detected: ${site.hasPricingOrMembershipKeywords}
Store/shop/merch link detected: ${site.hasStoreOrShopLink}
Sponsor/advertise language detected: ${site.hasSponsorMention}
Community link (Discord/Locals/forum) detected: ${site.hasCommunityLink}
Body text sample:
"""
${site.bodyTextSample.slice(0, 2500) || "(none extracted)"}
"""`.trim();
}

export function audienceEvidenceBlock(audience: ReturnType<typeof latestSnapshot>): string {
  if (!audience) return "No audience intelligence snapshot yet.";
  return `Subscribers: ${audience.subscribers ?? "unknown"}, avg views: ${audience.avg_views ?? "unknown"}, posting frequency/wk: ${audience.posting_frequency_per_week ?? "unknown"}, engagement rate: ${audience.engagement_rate ?? "unknown"}, momentum score: ${audience.momentum_score ?? "unknown"}/100.`;
}
