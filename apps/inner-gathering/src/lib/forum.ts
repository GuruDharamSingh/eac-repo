/**
 * Forum data layer for inner-gathering's /forum route.
 *
 * Single-topic forum keyed to the active work_question. Threads are rows in
 * the unified `threads` table (kind='post') tagged with a forum topic.
 *
 * Read access is public; write access is checked at the API/page level.
 */

import { db } from "@elkdonis/db";
import { isAdmin } from "@elkdonis/auth-server";
import { nanoid } from "nanoid";

// Re-export the canonical reply types/helpers from @elkdonis/db so callers
// inside the forum can stay against a single source of truth.
export {
  createReply,
  getReplies,
  getRepliesFlat,
  buildReplyTree,
} from "@elkdonis/db";
export type { Reply } from "@elkdonis/db";

const ORG_ID = "inner_group";
const FORUM_TOPIC_SLUG = "what-is-art-for";
const FORUM_TOPIC_NAME = "What Is Art For?";

// Forum moderation seam: today this is just an admin check, but routing all
// pin/lock/etc. calls through here lets us add a moderator role later without
// touching the API or UI.
export async function canModerateForum(userId: string): Promise<boolean> {
  return isAdmin(userId);
}

export interface ForumLastReply {
  userName: string;
  userInitials: string;
  commentColor: string | null;
  excerpt: string;
  createdAt: Date;
}

export interface ForumThreadSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorAvatar: string | null;
  createdAt: Date;
  lastActivityAt: Date;
  replyCount: number;
  pinned: boolean;
  lastReply: ForumLastReply | null;
}

export interface ForumThreadDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorAvatar: string | null;
  authorCommentColor: string | null;
  createdAt: Date;
  lastActivityAt: Date;
  replyCount: number;
  pinned: boolean;
}

export interface ActiveWorkQuestion {
  id: string;
  question: string;
}

function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

async function ensureForumTopicId(): Promise<string> {
  const existing = await db<{ id: string }[]>`
    SELECT id FROM topics WHERE slug = ${FORUM_TOPIC_SLUG} LIMIT 1
  `;
  if (existing.length > 0) return existing[0].id;

  const id = nanoid();
  await db`
    INSERT INTO topics (id, name, slug, description)
    VALUES (
      ${id},
      ${FORUM_TOPIC_NAME},
      ${FORUM_TOPIC_SLUG},
      ${"Member threads gathered around the collective's current work question."}
    )
    ON CONFLICT (slug) DO NOTHING
  `;
  // If a race inserted a row first, fetch the canonical id.
  const after = await db<{ id: string }[]>`
    SELECT id FROM topics WHERE slug = ${FORUM_TOPIC_SLUG} LIMIT 1
  `;
  return after[0].id;
}

export interface AnonymousReflection {
  id: string;
  source: "landing" | "feed";
  text: string;
  createdAt: Date;
}

export interface AnonymousReflectionsSummary {
  count: number;
  latest: AnonymousReflection | null;
}

/**
 * Unified read of every anonymous response to the current work question.
 * Pulls from:
 *   - landing_inquiries (anonymous answers from /3005 InquiryPrompt + CurrentWorkQuestion)
 *   - work_question_responses (responses from /feed WorkQuestionBox)
 *
 * Identity is intentionally stripped in this view — everything surfaces as
 * anonymous reflections, even feed responses that have a display_name.
 */
