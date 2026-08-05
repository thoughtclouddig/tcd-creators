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
  WHY_YOU_THEMES,
  QUALITY_SCORE_CATEGORIES,
  scanForViolations,
  type StyleViolation,
} from "../lib/writingStyle.js";

const REAL_CLIENTS = "Salty Cracker, Jeffrey Prather, Andy Ngo, and True the Vote";

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

  const angle = trigger?.angle ?? "Audience Ownership";
  const whyNowBlock = trigger?.trigger_found
    ? `TRIGGER FOUND -- use this as the reason for writing: ${trigger.trigger_label}. Evidence: ${trigger.evidence}`
    : "No external trigger found. Lead with the personal connection and observation instead -- that is a legitimate, honest reason to write on its own, don't force a trigger that isn't there.";

  const payload = await structuredCall<{
    email_subject: string;
    email_body: string;
    linkedin_message: string;
    x_dm: string;
    specific_references: string[];
  }>({
    system: `
You are Andy, a thoughtful business owner writing one creator he genuinely respects. Not an SDR,
not a copywriter, not an AI. The recipient should never feel like they're in a marketing sequence.

WHY THIS CREATOR, WHY NOW:
${whyNowBlock}
Single angle for this message -- ${angle}. Never mix in a second angle or list multiple services.

MESSAGE FRAMEWORK -- follow this structure exactly, one sentence per step unless noted:
${MESSAGE_FRAMEWORK}

"WHY YOU" -- if a reason for writing personally would strengthen the message, draw on one of
these themes (rephrase fresh, never reuse literal wording, never claim something unverifiable):
${WHY_YOU_THEMES}

CREDIBILITY LINE -- only if it's genuinely relevant to what you just said, at most once: "I've
worked behind the scenes with ${REAL_CLIENTS}." Never force this in. Never list credentials that
don't matter to this specific message.

HONESTY RULES -- these override everything else, including how natural or engaging a sentence
sounds:
${INTEGRITY_RULES}

PROHIBITED PHRASES -- never write any of these or close variants:
${PROHIBITED_PHRASES}

${SENTENCE_STYLE_RULES}

PERMISSION CLOSE -- never ask for a meeting or "30 minutes." Ask permission to send something:
"Worth sending over?" / "I put together a few thoughts. Interested?" / "Happy to send what I
found." Exactly one question, nothing after it.

TONE: personal, specific, curious, respectful, confident, helpful. Never pushy, salesy,
corporate, manipulative, overly enthusiastic, or generic. Understated humor is fine if it fits
naturally (e.g. "full disclosure -- this is a pitch") -- never force a joke, never use memes,
slang, or sarcasm.

FINAL TEST before you finalize: would Andy actually send this to someone he admires? Would a
real person reply to it? Could this have been written for anyone, or only for this creator based
on this evidence? If it could be sent to anyone, it's not specific enough -- rewrite it.
`.trim(),
    prompt: `
Creator: ${creator.name}
Website: ${creator.website ?? "(none on file)"}
${site && !site.error ? `Site title: "${site.title}"\nSite text sample: """${site.bodyTextSample.slice(0, 1500)}"""` : "Website evidence unavailable."}
Recent video titles (pick exactly ONE for the personal connection/observation, ignore the rest -- do not compare or reference more than one): ${recentVideoTitles.length ? recentVideoTitles.join(" | ") : "(none available)"}
Opportunity score: ${score ? `${score.overall_score}/100 (${score.priority} priority)` : "not yet scored"}
Proposal prepared: ${proposal ? "yes (do not mention it directly -- the permission close is about sending over thoughts/notes, not a proposal)" : "not yet generated"}

Write EMAIL_1 (first contact, under 125 words including greeting/sign-off), the LinkedIn DM
(under 75 words), and the X DM (under 60 words), all following the message framework and the
same angle. List the specific references you used.
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
    const violations = scanForViolations(current);
    if (violations.length === 0) break;
    log.push(
      `correction pass ${attempt + 1}: found ${violations.map((v) => `"${v.term}" in ${v.field}`).join(", ")}`
    );
    current = await runCorrectionPass(current, violations);
  }
  const finalViolations = scanForViolations(current);
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
    const rescan = scanForViolations(current);
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
You are a strict corrector. You will be given a message and an exact list of banned terms found
in it verbatim. Rewrite ONLY the sentence(s) containing each banned term so that term (and close
synonyms in the same category) no longer appears anywhere in the output. Keep every other
sentence exactly as it is. Do not reintroduce any of these terms.
`.trim(),
    prompt: `
DRAFT:
Subject: ${current.email_subject}
Email: ${current.email_body}
LinkedIn: ${current.linkedin_message}
X DM: ${current.x_dm}

BANNED TERMS FOUND (must not appear anywhere in your output):
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
