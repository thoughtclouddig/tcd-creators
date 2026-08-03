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
  const creator = getCreator(creatorId);
  if (!creator) throw new Error(`Creator ${creatorId} not found`);

  const site = creator.website ? await fetchSiteSnapshot(creator.website) : null;
  const recentVideoTitles = await fetchRecentVideoTitles(creator.youtube_channel_id);
  const score = latestOpportunityScore(creatorId);
  const proposal = latestProposal(creatorId);

  const payload = await structuredCall<{
    email_subject: string;
    email_body: string;
    linkedin_message: string;
    x_dm: string;
    specific_references: string[];
  }>({
    system:
      "You write outreach on behalf of Andy at ThoughtCloud Digital, which helps independent political " +
      "podcasters, journalists, and commentary creators build independent media companies. Your outreach " +
      "NEVER uses templates or generic openers ('I came across your channel', 'I love what you're doing'). " +
      "Every message must reference something specific and real from the evidence given — an actual video " +
      "title, a specific line from their site, a specific finding. Tone: a peer who respects the work, not a " +
      "salesperson. Short. No hype, no exclamation points, no 'unlock synergies' language. The goal of every " +
      "message is simply to start a conversation — never push toward a meeting or a call directly.",
    prompt: `
Creator: ${creator.name}
Website: ${creator.website ?? "(none on file)"}
${site && !site.error ? `Site title: "${site.title}"\nSite text sample: """${site.bodyTextSample.slice(0, 1500)}"""` : "Website evidence unavailable."}
Recent video titles: ${recentVideoTitles.length ? recentVideoTitles.join(" | ") : "(none available)"}
Opportunity score: ${score ? `${score.overall_score}/100 (${score.priority} priority)` : "not yet scored"}
Proposal prepared: ${proposal ? `"${proposal.title}"` : "not yet generated"}

Write: an email subject line, an email body, a LinkedIn message, and an X DM. Each must be short,
specific, and reference at least one concrete detail from the evidence above (ideally a real video
title or a real line from their site). List the specific references you used.
`.trim(),
    schema: OUTREACH_SCHEMA,
    toolName: "emit_outreach",
    maxTokens: 1500,
  });

  saveOutreach(creatorId, "email", payload.email_body, {
    subject: payload.email_subject,
    basedOn: payload.specific_references,
  });
  saveOutreach(creatorId, "linkedin", payload.linkedin_message, {
    basedOn: payload.specific_references,
  });
  saveOutreach(creatorId, "x_dm", payload.x_dm, {
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
