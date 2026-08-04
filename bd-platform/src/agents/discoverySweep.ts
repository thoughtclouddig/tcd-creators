/**
 * Agent 1 (real search) — Discovery Sweep
 *
 * Unlike runDiscovery() in discovery.ts (which enriches a creator you already named),
 * this searches YouTube by ICP keyword and surfaces creators you don't already know about.
 * Deliberately cheap: only the YouTube Data API is called here, never Claude — a broad
 * keyword sweep can return dozens of candidates, and running the full 14-agent audit
 * pipeline (~10 Claude calls each) on every one of them unreviewed would be expensive and
 * noisy. Candidates land in the DB with a basic audience snapshot (Agent 2) and show up on
 * the dashboard as "discovered, not yet audited" — a human decides which are worth the full
 * treatment via runFullAuditPipeline().
 *
 * Coverage note: YouTube has a real, ToS-compliant search API, so this works cleanly here.
 * Rumble, X, Locals, Patreon, and "conference speakers" from the original brief don't have
 * an equivalent without scraping, so this sweep only ever surfaces YouTube-native creators.
 */
import { google } from "googleapis";
import {
  getCreatorByYoutubeChannelId,
  updateCreatorAudienceFields,
  upsertCreator,
} from "../db/repo.js";
import { runAudienceIntelligence } from "./audienceIntelligence.js";
import type { Creator } from "../types.js";

const youtube = google.youtube("v3");

export const DEFAULT_ICP_QUERIES = [
  "independent political commentary podcast",
  "independent investigative journalist",
  "constitutional law commentary",
  "military analyst podcast",
  "faith and culture commentary",
  "news creator independent media",
];

export interface SweepCandidate {
  creator: Creator;
  subscribers: number;
  isNew: boolean;
}

export interface SweepOutcome {
  queries: string[];
  channelsFound: number;
  alreadyKnown: number;
  outOfRange: number;
  newCandidates: SweepCandidate[];
  warnings: string[];
}

export async function runDiscoverySweep(opts: {
  queries?: string[];
  minSubscribers?: number;
  maxSubscribers?: number;
  maxResultsPerQuery?: number;
} = {}): Promise<SweepOutcome> {
  const queries = opts.queries ?? DEFAULT_ICP_QUERIES;
  const minSubscribers = opts.minSubscribers ?? 5_000;
  const maxSubscribers = opts.maxSubscribers ?? 3_000_000;
  const maxResultsPerQuery = opts.maxResultsPerQuery ?? 10;
  const warnings: string[] = [];

  if (!process.env.YOUTUBE_API_KEY) {
    return {
      queries,
      channelsFound: 0,
      alreadyKnown: 0,
      outOfRange: 0,
      newCandidates: [],
      warnings: ["YOUTUBE_API_KEY not set — discovery sweep needs it to search YouTube."],
    };
  }

  // ---- 1. Search each ICP query, collect unique channel IDs ----
  const channelIds = new Set<string>();
  for (const q of queries) {
    try {
      const { data } = await youtube.search.list({
        key: process.env.YOUTUBE_API_KEY,
        q,
        type: ["channel"],
        part: ["snippet"],
        maxResults: maxResultsPerQuery,
        order: "relevance",
      });
      for (const item of data.items ?? []) {
        const id = item.snippet?.channelId;
        if (id) channelIds.add(id);
      }
    } catch (err: any) {
      warnings.push(`Search failed for "${q}": ${err.message}`);
    }
  }

  if (channelIds.size === 0) {
    return { queries, channelsFound: 0, alreadyKnown: 0, outOfRange: 0, newCandidates: [], warnings };
  }

  // ---- 2. Pull stats for every candidate (batched — channels.list accepts up to 50 ids) ----
  const idList = Array.from(channelIds);
  const statsById = new Map<string, { title: string; subscribers: number }>();
  for (let i = 0; i < idList.length; i += 50) {
    const batch = idList.slice(i, i + 50);
    try {
      const { data } = await youtube.channels.list({
        key: process.env.YOUTUBE_API_KEY,
        id: batch,
        part: ["statistics", "snippet"],
      });
      for (const ch of data.items ?? []) {
        if (!ch.id || !ch.statistics) continue;
        statsById.set(ch.id, {
          title: ch.snippet?.title ?? ch.id,
          subscribers: Number(ch.statistics.subscriberCount ?? 0),
        });
      }
    } catch (err: any) {
      warnings.push(`Fetching channel stats failed: ${err.message}`);
    }
  }

  // ---- 3. Dedupe against existing creators + filter by subscriber range ----
  let alreadyKnown = 0;
  let outOfRange = 0;
  const newCandidates: SweepCandidate[] = [];

  for (const [channelId, stats] of statsById) {
    const existing = await getCreatorByYoutubeChannelId(channelId);
    if (existing) {
      alreadyKnown++;
      continue;
    }
    if (stats.subscribers < minSubscribers || stats.subscribers > maxSubscribers) {
      outOfRange++;
      continue;
    }

    const creator = await upsertCreator({
      name: stats.title,
      youtube_channel_id: channelId,
    });
    await updateCreatorAudienceFields(creator.id, { source: "youtube_discovery" });
    // Cheap audience snapshot (Agent 2) so the dashboard can show momentum before anyone
    // commits to a full Claude-driven audit.
    try {
      await runAudienceIntelligence(creator.id);
    } catch (err: any) {
      warnings.push(`Audience intelligence failed for ${stats.title}: ${err.message}`);
    }
    newCandidates.push({ creator, subscribers: stats.subscribers, isNew: true });
  }

  return {
    queries,
    channelsFound: statsById.size,
    alreadyKnown,
    outOfRange,
    newCandidates,
    warnings,
  };
}
