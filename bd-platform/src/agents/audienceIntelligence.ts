/**
 * Agent 2 — Audience Intelligence
 *
 * Computes posting frequency, engagement rate, estimated monthly views, and a 0-100
 * momentum score from the most recent uploads. Every run appends a snapshot row so
 * momentum can be tracked over time (Agent 2 never overwrites — it accumulates history).
 */
import { google } from "googleapis";
import { getCreator, insertAudienceSnapshot, latestSnapshot } from "../db/repo.js";

const youtube = google.youtube("v3");

export interface AudienceIntelligenceResult {
  subscribers?: number;
  avg_views?: number;
  posting_frequency_per_week?: number;
  engagement_rate?: number;
  estimated_monthly_views?: number;
  momentum_score: number;
  revenue_signal_notes: string;
  confidence: "high" | "medium" | "low";
}

export async function runAudienceIntelligence(
  creatorId: number
): Promise<AudienceIntelligenceResult> {
  const creator = getCreator(creatorId);
  if (!creator) throw new Error(`Creator ${creatorId} not found`);

  let result: AudienceIntelligenceResult;

  if (process.env.YOUTUBE_API_KEY && creator.youtube_channel_id) {
    result = await computeFromYouTube(creator.youtube_channel_id, creator.subscribers);
  } else {
    result = computeFromStaticFields(creator.subscribers, creator.avg_views, creator.growth_pct);
  }

  const previous = latestSnapshot(creatorId);
  insertAudienceSnapshot(creatorId, {
    subscribers: result.subscribers,
    avg_views: result.avg_views,
    posting_frequency_per_week: result.posting_frequency_per_week,
    engagement_rate: result.engagement_rate,
    estimated_monthly_views: result.estimated_monthly_views,
    momentum_score: result.momentum_score,
    revenue_signal_notes: result.revenue_signal_notes,
  });

  if (previous && result.subscribers && previous.subscribers) {
    const deltaPct =
      ((result.subscribers - previous.subscribers) / previous.subscribers) * 100;
    result.revenue_signal_notes += ` Subscriber change since last snapshot: ${deltaPct.toFixed(2)}%.`;
  }

  return result;
}

async function computeFromYouTube(
  channelId: string,
  fallbackSubs: number | null
): Promise<AudienceIntelligenceResult> {
  const key = process.env.YOUTUBE_API_KEY!;

  const chRes = await youtube.channels.list({
    key,
    id: [channelId],
    part: ["statistics", "contentDetails"],
  });
  const ch = chRes.data.items?.[0];
  const subscribers = Number(ch?.statistics?.subscriberCount ?? fallbackSubs ?? 0) || undefined;
  const uploadsPlaylist = ch?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylist) {
    return computeFromStaticFields(subscribers ?? null, null, null);
  }

  const itemsRes = await youtube.playlistItems.list({
    key,
    playlistId: uploadsPlaylist,
    part: ["contentDetails", "snippet"],
    maxResults: 15,
  });
  const videoIds = (itemsRes.data.items ?? [])
    .map((i) => i.contentDetails?.videoId)
    .filter((id): id is string => !!id);

  if (videoIds.length === 0) {
    return computeFromStaticFields(subscribers ?? null, null, null);
  }

  const videosRes = await youtube.videos.list({
    key,
    id: videoIds,
    part: ["statistics", "snippet"],
  });
  const videos = videosRes.data.items ?? [];

  const viewCounts = videos.map((v) => Number(v.statistics?.viewCount ?? 0));
  const likeCounts = videos.map((v) => Number(v.statistics?.likeCount ?? 0));
  const commentCounts = videos.map((v) => Number(v.statistics?.commentCount ?? 0));
  const avgViews = Math.round(average(viewCounts));
  const engagementRate =
    avgViews > 0
      ? average(
          videos.map((v, i) => (likeCounts[i] + commentCounts[i]) / Math.max(viewCounts[i], 1))
        )
      : 0;

  const publishDates = videos
    .map((v) => v.snippet?.publishedAt)
    .filter((d): d is string => !!d)
    .map((d) => new Date(d).getTime())
    .sort((a, b) => b - a);
  const postingFrequencyPerWeek = estimatePostingFrequency(publishDates);

  const estimatedMonthlyViews = Math.round(avgViews * postingFrequencyPerWeek * (30 / 7));

  const momentumScore = computeMomentumScore({
    subscribers: subscribers ?? 0,
    avgViews,
    postingFrequencyPerWeek,
    engagementRate,
  });

  return {
    subscribers,
    avg_views: avgViews,
    posting_frequency_per_week: Math.round(postingFrequencyPerWeek * 10) / 10,
    engagement_rate: Math.round(engagementRate * 10000) / 10000,
    estimated_monthly_views: estimatedMonthlyViews,
    momentum_score: momentumScore,
    revenue_signal_notes: `Computed from the ${videoIds.length} most recent uploads.`,
    confidence: "high",
  };
}

function computeFromStaticFields(
  subscribers: number | null,
  avgViews: number | null,
  growthPct: number | null
): AudienceIntelligenceResult {
  const momentum = computeMomentumScore({
    subscribers: subscribers ?? 0,
    avgViews: avgViews ?? 0,
    postingFrequencyPerWeek: 2, // unknown — assume moderate cadence until live data available
    engagementRate: 0.03,
  });
  return {
    subscribers: subscribers ?? undefined,
    avg_views: avgViews ?? undefined,
    posting_frequency_per_week: undefined,
    engagement_rate: undefined,
    estimated_monthly_views:
      avgViews != null ? Math.round(avgViews * 2 * (30 / 7)) : undefined,
    momentum_score: momentum,
    revenue_signal_notes:
      "Estimated from manually-seeded figures — no live platform API connected. Connect YOUTUBE_API_KEY for high-confidence momentum tracking.",
    confidence: "low",
  };
}

function estimatePostingFrequency(publishTimesDesc: number[]): number {
  if (publishTimesDesc.length < 2) return 1;
  const spanMs = publishTimesDesc[0] - publishTimesDesc[publishTimesDesc.length - 1];
  const spanWeeks = spanMs / (1000 * 60 * 60 * 24 * 7);
  if (spanWeeks <= 0) return publishTimesDesc.length;
  return publishTimesDesc.length / spanWeeks;
}

function computeMomentumScore(inputs: {
  subscribers: number;
  avgViews: number;
  postingFrequencyPerWeek: number;
  engagementRate: number;
}): number {
  // Log-scaled so a channel doesn't need millions of subs to register — we're scoring
  // trajectory and consistency, not just raw size.
  const sizeScore = clamp(Math.log10(Math.max(inputs.subscribers, 1)) * 10, 0, 40);
  const viewsScore = clamp(Math.log10(Math.max(inputs.avgViews, 1)) * 8, 0, 25);
  const cadenceScore = clamp(inputs.postingFrequencyPerWeek * 6, 0, 20);
  const engagementScore = clamp(inputs.engagementRate * 1000, 0, 15);
  return Math.round(sizeScore + viewsScore + cadenceScore + engagementScore);
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
