// Reads only (a plain server module). Writes: lib/feed-actions.ts.
// CONTRACT: the guides' Feed (design screens 15, 16, 39). One thread, three views, no copy:
//   thread kind 'post', section 'feed', status pending -> published (public) or archived (declined).
//   Comments are the thread's forum replies, so the forum's Feed section shows the same record.
//   Link posts carry the unfurled card in metadata.link.
// Needs one org_feeds row (data, not a migration):
//   INSERT INTO org_feeds (org_id, slug, name, tagline, is_public, sort_order)
//   VALUES ('elktours', 'feed', 'Feed', 'From the guides', TRUE, 3) ON CONFLICT (org_id, slug) DO NOTHING;
// Without it the forum has no "Feed" section, but these reads and writes still work (threads.section is free text).

import { db } from "@elkdonis/db";
import { listReplies, type ForumReply } from "@elkdonis/services";
import { getViewer, requireOrgEditor } from "@/lib/auth";
import { getForumViewer } from "@/lib/forum";
import { siteConfig } from "@/config/site";

const ORG = siteConfig.orgId;
export const FEED_SECTION = "feed";
type Row = Record<string, unknown>;

export interface FeedLink {
  url: string;
  host: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

export interface FeedPost {
  id: string;
  slug: string;
  kind: "post" | "link";
  title: string;
  /** Sanitised HTML. */
  body: string | null;
  excerpt: string | null;
  link: FeedLink | null;
  /** pending = "With the office"; published = "On Discover"; archived = "Declined". */
  status: "pending" | "published" | "archived";
  author: { userId: string; name: string | null; slug: string | null; avatarUrl: string | null };
  replyCount: number;
  createdAt: string;
  publishedAt: string | null;
  /** Link to the same record in the forum. */
  forumHref: string;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function mapPost(r: Row): FeedPost {
  const meta = (r.metadata ?? {}) as Record<string, unknown>;
  const l = meta.link as Partial<FeedLink> | undefined;
  const link: FeedLink | null = l && typeof l.url === "string"
    ? { url: l.url, host: hostOf(l.url), title: l.title ?? hostOf(l.url), description: l.description ?? null, imageUrl: l.imageUrl ?? null, siteName: l.siteName ?? null }
    : null;
  return {
    id: r.id as string,
    slug: r.slug as string,
    kind: link ? "link" : "post",
    title: r.title as string,
    body: (r.body as string | null) ?? null,
    excerpt: (r.excerpt as string | null) ?? null,
    link,
    status: r.status as FeedPost["status"],
    author: { userId: r.author_id as string, name: (r.display_name as string | null) ?? null, slug: (r.user_slug as string | null) ?? null, avatarUrl: (r.avatar_url as string | null) ?? null },
    replyCount: Number(r.reply_count ?? 0),
    createdAt: new Date(r.created_at as string).toISOString(),
    publishedAt: r.published_at ? new Date(r.published_at as string).toISOString() : null,
    forumHref: `/forum/t/${r.id as string}/${r.slug as string}`,
  };
}

const COLS = db`
  t.id, t.slug, t.title, t.body, t.excerpt, t.status, t.author_id, t.metadata, t.reply_count, t.created_at, t.published_at,
  u.display_name, u.slug AS user_slug, u.avatar_url
`;

/**
 * Published posts, newest first. The signed-in viewer also gets their own pending posts, and editors
 * see everything not archived (pass `includePending` to widen to what the viewer may see).
 */
export async function listFeedPosts(opts: { limit?: number; authorUserId?: string; includePending?: boolean } = {}): Promise<FeedPost[]> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  try {
    const viewer = opts.includePending ? await getViewer().catch(() => null) : null;
    const mine = viewer?.userId ?? null;
    const editor = Boolean(viewer?.canEdit);
    const rows = (await db`
      SELECT ${COLS}
      FROM threads t LEFT JOIN users u ON u.id = t.author_id
      WHERE t.org_id = ${ORG} AND t.section = ${FEED_SECTION} AND t.kind = 'post'
        AND (
          (t.status = 'published' AND t.visibility = 'PUBLIC')
          ${opts.includePending ? db`OR (t.status = 'pending' AND (${editor} OR t.author_id = ${mine}))` : db``}
        )
        ${opts.authorUserId ? db`AND t.author_id = ${opts.authorUserId}` : db``}
      ORDER BY COALESCE(t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `) as unknown as Row[];
    return rows.map(mapPost);
  } catch (err) {
    console.error("[elktours] listFeedPosts:", err);
    return [];
  }
}

/** One post with its replies (the same list the forum topic shows). Null when the viewer may not see it. */
export async function getFeedPost(id: string, opts: { page?: number } = {}): Promise<{ post: FeedPost; replies: ForumReply[]; canComment: boolean } | null> {
  try {
    const viewer = await getViewer().catch(() => null);
    const [row] = (await db`
      SELECT ${COLS}
      FROM threads t LEFT JOIN users u ON u.id = t.author_id
      WHERE t.org_id = ${ORG} AND t.section = ${FEED_SECTION} AND t.kind = 'post' AND t.id = ${id}
        AND (
          (t.status = 'published' AND t.visibility = 'PUBLIC')
          OR (t.status = 'pending' AND (${Boolean(viewer?.canEdit)} OR t.author_id = ${viewer?.userId ?? null}))
        )
      LIMIT 1
    `) as unknown as Row[];
    if (!row) return null;
    const post = mapPost(row);
    const fv = await getForumViewer();
    const page = await listReplies(id, { page: opts.page ?? 1, limit: 50, viewer: fv });
    return { post, replies: page.rows, canComment: Boolean(viewer) && post.status === "published" };
  } catch (err) {
    console.error(`[elktours] getFeedPost(${id}):`, err);
    return null;
  }
}

/** The office queue: posts waiting. Editors only. */
export async function listFeedPostsToConfirm(): Promise<FeedPost[]> {
  const viewer = await requireOrgEditor("/manage");
  if (viewer.role !== "owner") return []; // the office's queue
  const rows = (await db`
    SELECT ${COLS}
    FROM threads t LEFT JOIN users u ON u.id = t.author_id
    WHERE t.org_id = ${ORG} AND t.section = ${FEED_SECTION} AND t.kind = 'post' AND t.status = 'pending'
    ORDER BY t.created_at DESC LIMIT 50
  `) as unknown as Row[];
  return rows.map(mapPost);
}
