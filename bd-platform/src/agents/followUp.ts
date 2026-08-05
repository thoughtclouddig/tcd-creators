/**
 * Agent 14 — Follow Up
 *
 * Generates the 7/21/60-day follow-up drafts up front (at outreach time) so they're ready
 * for review on schedule rather than written reactively. Each is a fresh Claude call with
 * a different angle so the three never read as the same email restated.
 */
import { getCreator, latestOpportunityScore, saveFollowUp } from "../db/repo.js";
import { textCall } from "../lib/claude.js";
import {
  BANNED_JARGON_CATEGORIES,
  SENTENCE_STYLE_RULES,
  INTEGRITY_RULES,
  scanForViolations,
} from "../lib/writingStyle.js";

const STAGES: { dayOffset: 7 | 21 | 60; angle: string }[] = [
  {
    dayOffset: 7,
    angle:
      "Light, brief check-in. Assume they're busy, not uninterested. Reference the original outreach without repeating it. One or two sentences.",
  },
  {
    dayOffset: 21,
    angle:
      "Mention one more genuine, specific reaction to something they made -- an opinion or question about the substance, never a strategic observation about their content or audience. Three sentences max.",
  },
  {
    dayOffset: 60,
    angle:
      "Final, low-pressure note. Explicitly give them an easy out ('no worries if the timing isn't right'). Leave the door open without chasing.",
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

  const outcomes: FollowUpOutcome[] = [];

  for (const stage of STAGES) {
    const body = await textCall({
      system: `
You are Andy, sending a short follow-up. It must not read as AI-written or as marketing copy --
if a skeptical reader could tell an AI wrote it, you have failed. No "just following up", no "I
wanted to circle back", no throat-clearing openers, no vague temporal scene-setters ("Been
following your recent run", "Circling back on your recent episode"). Open directly on the actual
point, never on a sentence about having been aware of them in general.

HONESTY RULES -- these matter more than style, check them first:
${INTEGRITY_RULES}

BANNED WORDS AND PHRASES, BY CATEGORY:
${BANNED_JARGON_CATEGORIES}

${SENTENCE_STYLE_RULES}

The original outreach offered to send over notes Andy wrote about one specific episode -- keep
that same pretext. End with exactly one low-key question about sending those notes over -- nothing
after it, no "let me know if you have questions."

Before finalizing, check every sentence against the honesty rules first, then the banned list and
the 15-word limit. Rewrite anything that violates any of them.
`.trim(),
      prompt: `
Creator: ${creator.name}
Opportunity score: ${score ? `${score.overall_score}/100 (${score.priority} priority)` : "unscored"}
Original outreach email:
"""
${originalEmailBody}
"""

Write the day-${stage.dayOffset} follow-up. Angle: ${stage.angle}
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
