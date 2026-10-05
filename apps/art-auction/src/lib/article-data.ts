import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

// ============================================================================
// An article that is really a forum topic.
//
// The page reads one `post` thread of the marketplace org and its replies. Only
// PUBLISHED, PUBLIC threads are shown, so a draft or an org-only topic is never
// drawn here, and replies carry a display name only (never an email). Replying
// happens on the forum itself: the page links to the thread there. A Studio
// piece (`kind = 'writing'`) is not a forum topic and is excluded from the
// forum by design, so these pages are for `post` threads. The thread's FEED
// must also be public with no minimum role (`org_feeds`): the forum gates by
// feed, and a thread in a members-only feed is not for the open web even when
// its own visibility reads PUBLIC.
// ============================================================================

const ORG = siteConfig.marketplaceOrgId;

/** The forum's own address for a thread (network host: /t/<id>/<slug>). */
export const FORUM_URL = (process.env.NEXT_PUBLIC_FORUM_URL ?? "https://forum.arts-collective.com").replace(/\/$/, "");
export const forumThreadUrl = (id: string, slug: string) => `${FORUM_URL}/t/${id}/${slug}`;

export interface WirePost {
  id: string;
  slug: string;
  title: string;
  lede: string | null;
  bodyHtml: string;
  authorName: string | null;
  publishedAt: string | null;
  coverImageUrl: string | null;
  replyCount: number;
  forumHref: string;
}

export interface WireReply {
  id: string;
  parentId: string | null;
  authorName: string;
  html: string;
  at: string;
}

export interface WireDiscussion {
  threadId: string;
  forumHref: string;
  replyCount: number;
  replies: WireReply[];
}

export interface WireTopic {
  id: string;
  title: string;
  replyCount: number;
  at: string;
  href: string;
  readHref: string;
}

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export async function loadPost(slug: string): Promise<WirePost | null> {
  try {
    const [r] = (await db`
      SELECT t.id, t.slug, t.title, t.excerpt, t.body, t.published_at, t.created_at, t.reply_count,
             t.metadata->>'coverImageUrl' AS cover, u.display_name AS author
      FROM threads t
      JOIN org_feeds f ON f.org_id = t.org_id AND f.slug = t.section AND f.is_public AND f.min_role IS NULL
      LEFT JOIN users u ON u.id = t.author_id
      WHERE t.org_id = ${ORG} AND t.kind = 'post' AND t.slug = ${slug}
        AND t.status = 'published' AND t.visibility = 'PUBLIC'
      LIMIT 1
    `) as unknown as Row[];
    if (!r) return null;
    return {
      id: String(r.id),
      slug: String(r.slug),
      title: String(r.title),
      lede: (r.excerpt as string | null) ?? null,
      bodyHtml: (r.body as string | null) ?? "",
      authorName: (r.author as string | null) ?? null,
      publishedAt: iso(r.published_at ?? r.created_at),
      coverImageUrl: (r.cover as string | null) ?? null,
      replyCount: Number(r.reply_count ?? 0),
      forumHref: forumThreadUrl(String(r.id), String(r.slug)),
    };
  } catch (err) {
    console.error("[art-auction] loadPost:", err);
    return null;
  }
}

export async function loadDiscussion(threadId: string, limit = 12): Promise<WireDiscussion | null> {
  const cap = Math.min(Math.max(limit, 1), 50);
  try {
    const [t] = (await db`
      SELECT t.id, t.slug, t.reply_count FROM threads t
      JOIN org_feeds f ON f.org_id = t.org_id AND f.slug = t.section AND f.is_public AND f.min_role IS NULL
      WHERE t.id = ${threadId} AND t.org_id = ${ORG} AND t.kind = 'post' AND t.status = 'published' AND t.visibility = 'PUBLIC'
    `) as unknown as Row[];
    if (!t) return null;
    // Newest first, so the page shows what is happening now.
    const rows = (await db`
      SELECT r.id, r.parent_reply_id, r.content, r.created_at, COALESCE(NULLIF(u.display_name, ''), 'A member') AS author
      FROM replies r JOIN users u ON u.id = r.user_id
      WHERE r.thread_id = ${threadId}
      ORDER BY r.created_at DESC
      LIMIT ${cap}
    `) as unknown as Row[];
    return {
      threadId: String(t.id),
      forumHref: forumThreadUrl(String(t.id), String(t.slug)),
      replyCount: Number(t.reply_count ?? 0),
      replies: rows.map((r) => ({
        id: String(r.id),
        parentId: (r.parent_reply_id as string | null) ?? null,
        authorName: String(r.author),
        html: String(r.content),
        at: iso(r.created_at)!,
      })),
    };
  } catch (err) {
    console.error("[art-auction] loadDiscussion:", err);
    return null;
  }
}

export async function loadTopics(limit = 6): Promise<WireTopic[]> {
  const cap = Math.min(Math.max(limit, 1), 20);
  try {
    const rows = (await db`
      SELECT t.id, t.slug, t.title, t.reply_count, COALESCE(t.last_activity_at, t.published_at, t.created_at) AS at
      FROM threads t
      JOIN org_feeds f ON f.org_id = t.org_id AND f.slug = t.section AND f.is_public AND f.min_role IS NULL
      WHERE t.org_id = ${ORG} AND t.kind = 'post' AND t.status = 'published' AND t.visibility = 'PUBLIC'
      ORDER BY at DESC
      LIMIT ${cap}
    `) as unknown as Row[];
    return rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      replyCount: Number(r.reply_count ?? 0),
      at: iso(r.at)!,
      href: forumThreadUrl(String(r.id), String(r.slug)),
      readHref: `/read/${r.slug}`,
    }));
  } catch (err) {
    console.error("[art-auction] loadTopics:", err);
    return [];
  }
}
