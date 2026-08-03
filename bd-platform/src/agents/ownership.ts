/** Agent 4 — Audience Ownership: newsletter, SMS, push, app, CRM, member portal, platform dependency. */
import { audienceEvidenceBlock, runGenericAudit, siteEvidenceBlock } from "./genericAuditRunner.js";
import type { AuditResult } from "../types.js";

export async function runOwnershipAudit(creatorId: number): Promise<AuditResult> {
  return runGenericAudit(
    creatorId,
    "ownership",
    "You are a senior strategist at ThoughtCloud Digital, specializing in audience ownership — email, SMS, push, " +
      "apps, CRM, and member databases as a hedge against platform dependency. Score how much of this creator's " +
      "relationship with their audience is owned vs. rented. Frame gaps as opportunity, never as failure.",
    (ctx) => `
Creator: ${ctx.creatorName}

WEBSITE EVIDENCE:
${siteEvidenceBlock(ctx.site)}

AUDIENCE SIGNAL:
${audienceEvidenceBlock(ctx.audience)}

Evaluate audience ownership: newsletter/email capture, SMS, push notifications, a branded app, a
CRM/member database, and a member portal. Produce a 0-100 "Audience Ownership Score" where 100 means
the creator could lose every platform tomorrow and still reach their full audience directly. Explain
the platform-dependency risk concretely (not generically) based on what you can see.
`.trim(),
    { needsSite: true }
  );
}
