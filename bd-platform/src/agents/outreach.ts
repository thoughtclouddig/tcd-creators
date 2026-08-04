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
import { OUTREACH_SCHEMA } from "./schemas.js";

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
- Any sentence shaped like "[detail] is doing/reveals/suggests something about your content/
  strategy/audience/retention" -- see above
- Comparing or referencing more than one piece of their content in the same message
- Triplets and parallel lists ("X, Y, and Z" rhythm reads as written, not typed)
- Em-dash used as a crutch for every other clause
- Exclamation points
- Marketing/corporate or analyst words: unlock, leverage, elevate, dive in, game-changer,
  synergy, ecosystem, journey, passionate, thrilled, excited, empower, seamless, pattern,
  outperforming, strategy, angle, lean into, contrast, retention
- Stacked rhetorical questions
- Any pitch: never list services, features, or capabilities; never say "we can help you with";
  never mention "the plan," a proposal, or ThoughtCloud by name

WHAT EACH MESSAGE MUST DO:
1. Name the ONE episode you picked (title quoted or closely paraphrased).
2. Give ONE genuine, specific reaction or opinion about what it actually said or argued.
3. Say, plainly, that you wrote something down about it -- notes, a few thoughts, whatever's true
   to how a real person would phrase jotting something down after watching.
4. End with exactly ONE question offering to send that over: "want me to send over what I wrote?"
   / "want the notes?" -- phrased around the notes, never around "the plan" or a proposal.
   Nothing after it. No "let me know if you have questions", no "happy to hop on a call".

Sentence length should vary like a real person typing quickly -- short fragments are fine, even
good. Write it once, read it back, and cut anything that sounds like copy or like analysis.
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

  await saveOutreach(creatorId, "email", payload.email_body, {
    subject: payload.email_subject,
    basedOn: payload.specific_references,
  });
  await saveOutreach(creatorId, "linkedin", payload.linkedin_message, {
    basedOn: payload.specific_references,
  });
  await saveOutreach(creatorId, "x_dm", payload.x_dm, {
    basedOn: payload.specific_references,
  });

  return {
    emailSubject: payload.email_subject,
    emailBody: payload.email_body,
    linkedinMessage: payload.linkedin_message,
    xDm: payload.x_dm,
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
