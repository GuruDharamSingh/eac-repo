import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { sanitizeRichText } from '@elkdonis/utils';
import { createThread } from './posts';
import { getOrgFeed, canViewFeed } from './org-feeds';
import type { ForumPerson, ForumViewer } from './forum';

// ============================================================================
// The Grand Forum — write layer.
//
// Every write takes the ForumViewer and decides for itself; nothing here
// trusts a caller's claim about who is acting. Results are plain objects
// with `ok` so a form handler can redirect with a message rather than throw.
//
// Posting rule (settled 2026-09-08): any signed-in network user may post to
// any feed they can READ (org feeds with a minRole are gated by that role).
// Org owners/guides and global admins moderate.
// ============================================================================

export const REPLIES_PER_PAGE = 20;

export type WriteResult<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const RATE_WINDOW_MIN = 10;
const RATE_MAX_POSTS = 10;

async function overRateLimit(userId: string): Promise<boolean> {
  const [{ n }] = await db<Array<{ n: number }>>`
    SELECT (
      (SELECT COUNT(*) FROM replies WHERE user_id = ${userId} AND created_at > NOW() - (${RATE_WINDOW_MIN} || ' minutes')::interval) +
      (SELECT COUNT(*) FROM threads WHERE author_id = ${userId} AND created_at > NOW() - (${RATE_WINDOW_MIN} || ' minutes')::interval)
    )::int AS n
  `;
  return n >= RATE_MAX_POSTS;
}

/**
 * Plain text from a <textarea> → HTML: blank lines split paragraphs, lines
 * beginning with "> " become a blockquote, everything else is escaped.
 * Then sanitized like any other body, so pasted HTML is inert.
 */
export function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const blocks = text.replace(/\r\n?/g, '\n').trim().split(/\n{2,}/);
  const html = blocks
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((l) => l.startsWith('>'))) {
        const inner = lines.map((l) => esc(l.replace(/^>\s?/, ''))).join('<br>');
        return `<blockquote><p>${inner}</p></blockquote>`;
      }
      return `<p>${lines.map(esc).join('<br>')}</p>`;
    })
    .join('\n');
  return sanitizeRichText(html);
}

/** The inverse, for quoting a post back into the textarea. */
export function htmlToQuote(html: string, limit = 600): string {
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const clipped = text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
  return clipped.split('\n').map((l) => `> ${l}`).join('\n');
}

// ── gates ───────────────────────────────────────────────────────────────────

interface ThreadGate {
  id: string;
  orgId: string;
  authorId: string;
  section: string | null;
  locked: boolean;
  visibility: string;
  status: string;
  title: string;
}

async function loadThreadForWrite(threadId: string, viewer: ForumViewer): Promise<ThreadGate | null> {
  const [t] = await db<Array<{ id: string; org_id: string; author_id: string; section: string | null; locked: boolean; visibility: string; status: string; title: string; min_role: string | null }>>`
    SELECT t.id, t.org_id, t.author_id, t.section, COALESCE(t.locked, false) AS locked, t.visibility, t.status, t.title, f.min_role
    FROM threads t
    LEFT JOIN org_feeds f ON f.org_id = t.org_id AND f.slug = COALESCE(t.section, 'general')
    WHERE t.id = ${threadId}
  `;
  if (!t) return null;
  const role = viewer.roles[t.org_id] ?? null;
  const visible =
    viewer.isGlobalAdmin ||
    (t.status === 'published' &&
      (t.visibility === 'PUBLIC' ||
        (t.visibility === 'ORGANIZATION' && role !== null) ||
        t.author_id === viewer.userId));
  if (!visible) return null;
  if (!viewer.isGlobalAdmin && !canViewFeed({ minRole: t.min_role as 'member' | 'guide' | 'owner' | null }, role)) return null;
  return { id: t.id, orgId: t.org_id, authorId: t.author_id, section: t.section, locked: t.locked, visibility: t.visibility, status: t.status, title: t.title };
}

