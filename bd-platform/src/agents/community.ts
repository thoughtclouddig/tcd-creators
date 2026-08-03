/** Agent 7 — Community: Discord, Locals, private forums, comments, member engagement, livestreams, events. */
import { audienceEvidenceBlock, runGenericAudit, siteEvidenceBlock } from "./genericAuditRunner.js";
import type { AuditResult } from "../types.js";

export async function runCommunityAudit(creatorId: number): Promise<AuditResult> {
  return runGenericAudit(
    creatorId,
    "community",
    "You are a community strategist at ThoughtCloud Digital. You evaluate whether a creator's audience has a " +
      "real place to gather and talk to each other — not just watch — and how alive that space actually is.",
    (ctx) => `
Creator: ${ctx.creatorName}

WEBSITE EVIDENCE:
${siteEvidenceBlock(ctx.site)}

AUDIENCE SIGNAL:
${audienceEvidenceBlock(ctx.audience)}

Evaluate community: Discord, Locals, private forums, comment culture, membership engagement,
livestreams, and in-person or virtual events. Produce a 0-100 "Community Quality Score" — weight
whether a real community EXISTS at all above how polished it is; a small, active Discord beats a
large, dead one.
`.trim(),
    { needsSite: true }
  );
}
