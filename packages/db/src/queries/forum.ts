/**
 * Forum queries for cross-organization content aggregation
 * 
 * Used by /forum app to show unified feed of posts + meetings
 */

import { db } from '../client';
import { nanoid } from 'nanoid';

// ============================================================================
// TYPES
// ============================================================================

export interface ForumThread {
  kind: 'post' | 'meeting' | 'workshop';
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorInitials: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  createdAt: Date;
  lastActivityAt: Date;
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  reactionCount: number;
  viewCount: number;
  topicIds: string[];
  topicNames: string[];
  // Meeting-specific
  scheduledAt?: Date | null;
  location?: string | null;
  isOnline?: boolean | null;
  // User state
  isWatching?: boolean;
  isBookmarked?: boolean;
}

export interface ForumFeedOptions {
  userId?: string;
  sort?: 'active' | 'newest' | 'oldest' | 'reactions';
  orgIds?: string[];
  topicIds?: string[];
  onlyWatching?: boolean;
  onlyBookmarked?: boolean;
  page?: number;
  limit?: number;
}

export interface Reply {
  id: string;
  parentId: string | null;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  reactionCount: number;
  userName: string;
  userAvatar: string | null;
  userInitials: string;
  userTrustLevel: number;
  commentColor?: string;
  children?: Reply[];
}

// ============================================================================
// FORUM FEED QUERY
// ============================================================================

