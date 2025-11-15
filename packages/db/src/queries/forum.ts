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
  type: 'post' | 'meeting';
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
        'post' AS type,
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
        'meeting' AS type,
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
          (w.watchable_type = 'post' AND w.watchable_id = combined.id AND combined.type = 'post')
          OR
          (w.watchable_type = 'meeting' AND w.watchable_id = combined.id AND combined.type = 'meeting')
        )
        AND w.user_id = ${userId}
      )` : db`FALSE`} AS is_watching,
      ${userId ? db`EXISTS(
        SELECT 1 FROM bookmarks b
        WHERE (
          (b.bookmarkable_type = 'post' AND b.bookmarkable_id = combined.id AND combined.type = 'post')
          OR
          (b.bookmarkable_type = 'meeting' AND b.bookmarkable_id = combined.id AND combined.type = 'meeting')
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
      'post' AS type,
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
      'meeting' AS type,
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
// REPLIES QUERY
// ============================================================================

export async function getReplies(threadId: string, threadType: 'post' | 'meeting', sort: 'oldest' | 'newest' | 'reactions' = 'oldest') {
  const replies = await db<Reply[]>`
    SELECT
      r.id,
      CASE
        WHEN r.parent_type = 'reply' THEN r.parent_id
        ELSE NULL
      END AS parent_id,
      r.user_id,
      r.content,
      r.created_at,
      r.updated_at,
      r.edited_at,
      COALESCE(r.reaction_count, 0) AS reaction_count,
      u.display_name AS user_name,
      u.avatar_url AS user_avatar,
      COALESCE(u.trust_level, 0) AS user_trust_level,
      CONCAT(
        SUBSTRING(SPLIT_PART(u.display_name, ' ', 1), 1, 1),
        COALESCE(SUBSTRING(SPLIT_PART(u.display_name, ' ', 2), 1, 1), '')
      ) AS user_initials
    FROM replies r
    JOIN users u ON u.id = r.user_id
    WHERE r.parent_type = ${threadType}
      AND r.parent_id = ${threadId}
      OR (
        r.parent_type = 'reply'
        AND r.parent_id IN (
          SELECT id FROM replies
          WHERE parent_type = ${threadType} AND parent_id = ${threadId}
        )
      )
    ORDER BY
      ${sort === 'newest' ? db`r.created_at DESC` :
        sort === 'reactions' ? db`r.reaction_count DESC, r.created_at ASC` :
        db`r.created_at ASC`}
  `;

  // Build nested tree
  return buildReplyTree(replies, threadId);
}

function buildReplyTree(replies: Reply[], threadId: string): Reply[] {
  const replyMap = new Map<string, Reply>();
  const rootReplies: Reply[] = [];

  // First pass: create map
  replies.forEach(reply => {
    replyMap.set(reply.id, { ...reply, children: [] });
  });

  // Second pass: build tree
  replies.forEach(reply => {
    const node = replyMap.get(reply.id)!;
    
    if (!reply.parentId || reply.parentId === threadId) {
      // Root-level reply
      rootReplies.push(node);
    } else {
      // Nested reply
      const parent = replyMap.get(reply.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        // Orphaned reply, add to root
        rootReplies.push(node);
      }
    }
  });

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

export async function createReply(data: {
  threadId: string;
  threadType: 'post' | 'meeting';
  parentId: string | null;
  userId: string;
  content: string;
}) {
  const { threadId, threadType, parentId, userId, content } = data;
  const replyId = nanoid();

  const result = await db`
    INSERT INTO replies (
      id,
      parent_type,
      parent_id,
      user_id,
      content,
      created_at,
      updated_at
    ) VALUES (
      ${replyId},
      ${parentId ? 'reply' : threadType},
      ${parentId || threadId},
      ${userId},
      ${content},
      NOW(),
      NOW()
    )
    RETURNING *
  `;

  return result[0];
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
