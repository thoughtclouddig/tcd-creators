/**
 * Agent 11 — Executive Proposal
 *
 * Assembles every prior agent's output into the same premium report format used for
 * hand-built ThoughtCloud Digital proposals (see TCD-Proposal-Design-System.md), writes
 * HTML + Markdown to disk, and records the proposal row. One Claude call writes the two
 * narrative passages (executive summary, closing letter) grounded in the real audit data —
 * everything else is templated directly from stored scores/findings, not re-generated.
 */
import fs from "node:fs";
import path from "node:path";
import {
  allLatestAudits,
  getCreator,
  latestOpportunityScore,
  saveProposal,
} from "../db/repo.js";
import { textCall } from "../lib/claude.js";
import {
  renderProposalHtml,
  renderProposalMarkdown,
  type ProposalData,
  type ProposalRecommendation,
} from "../proposal/template.js";
import type { AuditAgent } from "../types.js";

const AGENT_LABELS: Record<AuditAgent, string> = {
  website: "Website",
  ownership: "Audience Ownership",
  merch: "Merchandise",
  monetization: "Monetization",
  community: "Community",
  ai_opportunity: "AI Opportunity",
  topfan: "TopFan Fit",
};

const REPORT_ORDER: AuditAgent[] = [
  "website",
  "ownership",
  "merch",
  "monetization",
  "community",
  "ai_opportunity",
  "topfan",
];

const CLIENTS = [
  { name: "Salty Cracker", tag: "Independent political commentary" },
  { name: "Jeffrey Prather", tag: "Intelligence & geopolitical analysis" },
  { name: "Andy Ngo", tag: "Independent investigative journalism" },
  { name: "True the Vote", tag: "Nonprofit · election integrity" },
  { name: "Pilot Debrief", tag: "Aviation & military analysis" },
];

const OUTPUT_DIR = process.env.PROPOSAL_OUTPUT_DIR || "./output/proposals";

export interface ProposalOutcome {
  title: string;
  htmlPath: string;
  markdownPath: string;
}

export async function runProposalGenerator(creatorId: number): Promise<ProposalOutcome> {
  const creator = getCreator(creatorId);
  if (!creator) throw new Error(`Creator ${creatorId} not found`);

  const score = latestOpportunityScore(creatorId);
  if (!score) {
    throw new Error(
      `No opportunity score for creator ${creatorId} — run Agent 10 (scoring) before the proposal.`
    );
  }
  const breakdown = JSON.parse(score.breakdown_json);

  const audits = allLatestAudits(creatorId);
  const byAgent = Object.fromEntries(audits.map((a) => [a.agent, a]));

  const agentSummaries = REPORT_ORDER.filter((a) => byAgent[a]).map((a) => ({
    label: AGENT_LABELS[a],
    summary: byAgent[a].summary as string,
  }));

  const topRecommendations = collectTopRecommendations(byAgent);

  const { executiveSummary, closingLetter } = await writeNarrative(
    creator.name,
    score.overall_score,
    score.priority,
    agentSummaries
  );

  const data: ProposalData = {
    creatorName: creator.name,
    brand: creator.brand,
    preparedDate: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    overallScore: score.overall_score,
    priority: score.priority,
    topfanFitScore: score.topfan_fit_score,
    estimatedRevenueOpportunity: score.estimated_revenue_opportunity,
    executiveSummary,
    closingLetter,
    categoryScores: [
      { label: "Audience", score10: breakdown.audience_size / 10 },
      { label: "Website", score10: breakdown.website / 10 },
      { label: "Audience Ownership", score10: breakdown.ownership / 10 },
      { label: "Community", score10: breakdown.community / 10 },
      { label: "Merchandise", score10: breakdown.merch / 10 },
      { label: "AI Opportunity", score10: breakdown.ai_opportunity / 10 },
    ],
    agentSummaries,
    topRecommendations,
    clients: CLIENTS,
  };

  const html = renderProposalHtml(data);
  const markdown = renderProposalMarkdown(data);

  const slug = slugify(creator.name);
  const stamp = new Date().toISOString().slice(0, 10);
  const dir = path.join(OUTPUT_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  const htmlPath = path.join(dir, `${stamp}.html`);
  const markdownPath = path.join(dir, `${stamp}.md`);
  fs.writeFileSync(htmlPath, html, "utf-8");
  fs.writeFileSync(markdownPath, markdown, "utf-8");

  saveProposal(creatorId, score.id, {
    title: `Building the Future of ${creator.name}`,
    html_path: htmlPath,
    markdown_path: markdownPath,
  });

  return {
    title: `Building the Future of ${creator.name}`,
    htmlPath,
    markdownPath,
  };
}

async function writeNarrative(
  creatorName: string,
  overallScore: number,
  priority: string,
  agentSummaries: { label: string; summary: string }[]
): Promise<{ executiveSummary: string; closingLetter: string }> {
  const context = agentSummaries.map((a) => `${a.label}: ${a.summary}`).join("\n");

  const executiveSummary = await textCall({
    system:
      "You write executive summaries for ThoughtCloud Digital's creator proposals — the same voice as the " +
      "hand-written 'Building the Future of Real Baron' proposal: direct, respectful, never salesy, reframes " +
      "gaps as opportunity, never criticizes the creator. Two short paragraphs, no headers, no bullet points, " +
      'no agency buzzwords ("grow your brand", "unlock synergies", "best-in-class"). First paragraph acknowledges ' +
      "what they've already built. Second paragraph names the specific opportunity ahead, grounded in the audit " +
      "findings given.",
    prompt: `Creator: ${creatorName}\nOverall opportunity score: ${overallScore}/100 (${priority} priority)\n\nAudit findings:\n${context}\n\nWrite the two-paragraph executive summary now.`,
    maxTokens: 500,
  });

  const closingLetter = await textCall({
    system:
      "You write the closing personal letter for ThoughtCloud Digital's creator proposals — same voice as the " +
      "'To Baron,' letter in the Real Baron proposal: warm, direct, restates the thesis once more personally. " +
      "Two short paragraphs, no salutation line (that's added separately), no sign-off (added separately).",
    prompt: `Creator: ${creatorName}\nOverall opportunity score: ${overallScore}/100\n\nAudit findings:\n${context}\n\nWrite the two-paragraph closing letter body now (no "To ${creatorName.split(" ")[0]}," line, no sign-off).`,
    maxTokens: 400,
  });

  return { executiveSummary, closingLetter };
}

function collectTopRecommendations(
  byAgent: Record<string, any>
): ProposalRecommendation[] {
  const all: ProposalRecommendation[] = [];
  for (const agent of REPORT_ORDER) {
    const row = byAgent[agent];
    if (!row) continue;
    const recs = JSON.parse(row.recommendations_json || "[]") as ProposalRecommendation[];
    all.push(...recs.filter((r) => r && r.title && r.detail));
  }
  return all.slice(0, 6);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
