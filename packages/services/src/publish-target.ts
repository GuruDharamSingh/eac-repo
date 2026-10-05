/**
 * Where a thread's recordings are published — first use: a reading circle's
 * call recordings going to a YouTube channel (2026-10-03).
 *
 * Stored on the thread as `threads.metadata.publish.youtube`:
 *   connectionId  user_connections.id (migration 192) — whose channel
 *   privacy       'private' | 'unlisted' | 'public' (YouTube privacyStatus)
 *   mode          'auto'   — upload as soon as a recording is filed
 *                 'review' — wait for someone to approve it (Studio)
 *   setBy, setAt  who chose the channel, when
 *
 * Only the connection's owner may point a thread at it: binding checks that
 * the acting user owns the connection. Callers gate on their own rule for who
 * may change a thread's settings (circle author, org owner/guide).
 *
 * Nothing uploads yet; the uploader reads this. Unaudited Google projects can
 * only upload private videos, so 'unlisted'/'public' fail until the person's
 * project passes YouTube's API audit.
 */

import { db } from '@elkdonis/db';
import { describeConnection, getConnection, type UserConnection } from './connections';

export type PublishPrivacy = 'private' | 'unlisted' | 'public';
export type PublishMode = 'auto' | 'review';

export interface YoutubePublishTarget {
  connectionId: string | null;
  privacy: PublishPrivacy;
  mode: PublishMode;
  setBy: string | null;
  setAt: string | null;
}

export interface PublishTargetView {
  youtube: YoutubePublishTarget;
  /** The bound connection, without secrets; null when none or removed. */
  connection: (Pick<UserConnection, 'id' | 'label' | 'status' | 'accountName' | 'accountUrl' | 'error'> & { ownerName: string | null }) | null;
}

const PRIVACY: PublishPrivacy[] = ['private', 'unlisted', 'public'];
const MODES: PublishMode[] = ['auto', 'review'];

function readTarget(meta: Record<string, any> | null | undefined): YoutubePublishTarget {
  const y = (meta?.publish?.youtube ?? {}) as Record<string, unknown>;
  return {
    connectionId: typeof y.connectionId === 'string' ? y.connectionId : null,
    privacy: PRIVACY.includes(y.privacy as PublishPrivacy) ? (y.privacy as PublishPrivacy) : 'private',
    mode: MODES.includes(y.mode as PublishMode) ? (y.mode as PublishMode) : 'review',
    setBy: typeof y.setBy === 'string' ? y.setBy : null,
    setAt: typeof y.setAt === 'string' ? y.setAt : null,
  };
}

export async function getPublishTarget(orgId: string, threadId: string): Promise<PublishTargetView | null> {
  const [row] = await db`SELECT metadata FROM threads WHERE org_id = ${orgId} AND id = ${threadId}`;
  if (!row) return null;
  const youtube = readTarget(row.metadata);
  let connection: PublishTargetView['connection'] = null;
  if (youtube.connectionId) {
    const c = await describeConnection(youtube.connectionId);
    if (c) {
      const [owner] = await db`
        SELECT COALESCE(display_name, split_part(email, '@', 1)) AS name FROM users WHERE id = ${c.userId}
      `;
      connection = {
        id: c.id,
        label: c.label,
        status: c.status,
        accountName: c.accountName,
        accountUrl: c.accountUrl,
        error: c.error,
        ownerName: owner?.name ?? null,
      };
    }
  }
  return { youtube, connection };
}

export async function setPublishTarget(
  orgId: string,
  threadId: string,
  userId: string,
  input: { connectionId?: unknown; privacy?: unknown; mode?: unknown }
): Promise<{ ok: true; target: PublishTargetView } | { ok: false; error: string }> {
  const [row] = await db`SELECT metadata FROM threads WHERE org_id = ${orgId} AND id = ${threadId}`;
  if (!row) return { ok: false, error: 'Not found.' };
  const current = readTarget(row.metadata);
  const next: YoutubePublishTarget = { ...current };

  if (input.connectionId !== undefined) {
    if (input.connectionId === null || input.connectionId === '') {
      next.connectionId = null;
    } else if (typeof input.connectionId === 'string' && input.connectionId !== current.connectionId) {
      // Only your own connection can be chosen; an existing binding to someone
      // else's is left as it is unless replaced or cleared.
      const mine = await getConnection(userId, input.connectionId);
      if (!mine) return { ok: false, error: 'Choose one of your own connections.' };
      if (mine.status !== 'connected') return { ok: false, error: 'Connect that one at Google first.' };
      next.connectionId = mine.id;
    }
  }
  if (input.privacy !== undefined) {
    if (!PRIVACY.includes(input.privacy as PublishPrivacy)) return { ok: false, error: 'Unknown privacy.' };
    next.privacy = input.privacy as PublishPrivacy;
  }
  if (input.mode !== undefined) {
    if (!MODES.includes(input.mode as PublishMode)) return { ok: false, error: 'Unknown mode.' };
    next.mode = input.mode as PublishMode;
  }
  next.setBy = userId;
  next.setAt = new Date().toISOString();

  // Merge, not assign: other features keep their own keys under metadata.
  await db`
    UPDATE threads
    SET metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object('publish', COALESCE(metadata->'publish', '{}'::jsonb) || jsonb_build_object('youtube', ${db.json(next as unknown as Record<string, string | null>)}::jsonb)),
      updated_at = now()
    WHERE org_id = ${orgId} AND id = ${threadId}
  `;
  return { ok: true, target: (await getPublishTarget(orgId, threadId))! };
}
