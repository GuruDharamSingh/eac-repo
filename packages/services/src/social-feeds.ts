import { listConnections, getInstagramLoginTarget, getMetaPageTarget } from './connections';

// ============================================================================
// Instagram and YouTube on a person's ArtDirect page (2026-11-01).
//
// The person connects the account in Connections (user_connections); this
// module reads what a visitor may see. Nothing is stored beyond a per-process
// cache: a feed is fetched at most once an hour per person.
//
// Instagram: the 9 latest posts. Through an "Instagram Login" connection
// (professional account, graph.instagram.com) or, failing that, the Instagram
// account linked to a Facebook Page of a `meta` connection. Instagram's image
// URLs expire, which is the second reason for the hour-long cache.
//
// YouTube: the channel's public RSS feed, by channel id (user_connections.
// account_id). No token and no API quota; it lists public videos only, so a
// private or unlisted upload cannot appear.
// ============================================================================

const GRAPH_IG = 'https://graph.instagram.com';
const GRAPH_FB = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`;
const MEDIA_FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';

const TTL_OK_MS = 60 * 60 * 1000;
const TTL_FAIL_MS = 5 * 60 * 1000;

export interface InstagramPost {
  id: string;
  permalink: string;
  imageUrl: string | null;
  caption: string | null;
  isVideo: boolean;
  timestamp: string | null;
}

export interface YoutubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  publishedAt: string | null;
}

/** The accounts a person has connected, for the owner's drawer. No tokens. */
export interface SocialAccounts {
  instagram: { connectionId: string; name: string | null; url: string | null } | null;
  youtube: { connectionId: string; name: string | null; url: string | null; channelId: string } | null;
}

export type SocialFeed<T> =
  | { ok: true; account: { name: string | null; url: string | null }; items: T[] }
  | { ok: false; error: string };

export async function getSocialAccounts(userId: string): Promise<SocialAccounts> {
  const all = (await listConnections(userId)).filter((c) => c.status === 'connected');
  const ig = all.find((c) => c.provider === 'instagram') ?? null;
  const fbIg = ig ? null : all.find((c) => c.provider === 'meta' && c.targets.some((t) => t.instagramUserId)) ?? null;
  const yt = all.find((c) => c.provider === 'youtube' && c.accountId) ?? null;
  const fbTarget = fbIg?.targets.find((t) => t.instagramUserId) ?? null;
  return {
    instagram: ig
      ? { connectionId: ig.id, name: ig.accountName, url: ig.accountUrl }
      : fbIg && fbTarget
        ? {
            connectionId: fbIg.id,
            name: fbTarget.instagramUsername ? `@${fbTarget.instagramUsername}` : null,
            url: fbTarget.instagramUsername ? `https://www.instagram.com/${fbTarget.instagramUsername}` : null,
          }
        : null,
    youtube: yt ? { connectionId: yt.id, name: yt.accountName, url: yt.accountUrl, channelId: yt.accountId! } : null,
  };
}

// ── cache ───────────────────────────────────────────────────────────────────

const cache = new Map<string, { at: number; ttl: number; value: SocialFeed<unknown> }>();

async function cached<T>(key: string, load: () => Promise<SocialFeed<T>>): Promise<SocialFeed<T>> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as SocialFeed<T>;
  const value = await load();
  // A failure keeps serving the last good feed, and is retried after five minutes.
  if (value.ok === false && hit?.value.ok) {
    cache.set(key, { at: Date.now(), ttl: TTL_FAIL_MS, value: hit.value });
    return hit.value as SocialFeed<T>;
  }
  cache.set(key, { at: Date.now(), ttl: value.ok ? TTL_OK_MS : TTL_FAIL_MS, value });
  return value;
}

/** Drop a person's cached feeds (after they connect, disconnect or switch a section). */
export function forgetSocialFeeds(userId: string): void {
  cache.delete(`ig:${userId}`);
  cache.delete(`yt:${userId}`);
}

// ── Instagram ───────────────────────────────────────────────────────────────

interface MediaRow {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
}

async function fetchMedia(base: string, who: string, token: string, limit: number): Promise<MediaRow[]> {
  const q = new URLSearchParams({ fields: MEDIA_FIELDS, limit: String(limit), access_token: token });
  const res = await fetch(`${base}/${who}/media?${q}`, { cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as { data?: MediaRow[]; error?: { message?: string } };
  if (!res.ok || data.error) throw new Error(data.error?.message ?? `Instagram answered ${res.status}`);
  return data.data ?? [];
}

export async function getInstagramFeed(userId: string, limit = 9): Promise<SocialFeed<InstagramPost>> {
  return cached<InstagramPost>(`ig:${userId}`, async () => {
    const accounts = await getSocialAccounts(userId);
    const acc = accounts.instagram;
    if (!acc) return { ok: false, error: 'Instagram is not connected.' };
    try {
      const connection = (await listConnections(userId)).find((c) => c.id === acc.connectionId)!;
      let rows: MediaRow[];
      if (connection.provider === 'instagram') {
        const t = await getInstagramLoginTarget(connection.id);
        if (t.ok === false) return { ok: false, error: t.error };
        rows = await fetchMedia(GRAPH_IG, 'me', t.accessToken, limit);
      } else {
        const target = connection.targets.find((x) => x.instagramUserId)!;
        const t = await getMetaPageTarget(connection.id, target.id);
        if (t.ok === false) return { ok: false, error: t.error };
        rows = await fetchMedia(GRAPH_FB, target.instagramUserId!, t.accessToken, limit);
      }
      const items = rows
        .filter((r) => r.permalink)
        .map<InstagramPost>((r) => ({
          id: r.id,
          permalink: r.permalink!,
          imageUrl: r.media_type === 'VIDEO' ? r.thumbnail_url ?? null : r.media_url ?? r.thumbnail_url ?? null,
          caption: r.caption ?? null,
          isVideo: r.media_type === 'VIDEO',
          timestamp: r.timestamp ?? null,
        }));
      return { ok: true, account: { name: acc.name, url: acc.url }, items };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

// ── YouTube ─────────────────────────────────────────────────────────────────

function xmlText(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

export async function getYoutubeFeed(userId: string, limit = 6): Promise<SocialFeed<YoutubeVideo>> {
  return cached<YoutubeVideo>(`yt:${userId}`, async () => {
    const acc = (await getSocialAccounts(userId)).youtube;
    if (!acc) return { ok: false, error: 'YouTube is not connected.' };
    // Channel ids are UC + 22 characters; the value is interpolated into a URL.
    if (!/^UC[\w-]{22}$/.test(acc.channelId)) return { ok: false, error: 'The connected channel id looks wrong. Connect again.' };
    try {
      const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${acc.channelId}`, { cache: 'no-store' });
      if (!res.ok) return { ok: false, error: `YouTube answered ${res.status}` };
      const xml = await res.text();
      const items: YoutubeVideo[] = [];
      for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        const entry = m[1]!;
        const id = entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
        if (!id) continue;
        items.push({
          id,
          title: xmlText(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''),
          url: `https://www.youtube.com/watch?v=${id}`,
          thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          publishedAt: entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? null,
        });
        if (items.length >= limit) break;
      }
      return { ok: true, account: { name: acc.name, url: acc.url }, items };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
