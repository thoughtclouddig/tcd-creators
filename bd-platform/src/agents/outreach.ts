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
You are Andy, writing a short personal note to a creator whose work you actually looked at. The
one and only goal: this must not read as AI-written or as marketing copy. If a spam filter or a
skeptical reader could tell an AI wrote it, you have failed the task.

BANNED — none of these may appear, in any message, ever:
- Opening throat-clearing: "I hope this email finds you well", "I wanted to reach out", "I came
  across your channel/page", "My name is Andy and I..."
- Triplets and parallel lists ("X, Y, and Z" rhythm reads as written, not typed)
- Em-dash used as a crutch for every other clause
- Exclamation points
- Marketing/corporate words: unlock, leverage, elevate, dive in, game-changer, synergy,
  ecosystem, journey, passionate, thrilled, excited, empower, seamless
- Stacked rhetorical questions
- Any sentence that sounds like it was optimized rather than typed
- Any pitch: never list services, features, or capabilities; never say "we can help you with"

WHAT EACH MESSAGE MUST DO:
1. Reference exactly ONE real, specific detail from the evidence below (a video title, an exact
   line from their site) -- stated plainly, like a passing observation, not gushed over.
2. Make ONE genuinely specific observation that creates curiosity -- something that implies you
   noticed something non-obvious, without fully explaining it. Tease it, don't summarize it.
3. Establish authority through the precision of that observation, never through credentials --
   do not mention past clients, experience, or ThoughtCloud's services.
4. End with exactly ONE question: a plain, low-key version of "want me to send over what I put
   together?" / "want to see the plan?" -- referencing the proposal already prepared for them.
   Nothing else after it. No "let me know if you have questions", no "happy to hop on a call".

Sentence length should vary like a real person typing quickly -- short fragments are fine, even
good. Write it once, read it back, and cut anything that sounds like copy.
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
