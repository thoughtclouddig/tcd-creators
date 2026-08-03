import * as cheerio from "cheerio";

export interface SiteSnapshot {
  url: string;
  finalUrl: string;
  fetchMs: number;
  htmlBytes: number;
  title: string;
  metaDescription: string;
  hasViewportMeta: boolean;
  h1Count: number;
  navLinkCount: number;
  navLinks: string[];
  hasEmailCaptureForm: boolean;
  hasSearchInput: boolean;
  hasPricingOrMembershipKeywords: boolean;
  hasStoreOrShopLink: boolean;
  hasSponsorMention: boolean;
  hasCommunityLink: boolean; // discord/locals/forum
  imageCount: number;
  imagesMissingAlt: number;
  externalScriptCount: number;
  bodyTextSample: string; // first ~4000 chars of visible text, for LLM context
  error?: string;
}

const UA =
  "Mozilla/5.0 (compatible; ThoughtCloudBDBot/0.1; +https://thoughtclouddigital.com)";

export async function fetchSiteSnapshot(url: string): Promise<SiteSnapshot> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    const fetchMs = Date.now() - start;
    const $ = cheerio.load(html);

    const navLinks: string[] = [];
    $("nav a, header a").each((_, el) => {
      const text = $(el).text().trim();
      if (text && navLinks.length < 20) navLinks.push(text);
    });

    const bodyText = $("body").text().replace(/\s+/g, " ").trim();

    let imagesMissingAlt = 0;
    let imageCount = 0;
    $("img").each((_, el) => {
      imageCount++;
      if (!$(el).attr("alt")) imagesMissingAlt++;
    });

    const lowerHtml = html.toLowerCase();

    return {
      url,
      finalUrl: res.url || url,
      fetchMs,
      htmlBytes: Buffer.byteLength(html),
      title: $("title").first().text().trim(),
      metaDescription: $('meta[name="description"]').attr("content")?.trim() ?? "",
      hasViewportMeta: $('meta[name="viewport"]').length > 0,
      h1Count: $("h1").length,
      navLinkCount: navLinks.length,
      navLinks,
      hasEmailCaptureForm:
        $('input[type="email"]').length > 0 ||
        /newsletter|subscribe|join our list|sign up for/i.test(bodyText),
      hasSearchInput:
        $('input[type="search"]').length > 0 || lowerHtml.includes('role="search"'),
      hasPricingOrMembershipKeywords:
        /membership|become a member|premium|patron|subscriber-only|paid subscription/i.test(
          bodyText
        ),
      hasStoreOrShopLink: /\bshop\b|\bstore\b|\bmerch\b/i.test(navLinks.join(" ")),
      hasSponsorMention: /sponsor|advertise with|partner with us/i.test(bodyText),
      hasCommunityLink:
        lowerHtml.includes("discord.gg") ||
        lowerHtml.includes("locals.com") ||
        /\bforum\b|\bcommunity\b/i.test(navLinks.join(" ")),
      imageCount,
      imagesMissingAlt,
      externalScriptCount: $("script[src]").length,
      bodyTextSample: bodyText.slice(0, 4000),
    };
  } catch (err: any) {
    return {
      url,
      finalUrl: url,
      fetchMs: Date.now() - start,
      htmlBytes: 0,
      title: "",
      metaDescription: "",
      hasViewportMeta: false,
      h1Count: 0,
      navLinkCount: 0,
      navLinks: [],
      hasEmailCaptureForm: false,
      hasSearchInput: false,
      hasPricingOrMembershipKeywords: false,
      hasStoreOrShopLink: false,
      hasSponsorMention: false,
      hasCommunityLink: false,
      imageCount: 0,
      imagesMissingAlt: 0,
      externalScriptCount: 0,
      bodyTextSample: "",
      error: err.message,
    };
  }
}