export async function getForumFeed(options: ForumFeedOptions) {
  const {
    userId = null,
    sort = 'active',
    orgIds = [],
    topicIds = [],
    onlyWatching = false,
    onlyBookmarked = false,
    page = 1,
    limit = 25
  } = options;

  const offset = (page - 1) * limit;

  // Build the unified query
  const threads = await db<ForumThread[]>`
    WITH posts_data AS (
      SELECT
        'post' AS kind,
        p.id,
        p.title,
        COALESCE(p.excerpt, LEFT(p.body, 200)) AS excerpt,
        p.slug,
        p.author_id AS author_id,
        u.display_name AS author_name,
        u.avatar_url AS author_avatar,
        CONCAT(
          SUBSTRING(SPLIT_PART(u.display_name, ' ', 1), 1, 1),
          COALESCE(SUBSTRING(SPLIT_PART(u.display_name, ' ', 2), 1, 1), '')
        ) AS author_initials,
        p.org_id,
        o.name AS org_name,
        o.slug AS org_slug,
        p.created_at,
        COALESCE(p.last_activity_at, p.published_at, p.created_at) AS last_activity_at,
        COALESCE(p.is_pinned, false) AS is_pinned,
        COALESCE(p.is_locked, false) AS is_locked,
        p.reply_count,
        COALESCE(p.reaction_count, 0) AS reaction_count,
        p.view_count,
        NULL::TIMESTAMPTZ AS scheduled_at,
        NULL::TEXT AS location,
        NULL::BOOLEAN AS is_online,
        COALESCE(
          ARRAY_AGG(t.id) FILTER (WHERE t.id IS NOT NULL),
          '{}'::TEXT[]
        ) AS topic_ids,
        COALESCE(
          ARRAY_AGG(t.name) FILTER (WHERE t.name IS NOT NULL),
          '{}'::TEXT[]
        ) AS topic_names
      FROM posts p
      JOIN users u ON u.id = p.author_id
      JOIN organizations o ON o.id = p.org_id
      LEFT JOIN post_topics pt ON pt.post_id = p.id
      LEFT JOIN topics t ON t.id = pt.topic_id
      WHERE p.status = 'published'
        AND p.visibility = 'PUBLIC'
      GROUP BY p.id, u.id, u.display_name, u.avatar_url, o.id, o.name, o.slug
    ),
    meetings_data AS (
      SELECT
        'meeting' AS kind,
        m.id,
        m.title,
        LEFT(COALESCE(m.description, ''), 200) AS excerpt,
        m.slug,
        m.guide_id AS author_id,
        u.display_name AS author_name,
        u.avatar_url AS author_avatar,
        CONCAT(
          SUBSTRING(SPLIT_PART(u.display_name, ' ', 1), 1, 1),
          COALESCE(SUBSTRING(SPLIT_PART(u.display_name, ' ', 2), 1, 1), '')
        ) AS author_initials,
        m.org_id,
        o.name AS org_name,
        o.slug AS org_slug,
        m.created_at,
        COALESCE(m.last_activity_at, m.published_at, m.created_at) AS last_activity_at,
        COALESCE(m.is_pinned, false) AS is_pinned,
        COALESCE(m.is_locked, false) AS is_locked,
        m.reply_count,
        COALESCE(m.reaction_count, 0) AS reaction_count,
        m.view_count,
        m.scheduled_at,
        m.location,
        m.is_online,
        COALESCE(
          ARRAY_AGG(t.id) FILTER (WHERE t.id IS NOT NULL),
          '{}'::TEXT[]
        ) AS topic_ids,
        COALESCE(
          ARRAY_AGG(t.name) FILTER (WHERE t.name IS NOT NULL),
          '{}'::TEXT[]
        ) AS topic_names
      FROM meetings m
      JOIN users u ON u.id = m.guide_id
      JOIN organizations o ON o.id = m.org_id
      LEFT JOIN meeting_topics mt ON mt.meeting_id = m.id
      LEFT JOIN topics t ON t.id = mt.topic_id
      WHERE m.status = 'published'
        AND m.visibility = 'PUBLIC'
      GROUP BY m.id, u.id, u.display_name, u.avatar_url, o.id, o.name, o.slug
    ),
    combined AS (
      SELECT * FROM posts_data
      UNION ALL
      SELECT * FROM meetings_data
    )
    SELECT
      *,
      ${userId ? db`EXISTS(
        SELECT 1 FROM watches w
        WHERE (
          (w.watchable_type = 'post' AND w.watchable_id = combined.id AND combined.kind = 'post')
          OR
          (w.watchable_type = 'meeting' AND w.watchable_id = combined.id AND combined.kind = 'meeting')
        )
        AND w.user_id = ${userId}
      )` : db`FALSE`} AS is_watching,
      ${userId ? db`EXISTS(
        SELECT 1 FROM bookmarks b
        WHERE (
          (b.bookmarkable_type = 'post' AND b.bookmarkable_id = combined.id AND combined.kind = 'post')
          OR
          (b.bookmarkable_type = 'meeting' AND b.bookmarkable_id = combined.id AND combined.kind = 'meeting')
        )
        AND b.user_id = ${userId}
      )` : db`FALSE`} AS is_bookmarked
    FROM combined
    WHERE 1=1
      ${orgIds.length > 0 ? db`AND org_id = ANY(${orgIds})` : db``}
      ${topicIds.length > 0 ? db`AND topic_ids && ${topicIds}` : db``}
    ORDER BY
      is_pinned DESC,
      ${sort === 'newest' ? db`created_at DESC` :
        sort === 'oldest' ? db`created_at ASC` :
        sort === 'reactions' ? db`reaction_count DESC, last_activity_at DESC` :
        db`last_activity_at DESC`}
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  // Get total count (simplified - just count published posts + meetings)
  const countResult = await db<[{ count: string }]>`
    SELECT (
      (SELECT COUNT(*) FROM posts WHERE status = 'published' AND visibility = 'PUBLIC') +
      (SELECT COUNT(*) FROM meetings WHERE status = 'published' AND visibility = 'PUBLIC')
    )::TEXT AS count
  `;

  const totalCount = parseInt(countResult[0].count);

  return {
    threads,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
}

// ============================================================================
// THREAD DETAIL QUERY
// ============================================================================

export async function getThread(slug: string, userId?: string) {
  // Try posts first
  const posts = await db`
    SELECT
      'post' AS kind,
      p.id,
      p.title,
      p.body,
      p.slug,
      p.author_id,
      u.display_name AS author_name,
      u.avatar_url AS author_avatar,
      COALESCE(u.trust_level, 0) AS author_trust_level,
      CONCAT(
        SUBSTRING(SPLIT_PART(u.display_name, ' ', 1), 1, 1),
        COALESCE(SUBSTRING(SPLIT_PART(u.display_name, ' ', 2), 1, 1), '')
      ) AS author_initials,
      p.org_id,
      o.name AS org_name,
      o.slug AS org_slug,
      p.created_at,
      p.published_at,
      COALESCE(p.is_pinned, false) AS is_pinned,
      COALESCE(p.is_locked, false) AS is_locked,
      p.reply_count,
      COALESCE(p.reaction_count, 0) AS reaction_count,
      p.view_count,
      NULL::TIMESTAMPTZ AS scheduled_at,
      NULL::TEXT AS location,
      NULL::BOOLEAN AS is_online,
      NULL::TEXT AS meeting_url,
      COALESCE(
        ARRAY_AGG(t.id) FILTER (WHERE t.id IS NOT NULL),
        '{}'::TEXT[]
      ) AS topic_ids,
      COALESCE(
        ARRAY_AGG(t.name) FILTER (WHERE t.name IS NOT NULL),
        '{}'::TEXT[]
      ) AS topic_names
    FROM posts p
    JOIN users u ON u.id = p.author_id
    JOIN organizations o ON o.id = p.org_id
    LEFT JOIN post_topics pt ON pt.post_id = p.id
    LEFT JOIN topics t ON t.id = pt.topic_id
    WHERE p.slug = ${slug}
      AND p.status = 'published'
    GROUP BY p.id, u.id, u.display_name, u.avatar_url, u.trust_level, o.id, o.name, o.slug
  `;

  if (posts.length > 0) {
    return posts[0];
  }

  // Try meetings
  const meetings = await db`
    SELECT
      'meeting' AS kind,
      m.id,
      m.title,
      m.description AS body,
      m.slug,
      m.guide_id AS author_id,
      u.display_name AS author_name,
      u.avatar_url AS author_avatar,
      COALESCE(u.trust_level, 0) AS author_trust_level,
      CONCAT(
        SUBSTRING(SPLIT_PART(u.display_name, ' ', 1), 1, 1),
        COALESCE(SUBSTRING(SPLIT_PART(u.display_name, ' ', 2), 1, 1), '')
      ) AS author_initials,
      m.org_id,
      o.name AS org_name,
      o.slug AS org_slug,
      m.created_at,
      m.published_at,
      COALESCE(m.is_pinned, false) AS is_pinned,
      COALESCE(m.is_locked, false) AS is_locked,
      m.reply_count,
      COALESCE(m.reaction_count, 0) AS reaction_count,
      m.view_count,
      m.scheduled_at,
      m.location,
      m.is_online,
      m.meeting_url,
      COALESCE(
        ARRAY_AGG(t.id) FILTER (WHERE t.id IS NOT NULL),
        '{}'::TEXT[]
      ) AS topic_ids,
      COALESCE(
        ARRAY_AGG(t.name) FILTER (WHERE t.name IS NOT NULL),
        '{}'::TEXT[]
      ) AS topic_names
    FROM meetings m
    JOIN users u ON u.id = m.guide_id
    JOIN organizations o ON o.id = m.org_id
    LEFT JOIN meeting_topics mt ON mt.meeting_id = m.id
    LEFT JOIN topics t ON t.id = mt.topic_id
    WHERE m.slug = ${slug}
      AND m.status = 'published'
    GROUP BY m.id, u.id, u.display_name, u.avatar_url, u.trust_level, o.id, o.name, o.slug
  `;

  if (meetings.length === 0) {
    throw new Error('Thread not found');
  }

  return meetings[0];
}

// ============================================================================
// REPLIES — SINGLE SOURCE OF TRUTH
// ============================================================================
//
// Foundation:
//   - Every reply hangs off a `threads` row via `replies.thread_id` (FK).
//   - Nesting is self-referential: `replies.parent_reply_id` (FK to replies).
//   - There is NO polymorphic discriminator. The source `schemas.ts` once
//     described one (`parent_type` / `parent_id`); that pattern was never
//     applied to this DB and has been removed from this query layer.
//
// Public surface (use these everywhere; do not duplicate):
//   - `getReplies(threadId, opts?)`       — flat ordered enriched list
//   - `getRepliesTree(threadId, opts?)`   — same data assembled into a tree
//   - `createReply({...})`                — insert + atomic activity bump
//   - `buildReplyTree(replies)`           — helper, client- or server-side
//
// The optional `threadType` argument on getReplies/createReply is accepted
// and ignored. Callers may pass it for documentation, but it is no longer
// load-bearing — kept for backwards compatibility across apps.

export interface GetRepliesOptions {
  sort?: 'oldest' | 'newest';
  /** No-op; retained for backwards compatibility. */
  threadType?: 'post' | 'meeting' | 'workshop' | 'thread';
}

async function fetchRepliesFlat(threadId: string, sort: 'oldest' | 'newest' = 'oldest'): Promise<Reply[]> {
  return db<Reply[]>`
    SELECT
      r.id,
      r.parent_reply_id AS parent_id,
      r.user_id,
      r.content,
      r.created_at,
      r.updated_at,
      r.edited_at,
      COALESCE(r.reaction_count, 0) AS reaction_count,
      u.display_name  AS user_name,
      u.avatar_url    AS user_avatar,
      u.comment_color,
      0               AS user_trust_level,
      CONCAT(
        SUBSTRING(SPLIT_PART(COALESCE(u.display_name, '?'), ' ', 1), 1, 1),
        COALESCE(SUBSTRING(SPLIT_PART(COALESCE(u.display_name, ''), ' ', 2), 1, 1), '')
      ) AS user_initials
    FROM replies r
    JOIN users u ON u.id = r.user_id
    WHERE r.thread_id = ${threadId}
    ORDER BY
      ${sort === 'newest' ? db`r.created_at DESC` : db`r.created_at ASC`}
  `;
}

/**
 * Returns the reply tree for a thread. Backwards-compatible with the
 * three-positional-argument call sites — `threadType` is ignored.
 */
export async function getReplies(
  threadId: string,
  threadTypeOrOptions?: 'post' | 'meeting' | 'workshop' | 'thread' | GetRepliesOptions,
  sortLegacy?: 'oldest' | 'newest' | 'reactions',
): Promise<Reply[]> {
  const sort =
    typeof threadTypeOrOptions === 'object'
      ? (threadTypeOrOptions.sort ?? 'oldest')
      : (sortLegacy === 'newest' ? 'newest' : 'oldest');
  const flat = await fetchRepliesFlat(threadId, sort);
  return buildReplyTree(flat, threadId);
}

/** Same data as getReplies, but returned flat (ordered). */
export async function getRepliesFlat(
  threadId: string,
  opts: GetRepliesOptions = {},
): Promise<Reply[]> {
  return fetchRepliesFlat(threadId, opts.sort ?? 'oldest');
}

export function buildReplyTree(replies: Reply[], threadId?: string): Reply[] {
  const replyMap = new Map<string, Reply>();
  const rootReplies: Reply[] = [];

  for (const r of replies) {
    replyMap.set(r.id, { ...r, children: [] });
  }

  for (const r of replies) {
    const node = replyMap.get(r.id)!;
    if (!r.parentId || r.parentId === threadId) {
      rootReplies.push(node);
    } else {
      const parent = replyMap.get(r.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        rootReplies.push(node);
      }
    }
  }

  return rootReplies;
}

// ============================================================================
// USER THREAD STATE
// ============================================================================

export async function getUserThreadState(threadId: string, threadType: 'post' | 'meeting', userId?: string) {
  if (!userId) {
    return {
      isWatching: false,
      isBookmarked: false,
      userReaction: null,
      flagCount: 0
    };
  }

  const state = await db`
    SELECT
      EXISTS(
        SELECT 1 FROM watches w
        WHERE w.watchable_type = ${threadType}
          AND w.watchable_id = ${threadId}
          AND w.user_id = ${userId}
      ) AS is_watching,
      EXISTS(
        SELECT 1 FROM bookmarks b
        WHERE b.bookmarkable_type = ${threadType}
          AND b.bookmarkable_id = ${threadId}
          AND b.user_id = ${userId}
      ) AS is_bookmarked,
      (
        SELECT r.reaction_type
        FROM reactions r
        WHERE r.reactable_type = ${threadType}
          AND r.reactable_id = ${threadId}
          AND r.user_id = ${userId}
        LIMIT 1
      ) AS user_reaction
  `;

  // Get flag count (for moderators)
  const flagResult = await db<[{ count: string }]>`
    SELECT COUNT(*)::TEXT AS count
    FROM flags
    WHERE flaggable_type = ${threadType}
      AND flaggable_id = ${threadId}
      AND status = 'pending'
  `;

  return {
    isWatching: state[0]?.is_watching || false,
    isBookmarked: state[0]?.is_bookmarked || false,
    userReaction: state[0]?.user_reaction || null,
    flagCount: parseInt(flagResult[0]?.count || '0')
  };
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Insert a reply and atomically bump the parent thread's activity
 * (reply_count + updated_at). Returns an enriched `Reply` with author info
 * already attached, so API routes don't need a follow-up SELECT.
 *
 * `threadType` is accepted for backwards compatibility and ignored.
 */
export async function createReply(data: {
  threadId: string;
  parentId: string | null;
  userId: string;
  content: string;
  /** No-op; retained for backwards compatibility. */
  threadType?: 'post' | 'meeting' | 'workshop' | 'thread';
}): Promise<Reply> {
  const { threadId, parentId, userId, content } = data;
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Reply content is required.');

  const replyId = nanoid();

  // Single round-trip: CTE inserts the reply, bumps the thread, joins users,
  // and returns the enriched row. All-or-nothing in one statement.
  const result = await db<Reply[]>`
    WITH inserted AS (
      INSERT INTO replies (
        id, thread_id, parent_reply_id, user_id, content,
        created_at, updated_at
      ) VALUES (
        ${replyId}, ${threadId}, ${parentId}, ${userId}, ${trimmed},
        NOW(), NOW()
      )
      RETURNING id, thread_id, parent_reply_id, user_id, content,
                created_at, updated_at, edited_at, reaction_count
    ),
    bump AS (
      UPDATE threads
      SET reply_count = COALESCE(reply_count, 0) + 1,
          updated_at  = NOW()
      WHERE id = ${threadId}
      RETURNING 1
    )
    SELECT
      i.id,
      i.parent_reply_id AS parent_id,
      i.user_id,
      i.content,
      i.created_at,
      i.updated_at,
      i.edited_at,
      COALESCE(i.reaction_count, 0) AS reaction_count,
      u.display_name  AS user_name,
      u.avatar_url    AS user_avatar,
      u.comment_color,
      0               AS user_trust_level,
      CONCAT(
        SUBSTRING(SPLIT_PART(COALESCE(u.display_name, '?'), ' ', 1), 1, 1),
        COALESCE(SUBSTRING(SPLIT_PART(COALESCE(u.display_name, ''), ' ', 2), 1, 1), '')
      ) AS user_initials
    FROM inserted i
    JOIN users u ON u.id = i.user_id
    WHERE EXISTS (SELECT 1 FROM bump)
  `;

  if (result.length === 0) {
    throw new Error('Failed to create reply.');
  }
  return { ...result[0], children: [] };
}

export async function toggleReaction(data: {
  contentId: string;
  contentType: 'post' | 'meeting' | 'reply';
  userId: string;
  reactionType: 'like' | 'upvote' | 'love' | 'insightful';
}) {
  const { contentId, contentType, userId, reactionType } = data;

  // Check if already reacted
  const existing = await db`
    SELECT id FROM reactions
    WHERE user_id = ${userId}
      AND reactable_type = ${contentType}
      AND reactable_id = ${contentId}
      AND reaction_type = ${reactionType}
  `;

  if (existing.length > 0) {
    // Remove reaction
    await db`
      DELETE FROM reactions
      WHERE id = ${existing[0].id}
    `;
    return { action: 'removed' };
  } else {
    // Add reaction
    await db`
      INSERT INTO reactions (
        id,
        user_id,
        reactable_type,
        reactable_id,
        reaction_type,
        created_at
      ) VALUES (
        ${nanoid()},
        ${userId},
        ${contentType},
        ${contentId},
        ${reactionType},
        NOW()
      )
    `;
    return { action: 'added' };
  }
}

export async function toggleWatch(data: {
  threadId: string;
  threadType: 'post' | 'meeting';
  userId: string;
}) {
  const { threadId, threadType, userId } = data;

  const existing = await db`
    SELECT 1 FROM watches
    WHERE user_id = ${userId}
      AND watchable_type = ${threadType}
      AND watchable_id = ${threadId}
  `;

  if (existing.length > 0) {
    // Unwatch
    await db`
      DELETE FROM watches
      WHERE user_id = ${userId}
        AND watchable_type = ${threadType}
        AND watchable_id = ${threadId}
    `;
    return { watching: false };
  } else {
    // Watch
    await db`
      INSERT INTO watches (
        user_id,
        watchable_type,
        watchable_id,
        started_at
      ) VALUES (
        ${userId},
        ${threadType},
        ${threadId},
        NOW()
      )
    `;
    return { watching: true };
  }
}

export async function toggleBookmark(data: {
  threadId: string;
  threadType: 'post' | 'meeting';
  userId: string;
}) {
  const { threadId, threadType, userId } = data;

  const existing = await db`
    SELECT 1 FROM bookmarks
    WHERE user_id = ${userId}
      AND bookmarkable_type = ${threadType}
      AND bookmarkable_id = ${threadId}
  `;

  if (existing.length > 0) {
    // Unbookmark
    await db`
      DELETE FROM bookmarks
      WHERE user_id = ${userId}
        AND bookmarkable_type = ${threadType}
        AND bookmarkable_id = ${threadId}
    `;
    return { bookmarked: false };
  } else {
    // Bookmark
    await db`
      INSERT INTO bookmarks (
        user_id,
        bookmarkable_type,
        bookmarkable_id,
        bookmarked_at
      ) VALUES (
        ${userId},
        ${threadType},
        ${threadId},
        NOW()
      )
    `;
    return { bookmarked: true };
  }
}

export async function deleteThread(threadId: string): Promise<void> {
  // Try posts first, then meetings — only one will match
  const postResult = await db`
    DELETE FROM posts WHERE id = ${threadId} RETURNING id
  `;
  if (postResult.length > 0) return;

  await db`
    DELETE FROM meetings WHERE id = ${threadId}
  `;
}
