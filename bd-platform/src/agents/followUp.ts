/**
 * Agent 14 — Follow Up (EMAIL_3, EMAIL_4, EMAIL_5 in the outreach spec)
 *
 * Generates the 7/21/60-day follow-up drafts up front (at outreach time) so they're ready
 * for review on schedule rather than written reactively. Each is a fresh Claude call with a
 * different approach so the three never read as the same email restated:
 *   EMAIL_3 (day 7)  -- light check-in, no new content
 *   EMAIL_4 (day 21) -- adds value: one more genuine, specific observation
 *   EMAIL_5 (day 60) -- graceful exit, easy out, door left open
 *
 * (EMAIL_2 -- the reply sent after a creator responds positively -- isn't generated here since
 * it needs to react to what they actually said; that's a manual "generate reply" action once
 * inbound replies are tracked, not something to pre-write blind.)
 */
import { getCreator, latestOpportunityScore, latestRelationshipTrigger, saveFollowUp } from "../db/repo.js";
import { textCall } from "../lib/claude.js";
import {
  PROHIBITED_PHRASES,
  SENTENCE_STYLE_RULES,
  INTEGRITY_RULES,
  scanForViolations,
} from "../lib/writingStyle.js";

const STAGES: { dayOffset: 7 | 21 | 60; approach: string }[] = [
  {
    dayOffset: 7,
    approach:
      "Light, brief check-in. Assume they're busy, not uninterested. Reference the original outreach without repeating it. One or two sentences. No new observation needed.",
  },
  {
    dayOffset: 21,
    approach:
      "Add value: one more genuine, specific reaction to something they made -- an opinion or question about the substance, never a strategic observation about their content or audience. Three sentences max.",
  },
  {
    dayOffset: 60,
    approach:
      "Graceful exit. Explicitly give them an easy out ('no worries if the timing isn't right'). Leave the door open without chasing. Low pressure, final note.",
  },
];

export interface FollowUpOutcome {
  dayOffset: number;
  scheduledDate: string;
  body: string;
}

export async function runFollowUpScheduler(
  creatorId: number,
  originalEmailBody: string
): Promise<FollowUpOutcome[]> {
  const creator = await getCreator(creatorId);
  if (!creator) throw new Error(`Creator ${creatorId} not found`);
  const score = await latestOpportunityScore(creatorId);
  const trigger = await latestRelationshipTrigger(creatorId);

  const outcomes: FollowUpOutcome[] = [];

  for (const stage of STAGES) {
    const body = await textCall({
      system: `
You are Andy, a thoughtful business owner sending a short follow-up -- not an SDR, not a
copywriter, not an AI. The recipient should never feel like they're in a marketing sequence.

HONESTY RULES -- these matter more than style, check them first:
${INTEGRITY_RULES}

PROHIBITED PHRASES -- never write any of these or close variants:
${PROHIBITED_PHRASES}

${SENTENCE_STYLE_RULES}

The original outreach offered to send over thoughts/notes Andy wrote about one specific piece of
content${trigger?.trigger_found ? ` (and mentioned: ${trigger.trigger_label})` : ""} -- keep that
same pretext and the same single angle (${trigger?.angle ?? "the same topic as the original"}).
End with exactly one low-key permission-close question ("worth sending over?" / "still interested?")
-- never ask for a meeting or call, nothing after the question.

Before finalizing, check every sentence against the honesty rules first, then the prohibited
phrases and the 15-word sentence limit. Rewrite anything that violates any of them.
`.trim(),
      prompt: `
Creator: ${creator.name}
Opportunity score: ${score ? `${score.overall_score}/100 (${score.priority} priority)` : "unscored"}
Original outreach email:
"""
${originalEmailBody}
"""

Write the day-${stage.dayOffset} follow-up. Approach: ${stage.approach}
Return only the message body, no subject line.
`.trim(),
      maxTokens: 300,
    });

    // Same deterministic backstop as Agent 12 -- prose instructions alone weren't reliably
    // catching terms like "plan" in production. One targeted correction pass if needed.
    let finalBody = body;
    const violations = scanForViolations({ body });
    if (violations.length > 0) {
      finalBody = await textCall({
        system:
          "You are a strict corrector. Rewrite ONLY the sentence(s) containing the banned " +
          "terms listed below so those terms (and close synonyms in the same category) no " +
          "longer appear. Keep every other sentence exactly as it is.",
        prompt: `Message:\n${body}\n\nBanned terms found (must not appear in your output):\n${violations.map((v) => `- "${v.term}"`).join("\n")}\n\nReturn the corrected message only.`,
        maxTokens: 300,
      });
    }

    const scheduledDate = addDays(new Date(), stage.dayOffset).toISOString().slice(0, 10);
    await saveFollowUp(creatorId, stage.dayOffset, scheduledDate, finalBody);
    outcomes.push({ dayOffset: stage.dayOffset, scheduledDate, body: finalBody });
  }

  return outcomes;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
