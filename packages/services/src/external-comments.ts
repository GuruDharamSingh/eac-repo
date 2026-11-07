/**
 * Comments from the outside copy of a thread (migration 225, 2026-11-01).
 *
 * Facebook sends a Page's `feed` changes to /api/meta/webhook once the Page
 * is subscribed to the app (subscribePageFeed, needs pages_manage_metadata).
 * A comment on a post the network sent out is matched to its thread through
 * the publish ledger's external id, or through the permalink kept in
 * threads.metadata.shares for posts made before the ledger, and stored here
 * for the piece page to show. Removals are honoured.
 */

import { db } from '@elkdonis/db';
import { getMetaPageTarget } from './connections';

const FB_GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`;

export interface ExternalComment {
  id: number;
  platform: string;
  externalId: string;
  parentExternalId: string | null;
  authorName: string;
  message: string;
  url: string | null;
  commentedAt: string;
}

export async function listExternalComments(threadId: string): Promise<ExternalComment[]> {
  try {
    const rows = await db<Array<{ id: number; platform: string; external_id: string; parent_external_id: string | null; author_name: string; message: string; url: string | null; commented_at: Date }>>`
      SELECT id, platform, external_id, parent_external_id, author_name, message, url, commented_at
      FROM thread_external_comments WHERE thread_id = ${threadId} ORDER BY commented_at ASC LIMIT 200
    `;
    return rows.map((r) => ({ id: r.id, platform: r.platform, externalId: r.external_id, parentExternalId: r.parent_external_id, authorName: r.author_name, message: r.message, url: r.url, commentedAt: r.commented_at.toISOString() }));
  } catch {
    return [];
  }
}

/** The network thread behind a platform post id, or null. */
export async function threadForExternalPost(platform: 'facebook' | 'instagram', externalPostId: string): Promise<string | null> {
  // 1. The ledger (posts sent since publish_jobs existed).
  const provider = platform === 'facebook' ? 'meta' : 'instagram';
  const jobs = await db<Array<{ source_kind: string; source_id: string }>>`
    SELECT source_kind, source_id FROM publish_jobs
    WHERE provider = ${provider} AND external_id = ${externalPostId} AND status = 'done' ORDER BY id DESC LIMIT 1
  `.catch(() => []);
  const job = jobs[0];
  if (job) {
    if (job.source_kind === 'thread') return job.source_id;
    const mirrored = await db<{ id: string }[]>`SELECT id FROM threads WHERE metadata->>'socialPostId' = ${job.source_id} AND status <> 'archived' LIMIT 1`;
    return mirrored[0]?.id ?? null;
  }
  // 2. Older pieces: the permalink in metadata.shares, "<page>/posts/<story>" for "<page>_<story>".
  if (platform === 'facebook') {
    const [pageId, storyId] = externalPostId.split('_');
    if (pageId && storyId) {
      const rows = await db<{ id: string }[]>`
        SELECT id FROM threads
        WHERE status <> 'archived' AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(metadata->'shares', '[]'::jsonb)) s
          WHERE s->>'url' LIKE ${`%/${pageId}/posts/${storyId}%`}
        ) LIMIT 1
      `.catch(() => []);
      return rows[0]?.id ?? null;
    }
  }
  return null;
}

export async function recordExternalComment(input: {
  threadId: string;
  platform: string;
  externalId: string;
  externalPostId: string;
  parentExternalId?: string | null;
  authorName?: string | null;
  authorExternalId?: string | null;
  message?: string | null;
  url?: string | null;
  commentedAt?: Date | null;
}): Promise<void> {
  await db`
    INSERT INTO thread_external_comments (thread_id, platform, external_id, external_post_id, parent_external_id, author_name, author_external_id, message, url, commented_at)
    VALUES (${input.threadId}, ${input.platform}, ${input.externalId}, ${input.externalPostId}, ${input.parentExternalId ?? null},
            ${(input.authorName ?? '').slice(0, 200)}, ${input.authorExternalId ?? null}, ${(input.message ?? '').slice(0, 8000)}, ${input.url ?? null},
            ${input.commentedAt ?? new Date()})
    ON CONFLICT (platform, external_id) DO UPDATE SET message = EXCLUDED.message, author_name = EXCLUDED.author_name
  `;
}

export async function removeExternalComment(platform: string, externalId: string): Promise<void> {
  await db`DELETE FROM thread_external_comments WHERE platform = ${platform} AND external_id = ${externalId}`;
}

interface FeedChangeValue {
  item?: string;
  verb?: string;
  post_id?: string;
  comment_id?: string;
  parent_id?: string;
  from?: { id?: string; name?: string };
  message?: string;
  created_time?: number;
}

/**
 * Turn a stored delivery into comment rows. Facebook: object "page", field
 * "feed", item "comment". Instagram: object "instagram", field "comments",
 * with the media id in value.media.id. Anything else is ignored.
 */
export async function processMetaWebhookEvent(event: { object?: string; entry?: unknown[] }): Promise<{ stored: number; removed: number; unmatched: number }> {
  const out = { stored: 0, removed: 0, unmatched: 0 };
  for (const entry of (event.entry ?? []) as Array<{ changes?: Array<{ field?: string; value?: unknown }> }>) {
    for (const change of entry.changes ?? []) {
      if (event.object === 'page' && change.field === 'feed') {
        const v = (change.value ?? {}) as FeedChangeValue;
        if (v.item !== 'comment' || !v.comment_id || !v.post_id) continue;
        if (v.verb === 'remove') {
          await removeExternalComment('facebook', v.comment_id);
          out.removed += 1;
          continue;
        }
        if (v.verb !== 'add' && v.verb !== 'edited') continue;
        const threadId = await threadForExternalPost('facebook', v.post_id);
        if (!threadId) {
          out.unmatched += 1;
          continue;
        }
        await recordExternalComment({
          threadId,
          platform: 'facebook',
          externalId: v.comment_id,
          externalPostId: v.post_id,
          parentExternalId: v.parent_id && v.parent_id !== v.post_id ? v.parent_id : null,
          authorName: v.from?.name ?? 'Someone on Facebook',
          authorExternalId: v.from?.id ?? null,
          message: v.message ?? '',
          url: `https://www.facebook.com/${v.comment_id}`,
          commentedAt: v.created_time ? new Date(v.created_time * 1000) : null,
        });
        out.stored += 1;
      } else if (event.object === 'instagram' && change.field === 'comments') {
        const v = (change.value ?? {}) as { id?: string; text?: string; from?: { id?: string; username?: string }; media?: { id?: string }; parent_id?: string };
        if (!v.id || !v.media?.id) continue;
        const threadId = await threadForExternalPost('instagram', v.media.id);
        if (!threadId) {
          out.unmatched += 1;
          continue;
        }
        await recordExternalComment({
          threadId,
          platform: 'instagram',
          externalId: v.id,
          externalPostId: v.media.id,
          parentExternalId: v.parent_id ?? null,
          authorName: v.from?.username ? `@${v.from.username}` : 'Someone on Instagram',
          authorExternalId: v.from?.id ?? null,
          message: v.text ?? '',
          url: null,
        });
        out.stored += 1;
      }
    }
  }
  return out;
}

