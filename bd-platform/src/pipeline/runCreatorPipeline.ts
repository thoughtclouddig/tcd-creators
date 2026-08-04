/**
 * Pipeline orchestrator — runs Agents 1-14 in sequence for one creator.
 *
 * Agents never call each other directly; they only read/write the DB (see src/types.ts).
 * This orchestrator is the only thing that knows the order they need to run in. Each step
 * is wrapped so one agent failing (e.g. a missing API key, a site that won't load) logs a
 * warning and the pipeline continues — later agents fall back to defaults rather than the
 * whole run aborting.
 */
import {
  finishPipelineRun,
  logPipelineStep,
  startPipelineRun,
} from "../db/repo.js";
import { runDiscovery } from "../agents/discovery.js";
import { runAudienceIntelligence } from "../agents/audienceIntelligence.js";
import { runWebsiteAuditor } from "../agents/websiteAuditor.js";
import { runOwnershipAudit } from "../agents/ownership.js";
import { runMerchAudit } from "../agents/merch.js";
import { runMonetizationAudit } from "../agents/monetization.js";
import { runCommunityAudit } from "../agents/community.js";
import { runAiOpportunityAudit } from "../agents/aiOpportunity.js";
import { runTopFanAudit } from "../agents/topfan.js";
import { runOpportunityScoring } from "../agents/scoring.js";
import { runProposalGenerator } from "../agents/proposal.js";
import { runOutreachWriter } from "../agents/outreach.js";
import { runCrmInit } from "../agents/crm.js";
import { runFollowUpScheduler } from "../agents/followUp.js";
import type { CreatorSeed } from "../types.js";

export interface PipelineResult {
  creatorId: number;
  runId: number;
  status: "completed" | "completed_with_warnings" | "failed";
  warnings: string[];
  proposalPath?: string;
}

/** Full pipeline for a brand-new creator: discovery/enrichment, then Agents 2-14. */
export async function runCreatorPipeline(seed: CreatorSeed): Promise<PipelineResult> {
  const { creator, warnings: discoveryWarnings } = await runDiscovery(seed);
  const result = await runFullAuditPipeline(creator.id);
  result.warnings.unshift(...discoveryWarnings.map((w) => `[discovery] ${w}`));
  return result;
}

/**
 * Agents 2-14 only, against a creator that's already in the DB (e.g. surfaced by the
 * discovery sweep, which stores cheap candidates without spending Claude calls on every
 * one). Lets a human pick which discovered creators are actually worth the full audit +
 * proposal + outreach treatment, rather than running it on everything a broad search finds.
 */
export async function runFullAuditPipeline(creatorId: number): Promise<PipelineResult> {
  const warnings: string[] = [];

  const runId = await startPipelineRun(creatorId);
  const step = async (label: string, fn: () => Promise<unknown> | unknown) => {
    try {
      await logPipelineStep(runId, `${label}: started`);
      await fn();
      await logPipelineStep(runId, `${label}: done`);
    } catch (err: any) {
      const msg = `${label} failed: ${err.message}`;
      warnings.push(msg);
      await logPipelineStep(runId, msg);
    }
  };

  await step("Agent 2 — Audience Intelligence", () => runAudienceIntelligence(creatorId));
  await step("Agent 3 — Website Auditor", () => runWebsiteAuditor(creatorId));
  await step("Agent 4 — Audience Ownership", () => runOwnershipAudit(creatorId));
  await step("Agent 5 — Merchandise", () => runMerchAudit(creatorId));
  await step("Agent 6 — Monetization", () => runMonetizationAudit(creatorId));
  await step("Agent 7 — Community", () => runCommunityAudit(creatorId));
  await step("Agent 8 — AI Opportunity", () => runAiOpportunityAudit(creatorId));
  await step("Agent 9 — TopFan Fit", () => runTopFanAudit(creatorId)); // after ownership/community/merch
  await step("Agent 10 — Opportunity Scoring", () => runOpportunityScoring(creatorId));

  let proposalPath: string | undefined;
  await step("Agent 11 — Executive Proposal", async () => {
    const outcome = await runProposalGenerator(creatorId);
    proposalPath = outcome.htmlPath;
  });

  let outreachEmailBody: string | undefined;
  await step("Agent 12 — Outreach Writer", async () => {
    const outcome = await runOutreachWriter(creatorId);
    outreachEmailBody = outcome.emailBody;
  });

  await step("Agent 13 — CRM Init", () => runCrmInit(creatorId));

  await step("Agent 14 — Follow-up Scheduler", async () => {
    if (outreachEmailBody) {
      await runFollowUpScheduler(creatorId, outreachEmailBody);
    } else {
      throw new Error("skipped — no outreach email body available");
    }
  });

  const status: PipelineResult["status"] =
    warnings.length === 0 ? "completed" : "completed_with_warnings";
  await finishPipelineRun(runId, warnings.length > 0 && !proposalPath ? "failed" : "completed");

  return { creatorId, runId, status, warnings, proposalPath };
}