export function canModerate(viewer: ForumViewer, orgId: string): boolean {
  if (viewer.isGlobalAdmin) return true;
  const role = viewer.roles[orgId];
  return role === 'owner' || role === 'guide';
}

// ── replies ─────────────────────────────────────────────────────────────────

export interface PostReplyInput {
  threadId: string;
  text: string;
  /** Reply to a specific reply; null for a top-level reply to the thread. */
  parentId?: string | null;
}

/**
 * Insert a reply, bump the thread, notify, auto-watch, and mark the thread
 * read for the author. Returns where the reply landed (page + anchor).
 */
export async function postReply(viewer: ForumViewer, input: PostReplyInput): Promise<WriteResult<{ replyId: string; page: number }>> {
  if (!viewer.userId) return { ok: false, error: 'Sign in to reply.' };
  const uid = viewer.userId;
  const thread = await loadThreadForWrite(input.threadId, viewer);
  if (!thread) return { ok: false, error: 'No such thread.' };
  if (thread.locked && !canModerate(viewer, thread.orgId)) return { ok: false, error: 'This topic is locked.' };

  const html = textToHtml(input.text ?? '');
  if (!html.replace(/<[^>]+>/g, '').trim()) return { ok: false, error: 'Write something first.' };
  if (html.length > 40_000) return { ok: false, error: 'That reply is too long.' };
  if (await overRateLimit(uid)) return { ok: false, error: 'Slow down — try again in a few minutes.' };

  let parentId: string | null = null;
  let parentAuthor: string | null = null;
  if (input.parentId) {
    const [p] = await db<Array<{ id: string; user_id: string }>>`
      SELECT id, user_id FROM replies WHERE id = ${input.parentId} AND thread_id = ${thread.id}
    `;
    if (!p) return { ok: false, error: 'That reply is gone.' };
    parentId = p.id;
    parentAuthor = p.user_id;
  }

  const replyId = nanoid();
  await db.begin(async (tx) => {
    await tx`
      INSERT INTO replies (id, thread_id, parent_reply_id, user_id, content, created_at, updated_at)
      VALUES (${replyId}, ${thread.id}, ${parentId}, ${uid}, ${html}, NOW(), NOW())
    `;
    await tx`
      UPDATE threads SET reply_count = COALESCE(reply_count, 0) + 1, last_activity_at = NOW(), updated_at = NOW()
      WHERE id = ${thread.id}
    `;
    await tx`INSERT INTO watches (thread_id, user_id) VALUES (${thread.id}, ${uid}) ON CONFLICT DO NOTHING`;
    await tx`
      INSERT INTO thread_reads (user_id, thread_id, last_read_reply_id, last_read_at)
      VALUES (${uid}, ${thread.id}, ${replyId}, NOW())
      ON CONFLICT (user_id, thread_id) DO UPDATE SET last_read_reply_id = EXCLUDED.last_read_reply_id, last_read_at = NOW()
    `;
    // Watchers hear about it; the parent's author hears it as a reply to them.
    await tx`
      INSERT INTO notifications (id, user_id, kind, thread_id, reply_id, actor_id, data)
      SELECT ${nanoid()} || substr(md5(w.user_id::text), 1, 6), w.user_id,
             CASE WHEN w.user_id = ${parentAuthor} THEN 'reply_to_you' ELSE 'reply' END,
             ${thread.id}, ${replyId}, ${uid}, '{}'::jsonb
      FROM watches w
      WHERE w.thread_id = ${thread.id} AND w.user_id <> ${uid}
    `;
    if (parentAuthor && parentAuthor !== uid) {
      await tx`
        INSERT INTO notifications (id, user_id, kind, thread_id, reply_id, actor_id, data)
        SELECT ${nanoid()}, ${parentAuthor}, 'reply_to_you', ${thread.id}, ${replyId}, ${uid}, '{}'::jsonb
        WHERE NOT EXISTS (SELECT 1 FROM watches WHERE thread_id = ${thread.id} AND user_id = ${parentAuthor})
      `;
    }
  });

  return { ok: true, replyId, page: await pageOfReply(thread.id, replyId) };
}

