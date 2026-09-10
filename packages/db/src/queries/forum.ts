/**
 * Reply queries.
 *
 * This file used to be the whole forum read layer. Everything in it except
 * the reply functions queried `posts` / `meetings` / `post_topics` /
 * `meeting_topics` — dropped by migration 030 — and the three toggles
 * (`toggleReaction`, `toggleWatch`, `toggleBookmark`) wrote to
 * `reactable_type` / `watchable_type` / `bookmarkable_type` columns that
 * never existed on this database. All of that is gone (2026-09-08).
 *
 * The forum's own reads now live in `@elkdonis/services` (`forum.ts`).
 * What stays here is the reply surface that inner-gathering still imports:
 *
 *   - `getReplies(threadId, opts?)`      — tree
 *   - `getRepliesFlat(threadId, opts?)`  — flat, ordered
 *   - `createReply({...})`               — insert + atomic reply_count bump
 *   - `buildReplyTree(replies)`          — helper
 *
 * Foundation:
 *   - Every reply hangs off a `threads` row via `replies.thread_id`.
 *   - Nesting is self-referential: `replies.parent_reply_id`.
 *   - There is no polymorphic discriminator; the optional `threadType`
 *     arguments are accepted and ignored for backwards compatibility.
 */

import { db } from '../client';
import { nanoid } from 'nanoid';

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
      COALESCE(u.trust_level, 0) AS user_trust_level,
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

/**
 * Insert a reply and bump the thread's reply_count in one statement. The
 * returned row is already enriched with the author, so API routes don't
 * need a follow-up SELECT.
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
      SET reply_count      = COALESCE(reply_count, 0) + 1,
          last_activity_at = NOW(),
          updated_at       = NOW()
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
      COALESCE(u.trust_level, 0) AS user_trust_level,
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
