/**
 * Agent 11.5 — Relationship Intelligence
 *
 * Runs BEFORE the Outreach Writer. Answers "why this creator, why now, why us" from real
 * evidence only -- never invents a trigger. Most of the triggers a human might reach for
 * (book release, funding round, new employee, conference appearance) aren't detectable from
 * the data this system actually has (YouTube + a website fetch), so this agent only ever
 * claims two kinds of trigger, both independently verifiable:
 *
 *   1. Subscriber growth between two recorded snapshots -- computed in code, not by an LLM.
 *   2. Announcement-like language literally present in a real recent title or site text --
 *      detected by Claude, then verified against the source text before being trusted; if the
 *      "evidence" it returns isn't an actual substring of what we gave it, it's discarded.
 *
 * trigger_found = false is a normal, common, correct outcome -- not a failure. When there's no
 * real trigger, the Outreach Writer still has a legitimate reason to write (the personal
 * reaction to one real piece of content), it's just a quieter one.
 *
 * The angle (which ONE of the fixed angle list to lead with) is picked deterministically from
 * the opportunity score breakdown -- the single biggest real gap/fit, not an LLM guess.
 */
import {
  getCreator,
  latestOpportunityScore,
  latestAudit,
  snapshotHistory,
  saveRelationshipTrigger,
} from "../db/repo.js";
import { fetchSiteSnapshot } from "../lib/website.js";
import { fetchRecentVideoTitles } from "../lib/youtubeContent.js";
import { structuredCall } from "../lib/claude.js";

export const ANGLES = [
  "Audience Ownership",
  "Membership",
  "Merch",
  "Community",
  "Website",
  "AI",
  "Sponsors",
  "TopFan",
] as const;
export type Angle = (typeof ANGLES)[number];

export interface RelationshipIntel {
  triggerFound: boolean;
  triggerLabel: string | null;
  evidence: string | null;
  angle: Angle;
  whyNow: string;
}

export async function runRelationshipIntelligence(creatorId: number): Promise<RelationshipIntel> {
  const creator = await getCreator(creatorId);
  if (!creator) throw new Error(`Creator ${creatorId} not found`);

  const score = await latestOpportunityScore(creatorId);
  const history = await snapshotHistory(creatorId);
  const monetizationAudit = await latestAudit(creatorId, "monetization");
  const titles = await fetchRecentVideoTitles(creator.youtube_channel_id, 8);
  const site = creator.website ? await fetchSiteSnapshot(creator.website) : null;

  const breakdown = score ? JSON.parse(score.breakdown_json) : null;
  const angle = pickAngle(breakdown, monetizationAudit?.score);

  let trigger = detectGrowthTrigger(history);
  if (!trigger) {
    trigger = await detectAnnouncementTrigger(creator.name, titles, site?.bodyTextSample ?? "");
  }

  const whyNow = trigger
    ? `${trigger.label}: ${trigger.evidence}. Worth reaching out now around ${angle}.`
    : `No external trigger found -- lead with a genuine reaction to their recent work, angled toward ${angle}.`;

  await saveRelationshipTrigger(creatorId, {
    triggerFound: !!trigger,
    triggerLabel: trigger?.label,
    evidence: trigger?.evidence,
    angle,
    whyNow,
  });

  return {
    triggerFound: !!trigger,
    triggerLabel: trigger?.label ?? null,
    evidence: trigger?.evidence ?? null,
    angle,
    whyNow,
  };
}

// ---------- Angle picker (deterministic, no LLM) ----------

