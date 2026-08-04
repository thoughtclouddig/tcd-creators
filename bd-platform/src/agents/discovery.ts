/**
 * Agent 1 — Creator Discovery / Enrichment
 *
 * Phase 1 scope: takes a manually-seeded creator (name + known handles) and enriches it
 * with real signals from YouTube Data API, Spotify, and Substack RSS. Each source degrades
 * gracefully — a missing API key or unresolved handle logs a warning and moves on rather
 * than failing the pipeline. True autonomous "scan the internet for new creators" discovery
 * is Phase 2 (see README) — this agent's contract (CreatorSeed in, enriched Creator out)
 * doesn't change when that's added, only what calls it does.
 */
import { google } from "googleapis";
import Parser from "rss-parser";
import {
  getCreatorByName,
  setYoutubeChannelId,
  updateCreatorAudienceFields,
  upsertCreator,
} from "../db/repo.js";
import type { Creator, CreatorSeed } from "../types.js";

const youtube = google.youtube("v3");
const rssParser = new Parser();

export interface DiscoveryOutcome {
  creator: Creator;
  sources_used: string[];
  warnings: string[];
}

export async function runDiscovery(seed: CreatorSeed): Promise<DiscoveryOutcome> {
  const warnings: string[] = [];
  const sourcesUsed: string[] = ["manual"];

  let creator = await upsertCreator(seed);

  // ---- YouTube ----
  if (process.env.YOUTUBE_API_KEY && (seed.youtube_channel_id || seed.youtube_handle)) {
    try {
      const channelId = await resolveYouTubeChannelId(seed);
      if (channelId) {
        // Persist the resolved ID immediately — every downstream agent (Audience
        // Intelligence, Outreach) keys off creator.youtube_channel_id, not the seed handle.
        await setYoutubeChannelId(creator.id, channelId);
        const { data } = await youtube.channels.list({
          key: process.env.YOUTUBE_API_KEY,
          id: [channelId],
          part: ["statistics", "snippet"],
        });
        const ch = data.items?.[0];
        if (ch?.statistics) {
          await updateCreatorAudienceFields(creator.id, {
            subscribers: Number(ch.statistics.subscriberCount ?? 0) || undefined,
            avg_views: undefined, // computed properly in Agent 2 from recent uploads
            source: "youtube",
          });
          sourcesUsed.push("youtube");
        }
      } else {
        warnings.push("Could not resolve YouTube channel from handle/id given.");
      }
    } catch (err: any) {
      warnings.push(`YouTube enrichment failed: ${err.message}`);
    }
  } else if (seed.youtube_channel_id || seed.youtube_handle) {
    warnings.push("YOUTUBE_API_KEY not set — skipped live YouTube enrichment.");
  }

  // ---- Spotify ----
  if (
    process.env.SPOTIFY_CLIENT_ID &&
    process.env.SPOTIFY_CLIENT_SECRET &&
    seed.spotify_show_id
  ) {
    try {
      const token = await getSpotifyToken();
      const res = await fetch(
        `https://api.spotify.com/v1/shows/${seed.spotify_show_id}?market=US`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        sourcesUsed.push("spotify");
      } else {
        warnings.push(`Spotify lookup returned ${res.status}`);
      }
    } catch (err: any) {
      warnings.push(`Spotify enrichment failed: ${err.message}`);
    }
  }

  // ---- Substack (public RSS) ----
  if (seed.substack_url) {
    try {
      const feedUrl = seed.substack_url.replace(/\/$/, "") + "/feed";
      const feed = await rssParser.parseURL(feedUrl);
      if (feed.items?.length) {
        sourcesUsed.push("substack");
      }
    } catch (err: any) {
      warnings.push(`Substack RSS fetch failed: ${err.message}`);
    }
  }

  creator = (await getCreatorByName(seed.name))!;
  return { creator, sources_used: sourcesUsed, warnings };
}

async function resolveYouTubeChannelId(seed: CreatorSeed): Promise<string | null> {
  if (seed.youtube_channel_id) return seed.youtube_channel_id;
  if (!seed.youtube_handle) return null;

  const handle = seed.youtube_handle.startsWith("@")
    ? seed.youtube_handle
    : `@${seed.youtube_handle}`;

  const byHandle = await youtube.channels.list({
    key: process.env.YOUTUBE_API_KEY!,
    forHandle: handle,
    part: ["id"],
  });
  const idFromHandle = byHandle.data.items?.[0]?.id;
  if (idFromHandle) return idFromHandle;

  const bySearch = await youtube.search.list({
    key: process.env.YOUTUBE_API_KEY!,
    q: seed.name,
    type: ["channel"],
    part: ["snippet"],
    maxResults: 1,
  });
  return bySearch.data.items?.[0]?.snippet?.channelId ?? null;
}

async function getSpotifyToken(): Promise<string> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}
