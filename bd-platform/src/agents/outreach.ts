/**
 * Agent 12 — Outreach Writer
 *
 * Follows the MESSAGE_FRAMEWORK (personal connection -> reason for writing -> one observation
 * -> optional credibility -> permission close), one angle only, per the Relationship
 * Intelligence agent's output (Agent 11.5, which must run first and answers why this creator,
 * why now). No templates -- every message references something specific and real.
 *
 * Pipeline after the first draft: editor pass (style checklist) -> deterministic banned-term
 * scan + targeted correction (up to 2 passes) -> self-score against the quality rubric -> one
 * more targeted rewrite if any category scores below 9/10. Prose instructions alone weren't
 * reliable enough in production (specific banned terms and comparison phrasing kept slipping
 * through even when explicitly forbidden) -- the scan and self-score are real checks against
 * the actual generated text, not just more instructions hoping the model complies.
 */
import {
  getCreator,
  latestAudit,
  latestOpportunityScore,
  latestProposal,
  latestRelationshipTrigger,
  saveOutreach,
} from "../db/repo.js";
import { fetchSiteSnapshot } from "../lib/website.js";
import { fetchRecentVideoTitles } from "../lib/youtubeContent.js";
import { structuredCall } from "../lib/claude.js";
import { OUTREACH_SCHEMA, OUTREACH_EDIT_SCHEMA, QUALITY_SCORE_SCHEMA } from "./schemas.js";
import {
  PROHIBITED_PHRASES,
  SENTENCE_STYLE_RULES,
  INTEGRITY_RULES,
  MESSAGE_FRAMEWORK,
  HONEST_OPENING_THEMES,
  QUALITY_SCORE_CATEGORIES,
  scanForViolations,
  type StyleViolation,
} from "../lib/writingStyle.js";
import type { Angle } from "./relationshipIntelligence.js";
import type { AuditAgent } from "../types.js";

const REAL_CLIENTS = "Salty Cracker, Jeffrey Prather, Andy Ngo, and True the Vote";

// Which audit backs the "one business observation" for each angle -- grounds that sentence in
// a real finding instead of asking the model to invent a business observation from nothing.
const ANGLE_TO_AUDIT_AGENT: Record<Angle, AuditAgent> = {
  "Audience Ownership": "ownership",
  Membership: "ownership",
  Merch: "merch",
  Community: "community",
  Website: "website",
  AI: "ai_opportunity",
  Sponsors: "monetization",
  TopFan: "topfan",
};

type OutreachFields = {
  email_subject: string;
  email_body: string;
  linkedin_message: string;
  x_dm: string;
};

export interface OutreachOutcome {
  emailSubject: string;
  emailBody: string;
  linkedinMessage: string;
  xDm: string;
  specificReferences: string[];
}

