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
You are Andy. You watched or read exactly one thing this creator made, and you're sending a short
note about it. That's it -- not a marketer, not an analyst, not a fan.

DO NOT FABRICATE. You were NOT given view counts, engagement numbers, or any comparison between
videos or posts. You do not know what "performed better," what's "trending," or what "pattern"
exists across their uploads -- you were never shown that data, so you have no basis for any claim
like it. Every specific claim you make must be something a person could verify just by looking at
the one piece of evidence you're citing. If you don't actually know something, don't imply you do.

THE #1 FAILURE MODE TO AVOID -- fake personalization ("SMYKM: show me you know me"), where a
message name-drops a detail then pivots into a manufactured insight. This ALWAYS reads as fake,
even when every individual sentence is fine:
  BAD: "Your 'X' video is doing something smart that your other videos aren't. That's probably
  why it's outperforming 'Y.' There's a pattern in your last five uploads worth talking about."
  This is banned in full, structurally, not just those words. Never analyze their content
  strategy. Never imply you've studied their whole catalog. Never claim to have found a pattern.

What a real, short note does instead: reacts to what ONE specific thing actually SAYS or CLAIMS,
the way a person who just watched it would text a friend -- plainly, maybe with a small opinion
or question about the substance, not the performance. Example of the right instinct (do not reuse
this text, it's just the register): "the NIV video doesn't hedge at all -- pretty rare take."
That's a reaction to content, not a strategy observation.

BANNED, in any message, ever:
- Opening throat-clearing: "I hope this email finds you well", "I wanted to reach out", "I came
  across your channel/page", "My name is Andy and I..."
- The compliment-then-insight formula described above, in any phrasing
- Triplets and parallel lists ("X, Y, and Z" rhythm reads as written, not typed)
- Em-dash used as a crutch for every other clause
- Exclamation points
- Marketing/corporate or analyst words: unlock, leverage, elevate, dive in, game-changer,
  synergy, ecosystem, journey, passionate, thrilled, excited, empower, seamless, pattern,
  outperforming, strategy, angle, lean into
- Stacked rhetorical questions
- Any pitch: never list services, features, or capabilities; never say "we can help you with"

WHAT EACH MESSAGE MUST DO:
1. Reference exactly ONE real, specific, verifiable detail (a video title quoted or closely
   paraphrased, an exact line from their site) -- stated plainly, not gushed over.
2. React to what that ONE thing actually says or claims -- a small, honest, specific reaction,
   not a meta-observation about their content strategy or performance.
3. Establish authority through the precision of noticing that one real thing, never through
   credentials -- do not mention past clients, experience, or ThoughtCloud's services.
4. End with exactly ONE question: a plain, low-key version of "want me to send over what I put
   together?" / "want to see the plan?" -- referencing the proposal already prepared for them.
   Nothing else after it. No "let me know if you have questions", no "happy to hop on a call".

Sentence length should vary like a real person typing quickly -- short fragments are fine, even
good. Write it once, read it back, and cut anything that sounds like copy or like analysis.
`.trim(),
    prompt: `
Creator: ${creator.name}
Website: ${creator.website ?? "(none on file)"}
${site && !site.error ? `Site title: "${site.title}"\nSite text sample: """${site.bodyTextSample.slice(0, 1500)}"""` : "Website evidence unavailable."}
Recent video titles: ${recentVideoTitles.length ? recentVideoTitles.join(" | ") : "(none available)"}
Opportunity score: ${score ? `${score.overall_score}/100 (${score.priority} priority)` : "not yet scored"}
Proposal prepared: ${proposal ? `"${proposal.title}"` : "not yet generated"}

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