/** Which page of the flat stream a reply (or its top-level ancestor) sits on. */
export async function pageOfReply(threadId: string, replyId: string): Promise<number> {
  const [row] = await db<Array<{ n: number }>>`
    WITH RECURSIVE up AS (
      SELECT id, parent_reply_id, created_at FROM replies WHERE id = ${replyId}
      UNION ALL
      SELECT r.id, r.parent_reply_id, r.created_at FROM replies r JOIN up ON r.id = up.parent_reply_id
    ),
    root AS (SELECT * FROM up WHERE parent_reply_id IS NULL LIMIT 1)
    SELECT COUNT(*)::int AS n
    FROM replies r, root
    WHERE r.thread_id = ${threadId} AND r.parent_reply_id IS NULL
      AND (r.created_at < root.created_at OR (r.created_at = root.created_at AND r.id <= root.id))
  `;
  return Math.max(1, Math.ceil((row?.n ?? 1) / REPLIES_PER_PAGE));
}

// ── topics (threads) ────────────────────────────────────────────────────────

export interface CreateTopicInput {
  orgId: string;
  feedSlug: string;
  title: string;
  text: string;
  topicIds?: string[];
}

export async function createTopic(viewer: ForumViewer, input: CreateTopicInput): Promise<WriteResult<{ threadId: string; slug: string }>> {
  if (!viewer.userId) return { ok: false, error: 'Sign in to start a topic.' };
  const uid = viewer.userId;
  const feed = await getOrgFeed(input.orgId, input.feedSlug);
  if (!feed) return { ok: false, error: 'No such forum.' };
  const role = viewer.roles[input.orgId] ?? null;
  if (!viewer.isGlobalAdmin && !canViewFeed(feed, role)) return { ok: false, error: 'This forum is for members.' };

  const title = (input.title ?? '').trim().replace(/\s+/g, ' ');
  if (title.length < 2) return { ok: false, error: 'Give it a title.' };
  if (title.length > 200) return { ok: false, error: 'That title is too long.' };
  const html = textToHtml(input.text ?? '');
  if (!html.replace(/<[^>]+>/g, '').trim()) return { ok: false, error: 'Write something first.' };
  if (await overRateLimit(uid)) return { ok: false, error: 'Slow down — try again in a few minutes.' };

  const post = await createThread({
    kind: 'post',
    title,
    orgId: input.orgId,
    authorId: uid,
    body: html,
    status: 'published',
    visibility: 'PUBLIC',
    section: feed.slug,
  });

  const topicIds = (input.topicIds ?? []).filter(Boolean);
  if (topicIds.length) {
    await db`
      INSERT INTO thread_topics (thread_id, topic_id)
      SELECT ${post.id}, tp.id FROM topics tp
      WHERE tp.id = ANY(${topicIds}) AND (tp.status = 'approved' OR tp.org_id = ${input.orgId})
      ON CONFLICT DO NOTHING
    `;
  }
  await db`INSERT INTO watches (thread_id, user_id) VALUES (${post.id}, ${uid}) ON CONFLICT DO NOTHING`;
  await db`
    INSERT INTO thread_reads (user_id, thread_id, last_read_at) VALUES (${uid}, ${post.id}, NOW())
    ON CONFLICT (user_id, thread_id) DO UPDATE SET last_read_at = NOW()
  `;
  return { ok: true, threadId: post.id, slug: post.slug };
}

// ── votes and hearts ────────────────────────────────────────────────────────

export interface VoteTarget {
  threadId: string;
  /** Null targets the thread itself. */
  replyId: string | null;
}

