/**
 * Agent 12 — Outreach Writer
 *
 * No templates. Every message must reference something specific and real about the creator —
 * a video title, a line from their site, a specific audit finding — never a generic opener.
 * Pulls fresh evidence (site content + recent video titles) rather than reusing agent 3's
 * stored summary, since outreach needs concrete hooks, not audit conclusions.
 */
import { google } from "googleapis";
import {
  getCreator,
  latestOpportunityScore,
  latestProposal,
  saveOutreach,
} from "../db/repo.js";
import { fetchSiteSnapshot } from "../lib/website.js";
import { structuredCall } from "../lib/claude.js";
import { OUTREACH_SCHEMA, OUTREACH_EDIT_SCHEMA } from "./schemas.js";
import { BANNED_JARGON_CATEGORIES, SENTENCE_STYLE_RULES } from "../lib/writingStyle.js";

const youtube = google.youtube("v3");

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

  const payload = await structuredCall<{
    email_subject: string;
    email_body: string;
    linkedin_message: string;
    x_dm: string;
    specific_references: string[];
  }>({
    system: `
You are Andy. You watched ONE specific episode this creator made, jotted down real notes on it
while watching, and you're sending a short message offering to share what you wrote. That is the
entire pretext of every message -- not "I have a business plan for you," not "I noticed something
about your content strategy." Just: I watched this one thing, I wrote something about it, want it?

STRUCTURAL RULE -- PICK ONE, IGNORE THE REST: You will be given a list of several recent video
titles. Choose exactly ONE to focus on. Never mention, compare to, or imply anything about any
other title on the list. The moment a message references two pieces of content side by side, it
turns into strategy-analysis and reads as fake -- so it is structurally forbidden, not just
discouraged. One episode. That's it.

DO NOT FABRICATE. You were not given view counts, engagement numbers, or any way to compare one
piece of content to another. You do not know what performed better or what patterns exist across
their uploads. Every claim must be verifiable from the ONE title/detail you chose alone.

THE FAILURE MODE THAT KEEPS HAPPENING -- fake personalization ("SMYKM: show me you know me"): a
message name-drops a detail then pivots into a manufactured insight about their content strategy,
retention, or what makes them different from other creators. This is banned in full, structurally:
  BAD: "Your 'X' episode sitting next to 'Y' caught my eye -- that contrast is doing something for
  retention most [genre] shows miss. There's a pattern here worth talking about."
  BAD: "Noticed X while Y -- that's rare for this space."
  Any sentence shaped like "[detail] is doing/reveals/suggests [insight about their strategy or
  audience]" is this same banned pattern wearing different words. If your draft has a sentence
  like that, delete it and write a real reaction instead (see below).

WHAT A REAL REACTION LOOKS LIKE: an opinion or question about what the episode actually SAID or
ARGUED -- the substance, not the strategy. The register is "I watched this and had a thought,"
not "I studied this and found an insight." Example of the right instinct (do not reuse this text,
it's just the register): "the part where you said [claim] -- disagree, actually, here's why I
kept thinking about it." That's a reaction to an idea, not an observation about their content.

BANNED, in any message, ever:
- Opening throat-clearing: "I hope this email finds you well", "I wanted to reach out", "I came
  across your channel/page", "My name is Andy and I..."
- Vague temporal scene-setters before getting to the point: "Been following your recent run",
  "Been checking out your content lately", "Caught your recent episode", "I've been watching your
  channel" -- these are pure filler. Open directly with the actual detail, not a sentence about
  having been aware of them in general.
- Any sentence shaped like "[detail] is doing/reveals/suggests something about your content/
  strategy/audience/retention" -- see above
- Comparing or referencing more than one piece of their content in the same message
- Stacked rhetorical questions
- Any pitch: never list services, features, or capabilities; never say "we can help you with";
  never mention "the plan," a proposal, or ThoughtCloud by name

BANNED WORDS AND PHRASES, BY CATEGORY (a rewrite pass will check every word against these):
${BANNED_JARGON_CATEGORIES}

${SENTENCE_STYLE_RULES}

GREETING -- REQUIRED, NOT THROAT-CLEARING: Email and LinkedIn must open with a plain greeting
using the creator's first name: "Hi [FirstName]," or "Hey [FirstName] --" on its own, then the
actual content starts on the next sentence. A greeting is normal and expected in a real email; it
is NOT the same thing as banned throat-clearing like "I hope this finds you well." Skipping the
greeting entirely reads as abrupt and unnatural, not efficient. X DM can skip the greeting (DMs
don't typically have one) and go straight to the point.

WHAT EACH MESSAGE MUST DO:
1. Email/LinkedIn: open with "Hi [FirstName]," (own line or own short sentence). X DM: skip this.
2. Name the ONE episode you picked, in its own short sentence.
3. Give ONE genuine, specific reaction or opinion about what it actually said or argued, in one
   or two short sentences -- not one long sentence trying to hold the whole thought.
4. Say, plainly, in its own short sentence, that you wrote something down about it.
5. End with exactly ONE question, its own short sentence, offering to send that over: "Want me to
   send over what I wrote?" / "Want the notes?" -- phrased around the notes, never "the plan" or
   a proposal. Nothing after it.

FULL WORKED EXAMPLES -- these show the target register exactly, including sentence length and
the greeting. Never reuse this wording or these specific claims; the creator, episode, and
opinion must always come from the real evidence given. Match this rhythm: short sentences, a
real greeting, one idea per line.

  Example email:
  Subject: the fed episode
  Body:
  "Hi Sarah,

  Watched your episode on the Fed. The part where you said it reacts to inflation instead of
  controlling it stuck with me. Disagreed at first. Couldn't find a hole in it after thinking it
  through. Wrote a few notes on why. Want them?"

  Example LinkedIn:
  "Hi Sarah, your Fed episode stuck with me. The claim that it reacts instead of controls --
  I think you're onto something. Wrote up why. Want to see it?"

  Example X DM:
  "the fed take was better than you think it was. wrote it up, want it?"

Notice: real greeting on email/LinkedIn, short sentences throughout, no lead-in filler before the
point, one real opinion, one short offer. Before finalizing, read your draft aloud in your head --
if any sentence runs on past about 15 words, split it. If any sentence could appear in a thousand
other cold emails, cut it or make it more specific.
`.trim(),
    prompt: `
Creator: ${creator.name}
Website: ${creator.website ?? "(none on file)"}
${site && !site.error ? `Site title: "${site.title}"\nSite text sample: """${site.bodyTextSample.slice(0, 1500)}"""` : "Website evidence unavailable."}
Recent video titles (pick exactly ONE, ignore the rest -- do not compare or reference more than one): ${recentVideoTitles.length ? recentVideoTitles.join(" | ") : "(none available)"}
Opportunity score: ${score ? `${score.overall_score}/100 (${score.priority} priority)` : "not yet scored"}
Proposal prepared: ${proposal ? "yes (do not mention it directly -- the ask is about the notes, not the plan)" : "not yet generated"}

Write the email subject, email body, LinkedIn message, and X DM per the system rules. List the
specific references you used.
`.trim(),
    schema: OUTREACH_SCHEMA,
    toolName: "emit_outreach",
    maxTokens: 1500,
  });

  // Editor pass -- a separate call whose ONLY job is checking the draft against the style
  // checklist and rewriting violations. Asking one call to be creative, specific, AND hold 20+
  // style rules at once is exactly how words like "flag" kept slipping through; a dedicated
  // second pass with nothing else to do is far more reliable at actually enforcing a checklist.
  const edited = await structuredCall<{
    email_subject: string;
    email_body: string;
    linkedin_message: string;
    x_dm: string;
    changes_made: string[];
  }>({
    system: `
You are a strict editor. You do not write outreach -- you take an existing draft and rewrite ONLY
the parts that violate the checklist below. Keep every real detail, claim, and opinion the draft
already has; do not soften the opinion or make it vaguer. Your only job is fixing violations.

CHECKLIST:
${BANNED_JARGON_CATEGORIES}

${SENTENCE_STYLE_RULES}

Also require:
- Email and LinkedIn must open with "Hi [FirstName]," using the creator's first name. X DM: no
  greeting needed.
- Exactly one question at the very end, offering to send over "what I wrote" / "the notes" --
  never "the plan" or a proposal.
- No throat-clearing opener ("I hope this finds you well", "I wanted to reach out").

Go through each of the four fields one at a time. Read every sentence. If a sentence contains a
banned word/phrase, exceeds ~15 words, or violates the greeting/ending rules, rewrite that
sentence -- keep the rest of the message as close to the original as possible. If a field already
passes clean, return it unchanged. List what you actually changed in changes_made.
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

  const references = [...payload.specific_references, ...edited.changes_made.map((c) => `edit: ${c}`)];

  await saveOutreach(creatorId, "email", edited.email_body, {
    subject: edited.email_subject,
    basedOn: references,
  });
  await saveOutreach(creatorId, "linkedin", edited.linkedin_message, {
    basedOn: references,
  });
  await saveOutreach(creatorId, "x_dm", edited.x_dm, {
    basedOn: references,
  });

  return {
    emailSubject: edited.email_subject,
    emailBody: edited.email_body,
    linkedinMessage: edited.linkedin_message,
    xDm: edited.x_dm,
    specificReferences: payload.specific_references,
  };
}

async function fetchRecentVideoTitles(channelId: string | null): Promise<string[]> {
  if (!channelId || !process.env.YOUTUBE_API_KEY) return [];
  try {
    const chRes = await youtube.channels.list({
      key: process.env.YOUTUBE_API_KEY,
      id: [channelId],
      part: ["contentDetails"],
    });
    const uploadsPlaylist =
      chRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylist) return [];
    const itemsRes = await youtube.playlistItems.list({
      key: process.env.YOUTUBE_API_KEY,
      playlistId: uploadsPlaylist,
      part: ["snippet"],
      maxResults: 5,
    });
    return (itemsRes.data.items ?? [])
      .map((i) => i.snippet?.title)
      .filter((t): t is string => !!t);
  } catch {
    return [];
  }
}