/**
 * Subscribe a Page to the app's webhook for its feed (comments, posts).
 * Idempotent on Facebook's side. Needs pages_manage_metadata on the Page
 * token; without it Facebook answers with a permission error, returned here.
 */
export async function subscribePageFeed(connectionId: string, pageId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = await getMetaPageTarget(connectionId, pageId);
  if ('error' in t) return { ok: false, error: t.error };
  try {
    const res = await fetch(`${FB_GRAPH}/${pageId}/subscribed_apps`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ subscribed_fields: 'feed', access_token: t.accessToken }),
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
    if (!res.ok || data.error) return { ok: false, error: data.error?.message ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Every Page on every Facebook connection, subscribed; for the daily maintenance. */
export async function subscribeAllPageFeeds(): Promise<{ pages: number; subscribed: number; failed: string[] }> {
  const rows = await db<Array<{ id: string; targets: unknown }>>`SELECT id, targets FROM user_connections WHERE provider = 'meta' AND status = 'connected'`;
  const out = { pages: 0, subscribed: 0, failed: [] as string[] };
  for (const row of rows) {
    for (const t of (Array.isArray(row.targets) ? row.targets : []) as Array<{ id: string; name?: string }>) {
      out.pages += 1;
      const r = await subscribePageFeed(row.id, t.id);
      if ('error' in r) out.failed.push(`${t.name ?? t.id}: ${r.error}`);
      else out.subscribed += 1;
    }
  }
  return out;
}