export async function runOutreachWriter(creatorId: number): Promise<OutreachOutcome> {
  const creator = await getCreator(creatorId);
  if (!creator) throw new Error(`Creator ${creatorId} not found`);

  const site = creator.website ? await fetchSiteSnapshot(creator.website) : null;
  const recentVideoTitles = await fetchRecentVideoTitles(creator.youtube_channel_id);
  const score = await latestOpportunityScore(creatorId);
  const proposal = await latestProposal(creatorId);
  const trigger = await latestRelationshipTrigger(creatorId);

  const angle = (trigger?.angle as Angle) ?? "Audience Ownership";
  const groundingAudit = await latestAudit(creatorId, ANGLE_TO_AUDIT_AGENT[angle]);
  const whyNowBlock = trigger?.trigger_found
    ? `TRIGGER FOUND -- use this as "why this creator": ${trigger.trigger_label}. Evidence: ${trigger.evidence}`
    : "No external trigger found. Mentioning the one piece of content is reason enough on its own -- don't force a trigger that isn't there.";

  const payload = await structuredCall<{
    email_subject: string;
    email_body: string;
    linkedin_message: string;
    x_dm: string;
    specific_references: string[];
  }>({
    system: `
REGISTER -- calibrate everything to this: this is the email Andy would write if he'd been
introduced to this creator by a mutual friend. Not cold, not stiff, not over-explaining who he
is. Warm, direct, credible by implication rather than by resume. The recipient should finish
reading and think "this sounds like one person writing another person," never "this AI scraped
my channel."

This exists to start a conversation, not to sell, explain services, or book a meeting. Success
is a genuine reply -- nothing else matters, not opens, not clicks.

WHY THIS CREATOR, WHY NOW:
${whyNowBlock}
Single angle for this message -- ${angle}. Never mix in a second angle or list multiple services.

BUSINESS OBSERVATION EVIDENCE (ground step 3 of the framework in this real finding, don't invent
your own): ${groundingAudit ? groundingAudit.summary : "No audit evidence available -- keep the observation general and honest about that."}

MESSAGE FRAMEWORK -- follow this structure exactly, one sentence per step unless noted:
${MESSAGE_FRAMEWORK}

STEP 1 OPTIONS (rephrase fresh, don't reuse literal wording):
${HONEST_OPENING_THEMES}

CREDIBILITY LINE -- only if it's genuinely relevant to what you just said, at most once: "I've
worked behind the scenes with ${REAL_CLIENTS}." Never force this in. Never list your resume.

NEVER DO THIS: never summarize their content, never list multiple videos/pieces, never prove you
researched them, never compliment everything, never flatter. Mention ONE thing and move on --
"I've been following your recent Iran coverage." Done. Nothing more. If a sentence explains WHY
something was good, or names a second title, it has already failed this rule.

HONESTY RULES -- these override everything else, including how natural or engaging a sentence
sounds:
${INTEGRITY_RULES}

PROHIBITED PHRASES -- never write any of these or close variants:
${PROHIBITED_PHRASES}

${SENTENCE_STYLE_RULES}

PERMISSION -- never ask for a meeting, a call, or time on the calendar, never mention Calendly.
Ask permission to send something instead: "I put together a few ideas specifically for you.
Worth sending over?" / "I'd be happy to share it." Exactly one question, nothing after it.

TONE: calm, observant, confident, understated, human. No hype, no enthusiasm theater, no
corporate language. Understated humor is fine if it fits naturally -- never force a joke, never
use memes, slang, or sarcasm.

MAXIMUM LENGTH: email 120 words, LinkedIn 75 words, X DM 55 words. If longer, cut it down.

FINAL TEST before you finalize: would a real founder actually send this? Or does it sound like
AI trying to sound human? Could this have been written for anyone, or only for this creator based
on this evidence? If either test fails, rewrite it.
`.trim(),
    prompt: `
Creator: ${creator.name}
Website: ${creator.website ?? "(none on file)"}
${site && !site.error ? `Site title: "${site.title}"\nSite text sample: """${site.bodyTextSample.slice(0, 1500)}"""` : "Website evidence unavailable."}
Recent video titles (pick exactly ONE to mention in step 2, ignore the rest -- do not compare, list, or reference more than one): ${recentVideoTitles.length ? recentVideoTitles.join(" | ") : "(none available)"}
Opportunity score: ${score ? `${score.overall_score}/100 (${score.priority} priority)` : "not yet scored"}
Proposal prepared: ${proposal ? "yes (do not mention it directly -- the permission close is about sending over ideas, not a proposal)" : "not yet generated"}

Write EMAIL_1 (first contact, max 120 words including greeting/sign-off), the LinkedIn DM (max
75 words), and the X DM (max 55 words), all following the message framework and the same angle.
List the specific references you used.
`.trim(),
    schema: OUTREACH_SCHEMA,
    toolName: "emit_outreach",
    maxTokens: 1500,
  });

  // Editor pass -- a separate call whose ONLY job is checking the draft against the checklist
  // and rewriting violations. Asking one call to be creative AND hold every rule at once is
  // exactly how specific banned terms kept slipping through; a dedicated second pass with
  // nothing else to do is far more reliable at actually enforcing a checklist.
  const edited = await structuredCall<{
    email_subject: string;
    email_body: string;
    linkedin_message: string;
    x_dm: string;
    changes_made: string[];
  }>({
    system: `
You are a strict editor. You do not write outreach -- you take an existing draft and rewrite ONLY
the parts that violate the checklist below. Your only job is fixing violations.

CHECK THIS FIRST, IT MATTERS MORE THAN STYLE -- HONESTY:
${INTEGRITY_RULES}
A message can sound perfectly natural and still be a violation if it claims work that was never
done (comparing content, claiming to know performance, claiming analysis happened). Fix these
even if it means removing the most "engaging" part of the draft.

THEN CHECK PROHIBITED PHRASES (exact list, verbatim or close variants):
${PROHIBITED_PHRASES}

${SENTENCE_STYLE_RULES}

Also require: the permission close asks to send something over (never "the plan," never a
meeting/call), and the message follows this structure without extra steps added:
${MESSAGE_FRAMEWORK}

Keep every real detail, claim, and opinion the draft already has, as long as it passes the
honesty check above. Go through each of the four fields one at a time, sentence by sentence. If
a field already passes clean, return it unchanged. List what you actually changed in changes_made.
`.trim(),
    prompt: `
Creator's first name: ${creator.name.split(" ")[0]}

DRAFT TO EDIT:
Subject: ${payload.email_subject}
Email: ${payload.email_body}
LinkedIn: ${payload.linkedin_message}
X DM: ${payload.x_dm}

Return the edited version of all four fields.
`.trim(),
    schema: OUTREACH_EDIT_SCHEMA,
    toolName: "emit_edited_outreach",
    maxTokens: 1200,
  });

  let current: OutreachFields = {
    email_subject: edited.email_subject,
    email_body: edited.email_body,
    linkedin_message: edited.linkedin_message,
    x_dm: edited.x_dm,
  };
  const log: string[] = [...edited.changes_made.map((c) => `edit: ${c}`)];

  // Deterministic backstop: literal banned-term scan, up to 2 targeted correction passes.
  for (let attempt = 0; attempt < 2; attempt++) {
    const violations = scanForViolations(current, recentVideoTitles);
    if (violations.length === 0) break;
    log.push(
      `correction pass ${attempt + 1}: found ${violations.map((v) => `"${v.term}" in ${v.field}`).join(", ")}`
    );
    current = await runCorrectionPass(current, violations);
  }
  const finalViolations = scanForViolations(current, recentVideoTitles);
  if (finalViolations.length > 0) {
    log.push(
      `UNRESOLVED after correction passes: ${finalViolations.map((v) => `"${v.term}" in ${v.field}`).join(", ")}`
    );
  }

  // Self-scoring quality gate -- score the email body (the fullest, most representative field)
  // against the rubric; if anything scores below 9, one targeted rewrite pass citing exactly
  // which categories failed and why.
  const scores = await structuredCall<
    Record<(typeof QUALITY_SCORE_CATEGORIES)[number], { score: number; reason: string }>
  >({
    system:
      "Score this outreach message honestly against each category, 1-10. Most real messages " +
      "should score 7-9; reserve 10 for genuinely exceptional. Be a harsh, honest critic, not " +
      "encouraging -- the goal is catching real weaknesses, not validating the draft.",
    prompt: `Message to score:\n${current.email_body}\n\nScore each category.`,
    schema: QUALITY_SCORE_SCHEMA,
    toolName: "emit_quality_scores",
    maxTokens: 500,
  });

  const weak = QUALITY_SCORE_CATEGORIES.filter((cat) => scores[cat].score < 9);
  if (weak.length > 0) {
    log.push(`quality gate: ${weak.map((cat) => `${cat}=${scores[cat].score} (${scores[cat].reason})`).join(", ")}`);
    current = await runQualityRewrite(current, weak, scores);
    const rescan = scanForViolations(current, recentVideoTitles);
    if (rescan.length > 0) {
      log.push(`post-quality-rewrite violations: ${rescan.map((v) => `"${v.term}" in ${v.field}`).join(", ")}`);
      current = await runCorrectionPass(current, rescan);
    }
  }

  const references = [...payload.specific_references, ...log];

  await saveOutreach(creatorId, "email", current.email_body, {
    subject: current.email_subject,
    basedOn: references,
  });
  await saveOutreach(creatorId, "linkedin", current.linkedin_message, {
    basedOn: references,
  });
  await saveOutreach(creatorId, "x_dm", current.x_dm, {
    basedOn: references,
  });

  return {
    emailSubject: current.email_subject,
    emailBody: current.email_body,
    linkedinMessage: current.linkedin_message,
    xDm: current.x_dm,
    specificReferences: payload.specific_references,
  };
}

