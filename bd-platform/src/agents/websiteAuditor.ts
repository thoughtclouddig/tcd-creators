/**
 * Agent 3 — Website Auditor
 *
 * Fetches the live site, extracts real technical signals with cheerio (nav structure,
 * email capture, SEO tags, load latency as a speed proxy), then hands that evidence to
 * Claude to grade the qualitative categories (brand, messaging, UX, etc.) A-F. Claude is
 * never asked to grade something it wasn't given evidence for.
 */
import { getCreator, saveAudit } from "../db/repo.js";
import { fetchSiteSnapshot } from "../lib/website.js";
import { structuredCall } from "../lib/claude.js";
import { WEBSITE_AUDIT_SCHEMA } from "./schemas.js";
import type { AuditResult } from "../types.js";

interface WebsiteAuditPayload {
  overall_score: number;
  summary: string;
  category_grades: Record<string, { grade: string; reasoning: string }>;
  findings: { label: string; detail: string }[];
  recommendations: { title: string; detail: string; estimated_impact?: string }[];
}

export async function runWebsiteAuditor(creatorId: number): Promise<AuditResult> {
  const creator = await getCreator(creatorId);
  if (!creator) throw new Error(`Creator ${creatorId} not found`);

  if (!creator.website) {
    const result: AuditResult = {
      agent: "website",
      score: 0,
      grade: "F",
      summary: "No website on file — this is the highest-leverage gap to close first.",
      findings: [{ label: "No website", detail: "No URL is associated with this creator yet." }],
      recommendations: [
        {
          title: "Stand up a headquarters site",
          detail: "Every other agent in this pipeline (ownership, membership, merch, AI) assumes a site to build on.",
        },
      ],
      raw: {},
    };
    await saveAudit(creatorId, result);
    return result;
  }

  const snapshot = await fetchSiteSnapshot(creator.website);

  const payload = await structuredCall<WebsiteAuditPayload>({
    system:
      "You are a senior digital strategist at ThoughtCloud Digital, auditing an independent media creator's website. " +
      "Grade honestly and specifically using ONLY the evidence provided — never invent details you weren't given. " +
      "Frame every finding as opportunity, never as criticism of the creator. Avoid generic agency language " +
      '("grow your brand", "unlock synergies", "best-in-class").',
    prompt: buildPrompt(creator.name, snapshot),
    schema: WEBSITE_AUDIT_SCHEMA,
    toolName: "emit_website_audit",
    maxTokens: 3000,
  });

  const overallGrade = scoreToGrade(payload.overall_score);

  const result: AuditResult = {
    agent: "website",
    score: payload.overall_score,
    grade: overallGrade,
    summary: payload.summary,
    findings: payload.findings,
    recommendations: payload.recommendations,
    raw: {
      category_grades: payload.category_grades,
      technical_snapshot: {
        fetchMs: snapshot.fetchMs,
        htmlBytes: snapshot.htmlBytes,
        hasViewportMeta: snapshot.hasViewportMeta,
        navLinkCount: snapshot.navLinkCount,
        navLinks: snapshot.navLinks,
        hasEmailCaptureForm: snapshot.hasEmailCaptureForm,
        hasSearchInput: snapshot.hasSearchInput,
        hasPricingOrMembershipKeywords: snapshot.hasPricingOrMembershipKeywords,
        hasStoreOrShopLink: snapshot.hasStoreOrShopLink,
        hasCommunityLink: snapshot.hasCommunityLink,
        imagesMissingAlt: snapshot.imagesMissingAlt,
        imageCount: snapshot.imageCount,
        error: snapshot.error,
      },
    },
  };

  await saveAudit(creatorId, result);
  return result;
}

function buildPrompt(creatorName: string, s: Awaited<ReturnType<typeof fetchSiteSnapshot>>): string {
  if (s.error) {
    return `The website for ${creatorName} (${s.url}) failed to load: "${s.error}". Grade every category F/low and note the site is currently unreachable — this alone is a critical, fixable finding.`;
  }
  return `
Creator: ${creatorName}
URL: ${s.url} (resolved to ${s.finalUrl})

TECHNICAL EVIDENCE (extracted directly from the live HTML — treat as ground truth):
- Page fetch latency: ${s.fetchMs}ms, HTML size: ${(s.htmlBytes / 1024).toFixed(0)}KB
- <title>: "${s.title}"
- Meta description: "${s.metaDescription || "(none)"}"
- Mobile viewport meta tag present: ${s.hasViewportMeta}
- H1 count on homepage: ${s.h1Count}
- Nav links (${s.navLinkCount}): ${s.navLinks.join(", ") || "(none found)"}
- Email capture form/newsletter language detected: ${s.hasEmailCaptureForm}
- Search input detected: ${s.hasSearchInput}
- Membership/premium/patron language detected: ${s.hasPricingOrMembershipKeywords}
- Store/shop/merch nav link detected: ${s.hasStoreOrShopLink}
- Sponsor/advertise language detected: ${s.hasSponsorMention}
- Community link (Discord/Locals/forum) detected: ${s.hasCommunityLink}
- Images: ${s.imageCount} total, ${s.imagesMissingAlt} missing alt text
- External script tags: ${s.externalScriptCount}

VISIBLE BODY TEXT SAMPLE (first ~4000 chars, for tone/messaging/brand judgment):
"""
${s.bodyTextSample || "(no text extracted)"}
"""

Grade each category (brand, speed, navigation, messaging, homepage, seo, email_capture, sponsors,
search, architecture, accessibility, community, membership, calls_to_action, overall_ux) A-F with
one sentence of reasoning grounded in the evidence above. For "speed", use fetch latency as a proxy
(under 400ms = A range, 400-900ms = B/C, over 900ms or errors = D/F) and say so explicitly.
Then give an overall 0-100 score, a summary, 3-6 findings, and 2-5 recommendations.
`.trim();
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