function pickAngle(
  breakdown: Record<string, number> | null,
  monetizationScore: number | undefined
): Angle {
  if (!breakdown) return "Audience Ownership"; // no score yet -- safest general angle
  const candidates: { angle: Angle; strength: number }[] = [
    { angle: "Audience Ownership", strength: 100 - breakdown.ownership },
    { angle: "Merch", strength: 100 - breakdown.merch },
    { angle: "Community", strength: 100 - breakdown.community },
    { angle: "Website", strength: 100 - breakdown.website },
    { angle: "Membership", strength: 100 - (breakdown.ownership + breakdown.community) / 2 },
    { angle: "AI", strength: breakdown.ai_opportunity },
    { angle: "TopFan", strength: breakdown.topfan_fit },
    { angle: "Sponsors", strength: 100 - (monetizationScore ?? 50) },
  ];
  candidates.sort((a, b) => b.strength - a.strength);
  return candidates[0].angle;
}

// ---------- Trigger 1: subscriber growth (deterministic) ----------

function detectGrowthTrigger(
  history: Array<{ subscribers: number | null; captured_at: string | Date }>
): { label: string; evidence: string } | null {
  const withSubs = history.filter((h) => h.subscribers != null) as Array<{
    subscribers: number;
    captured_at: string | Date;
  }>;
  if (withSubs.length < 2) return null;
  const earliest = withSubs[0];
  const latest = withSubs[withSubs.length - 1];
  if (earliest.subscribers <= 0) return null;
  const growthPct = ((latest.subscribers - earliest.subscribers) / earliest.subscribers) * 100;
  if (growthPct < 15) return null; // real but unremarkable growth -- not trigger-worthy
  return {
    label: "Rapid subscriber growth",
    evidence: `Subscribers went from ${earliest.subscribers.toLocaleString()} to ${latest.subscribers.toLocaleString()} (+${Math.round(growthPct)}%) across recorded snapshots.`,
  };
}

// ---------- Trigger 2: announcement language (LLM-detected, then verbatim-verified) ----------

async function detectAnnouncementTrigger(
  creatorName: string,
  titles: string[],
  siteText: string
): Promise<{ label: string; evidence: string } | null> {
  if (titles.length === 0 && !siteText) return null;

  const payload = await structuredCall<{
    trigger_found: boolean;
    trigger_label: string | null;
    evidence_quote: string | null;
  }>({
    system: `
You check real evidence for signs of a genuine business trigger -- something that would make
reaching out to this creator timely. Only report trigger_found=true if you can quote a literal,
verbatim excerpt from the evidence given as proof. Do not infer, guess, or assume a trigger type
that isn't explicitly stated in the text -- you have no way to know about funding rounds, book
deals, conference appearances, or new hires unless the text literally says so. Most of the time
there is no detectable trigger here, which is the correct and expected answer -- only real
platforms (merch launches, rebrands, milestones, membership launches, sponsor announcements) that
are explicitly named in a title or site line count.
`.trim(),
    prompt: `
Creator: ${creatorName}
Recent video titles: ${titles.length ? titles.join(" | ") : "(none)"}
Site text sample: """${siteText.slice(0, 1500) || "(none)"}"""

Is there a genuine, explicitly-stated trigger here? If yes, quote the exact text proving it.
`.trim(),
    schema: {
      type: "object",
      properties: {
        trigger_found: { type: "boolean" },
        trigger_label: { type: ["string", "null"] },
        evidence_quote: {
          type: ["string", "null"],
          description: "Must be a literal, verbatim substring of the titles or site text given -- not a paraphrase.",
        },
      },
      required: ["trigger_found", "trigger_label", "evidence_quote"],
    },
    toolName: "emit_trigger_check",
    maxTokens: 300,
  });

  if (!payload.trigger_found || !payload.evidence_quote) return null;

  // Honesty backstop: if the model's "verbatim" quote isn't actually a substring of what we
  // gave it, it hallucinated the evidence -- discard rather than trust it.
  const haystack = (titles.join(" | ") + " " + siteText).toLowerCase();
  if (!haystack.includes(payload.evidence_quote.toLowerCase().slice(0, 30))) return null;

  return {
    label: payload.trigger_label ?? "Notable announcement",
    evidence: payload.evidence_quote,
  };
}
