/** Agent 6 — Monetization: sponsors, affiliates, premium content, membership, courses, events, donations, ads. */
import { audienceEvidenceBlock, runGenericAudit, siteEvidenceBlock } from "./genericAuditRunner.js";
import type { AuditResult } from "../types.js";

export async function runMonetizationAudit(creatorId: number): Promise<AuditResult> {
  return runGenericAudit(
    creatorId,
    "monetization",
    "You are a monetization strategist at ThoughtCloud Digital for independent media creators. Survey every " +
      "revenue line a creator like this could realistically run — sponsors, affiliates, premium content, " +
      "membership, courses, events, books, donations, advertising, brand deals — and identify which are " +
      "present, which are missing, and which are the highest-leverage next additions.",
    (ctx) => `
Creator: ${ctx.creatorName}

WEBSITE EVIDENCE:
${siteEvidenceBlock(ctx.site)}

AUDIENCE SIGNAL:
${audienceEvidenceBlock(ctx.audience)}

Evaluate current and missing monetization lines: sponsors, affiliates, premium/paywalled content,
membership, courses, live events, books, donations, display advertising, and direct brand deals.
Score 0-100 for how fully the creator is monetizing relative to their audience size and engagement.
Provide estimated_value_usd as a realistic ADDITIONAL annual revenue figure from the highest-leverage
gaps, grounded in the audience numbers given — show your reasoning in the findings.
`.trim(),
    { needsSite: true }
  );
}
