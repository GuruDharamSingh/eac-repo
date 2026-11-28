import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import type { ForumViewer } from './forum';
import { canModerate, type WriteResult } from './forum-write';

// ============================================================================
// Hide a single reply (OFFER_SURFACES Decision 13).
//
// Owners and guides of the thread's org (and network admins: this follows
// `canModerate`, the one rule moderateThread uses) can hide one reply. A hidden
// reply is not returned to other viewers by the readers that ask for the hidden
// set (hiddenReplyIds below); the moderator still sees it, marked, with a way
// to unhide.
//
// Where "hidden" lives: `replies.hidden_at` and `replies.hidden_by`. Those
// columns do not exist until their migration is applied, so EVERYTHING here
// checks for them first (repliesHiddenSupported) and answers "not available
// yet" rather than throwing: the tree stays safe to build and run without the
// migration. See the proposal in OFFER_SURFACES_2026-11-27/FORUM_HIDE_REPLY.sql.
//
// Every hide and unhide is logged to `events` the way moderateThread logs
// (forum-write.ts logModeration): action content_hidden / content_unhidden,
// resource_type 'post', resource_id the THREAD (so listModLog, which joins on
// the thread, shows it), data { via: 'forum', action, replyId }.
// ============================================================================

let supported: boolean | null = null;
let checkedAt = 0;
const RECHECK_MS = 60_000;

/** True when `replies.hidden_at` exists. A positive answer is kept; a negative one is rechecked each minute. */
export async function repliesHiddenSupported(): Promise<boolean> {
  if (supported === true) return true;
  const now = Date.now();
  if (supported === false && now - checkedAt < RECHECK_MS) return false;
  try {
    const rows = await db<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'replies' AND column_name IN ('hidden_at', 'hidden_by')
    `;
    supported = (rows[0]?.n ?? 0) === 2;
  } catch {
    supported = false;
  }
  checkedAt = now;
  return supported;
}

export interface HiddenReply {
  at: Date;
  by: string | null;
}

/** The hidden replies of one thread, by reply id. Empty when the column is not there yet. */
export async function hiddenReplyIds(threadId: string): Promise<Map<string, HiddenReply>> {
  const out = new Map<string, HiddenReply>();
  if (!(await repliesHiddenSupported())) return out;
  const rows = await db<Array<{ id: string; hidden_at: Date; hidden_by: string | null }>>`
    SELECT id, hidden_at, hidden_by FROM replies WHERE thread_id = ${threadId} AND hidden_at IS NOT NULL
  `;
  for (const r of rows) out.set(r.id, { at: r.hidden_at, by: r.hidden_by });
  return out;
}

/**
 * Hide or unhide one reply. The viewer must be able to moderate the org the reply's thread belongs to.
 * Answers `{ ok:false }` (never throws) when the column is missing, the reply is gone or the viewer may not.
 */
export async function setReplyHidden(viewer: ForumViewer, replyId: string, hidden: boolean): Promise<WriteResult<{ hidden: boolean; threadId: string }>> {
  if (!viewer.userId) return { ok: false, error: 'Sign in first.' };
  if (!(await repliesHiddenSupported())) return { ok: false, error: 'Hiding a reply is not switched on yet.' };
  const [r] = await db<Array<{ thread_id: string; org_id: string; hidden_at: Date | null }>>`
    SELECT r.thread_id, t.org_id, r.hidden_at
    FROM replies r JOIN threads t ON t.id = r.thread_id
    WHERE r.id = ${replyId}
  `;
  if (!r) return { ok: false, error: 'That reply is gone.' };
  if (!canModerate(viewer, r.org_id)) return { ok: false, error: 'Owners and guides only.' };
  const already = r.hidden_at !== null;
  if (already === hidden) return { ok: true, hidden, threadId: r.thread_id };
  if (hidden) {
    await db`UPDATE replies SET hidden_at = NOW(), hidden_by = ${viewer.userId} WHERE id = ${replyId}`;
  } else {
    await db`UPDATE replies SET hidden_at = NULL, hidden_by = NULL WHERE id = ${replyId}`;
  }
  try {
    await db`
      INSERT INTO events (id, org_id, user_id, action, resource_type, resource_id, data, created_at)
      VALUES (${nanoid()}, ${r.org_id}, ${viewer.userId}, ${hidden ? 'content_hidden' : 'content_unhidden'}, 'post', ${r.thread_id},
              ${db.json({ via: 'forum', action: hidden ? 'hide_reply' : 'unhide_reply', replyId })}, NOW())
    `;
  } catch (err) {
    // The act itself already happened; losing its log entry must not undo it (same as logModeration).
    console.error('[forum] logHideReply:', err);
  }
  return { ok: true, hidden, threadId: r.thread_id };
}
