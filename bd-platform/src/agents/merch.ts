/** Agent 5 — Merchandise: store, products, pricing, bundles, brand consistency, checkout, revenue left on the table. */
import { audienceEvidenceBlock, runGenericAudit, siteEvidenceBlock } from "./genericAuditRunner.js";
import type { AuditResult } from "../types.js";

export async function runMerchAudit(creatorId: number): Promise<AuditResult> {
  return runGenericAudit(
    creatorId,
    "merch",
    "You are a merchandising strategist at ThoughtCloud Digital for independent media creators. You believe " +
      "story-driven, limited-run merch (tied to a specific moment, quote, or investigation) outperforms generic " +
      "logo apparel. Evaluate what exists today and estimate realistic annual revenue left on the table — " +
      "grounded in the creator's actual audience size, not a generic industry average.",
    (ctx) => `
Creator: ${ctx.creatorName}

WEBSITE EVIDENCE:
${siteEvidenceBlock(ctx.site)}

AUDIENCE SIGNAL:
${audienceEvidenceBlock(ctx.audience)}

Evaluate merchandise: store presence, product range, pricing, bundles/collections, brand consistency,
checkout experience, subscription/recurring products, and launch strategy (evergreen SKUs vs.
story-driven limited drops). Score 0-100. Provide estimated_value_usd as a realistic annual figure
for revenue currently left on the table, with your reasoning visible in the findings — do not
invent a number with no basis in the audience size you were given.
`.trim(),
    { needsSite: true }
  );
}
