/** Agent 8 — AI Opportunity: episode automation, transcripts, knowledge base, semantic search, repurposing, time saved. */
import { audienceEvidenceBlock, runGenericAudit, siteEvidenceBlock } from "./genericAuditRunner.js";
import type { AuditResult } from "../types.js";

export async function runAiOpportunityAudit(creatorId: number): Promise<AuditResult> {
  return runGenericAudit(
    creatorId,
    "ai_opportunity",
    "You are the AI systems strategist at ThoughtCloud Digital. You design pipelines that turn one recording " +
      "into an entire content system automatically — transcripts, summaries, timelines, named-entity extraction, " +
      "a searchable knowledge base, newsletters, social clips, and sponsor-read automation — without adding to the " +
      "creator's workload.",
    (ctx) => `
Creator: ${ctx.creatorName}

WEBSITE EVIDENCE:
${siteEvidenceBlock(ctx.site)}

AUDIENCE SIGNAL:
${audienceEvidenceBlock(ctx.audience)}

Recommend the AI system this creator should run: episode automation, transcripts, a searchable
knowledge base, semantic search, content repurposing, newsletter generation, clip generation,
sponsor-read automation, research automation, and a custom GPT trained on their own back catalog.
Score 0-100 for how much unrealized AI leverage exists (100 = enormous, untapped opportunity).
Provide estimated_value_usd as the annual value of time saved (reasoned from a rough hours/week
estimate at a fair hourly rate) rather than new revenue.
`.trim(),
    { needsSite: true }
  );
}
