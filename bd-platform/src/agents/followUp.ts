/**
 * Agent 14 — Follow Up
 *
 * Generates the 7/21/60-day follow-up drafts up front (at outreach time) so they're ready
 * for review on schedule rather than written reactively. Each is a fresh Claude call with
 * a different angle so the three never read as the same email restated.
 */
import { getCreator, latestOpportunityScore, saveFollowUp } from "../db/repo.js";
import { textCall } from "../lib/claude.js";

const STAGES: { dayOffset: 7 | 21 | 60; angle: string }[] = [
  {
    dayOffset: 7,
    angle:
      "Light, brief check-in. Assume they're busy, not uninterested. Reference the original outreach without repeating it. One or two sentences.",
  },
  {
    dayOffset: 21,
    angle:
      "Add new value — a specific observation, a relevant idea, or something timely about their recent content — rather than just 'following up'. Three sentences max.",
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
  const creator = getCreator(creatorId);
  if (!creator) throw new Error(`Creator ${creatorId} not found`);
  const score = latestOpportunityScore(creatorId);

  const outcomes: FollowUpOutcome[] = [];

  for (const stage of STAGES) {
    const body = await textCall({
      system:
        "You write follow-up outreach for ThoughtCloud Digital. No templates, no generic 'just following up' " +
        "openers, no hype. Grounded, specific, respectful of the recipient's time.",
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

    const scheduledDate = addDays(new Date(), stage.dayOffset).toISOString().slice(0, 10);
    saveFollowUp(creatorId, stage.dayOffset, scheduledDate, body);
    outcomes.push({ dayOffset: stage.dayOffset, scheduledDate, body });
  }

  return outcomes;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