export async function listAnonymousReflections(limit = 500): Promise<AnonymousReflection[]> {
  const question = await getActiveWorkQuestion();
  if (!question) return [];

  const rows = await db<Array<{
    id: string;
    source: "landing" | "feed";
    text: string;
    created_at: Date;
  }>>`
    WITH active_question AS (
      SELECT id AS question_id, question
      FROM work_questions
      WHERE id = ${question.id}
      LIMIT 1
    )
    SELECT * FROM (
      SELECT
        'landing-' || li.id::text AS id,
        'landing'::text            AS source,
        li.answer                  AS text,
        li.created_at
      FROM landing_inquiries li, active_question aq
      WHERE LOWER(li.prompt) = LOWER(aq.question)

      UNION ALL

      SELECT
        'feed-' || wqr.id::text AS id,
        'feed'::text            AS source,
        wqr.response            AS text,
        wqr.created_at
      FROM work_question_responses wqr, active_question aq
      WHERE wqr.question_id = aq.question_id
    ) AS combined
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    text: r.text,
    createdAt: r.created_at,
  }));
}

export async function getAnonymousReflectionsSummary(): Promise<AnonymousReflectionsSummary> {
  const question = await getActiveWorkQuestion();
  if (!question) return { count: 0, latest: null };

  const counts = await db<[{ count: string }]>`
    WITH active_question AS (
      SELECT id AS question_id, question
      FROM work_questions
      WHERE id = ${question.id}
      LIMIT 1
    )
    SELECT (
      (SELECT COUNT(*) FROM landing_inquiries li, active_question aq
         WHERE LOWER(li.prompt) = LOWER(aq.question))
      +
      (SELECT COUNT(*) FROM work_question_responses wqr, active_question aq
         WHERE wqr.question_id = aq.question_id)
    )::text AS count
  `;

  const latest = await db<Array<{
    id: string;
    source: "landing" | "feed";
    text: string;
    created_at: Date;
  }>>`
    WITH active_question AS (
      SELECT id AS question_id, question
      FROM work_questions
      WHERE id = ${question.id}
      LIMIT 1
    )
    SELECT * FROM (
      SELECT
        'landing-' || li.id::text AS id,
        'landing'::text            AS source,
        li.answer                  AS text,
        li.created_at
      FROM landing_inquiries li, active_question aq
      WHERE LOWER(li.prompt) = LOWER(aq.question)

      UNION ALL

      SELECT
        'feed-' || wqr.id::text AS id,
        'feed'::text            AS source,
        wqr.response            AS text,
        wqr.created_at
      FROM work_question_responses wqr, active_question aq
      WHERE wqr.question_id = aq.question_id
    ) AS combined
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return {
    count: Number(counts[0]?.count ?? 0),
    latest: latest[0]
      ? {
          id: latest[0].id,
          source: latest[0].source,
          text: latest[0].text,
          createdAt: latest[0].created_at,
        }
      : null,
  };
}