/** Targeted, deterministic-violation-driven correction call -- cites the exact terms found. */
async function runCorrectionPass(
  current: OutreachFields,
  violations: StyleViolation[]
): Promise<OutreachFields> {
  const violationList = violations.map((v) => `- "${v.term}" appears in ${v.field}`).join("\n");
  return structuredCall<OutreachFields>({
    system: `
You are a strict corrector fixing an exact, machine-detected list of violations. Two kinds:

1. Banned terms/phrases (shown as "term" in quotes) -- rewrite ONLY the sentence(s) containing
   each one so it (and close synonyms in the same category) no longer appears anywhere.
2. Structural violations (shown as a description, not a quoted term):
   - "run-on sentence (N words)" -- split that sentence into two or more shorter ones, ~15
     words each, one idea per sentence.
   - "em-dash overused" -- remove extra em-dashes; rephrase as separate sentences instead.
   - "triplet list" -- break the X, Y, and Z list into a single item, or two short sentences.
   - "multiple content pieces referenced" -- pick the SINGLE strongest piece of content and
     remove every mention of any other one. This may require rewriting most of the message.
   - "missing permission-close question" -- ADD one short closing question at the very end,
     e.g. "Worth sending over?" / "Want to see it?" -- do not add anything after it.

Fix every violation listed. Keep everything else in the message as close to the original as
possible -- don't rewrite parts that aren't flagged.
`.trim(),
    prompt: `
DRAFT:
Subject: ${current.email_subject}
Email: ${current.email_body}
LinkedIn: ${current.linkedin_message}
X DM: ${current.x_dm}

VIOLATIONS FOUND (fix every one):
${violationList}

Return corrected versions of all four fields.
`.trim(),
    schema: OUTREACH_EDIT_SCHEMA,
    toolName: "emit_corrected_outreach",
    maxTokens: 1200,
  });
}

/** Rewrite pass driven by the self-scoring gate -- cites exactly which categories failed and why. */
async function runQualityRewrite(
  current: OutreachFields,
  weakCategories: readonly string[],
  scores: Record<string, { score: number; reason: string }>
): Promise<OutreachFields> {
  const weakList = weakCategories
    .map((cat) => `- ${cat}: scored ${scores[cat].score}/10 -- ${scores[cat].reason}`)
    .join("\n");
  return structuredCall<OutreachFields>({
    system: `
You are revising outreach copy that scored below 9/10 on specific quality categories. Fix ONLY
what's needed to address the categories listed -- don't rewrite parts that already work. Keep the
same real details, angle, and structure (personal connection, reason for writing, one
observation, optional credibility, permission close).
`.trim(),
    prompt: `
DRAFT:
Subject: ${current.email_subject}
Email: ${current.email_body}
LinkedIn: ${current.linkedin_message}
X DM: ${current.x_dm}

WEAK CATEGORIES TO FIX:
${weakList}

Return improved versions of all four fields.
`.trim(),
    schema: OUTREACH_EDIT_SCHEMA,
    toolName: "emit_quality_rewrite",
    maxTokens: 1200,
  });
}
