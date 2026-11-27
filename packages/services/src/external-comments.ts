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

/**
 * The publish ledger row behind a platform post id, and the network thread it
 * maps to (null when the post has none, e.g. a Channel post about a piece).
 * Instagram posts sent through a Page are ledger provider 'meta', Instagram
 * Login posts 'instagram' (2026-11-24: the earlier lookup asked only for
 * 'instagram' and so never matched a Page-linked account).
 */
export async function jobForExternalPost(platform: 'facebook' | 'instagram', externalPostId: string): Promise<{ jobId: number; threadId: string | null } | null> {
  const providers = platform === 'facebook' ? ['meta'] : ['meta', 'instagram'];
  const jobs = await db<Array<{ id: number; source_kind: string; source_id: string }>>`
    SELECT id, source_kind, source_id FROM publish_jobs
    WHERE provider = ANY(${providers}) AND external_id = ${externalPostId} AND status = 'done' ORDER BY id DESC LIMIT 1
  `.catch(() => []);
  const job = jobs[0];
  if (!job) return null;
  return { jobId: Number(job.id), threadId: await threadForJobSource(job.source_kind, job.source_id) };
}

async function threadForJobSource(sourceKind: string, sourceId: string): Promise<string | null> {
  if (sourceKind === 'thread') return sourceId;
  const mirrored = await db<{ id: string }[]>`SELECT id FROM threads WHERE metadata->>'socialPostId' = ${sourceId} AND status <> 'archived' LIMIT 1`.catch(() => []);
  return mirrored[0]?.id ?? null;
}

