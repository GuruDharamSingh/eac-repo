/**
 * IFAC's recent YouTube uploads, read from the channel's public feed.
 *
 * The home page's video section held two hand-picked embeds (defaultVideoEmbeds)
 * at full width. The owner asked for the videos "in a smaller grid that can be
 * scrollable" (2026-09-23), which only makes sense with more than two, and the
 * channel already publishes its uploads as an Atom feed — no API key needed.
 *
 * Fail-soft like blog-feed.ts: any failure returns [] and the page falls back
 * to the hand-picked embeds. A slow or unreachable YouTube must never take
 * the home page with it.
 */

/** @ifacgroup — resolved from the channel page, 2026-09-23. */
const CHANNEL_ID = "UCsC7CDe3nLBvX5iPvruwGlg";

export interface ChannelVideo {
  id: string;
  title: string;
  publishedAt: string | null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

function decode(text: string): string {
  return text.replace(/&(#?\w+);/g, (m, name: string) => ENTITIES[name] ?? m).trim();
}

export async function fetchChannelVideos(limit = 12): Promise<ChannelVideo[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const videos: ChannelVideo[] = [];
    for (const entry of xml.split("<entry>").slice(1)) {
      const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      const title = entry.match(/<title>([^<]*)<\/title>/)?.[1];
      if (!id || !title) continue;
      videos.push({
        id,
        title: decode(title),
        publishedAt: entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? null,
      });
      if (videos.length >= limit) break;
    }
    return videos;
  } catch {
    return [];
  }
}

/** A saved embed URL (youtube.com/embed/<id>?…) back to its id. */
export function youtubeIdFromEmbed(src: string): string | null {
  return src.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{6,})/)?.[1] ?? null;
}