async function targetAuthor(t: VoteTarget): Promise<string | null> {
  if (t.replyId) {
    const [r] = await db<Array<{ user_id: string }>>`SELECT user_id FROM replies WHERE id = ${t.replyId} AND thread_id = ${t.threadId}`;
    return r?.user_id ?? null;
  }
  const [r] = await db<Array<{ author_id: string }>>`SELECT author_id FROM threads WHERE id = ${t.threadId}`;
  return r?.author_id ?? null;
}

async function recount(t: VoteTarget): Promise<{ score: number; hearts: number }> {
  const [row] = t.replyId
    ? await db<Array<{ score: number; hearts: number }>>`
        UPDATE replies p SET
          vote_score = (SELECT COALESCE(SUM(CASE kind WHEN 'up' THEN 1 WHEN 'down' THEN -1 ELSE 0 END), 0) FROM reactions WHERE reply_id = p.id),
          reaction_count = (SELECT COUNT(*) FROM reactions WHERE reply_id = p.id AND kind = 'like')
        WHERE p.id = ${t.replyId}
        RETURNING vote_score AS score, reaction_count AS hearts`
    : await db<Array<{ score: number; hearts: number }>>`
        UPDATE threads t SET
          vote_score = (SELECT COALESCE(SUM(CASE kind WHEN 'up' THEN 1 WHEN 'down' THEN -1 ELSE 0 END), 0) FROM reactions WHERE thread_id = t.id AND reply_id IS NULL),
          reaction_count = (SELECT COUNT(*) FROM reactions WHERE thread_id = t.id AND reply_id IS NULL AND kind = 'like')
        WHERE t.id = ${t.threadId}
        RETURNING vote_score AS score, reaction_count AS hearts`;
  return { score: row?.score ?? 0, hearts: row?.hearts ?? 0 };
}

/**
 * Cast, switch or clear a vote. Voting the same way again clears it (a
 * toggle); voting the other way switches. Own posts can't be voted on.
 */
export async function setVote(viewer: ForumViewer, target: VoteTarget, kind: 'up' | 'down'): Promise<WriteResult<{ score: number; vote: 'up' | 'down' | null }>> {
  if (!viewer.userId) return { ok: false, error: 'Sign in to vote.' };
  const uid = viewer.userId;
  if (!(await loadThreadForWrite(target.threadId, viewer))) return { ok: false, error: 'No such thread.' };
  if ((await targetAuthor(target)) === uid) return { ok: false, error: "You can't vote on your own post." };

  const where = target.replyId
    ? db`reply_id = ${target.replyId} AND user_id = ${uid} AND kind IN ('up','down')`
    : db`thread_id = ${target.threadId} AND reply_id IS NULL AND user_id = ${uid} AND kind IN ('up','down')`;
  const [existing] = await db<Array<{ kind: 'up' | 'down' }>>`SELECT kind FROM reactions WHERE ${where}`;
  await db`DELETE FROM reactions WHERE ${where}`;
  let vote: 'up' | 'down' | null = null;
  if (!existing || existing.kind !== kind) {
    await db`
      INSERT INTO reactions (id, thread_id, reply_id, user_id, kind)
      VALUES (${nanoid()}, ${target.threadId}, ${target.replyId}, ${uid}, ${kind})
    `;
    vote = kind;
  }
  const { score } = await recount(target);
  return { ok: true, score, vote };
}

