import { google } from "googleapis";

const youtube = google.youtube("v3");

/** Shared by Agent 12 (outreach) and the Relationship Intelligence agent -- both need real,
 * recent video titles as evidence; this is the one place that fetches them. */
export async function fetchRecentVideoTitles(
  channelId: string | null,
  maxResults = 5
): Promise<string[]> {
  if (!channelId || !process.env.YOUTUBE_API_KEY) return [];
  try {
    const chRes = await youtube.channels.list({
      key: process.env.YOUTUBE_API_KEY,
      id: [channelId],
      part: ["contentDetails"],
    });
    const uploadsPlaylist = chRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylist) return [];
    const itemsRes = await youtube.playlistItems.list({
      key: process.env.YOUTUBE_API_KEY,
      playlistId: uploadsPlaylist,
      part: ["snippet"],
      maxResults,
    });
    return (itemsRes.data.items ?? [])
      .map((i) => i.snippet?.title)
      .filter((t): t is string => !!t);
  } catch {
    return [];
  }
}