export async function getActiveWorkQuestion(): Promise<ActiveWorkQuestion | null> {
  const rows = await db<{ id: string; question: string }[]>`
    SELECT id, question
    FROM work_questions
    WHERE org_id = ${ORG_ID} AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listForumThreads(): Promise<ForumThreadSummary[]> {
  const topicId = await ensureForumTopicId();
  const rows = await db<Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    body: string | null;
    author_id: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: Date;
    last_activity_at: Date;
    reply_count: number;
    pinned: boolean;
    last_reply_user_name: string | null;
    last_reply_comment_color: string | null;
    last_reply_content: string | null;
    last_reply_created_at: Date | null;
  }>>`
    SELECT
      t.id, t.slug, t.title, t.excerpt, t.body,
      t.author_id,
      u.display_name,
      u.avatar_url,
      t.created_at,
      COALESCE(lr.created_at, t.updated_at, t.published_at, t.created_at) AS last_activity_at,
      COALESCE(t.reply_count, 0) AS reply_count,
      COALESCE(t.pinned, false) AS pinned,
      lr.display_name  AS last_reply_user_name,
      lr.comment_color AS last_reply_comment_color,
      lr.content       AS last_reply_content,
      lr.created_at    AS last_reply_created_at
    FROM threads t
    JOIN thread_topics tt ON tt.thread_id = t.id
    JOIN users u ON u.id = t.author_id
    LEFT JOIN LATERAL (
      SELECT r.content, r.created_at, lu.display_name, lu.comment_color
      FROM replies r
      JOIN users lu ON lu.id = r.user_id
      WHERE r.thread_id = t.id
      ORDER BY r.created_at DESC
      LIMIT 1
    ) lr ON TRUE
    WHERE tt.topic_id = ${topicId}
      AND t.org_id = ${ORG_ID}
      AND t.kind = 'post'
      AND t.status = 'published'
    ORDER BY t.pinned DESC NULLS LAST, COALESCE(lr.created_at, t.updated_at, t.published_at, t.created_at) DESC
    LIMIT 100
  `;

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt ?? (r.body ? r.body.slice(0, 200) : null),
    body: r.body ?? "",
    authorId: r.author_id,
    authorName: r.display_name ?? "Member",
    authorInitials: initialsFor(r.display_name),
    authorAvatar: r.avatar_url,
    createdAt: r.created_at,
    lastActivityAt: r.last_activity_at,
    replyCount: Number(r.reply_count ?? 0),
    pinned: !!r.pinned,
    lastReply:
      r.last_reply_content && r.last_reply_created_at
        ? {
            userName: r.last_reply_user_name ?? "Member",
            userInitials: initialsFor(r.last_reply_user_name),
            commentColor: r.last_reply_comment_color,
            excerpt: r.last_reply_content.slice(0, 120),
            createdAt: r.last_reply_created_at,
          }
        : null,
  }));
}

export async function getForumThread(slug: string): Promise<ForumThreadDetail | null> {
  const topicId = await ensureForumTopicId();
  const rows = await db<Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    body: string | null;
    author_id: string;
    display_name: string | null;
    avatar_url: string | null;
    comment_color: string | null;
    created_at: Date;
    last_activity_at: Date;
    reply_count: number;
    pinned: boolean;
  }>>`
    SELECT
      t.id, t.slug, t.title, t.excerpt, t.body,
      t.author_id,
      u.display_name,
      u.avatar_url,
      u.comment_color,
      t.created_at,
      COALESCE(t.updated_at, t.published_at, t.created_at) AS last_activity_at,
      COALESCE(t.reply_count, 0) AS reply_count,
      COALESCE(t.pinned, false) AS pinned
    FROM threads t
    JOIN thread_topics tt ON tt.thread_id = t.id
    JOIN users u ON u.id = t.author_id
    WHERE t.slug = ${slug}
      AND tt.topic_id = ${topicId}
      AND t.org_id = ${ORG_ID}
      AND t.kind = 'post'
      AND t.status = 'published'
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    body: r.body ?? "",
    authorId: r.author_id,
    authorName: r.display_name ?? "Member",
    authorInitials: initialsFor(r.display_name),
    authorAvatar: r.avatar_url,
    authorCommentColor: r.comment_color,
    createdAt: r.created_at,
    lastActivityAt: r.last_activity_at,
    replyCount: Number(r.reply_count ?? 0),
    pinned: !!r.pinned,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

export async function createForumThread(params: {
  authorId: string;
  title: string;
  body: string;
}): Promise<{ id: string; slug: string }> {
  const topicId = await ensureForumTopicId();
  const trimmedTitle = params.title.trim();
  const trimmedBody = params.body.trim();
  if (trimmedTitle.length < 3) throw new Error("Title must be at least 3 characters.");
  if (trimmedBody.length < 1) throw new Error("Body is required.");

  // Slug with short collision suffix; uniqueness is per (org_id, slug).
  const baseSlug = slugify(trimmedTitle).slice(0, 80) || "thread";
  const slug = `${baseSlug}-${nanoid(6).toLowerCase()}`;
  const threadId = nanoid();
  const excerpt = trimmedBody.slice(0, 200);

  await db`
    INSERT INTO threads (
      id, org_id, author_id, kind, title, slug,
      body, excerpt, status, visibility, published_at
    ) VALUES (
      ${threadId}, ${ORG_ID}, ${params.authorId}, 'post',
      ${trimmedTitle}, ${slug},
      ${trimmedBody}, ${excerpt},
      'published', 'PUBLIC',
      NOW()
    )
  `;

  await db`
    INSERT INTO thread_topics (thread_id, topic_id)
    VALUES (${threadId}, ${topicId})
    ON CONFLICT DO NOTHING
  `;

  return { id: threadId, slug };
}

export async function setThreadPinned(
  threadId: string,
  pinned: boolean
): Promise<void> {
  await db`UPDATE threads SET pinned = ${pinned} WHERE id = ${threadId}`;
}

// createForumReply removed — use `createReply` re-exported from @elkdonis/db
// (`import { createReply } from "@/lib/forum"`).