export async function toggleHeart(viewer: ForumViewer, target: VoteTarget): Promise<WriteResult<{ hearts: number; hearted: boolean }>> {
  if (!viewer.userId) return { ok: false, error: 'Sign in to react.' };
  const uid = viewer.userId;
  if (!(await loadThreadForWrite(target.threadId, viewer))) return { ok: false, error: 'No such thread.' };
  const where = target.replyId
    ? db`reply_id = ${target.replyId} AND user_id = ${uid} AND kind = 'like'`
    : db`thread_id = ${target.threadId} AND reply_id IS NULL AND user_id = ${uid} AND kind = 'like'`;
  const deleted = await db`DELETE FROM reactions WHERE ${where} RETURNING id`;
  let hearted = false;
  if (deleted.length === 0) {
    await db`INSERT INTO reactions (id, thread_id, reply_id, user_id, kind) VALUES (${nanoid()}, ${target.threadId}, ${target.replyId}, ${uid}, 'like')`;
    hearted = true;
    // Hearts on your post are worth hearing about; toggling it off is not.
    const author = await targetAuthor(target);
    if (author && author !== uid) {
      await db`INSERT INTO notifications (id, user_id, kind, thread_id, reply_id, actor_id, data) VALUES (${nanoid()}, ${author}, 'heart', ${target.threadId}, ${target.replyId}, ${uid}, '{}'::jsonb)`;
    }
  }
  const { hearts } = await recount(target);
  return { ok: true, hearts, hearted };
}

export interface Voters {
  up: ForumPerson[];
  down: ForumPerson[];
  hearts: ForumPerson[];
}

/** Named voters, because votes here are attributed (decision 6). */
export async function listVoters(target: VoteTarget): Promise<Voters> {
  const where = target.replyId ? db`r.reply_id = ${target.replyId}` : db`r.thread_id = ${target.threadId} AND r.reply_id IS NULL`;
  const rows = await db<Array<{ kind: string; id: string; slug: string | null; name: string | null; avatar: string | null; color: string | null }>>`
    SELECT r.kind, u.id, u.slug, u.display_name AS name, u.avatar_url AS avatar, u.comment_color AS color
    FROM reactions r JOIN users u ON u.id = r.user_id
    WHERE ${where}
    ORDER BY r.created_at ASC
  `;
  const p = (r: (typeof rows)[number]): ForumPerson => ({ id: r.id, slug: r.slug, name: r.name ?? 'Someone', avatarUrl: r.avatar, commentColor: r.color });
  return {
    up: rows.filter((r) => r.kind === 'up').map(p),
    down: rows.filter((r) => r.kind === 'down').map(p),
    hearts: rows.filter((r) => r.kind === 'like').map(p),
  };
}

// ── watch, bookmark, read ───────────────────────────────────────────────────

export async function toggleWatch(viewer: ForumViewer, threadId: string): Promise<WriteResult<{ watching: boolean }>> {
  if (!viewer.userId) return { ok: false, error: 'Sign in to watch topics.' };
  if (!(await loadThreadForWrite(threadId, viewer))) return { ok: false, error: 'No such thread.' };
  const gone = await db`DELETE FROM watches WHERE thread_id = ${threadId} AND user_id = ${viewer.userId} RETURNING 1`;
  if (gone.length) return { ok: true, watching: false };
  await db`INSERT INTO watches (thread_id, user_id) VALUES (${threadId}, ${viewer.userId})`;
  return { ok: true, watching: true };
}

export async function toggleBookmark(viewer: ForumViewer, threadId: string): Promise<WriteResult<{ bookmarked: boolean }>> {
  if (!viewer.userId) return { ok: false, error: 'Sign in to bookmark.' };
  if (!(await loadThreadForWrite(threadId, viewer))) return { ok: false, error: 'No such thread.' };
  const gone = await db`DELETE FROM bookmarks WHERE thread_id = ${threadId} AND user_id = ${viewer.userId} AND reply_id IS NULL RETURNING 1`;
  if (gone.length) return { ok: true, bookmarked: false };
  await db`INSERT INTO bookmarks (id, user_id, thread_id) VALUES (${nanoid()}, ${viewer.userId}, ${threadId})`;
  return { ok: true, bookmarked: true };
}

