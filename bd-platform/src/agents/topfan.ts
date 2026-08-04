/**
 * Agent 9 — TopFan Evaluation
 *
 * TopFan is the infrastructure ThoughtCloud Digital implements — never the product being sold.
 * This agent scores fit (membership potential, app value, community, commerce, premium content,
 * push, events, livestreams, fan loyalty) and must explain WHY, in terms of what TopFan specifically
 * replaces or accelerates for this creator — not a generic pitch.
 */
import { audienceEvidenceBlock, runGenericAudit, siteEvidenceBlock } from "./genericAuditRunner.js";
import type { AuditResult } from "../types.js";

export async function runTopFanAudit(creatorId: number): Promise<AuditResult> {
  return runGenericAudit(
    creatorId,
    "topfan",
    "You evaluate creators for TopFan fit on behalf of ThoughtCloud Digital, which implements TopFan as " +
      "infrastructure — never sells it as the product. TopFan provides: a branded website, iOS app, Android app, " +
      "memberships, premium content, livestreams, merchandise, email, SMS, community, and fan management. " +
      "Score how much this creator's specific situation would benefit from that infrastructure, and explain WHY " +
      "in concrete terms tied to their audience and current gaps — not a generic feature list.",
    (ctx) => `
Creator: ${ctx.creatorName}

WEBSITE EVIDENCE:
${siteEvidenceBlock(ctx.site)}

AUDIENCE SIGNAL:
${audienceEvidenceBlock(ctx.audience)}

PRIOR AUDIT FINDINGS (ownership, community, merch — for context, don't repeat them verbatim):
${JSON.stringify(ctx.priorFindings, null, 2)}

Produce a 0-100 "TopFan Fit Score" covering: membership potential, app value, community, commerce,
premium content, push notifications, events, livestreams, and fan loyalty. Keep the summary itself
to ONE short sentence stating the headline fit — put the specific "why" (audience size, engagement,
the ownership/community gaps already found) into the findings instead, one fact per finding, not
crammed into a single run-on sentence. Findings should map roughly 1:1 to TopFan capabilities that
close a specific gap for this creator.
`.trim(),
    { needsSite: true, needsPriorAgents: ["ownership", "community", "merch"] }
  );
}