/** The network thread behind a platform post id, or null. */
export async function threadForExternalPost(platform: 'facebook' | 'instagram', externalPostId: string): Promise<string | null> {
  // 1. The ledger (posts sent since publish_jobs existed).
  const job = await jobForExternalPost(platform, externalPostId);
  if (job) return job.threadId;
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
  threadId: string | null;
  publishJobId?: number | null;
  fromSelf?: boolean;
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
    INSERT INTO thread_external_comments (thread_id, publish_job_id, from_self, platform, external_id, external_post_id, parent_external_id, author_name, author_external_id, message, url, commented_at)
    VALUES (${input.threadId}, ${input.publishJobId ?? null}, ${input.fromSelf ?? false}, ${input.platform}, ${input.externalId}, ${input.externalPostId}, ${input.parentExternalId ?? null},
            ${(input.authorName ?? '').slice(0, 200)}, ${input.authorExternalId ?? null}, ${(input.message ?? '').slice(0, 8000)}, ${input.url ?? null},
            ${input.commentedAt ?? new Date()})
    ON CONFLICT (platform, external_id) DO UPDATE SET
      message = EXCLUDED.message,
      author_name = CASE WHEN EXCLUDED.author_name = '' THEN thread_external_comments.author_name ELSE EXCLUDED.author_name END,
      thread_id = COALESCE(thread_external_comments.thread_id, EXCLUDED.thread_id),
      publish_job_id = COALESCE(thread_external_comments.publish_job_id, EXCLUDED.publish_job_id),
      from_self = thread_external_comments.from_self OR EXCLUDED.from_self
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
        const job = await jobForExternalPost('facebook', v.post_id);
        const threadId = job ? job.threadId : await threadForExternalPost('facebook', v.post_id);
        if (!job && !threadId) {
          out.unmatched += 1;
          continue;
        }
        await recordExternalComment({
          threadId,
          publishJobId: job?.jobId ?? null,
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
        const job = await jobForExternalPost('instagram', v.media.id);
        if (!job) {
          out.unmatched += 1;
          continue;
        }
        await recordExternalComment({
          threadId: job.threadId,
          publishJobId: job.jobId,
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

// ── Channel → Comments (2026-11-24) ─────────────────────────────────────────

/**
 * An outside post the person sent through one of their own connections, with
 * the comments stored for it. Only the connection's owner may read or answer
 * them here: the reply goes out with that connection's token.
 */
export interface ChannelCommentPost {
  jobId: number;
  connectionId: string;
  /** page, instagram (through a Page) or iglogin. */
  route: 'page' | 'instagram' | 'iglogin';
  pageId: string | null;
  externalId: string;
  externalUrl: string | null;
  orgId: string | null;
  threadId: string | null;
  title: string;
  excerpt: string;
  sentAt: string;
  syncedAt: string | null;
  comments: ChannelComment[];
}

export interface ChannelComment {
  id: number;
  externalId: string;
  parentExternalId: string | null;
  authorName: string;
  message: string;
  url: string | null;
  fromSelf: boolean;
  commentedAt: string;
}

function routeOf(targetId: string): { connectionId: string; route: ChannelCommentPost['route']; pageId: string | null } | null {
  const [connectionId, kind, pageId] = targetId.split(':');
  if (!connectionId) return null;
  if (kind === 'page' || kind === 'instagram') return pageId ? { connectionId, route: kind, pageId } : null;
  if (kind === 'iglogin') return { connectionId, route: 'iglogin', pageId: null };
  return null;
}

/**
 * The person's published Facebook and Instagram posts from the last
 * `days` days (newest first, at most `limit`), each with its comments.
 * `orgId` narrows to posts filed under that org; null shows all of theirs.
 */
export async function listChannelCommentPosts(userId: string, opts: { orgId?: string | null; days?: number; limit?: number } = {}): Promise<ChannelCommentPost[]> {
  const days = Math.min(Math.max(opts.days ?? 90, 1), 365);
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const orgId = opts.orgId ?? null;
  const jobs = await db<Array<{ id: number; target_id: string; external_id: string; external_url: string | null; org_id: string | null; source_kind: string; source_id: string; finished_at: Date | null; created_at: Date; comments_synced_at: Date | null; title: string | null; body: string | null; mirror_id: string | null }>>`
    SELECT j.id, j.target_id, j.external_id, j.external_url, j.org_id, j.source_kind, j.source_id, j.finished_at, j.created_at, j.comments_synced_at,
           (SELECT m.id FROM threads m WHERE j.source_kind = 'social_post' AND m.metadata->>'socialPostId' = j.source_id AND m.status <> 'archived' LIMIT 1) AS mirror_id,
           COALESCE(NULLIF(sp.title, ''), t.title) AS title,
           COALESCE(NULLIF(sp.body, ''), t.excerpt, '') AS body
    FROM publish_jobs j
    LEFT JOIN social_posts sp ON j.source_kind = 'social_post' AND sp.id = j.source_id
    LEFT JOIN threads t ON j.source_kind = 'thread' AND t.id = j.source_id
    WHERE j.status = 'done' AND j.external_id IS NOT NULL
      AND j.provider IN ('meta', 'instagram')
      AND split_part(j.target_id, ':', 1) IN (SELECT id FROM user_connections WHERE user_id = ${userId})
      AND j.created_at > now() - make_interval(days => ${days})
      AND (${orgId}::text IS NULL OR j.org_id = ${orgId})
    ORDER BY j.created_at DESC
    LIMIT ${limit}
  `;
  if (jobs.length === 0) return [];
  const ids = jobs.map((j) => Number(j.id));
  const rows = await db<Array<{ id: number; publish_job_id: number; external_id: string; parent_external_id: string | null; author_name: string; message: string; url: string | null; from_self: boolean; commented_at: Date }>>`
    SELECT id, publish_job_id, external_id, parent_external_id, author_name, message, url, from_self, commented_at
    FROM thread_external_comments WHERE publish_job_id = ANY(${ids}) ORDER BY commented_at ASC
  `;
  const byJob = new Map<number, ChannelComment[]>();
  for (const r of rows) {
    const list = byJob.get(Number(r.publish_job_id)) ?? [];
    list.push({ id: Number(r.id), externalId: r.external_id, parentExternalId: r.parent_external_id, authorName: r.author_name, message: r.message, url: r.url, fromSelf: r.from_self, commentedAt: r.commented_at.toISOString() });
    byJob.set(Number(r.publish_job_id), list);
  }
  const out: ChannelCommentPost[] = [];
  for (const j of jobs) {
    const route = routeOf(j.target_id);
    if (!route) continue;
    out.push({
      jobId: Number(j.id),
      connectionId: route.connectionId,
      route: route.route,
      pageId: route.pageId,
      externalId: j.external_id,
      externalUrl: j.external_url,
      orgId: j.org_id,
      threadId: j.source_kind === 'thread' ? j.source_id : j.mirror_id,
      title: (j.title ?? '').trim(),
      excerpt: (j.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 240),
      sentAt: (j.finished_at ?? j.created_at).toISOString(),
      syncedAt: j.comments_synced_at ? j.comments_synced_at.toISOString() : null,
      comments: byJob.get(Number(j.id)) ?? [],
    });
  }
  return out;
}

/** One of the person's posts, for fetching or replying; null when not theirs. */
export async function getChannelCommentPost(userId: string, jobId: number): Promise<ChannelCommentPost | null> {
  const rows = await db<Array<{ id: number }>>`
    SELECT j.id FROM publish_jobs j
    WHERE j.id = ${jobId} AND j.status = 'done' AND j.external_id IS NOT NULL AND j.provider IN ('meta', 'instagram')
      AND split_part(j.target_id, ':', 1) IN (SELECT id FROM user_connections WHERE user_id = ${userId})
  `;
  if (!rows[0]) return null;
  const all = await listChannelCommentPosts(userId, { days: 365, limit: 100 });
  return all.find((p) => p.jobId === jobId) ?? null;
}

/** A stored comment on one of the person's posts, with its post; null when not theirs. */
export async function getChannelComment(userId: string, commentId: number): Promise<{ post: ChannelCommentPost; comment: ChannelComment } | null> {
  const rows = await db<Array<{ publish_job_id: number | null }>>`SELECT publish_job_id FROM thread_external_comments WHERE id = ${commentId}`;
  const jobId = rows[0]?.publish_job_id;
  if (!jobId) return null;
  const post = await getChannelCommentPost(userId, Number(jobId));
  const comment = post?.comments.find((c) => c.id === commentId);
  return post && comment ? { post, comment } : null;
}

/**
 * Store one fetch of a post's comments. When the fetch was complete, rows
 * for this post that the platform no longer returns are removed (deleted or
 * hidden there). Stamps comments_synced_at either way.
 */
export async function storeFetchedComments(input: {
  jobId: number;
  threadId: string | null;
  platform: 'facebook' | 'instagram';
  externalPostId: string;
  selfIds: string[];
  complete: boolean;
  comments: Array<{ id: string; parentId: string | null; authorId: string | null; authorName: string; message: string; createdAt: string | null; url: string | null }>;
}): Promise<{ stored: number; removed: number }> {
  let stored = 0;
  for (const c of input.comments) {
    await recordExternalComment({
      threadId: input.threadId,
      publishJobId: input.jobId,
      fromSelf: c.authorId ? input.selfIds.includes(c.authorId) : false,
      platform: input.platform,
      externalId: c.id,
      externalPostId: input.externalPostId,
      parentExternalId: c.parentId,
      authorName: c.authorName || (input.platform === 'facebook' ? 'Someone on Facebook' : 'Someone on Instagram'),
      authorExternalId: c.authorId,
      message: c.message,
      url: c.url,
      commentedAt: c.createdAt ? new Date(c.createdAt) : null,
    });
    stored += 1;
  }
  let removed = 0;
  if (input.complete) {
    const keep = input.comments.map((c) => c.id);
    const gone = await db`
      DELETE FROM thread_external_comments
      WHERE publish_job_id = ${input.jobId} AND platform = ${input.platform} AND NOT (external_id = ANY(${keep}))
      RETURNING id
    `;
    removed = gone.length;
  }
  await db`UPDATE publish_jobs SET comments_synced_at = now() WHERE id = ${input.jobId}`;
  return { stored, removed };
}

/**
 * The person's Facebook and Instagram connections, and whether the
 * permissions comments need were granted. Facebook connections record what
 * was granted since 2026-11-24 (facebookGrantedPermissions); older rows hold
 * the requested list, which never includes the comment permissions.
 */
export async function listCommentConnections(userId: string): Promise<Array<{ id: string; provider: 'meta' | 'instagram'; accountName: string | null; commentsAllowed: boolean }>> {
  const rows = await db<Array<{ id: string; provider: 'meta' | 'instagram'; account_name: string | null; scopes: string[] | null }>>`
    SELECT id, provider, account_name, scopes FROM user_connections
    WHERE user_id = ${userId} AND provider IN ('meta', 'instagram') AND status = 'connected'
    ORDER BY created_at
  `;
  return rows.map((r) => {
    const s = r.scopes ?? [];
    const commentsAllowed = r.provider === 'meta'
      ? s.includes('pages_read_user_content') || s.includes('instagram_manage_comments')
      : s.includes('instagram_business_manage_comments');
    return { id: r.id, provider: r.provider, accountName: r.account_name, commentsAllowed };
  });
}