/** Called when a thread page renders: the viewer has now seen through `lastReplyId`. */
export async function markThreadRead(userId: string, threadId: string, lastReplyId: string | null): Promise<void> {
  try {
    await db`
      INSERT INTO thread_reads (user_id, thread_id, last_read_reply_id, last_read_at)
      VALUES (${userId}, ${threadId}, ${lastReplyId}, NOW())
      ON CONFLICT (user_id, thread_id) DO UPDATE
        SET last_read_reply_id = COALESCE(EXCLUDED.last_read_reply_id, thread_reads.last_read_reply_id),
            last_read_at = NOW()
    `;
  } catch (err) {
    console.error('[forum] markThreadRead:', err);
  }
}

export async function markAllRead(viewer: ForumViewer): Promise<WriteResult> {
  if (!viewer.userId) return { ok: false, error: 'Sign in first.' };
  await db`UPDATE users SET forum_read_all_at = NOW() WHERE id = ${viewer.userId}`;
  return { ok: true };
}

// ── taxonomy ────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/**
 * Owners and guides propose; a global admin's proposal is approved at once.
 * A proposed topic is usable by its origin org immediately.
 */
export async function proposeTopic(viewer: ForumViewer, input: { name: string; orgId: string }): Promise<WriteResult<{ topicId: string; status: string }>> {
  if (!viewer.userId) return { ok: false, error: 'Sign in first.' };
  if (!canModerate(viewer, input.orgId)) return { ok: false, error: 'Only org owners and guides can propose topics.' };
  const name = (input.name ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 60) return { ok: false, error: 'A topic is two to sixty characters.' };
  const slug = slugify(name);
  if (!slug) return { ok: false, error: 'That name has no letters in it.' };
  const [dup] = await db<Array<{ id: string; status: string }>>`SELECT id, status FROM topics WHERE slug = ${slug} OR LOWER(name) = LOWER(${name}) LIMIT 1`;
  if (dup) return { ok: true, topicId: dup.id, status: dup.status };
  const status = viewer.isGlobalAdmin ? 'approved' : 'proposed';
  const id = nanoid();
  await db`
    INSERT INTO topics (id, name, slug, status, proposed_by, org_id, reviewed_at)
    VALUES (${id}, ${name}, ${slug}, ${status}, ${viewer.userId}, ${input.orgId}, ${status === 'approved' ? db`NOW()` : null})
  `;
  return { ok: true, topicId: id, status };
}

export async function reviewTopic(viewer: ForumViewer, topicId: string, decision: 'approved' | 'rejected'): Promise<WriteResult> {
  if (!viewer.isGlobalAdmin) return { ok: false, error: 'Admins only.' };
  await db`UPDATE topics SET status = ${decision}, reviewed_at = NOW() WHERE id = ${topicId}`;
  return { ok: true };
}

/** Topics an org's author may pick from: approved everywhere, plus the org's own proposals. */
export async function listTopicChoices(orgId: string): Promise<Array<{ id: string; slug: string; name: string; status: string }>> {
  return db<Array<{ id: string; slug: string; name: string; status: string }>>`
    SELECT id, slug, name, status FROM topics
    WHERE status = 'approved' OR (status = 'proposed' AND org_id = ${orgId})
    ORDER BY status ASC, name ASC
  `;
}

// ── moderation ──────────────────────────────────────────────────────────────

export type ModAction = 'pin' | 'unpin' | 'lock' | 'unlock' | 'delete' | 'move';

/**
 * The audit trail for a moderation act.
 *
 * `events` is (id, org_id, user_id, action, resource_type, resource_id,
 * data, created_at) — not the actor_id/entity_type/metadata shape an
 * earlier version of this function guessed at, which failed silently
 * inside a catch. Actions reuse the existing EventAction vocabulary where
 * one fits, so the admin dashboard's filters keep working.
 */
const MOD_EVENT: Record<ModAction, string> = {
  pin: 'content_pinned',
  unpin: 'content_unpinned',
  lock: 'content_locked',
  unlock: 'content_unlocked',
  delete: 'content_hidden',
  move: 'post_updated',
};

async function logModeration(viewer: ForumViewer, orgId: string, threadId: string, action: ModAction, arg?: string): Promise<void> {
  try {
    await db`
      INSERT INTO events (id, org_id, user_id, action, resource_type, resource_id, data, created_at)
      VALUES (${nanoid()}, ${orgId}, ${viewer.userId}, ${MOD_EVENT[action]}, 'post', ${threadId},
              ${db.json({ via: 'forum', action, ...(arg ? { to: arg } : {}) })}, NOW())
    `;
  } catch (err) {
    // The act itself already happened; losing its log entry must not undo it.
    console.error('[forum] logModeration:', err);
  }
}

export async function moderateThread(viewer: ForumViewer, threadId: string, action: ModAction, arg?: string): Promise<WriteResult> {
  const [t] = await db<Array<{ org_id: string }>>`SELECT org_id FROM threads WHERE id = ${threadId}`;
  if (!t) return { ok: false, error: 'No such thread.' };
  if (!canModerate(viewer, t.org_id)) return { ok: false, error: 'Owners and guides only.' };
  switch (action) {
    case 'pin': await db`UPDATE threads SET pinned = TRUE WHERE id = ${threadId}`; break;
    case 'unpin': await db`UPDATE threads SET pinned = FALSE WHERE id = ${threadId}`; break;
    case 'lock': await db`UPDATE threads SET locked = TRUE WHERE id = ${threadId}`; break;
    case 'unlock': await db`UPDATE threads SET locked = FALSE WHERE id = ${threadId}`; break;
    case 'delete': await db`UPDATE threads SET status = 'archived', updated_at = NOW() WHERE id = ${threadId}`; break;
    case 'move': {
      if (!arg) return { ok: false, error: 'Pick a forum to move to.' };
      const feed = await getOrgFeed(t.org_id, arg);
      if (!feed) return { ok: false, error: 'No such forum.' };
      await db`UPDATE threads SET section = ${feed.slug}, updated_at = NOW() WHERE id = ${threadId}`;
      break;
    }
  }
  await logModeration(viewer, t.org_id, threadId, action, arg);
  return { ok: true };
}

// ── notifications ───────────────────────────────────────────────────────────

export interface ForumNotification {
  id: string;
  kind: string;
  threadId: string | null;
  threadSlug: string | null;
  threadTitle: string | null;
  replyId: string | null;
  actor: ForumPerson | null;
  readAt: Date | null;
  createdAt: Date;
}

export async function listNotifications(userId: string, limit = 20): Promise<ForumNotification[]> {
  const rows = await db<Array<{
    id: string; kind: string; thread_id: string | null; thread_slug: string | null; thread_title: string | null;
    reply_id: string | null; read_at: Date | null; created_at: Date;
    a_id: string | null; a_slug: string | null; a_name: string | null; a_avatar: string | null; a_color: string | null;
  }>>`
    SELECT n.id, n.kind, n.thread_id, t.slug AS thread_slug, t.title AS thread_title, n.reply_id, n.read_at, n.created_at,
           a.id AS a_id, a.slug AS a_slug, a.display_name AS a_name, a.avatar_url AS a_avatar, a.comment_color AS a_color
    FROM notifications n
    LEFT JOIN threads t ON t.id = n.thread_id
    LEFT JOIN users a ON a.id = n.actor_id
    WHERE n.user_id = ${userId}
    ORDER BY n.created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id, kind: r.kind, threadId: r.thread_id, threadSlug: r.thread_slug, threadTitle: r.thread_title, replyId: r.reply_id,
    actor: r.a_id ? { id: r.a_id, slug: r.a_slug, name: r.a_name ?? 'Someone', avatarUrl: r.a_avatar, commentColor: r.a_color } : null,
    readAt: r.read_at, createdAt: r.created_at,
  }));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const [r] = await db<Array<{ n: number }>>`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = ${userId} AND read_at IS NULL`;
  return r?.n ?? 0;
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await db`UPDATE notifications SET read_at = NOW() WHERE user_id = ${userId} AND read_at IS NULL`;
}
