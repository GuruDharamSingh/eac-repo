import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { sanitizeRichText } from '@elkdonis/utils';
import { createThread } from './posts';
import { getOrgFeed } from './org-feeds';

declare const process: any;

// ============================================================================
// The Nextcloud Forum app, mirrored per org (migration 144).
//
// Nextcloud runs ONE forum for the instance. Each org gets one category there,
// named after itself and restricted to the org's Team. What syncs:
//   - topics an org admin (owner/guide, or global admin) creates on the site
//     with "Sync to Nextcloud" ticked;
//   - topics started on Nextcloud inside an org's category;
//   - replies to either, both ways.
// Nothing else crosses.
//
// Outbound runs right after the local write, as the author's own NC account
// when we hold a working app password for them, otherwise as the robot with a
// "Posted by … via …" line. It never undoes the local write: a failure leaves
// the link row 'failed' and the tick retries it.
//
// Inbound is a poll — the forum app dispatches no events. `runNcForumSyncTick`
// walks every linked category. Each org's sync and every outbound push take
// the same advisory lock, which is what stops the poll from importing a post
// the push has created but not yet linked.
//
// Facts (verified 2026-09-18, forum app 1.4.1): OCS API under
// /ocs/v2.php/apps/forum/api; post `content` comes back as rendered HTML,
// `contentRaw` as BBCode, and writes take BBCode; times are unix SECONDS;
// the Admin forum role has hard-coded full access, which the robot holds.
// ============================================================================

/** The stand-in identity for NC authors with no site account (migration 144). */
export const NC_FORUM_SENTINEL_ID = '00000000-0000-4000-8000-0000000c0f01';

const NC_URL = (): string => (process.env.NEXTCLOUD_URL || '').replace(/\/$/, '');
const NC_PUBLIC_URL = (): string =>
  (process.env.NEXTCLOUD_PUBLIC_URL || process.env.NEXT_PUBLIC_NEXTCLOUD_URL || '').replace(/\/$/, '');

const MAX_ATTEMPTS = 6;

export function ncForumConfigured(): boolean {
  return Boolean(NC_URL() && process.env.NEXTCLOUD_ADMIN_USER && process.env.NEXTCLOUD_ADMIN_PASSWORD);
}

/** The browser link to a thread in Nextcloud's forum. */
export function ncThreadUrl(slug: string): string | null {
  const base = NC_PUBLIC_URL();
  return base ? `${base}/apps/forum/t/${encodeURIComponent(slug)}` : null;
}

// ── the API ─────────────────────────────────────────────────────────────────

interface Cred { uid: string; secret: string; via: 'self' | 'robot' }

function robotCred(): Cred {
  return { uid: process.env.NEXTCLOUD_ADMIN_USER || '', secret: process.env.NEXTCLOUD_ADMIN_PASSWORD || '', via: 'robot' };
}

// Not a discriminated union on purpose: this package compiles without
// strictNullChecks, where `ok === false` doesn't narrow.
interface OcsResult<T> { ok: boolean; status: number; data: T; error: string }

async function ocs<T>(cred: Cred, method: string, path: string, body?: Record<string, unknown>): Promise<OcsResult<T>> {
  const url = `${NC_URL()}/ocs/v2.php/apps/forum/api${path}${path.includes('?') ? '&' : '?'}format=json`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'OCS-APIRequest': 'true',
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${cred.uid}:${cred.secret}`).toString('base64')}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    if (!res.ok) {
      return { ok: false, status: res.status, data: null as T, error: json?.ocs?.data?.error || json?.ocs?.meta?.message || text.slice(0, 200) || res.statusText };
    }
    return { ok: true, status: res.status, data: json?.ocs?.data as T, error: '' };
  } catch (err) {
    return { ok: false, status: 0, data: null as T, error: err instanceof Error ? err.message : String(err) };
  }
}

interface NcAuthor { userId: string; displayName: string | null }
interface NcThread {
  id: number; categoryId: number; authorId: string; title: string; slug: string;
  lastPostId: number | null; isLocked: boolean; isPinned: boolean; isHidden: boolean;
  createdAt: number; updatedAt: number; deletedAt: number | null; author?: NcAuthor;
}
interface NcPost {
  id: number; threadId: number; authorId: string; content: string; contentRaw?: string;
  isFirstPost: boolean; createdAt: number; updatedAt: number; editedAt: number | null; deletedAt: number | null;
  author?: NcAuthor;
}

// ── HTML ⇄ BBCode ───────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * The site's sanitized HTML → the forum app's BBCode. Covers what the site's
 * editors produce; anything else is reduced to its text rather than dropped.
 */
export function htmlToBbcode(html: string): string {
  let s = html.replace(/\r\n?/g, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<(strong|b)(\s[^>]*)?>/gi, '[b]').replace(/<\/(strong|b)>/gi, '[/b]');
  s = s.replace(/<(em|i)(\s[^>]*)?>/gi, '[i]').replace(/<\/(em|i)>/gi, '[/i]');
  s = s.replace(/<u(\s[^>]*)?>/gi, '[u]').replace(/<\/u>/gi, '[/u]');
  s = s.replace(/<(s|del|strike)(\s[^>]*)?>/gi, '[s]').replace(/<\/(s|del|strike)>/gi, '[/s]');
  s = s.replace(/<a\s[^>]*href="([^"]*)"[^>]*>/gi, (_m, href) => `[url=${decodeEntities(href)}]`).replace(/<\/a>/gi, '[/url]');
  s = s.replace(/<img\s[^>]*src="([^"]*)"[^>]*>/gi, (_m, src) => `[img]${decodeEntities(src)}[/img]`);
  s = s.replace(/<pre(\s[^>]*)?>/gi, '[code]').replace(/<\/pre>/gi, '[/code]\n');
  s = s.replace(/<code(\s[^>]*)?>/gi, '[code]').replace(/<\/code>/gi, '[/code]');
  s = s.replace(/<blockquote(\s[^>]*)?>/gi, '[quote]').replace(/<\/blockquote>/gi, '[/quote]\n');
  s = s.replace(/<ol(\s[^>]*)?>/gi, '[list=1]\n').replace(/<\/ol>/gi, '[/list]\n');
  s = s.replace(/<ul(\s[^>]*)?>/gi, '[list]\n').replace(/<\/ul>/gi, '[/list]\n');
  s = s.replace(/<li(\s[^>]*)?>/gi, '[*]').replace(/<\/li>/gi, '\n');
  s = s.replace(/<h[1-6](\s[^>]*)?>/gi, '[b]').replace(/<\/h[1-6]>/gi, '[/b]\n\n');
  s = s.replace(/<\/(p|div)>/gi, '\n\n');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  // [code] inside [code] (a <pre><code>) collapses to one.
  s = s.replace(/\[code\]\[code\]/g, '[code]').replace(/\[\/code\]\[\/code\]/g, '[/code]');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

/** NC's rendered HTML → site HTML. NC renders BBCode with <br/> + newlines. */
export function ncHtmlToSite(html: string): string {
  const cleaned = (html || '').replace(/<br\s*\/?>\s*\n/gi, '<br>');
  return sanitizeRichText(cleaned);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── org ↔ category ─────────────────────────────────────────────────────────

export interface OrgNcForum {
  orgId: string;
  ncCategoryId: number;
  ncCategorySlug: string;
  isPublic: boolean;
  siteFeedSlug: string;
  lastPolledAt: Date | null;
}

export async function getOrgNcForum(orgId: string): Promise<OrgNcForum | null> {
  const [r] = await db<Array<{ org_id: string; nc_category_id: number; nc_category_slug: string; is_public: boolean; site_feed_slug: string; last_polled_at: Date | null }>>`
    SELECT * FROM org_nc_forum WHERE org_id = ${orgId}
  `;
  return r ? { orgId: r.org_id, ncCategoryId: r.nc_category_id, ncCategorySlug: r.nc_category_slug, isPublic: r.is_public, siteFeedSlug: r.site_feed_slug, lastPolledAt: r.last_polled_at } : null;
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

const ORG_HEADER_NAME = 'Organisations';
const NC_ROLE = { user: 3, guest: 4 } as const;

async function ensureOrgHeader(): Promise<number> {
  const r = await ocs<Array<{ id: number; name: string }>>(robotCred(), 'GET', '/headers');
  if (r.ok === false) throw new Error(`list headers: ${r.status} ${r.error}`);
  const found = r.data.find((h) => h.name === ORG_HEADER_NAME);
  if (found) return found.id;
  const c = await ocs<{ id: number }>(robotCred(), 'POST', '/headers', { name: ORG_HEADER_NAME, description: 'One category per organisation, shared with its Team and its site.', sortOrder: 0 });
  if (c.ok === false) throw new Error(`create header: ${c.status} ${c.error}`);
  return c.data.id;
}

/**
 * The permission rows for an org's category. The Team reads, posts and
 * replies; the Admin role (the robot) has full access regardless. Public
 * adds NC's User role (read + reply) and Guest role (read).
 */
async function applyCategoryPermissions(categoryId: number, teamId: string, isPublic: boolean): Promise<void> {
  const permissions = isPublic
    ? [
        { roleId: NC_ROLE.user, canView: true, canPost: false, canReply: true, canModerate: false },
        { roleId: NC_ROLE.guest, canView: true, canPost: false, canReply: false, canModerate: false },
      ]
    : [];
  const teamPermissions = [{ teamId, canView: true, canPost: true, canReply: true, canModerate: false }];
  const r = await ocs(robotCred(), 'POST', `/categories/${categoryId}/permissions`, { permissions, teamPermissions });
  if (r.ok === false) throw new Error(`set permissions: ${r.status} ${r.error}`);
}

/**
 * Give an org its Nextcloud category (idempotent). Named after the org,
 * under the "Organisations" header, readable by its Team only unless public.
 */
export async function ensureOrgNcCategory(orgId: string, opts: { isPublic?: boolean; siteFeedSlug?: string } = {}): Promise<OrgNcForum> {
  if (!ncForumConfigured()) throw new Error('Nextcloud is not configured on this host.');
  const [org] = await db<Array<{ id: string; name: string; nextcloud_circle_id: string | null }>>`
    SELECT id, name, nextcloud_circle_id FROM organizations WHERE id = ${orgId}
  `;
  if (!org) throw new Error(`No such org: ${orgId}`);
  if (!org.nextcloud_circle_id) throw new Error(`${orgId} has no Nextcloud Team yet — run scripts/provision-org-circles.mjs first.`);

  const existing = await getOrgNcForum(orgId);
  const isPublic = opts.isPublic ?? existing?.isPublic ?? false;
  if (existing) {
    const check = await ocs<{ id: number; slug: string }>(robotCred(), 'GET', `/categories/${existing.ncCategoryId}`);
    if (check.ok) {
      await applyCategoryPermissions(existing.ncCategoryId, org.nextcloud_circle_id, isPublic);
      await db`
        UPDATE org_nc_forum SET is_public = ${isPublic}, nc_category_slug = ${check.data.slug},
          site_feed_slug = ${opts.siteFeedSlug ?? existing.siteFeedSlug}
        WHERE org_id = ${orgId}
      `;
      return (await getOrgNcForum(orgId))!;
    }
    if (check.status !== 404) throw new Error(`check category: ${check.status} ${check.error}`);
    await db`DELETE FROM org_nc_forum WHERE org_id = ${orgId}`;
  }

  const headerId = await ensureOrgHeader();
  const slug = slugify(org.name) || slugify(org.id);
  const bySlug = await ocs<{ id: number; slug: string }>(robotCred(), 'GET', `/categories/slug/${encodeURIComponent(slug)}`);
  let category: { id: number; slug: string };
  if (bySlug.ok && bySlug.data?.id) {
    category = bySlug.data;
  } else {
    const c = await ocs<{ id: number; slug: string }>(robotCred(), 'POST', '/categories', {
      headerId, name: org.name, slug, description: `${org.name} — shared with its Team and mirrored on its site's forum.`, sortOrder: 0,
    });
    if (c.ok === false) throw new Error(`create category: ${c.status} ${c.error}`);
    category = c.data;
  }
  await applyCategoryPermissions(category.id, org.nextcloud_circle_id, isPublic);
  await db`
    INSERT INTO org_nc_forum (org_id, nc_category_id, nc_category_slug, is_public, site_feed_slug)
    VALUES (${orgId}, ${category.id}, ${category.slug}, ${isPublic}, ${opts.siteFeedSlug ?? 'general'})
    ON CONFLICT (org_id) DO UPDATE SET nc_category_id = EXCLUDED.nc_category_id, nc_category_slug = EXCLUDED.nc_category_slug,
      is_public = EXCLUDED.is_public, site_feed_slug = EXCLUDED.site_feed_slug
  `;
  return (await getOrgNcForum(orgId))!;
}

// ── who a post is written as ────────────────────────────────────────────────

interface AuthorInfo { id: string; name: string; cred: Cred | null }

async function authorInfo(userId: string): Promise<AuthorInfo> {
  const [u] = await db<Array<{ display_name: string | null; nextcloud_user_id: string | null; nextcloud_app_password: string | null }>>`
    SELECT display_name, nextcloud_user_id, nextcloud_app_password FROM users WHERE id = ${userId}
  `;
  const cred = u?.nextcloud_user_id && u?.nextcloud_app_password
    ? { uid: u.nextcloud_user_id, secret: u.nextcloud_app_password, via: 'self' as const }
    : null;
  return { id: userId, name: u?.display_name || 'Someone', cred };
}

async function orgName(orgId: string): Promise<string> {
  const [o] = await db<Array<{ name: string }>>`SELECT name FROM organizations WHERE id = ${orgId}`;
  return o?.name ?? orgId;
}

/**
 * Write to NC as the author when we can, as the robot otherwise. A self
 * credential that NC refuses (stale app password, not in the Team) falls
 * back to the robot rather than failing the post.
 */
async function writeAs<T>(
  author: AuthorInfo,
  via: string,
  send: (cred: Cred, content: string) => Promise<OcsResult<T>>,
  bbcode: string
): Promise<{ result: OcsResult<T>; cred: Cred }> {
  if (author.cred) {
    const r = await send(author.cred, bbcode);
    if (r.ok || (r.status !== 401 && r.status !== 403)) return { result: r, cred: author.cred };
  }
  const robot = robotCred();
  const attributed = `[i]Posted by ${author.name} via ${via}[/i]\n\n${bbcode}`;
  return { result: await send(robot, attributed), cred: robot };
}

async function withOrgLock<T>(orgId: string, fn: (tx: typeof db) => Promise<T>): Promise<T> {
  return db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`ncforum:${orgId}`}))`;
    return fn(tx as unknown as typeof db);
  }) as Promise<T>;
}

// ── outbound ────────────────────────────────────────────────────────────────

async function setThreadNcMeta(tx: typeof db, threadId: string, ncThreadId: number, ncSlug: string): Promise<void> {
  await tx`
    UPDATE threads
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('nextcloud',
      jsonb_build_object('threadId', ${ncThreadId}::int, 'slug', ${ncSlug}::text, 'url', ${ncThreadUrl(ncSlug)}::text))
    WHERE id = ${threadId}
  `;
}

/**
 * Put a site topic into its org's Nextcloud category. Called by createTopic
 * when "Sync to Nextcloud" was ticked, and by the tick to retry.
 */
export async function pushTopicToNextcloud(threadId: string): Promise<{ ok: boolean; error?: string }> {
  const [t] = await db<Array<{ org_id: string; title: string; body: string | null; author_id: string }>>`
    SELECT org_id, title, body, author_id FROM threads WHERE id = ${threadId}
  `;
  if (!t) return { ok: false, error: 'No such thread.' };
  const forum = await getOrgNcForum(t.org_id);
  if (!forum) return { ok: false, error: 'This org has no Nextcloud forum category.' };
  const author = await authorInfo(t.author_id);
  const via = await orgName(t.org_id);

  return withOrgLock(t.org_id, async (tx) => {
    const [link] = await tx<Array<{ id: number; status: string; attempts: number }>>`
      INSERT INTO nc_forum_links (org_id, local_thread_id, origin, status)
      VALUES (${t.org_id}, ${threadId}, 'site', 'pending')
      ON CONFLICT (local_thread_id) WHERE local_reply_id IS NULL DO UPDATE SET attempts = nc_forum_links.attempts
      RETURNING id, status, attempts
    `;
    if (link.status === 'synced') return { ok: true };
    // A host without Nextcloud credentials (the forum container) leaves it
    // pending; the scheduler on a host that has them delivers it.
    if (!ncForumConfigured()) return { ok: false, error: 'queued for the sync' };

    const { result, cred } = await writeAs<NcThread>(
      author, via,
      (c, content) => ocs<NcThread>(c, 'POST', '/threads', { categoryId: forum.ncCategoryId, title: t.title, content }),
      htmlToBbcode(t.body ?? '')
    );
    if (result.ok === false) {
      await tx`UPDATE nc_forum_links SET status = 'failed', last_error = ${`${result.status} ${result.error}`}, attempts = attempts + 1 WHERE id = ${link.id}`;
      console.error(`[nc-forum] push topic ${threadId}:`, result.status, result.error);
      return { ok: false, error: result.error };
    }
    const nc = result.data;
    await tx`
      UPDATE nc_forum_links
      SET nc_thread_id = ${nc.id}, nc_post_id = ${nc.lastPostId}, posted_via = ${cred.via}, nc_author_uid = ${cred.uid},
          nc_updated_at = ${nc.updatedAt}, status = 'synced', last_error = NULL, attempts = attempts + 1, synced_at = NOW()
      WHERE id = ${link.id}
    `;
    await setThreadNcMeta(tx, threadId, nc.id, nc.slug);
    return { ok: true };
  });
}

/** Mirror a reply on a synced thread. A no-op for threads that aren't synced. */
export async function pushReplyToNextcloud(replyId: string): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const [r] = await db<Array<{ thread_id: string; user_id: string; content: string; org_id: string; nc_thread_id: number | null }>>`
    SELECT r.thread_id, r.user_id, r.content, t.org_id, l.nc_thread_id
    FROM replies r
    JOIN threads t ON t.id = r.thread_id
    LEFT JOIN nc_forum_links l ON l.local_thread_id = r.thread_id AND l.local_reply_id IS NULL AND l.status = 'synced'
    WHERE r.id = ${replyId}
  `;
  if (!r || !r.nc_thread_id) return { ok: true, skipped: true };
  const author = await authorInfo(r.user_id);
  const via = await orgName(r.org_id);
  const ncThreadId = r.nc_thread_id;

  return withOrgLock(r.org_id, async (tx) => {
    const [link] = await tx<Array<{ id: number; status: string }>>`
      INSERT INTO nc_forum_links (org_id, local_thread_id, local_reply_id, nc_thread_id, origin, status)
      VALUES (${r.org_id}, ${r.thread_id}, ${replyId}, ${ncThreadId}, 'site', 'pending')
      ON CONFLICT (local_reply_id) WHERE local_reply_id IS NOT NULL DO UPDATE SET attempts = nc_forum_links.attempts
      RETURNING id, status
    `;
    if (link.status === 'synced') return { ok: true };
    if (!ncForumConfigured()) return { ok: false, error: 'queued for the sync' };
    const { result, cred } = await writeAs<NcPost>(
      author, via,
      (c, content) => ocs<NcPost>(c, 'POST', '/posts', { threadId: ncThreadId, content }),
      htmlToBbcode(r.content)
    );
    if (result.ok === false) {
      await tx`UPDATE nc_forum_links SET status = 'failed', last_error = ${`${result.status} ${result.error}`}, attempts = attempts + 1 WHERE id = ${link.id}`;
      console.error(`[nc-forum] push reply ${replyId}:`, result.status, result.error);
      return { ok: false, error: result.error };
    }
    await tx`
      UPDATE nc_forum_links
      SET nc_post_id = ${result.data.id}, posted_via = ${cred.via}, nc_author_uid = ${cred.uid},
          nc_updated_at = ${result.data.updatedAt}, status = 'synced', last_error = NULL, attempts = attempts + 1, synced_at = NOW()
      WHERE id = ${link.id}
    `;
    return { ok: true };
  });
}

export type NcModeration = 'lock' | 'unlock' | 'pin' | 'unpin' | 'delete';

/** Carry a moderator's act on a synced thread across. Best effort, as the robot. */
export async function pushModerationToNextcloud(threadId: string, action: NcModeration): Promise<void> {
  const [l] = await db<Array<{ nc_thread_id: number | null }>>`
    SELECT nc_thread_id FROM nc_forum_links WHERE local_thread_id = ${threadId} AND local_reply_id IS NULL AND status = 'synced'
  `;
  if (!l?.nc_thread_id) return;
  if (!ncForumConfigured()) {
    // Queue it on the thread; syncOrgNcForum applies queued acts before it
    // pulls, so NC's older lock/pin state can't overwrite this one.
    await db`
      UPDATE threads SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{nextcloud,pendingMod}',
        COALESCE(metadata->'nextcloud'->'pendingMod', '[]'::jsonb) || to_jsonb(${action}::text), true)
      WHERE id = ${threadId}
    `;
    return;
  }
  await applyNcModeration(l.nc_thread_id, threadId, action);
}

async function applyNcModeration(id: number, threadId: string, action: NcModeration): Promise<boolean> {
  const r =
    action === 'lock' || action === 'unlock' ? await ocs(robotCred(), 'PUT', `/threads/${id}/lock`, { locked: action === 'lock' })
    : action === 'pin' || action === 'unpin' ? await ocs(robotCred(), 'PUT', `/threads/${id}/pin`, { pinned: action === 'pin' })
    // Hidden, not deleted: the site archives rather than deletes, and the
    // forum app's slug check ignores soft-deleted threads, so deleting one
    // makes the next topic with the same title fail to create (500, unique
    // violation on the slug — seen 2026-09-18). A hidden thread keeps its slug.
    : await ocs(robotCred(), 'PUT', `/threads/${id}`, { isHidden: true });
  if (!r.ok) console.error(`[nc-forum] ${action} ${threadId} → NC ${id}:`, r.status, r.error);
  return r.ok;
}

/** Apply moderation queued by a host without NC credentials. */
async function flushQueuedModeration(orgId: string): Promise<void> {
  const rows = await db<Array<{ id: string; nc_thread_id: number; pending: string[] }>>`
    SELECT t.id, l.nc_thread_id, t.metadata->'nextcloud'->'pendingMod' AS pending
    FROM threads t JOIN nc_forum_links l ON l.local_thread_id = t.id AND l.local_reply_id IS NULL
    WHERE l.org_id = ${orgId} AND l.nc_thread_id IS NOT NULL AND jsonb_array_length(COALESCE(t.metadata->'nextcloud'->'pendingMod', '[]'::jsonb)) > 0
  `;
  for (const r of rows) {
    for (const act of r.pending) await applyNcModeration(r.nc_thread_id, r.id, act as NcModeration);
    await db`UPDATE threads SET metadata = metadata #- '{nextcloud,pendingMod}' WHERE id = ${r.id}`;
  }
}

/** Fire-and-forget wrapper for write paths: a sync failure never fails the post. */
export function afterWrite(p: Promise<unknown>, what: string): void {
  p.catch((err) => console.error(`[nc-forum] ${what}:`, err));
}

// ── gates the write path asks ───────────────────────────────────────────────

export interface ThreadNcState { synced: boolean; isPublic: boolean }

export async function threadNcState(threadId: string): Promise<ThreadNcState> {
  const [r] = await db<Array<{ is_public: boolean | null }>>`
    SELECT f.is_public FROM nc_forum_links l
    JOIN org_nc_forum f ON f.org_id = l.org_id
    WHERE l.local_thread_id = ${threadId} AND l.local_reply_id IS NULL
  `;
  return r ? { synced: true, isPublic: Boolean(r.is_public) } : { synced: false, isPublic: false };
}

// ── inbound ─────────────────────────────────────────────────────────────────

async function listCategoryThreads(categoryId: number): Promise<NcThread[] | null> {
  const out: NcThread[] = [];
  for (let page = 1; page <= 50; page++) {
    const r = await ocs<{ threads: NcThread[]; pagination?: { totalPages: number } }>(robotCred(), 'GET', `/categories/${categoryId}/threads?page=${page}&perPage=50`);
    if (r.ok === false) { console.error('[nc-forum] list threads:', r.status, r.error); return null; }
    out.push(...(r.data.threads ?? []));
    if (page >= (r.data.pagination?.totalPages ?? 1) || !(r.data.threads ?? []).length) break;
  }
  return out;
}

async function listThreadPosts(ncThreadId: number): Promise<NcPost[] | null> {
  const out: NcPost[] = [];
  for (let page = 1; page <= 100; page++) {
    const r = await ocs<{ firstPost: NcPost | null; replies: NcPost[]; pagination?: { totalPages: number } }>(
      robotCred(), 'GET', `/threads/${ncThreadId}/posts?page=${page}&perPage=100`
    );
    if (r.ok === false) { console.error('[nc-forum] list posts:', r.status, r.error); return null; }
    if (page === 1 && r.data.firstPost) out.push(r.data.firstPost);
    out.push(...(r.data.replies ?? []));
    if (page >= (r.data.pagination?.totalPages ?? 1)) break;
  }
  return out;
}

async function mapNcAuthor(tx: typeof db, uid: string): Promise<string | null> {
  if (uid === robotCred().uid) return null;
  const [u] = await tx<Array<{ id: string }>>`SELECT id FROM users WHERE nextcloud_user_id = ${uid} LIMIT 1`;
  return u?.id ?? null;
}

/** Body for an NC post by someone with no site account: their name leads it. */
function bylined(name: string, html: string): string {
  return `<p><strong>${escapeHtml(name)}</strong> · on Nextcloud</p>${html}`;
}

const toDate = (sec: number): Date => new Date(sec * 1000);

export interface NcSyncReport {
  orgId: string;
  threadsImported: number;
  repliesImported: number;
  edited: number;
  removed: number;
  retried: number;
  error?: string;
}

/**
 * Pull one org's category into its site forum: new topics, new replies,
 * edits, lock/pin state, and deletions. Idempotent.
 */
export async function syncOrgNcForum(orgId: string): Promise<NcSyncReport> {
  const report: NcSyncReport = { orgId, threadsImported: 0, repliesImported: 0, edited: 0, removed: 0, retried: 0 };
  const forum = await getOrgNcForum(orgId);
  if (!forum || !ncForumConfigured()) return { ...report, error: 'not linked' };

  report.retried = await retryFailedPushes(orgId);
  await flushQueuedModeration(orgId);

  // The org's root category AND every sub-category under it. Sub-categories
  // are mirrored as sub-feeds and created on sight — see
  // resolveOrgCategoryFeeds. Before this, only the root was polled, so a topic
  // filed into a sub-category simply never reached the site.
  const mapped = await resolveOrgCategoryFeeds(orgId, forum);
  const visibility = forum.isPublic ? 'PUBLIC' : 'ORGANIZATION';

  // Accumulated across EVERY category, and this is load-bearing: the archival
  // pass below retires any linked topic it does not see. Moving a topic from
  // the root into a sub-category would otherwise look exactly like a deletion,
  // and the move would archive the very topic it was meant to relocate.
  const liveNcThreadIds = new Set<number>();
  let completeListing = true;

  for (const { ncCategoryId, feedSlug: section } of mapped) {
  const ncThreads = await listCategoryThreads(ncCategoryId);
  // One unreadable category must not archive the whole org's forum, so the
  // completeness flag drops and the archival pass stands down.
  if (!ncThreads) { completeListing = false; continue; }

  for (const nt of ncThreads) {
    if (nt.deletedAt || nt.isHidden) continue;
    liveNcThreadIds.add(nt.id);
    const posts = await listThreadPosts(nt.id);
    if (!posts) { completeListing = false; continue; }

    await withOrgLock(orgId, async (tx) => {
      const [tl] = await tx<Array<{ id: number; local_thread_id: string; nc_updated_at: number | null; origin: string }>>`
        SELECT id, local_thread_id, nc_updated_at, origin FROM nc_forum_links
        WHERE nc_thread_id = ${nt.id} AND local_reply_id IS NULL
      `;
      const first = posts.find((p) => p.isFirstPost) ?? null;
      let localThreadId: string;
      const fresh = !tl;

      if (!tl) {
        // A topic started on Nextcloud: make it here.
        const authorLocal = await mapNcAuthor(tx, nt.authorId);
        const name = first?.author?.displayName || nt.author?.displayName || nt.authorId;
        const html = ncHtmlToSite(first?.content ?? '');
        const post = await createThread({
          kind: 'post',
          title: nt.title,
          orgId,
          authorId: authorLocal ?? NC_FORUM_SENTINEL_ID,
          body: authorLocal ? html : bylined(name, html),
          status: 'published',
          visibility: visibility as 'PUBLIC',
          section,
          pinned: nt.isPinned,
          metadata: { nextcloud: { threadId: nt.id, slug: nt.slug, url: ncThreadUrl(nt.slug) } },
        });
        localThreadId = post.id;
        // createThread wrote on its own connection, so the link goes in on
        // one too, at once: if anything below rolls back, the thread still
        // has its link and the next pass fills in the replies instead of
        // importing the topic a second time.
        await db`
          INSERT INTO nc_forum_links (org_id, local_thread_id, nc_thread_id, nc_post_id, origin, nc_author_uid, nc_author_name, nc_updated_at, status, synced_at)
          VALUES (${orgId}, ${localThreadId}, ${nt.id}, ${first?.id ?? null}, 'nextcloud', ${nt.authorId}, ${name}, ${first?.updatedAt ?? nt.updatedAt}, 'synced', NOW())
        `;
        await tx`
          UPDATE threads SET locked = ${nt.isLocked}, created_at = ${toDate(nt.createdAt)}, published_at = ${toDate(nt.createdAt)},
            last_activity_at = ${toDate(nt.updatedAt)}
          WHERE id = ${localThreadId}
        `;
        report.threadsImported++;
      } else {
        localThreadId = tl.local_thread_id;
        await tx`
          UPDATE threads SET locked = ${nt.isLocked}, pinned = ${nt.isPinned},
            title = CASE WHEN ${tl.origin} = 'nextcloud' THEN ${nt.title} ELSE title END,
            -- The section follows Nextcloud: moving a topic between
            -- categories there moves it between feeds here.
            section = ${section},
            -- REVIVAL. Archival below is what happens to a topic that has
            -- left every category we mirror, and moving one into a
            -- sub-category looked exactly like that before sub-categories
            -- existed. Without this, such a topic stays archived forever even
            -- once it is visibly back — which is the state the first import
            -- of the Marketing topic ended up in. Only lifts 'archived': a draft
            -- is somebody's unfinished writing and is not ours to publish.
            status = CASE WHEN status = 'archived' THEN 'published' ELSE status END
          WHERE id = ${localThreadId}
        `;
        if (first && tl.origin === 'nextcloud' && (tl.nc_updated_at ?? 0) < first.updatedAt) {
          const authorLocal = await mapNcAuthor(tx, first.authorId);
          const html = ncHtmlToSite(first.content);
          await tx`UPDATE threads SET body = ${authorLocal ? html : bylined(first.author?.displayName || first.authorId, html)}, updated_at = NOW() WHERE id = ${localThreadId}`;
          await tx`UPDATE nc_forum_links SET nc_updated_at = ${first.updatedAt}, synced_at = NOW() WHERE id = ${tl.id}`;
          report.edited++;
        }
      }

      // Replies.
      const livePostIds = new Set<number>();
      for (const p of posts) {
        if (p.isFirstPost || p.deletedAt) continue;
        livePostIds.add(p.id);
        const [pl] = await tx<Array<{ id: number; local_reply_id: string | null; nc_updated_at: number | null; origin: string }>>`
          SELECT id, local_reply_id, nc_updated_at, origin FROM nc_forum_links WHERE nc_post_id = ${p.id}
        `;
        const authorLocal = await mapNcAuthor(tx, p.authorId);
        const name = p.author?.displayName || p.authorId;
        const html = authorLocal ? ncHtmlToSite(p.content) : bylined(name, ncHtmlToSite(p.content));
        if (!pl) {
          const replyId = nanoid();
          const userId = authorLocal ?? NC_FORUM_SENTINEL_ID;
          await tx`
            INSERT INTO replies (id, thread_id, user_id, content, created_at, updated_at)
            VALUES (${replyId}, ${localThreadId}, ${userId}, ${html}, ${toDate(p.createdAt)}, ${toDate(p.updatedAt)})
          `;
          await tx`
            INSERT INTO nc_forum_links (org_id, local_thread_id, local_reply_id, nc_thread_id, nc_post_id, origin, nc_author_uid, nc_author_name, nc_updated_at, status, synced_at)
            VALUES (${orgId}, ${localThreadId}, ${replyId}, ${nt.id}, ${p.id}, 'nextcloud', ${p.authorId}, ${name}, ${p.updatedAt}, 'synced', NOW())
          `;
          // Watchers hear about a new reply — but not about the backfill of a
          // topic we're importing for the first time.
          if (!fresh) {
            await tx`
              INSERT INTO notifications (id, user_id, kind, thread_id, reply_id, actor_id, data)
              SELECT ${nanoid(15)} || substr(md5(w.user_id::text), 1, 6), w.user_id, 'reply', ${localThreadId}, ${replyId}, ${userId}, ${tx.json({ via: 'nextcloud' })}
              FROM watches w WHERE w.thread_id = ${localThreadId} AND w.user_id <> ${userId}
            `;
          }
          report.repliesImported++;
        } else if (pl.local_reply_id && (pl.nc_updated_at ?? 0) < p.updatedAt && p.editedAt) {
          // Edited on Nextcloud. A site-origin reply edited there keeps its
          // NC wording (it was changed on purpose) minus our attribution line.
          const content = pl.origin === 'site'
            ? ncHtmlToSite(p.content.replace(/^<em>Posted by [^<]*<\/em>(<br\s*\/?>\s*)*/i, ''))
            : html;
          await tx`UPDATE replies SET content = ${content}, edited_at = ${toDate(p.editedAt)}, updated_at = NOW() WHERE id = ${pl.local_reply_id}`;
          await tx`UPDATE nc_forum_links SET nc_updated_at = ${p.updatedAt}, synced_at = NOW() WHERE id = ${pl.id}`;
          report.edited++;
        } else if ((pl.nc_updated_at ?? 0) < p.updatedAt) {
          await tx`UPDATE nc_forum_links SET nc_updated_at = ${p.updatedAt} WHERE id = ${pl.id}`;
        }
      }

      // Replies deleted on Nextcloud go here too. Only links that did land
      // on NC count — a pending push hasn't got a post to be missing.
      const gone = await tx<Array<{ id: number; local_reply_id: string; nc_post_id: number }>>`
        SELECT id, local_reply_id, nc_post_id FROM nc_forum_links
        WHERE local_thread_id = ${localThreadId} AND local_reply_id IS NOT NULL AND status = 'synced' AND nc_post_id IS NOT NULL
      `;
      for (const g of gone) {
        if (livePostIds.has(g.nc_post_id)) continue;
        await tx`DELETE FROM replies WHERE id = ${g.local_reply_id}`;
        report.removed++;
      }

      await tx`
        UPDATE threads t SET
          reply_count = (SELECT COUNT(*)::int FROM replies r WHERE r.thread_id = t.id),
          last_activity_at = GREATEST(COALESCE(t.published_at, t.created_at), COALESCE((SELECT MAX(r.created_at) FROM replies r WHERE r.thread_id = t.id), t.created_at))
        WHERE t.id = ${localThreadId}
      `;
    });
  }
  }

  // Topics gone from EVERY category we mirror (deleted, hidden, or moved out
  // of the org entirely) are archived here — never deleted, same as a
  // moderator's remove. A topic moved BETWEEN mirrored categories is still
  // live, so it survives and simply changes section.
  if (completeListing) {
    const linked = await db<Array<{ local_thread_id: string; nc_thread_id: number }>>`
      SELECT l.local_thread_id, l.nc_thread_id FROM nc_forum_links l
      JOIN threads t ON t.id = l.local_thread_id
      WHERE l.org_id = ${orgId} AND l.local_reply_id IS NULL AND l.status = 'synced' AND l.nc_thread_id IS NOT NULL AND t.status <> 'archived'
    `;
    for (const l of linked) {
      if (liveNcThreadIds.has(l.nc_thread_id)) continue;
      await db`UPDATE threads SET status = 'archived', updated_at = NOW() WHERE id = ${l.local_thread_id}`;
      report.removed++;
    }
  }

  await db`UPDATE org_nc_forum SET last_polled_at = NOW() WHERE org_id = ${orgId}`;
  return report;
}

async function retryFailedPushes(orgId: string): Promise<number> {
  const rows = await db<Array<{ local_thread_id: string; local_reply_id: string | null }>>`
    SELECT l.local_thread_id, l.local_reply_id FROM nc_forum_links l
    JOIN threads t ON t.id = l.local_thread_id AND t.status = 'published'
    WHERE l.org_id = ${orgId} AND l.origin = 'site' AND l.attempts < ${MAX_ATTEMPTS}
      AND (l.status = 'failed' OR (l.status = 'pending' AND l.created_at < NOW() - INTERVAL '2 minutes'))
    ORDER BY l.local_reply_id NULLS FIRST, l.created_at
    LIMIT 20
  `;
  let n = 0;
  for (const r of rows) {
    const res = r.local_reply_id ? await pushReplyToNextcloud(r.local_reply_id) : await pushTopicToNextcloud(r.local_thread_id);
    if (res.ok) n++;
  }
  return n;
}

let ticking = false;

/** One pass over every linked org. The host's scheduler calls this. */
export async function runNcForumSyncTick(): Promise<NcSyncReport[]> {
  if (ticking || !ncForumConfigured()) return [];
  ticking = true;
  try {
    const orgs = await db<Array<{ org_id: string }>>`SELECT org_id FROM org_nc_forum ORDER BY org_id`;
    const out: NcSyncReport[] = [];
    for (const o of orgs) {
      try {
        out.push(await syncOrgNcForum(o.org_id));
      } catch (err) {
        console.error(`[nc-forum] sync ${o.org_id}:`, err);
        out.push({ orgId: o.org_id, threadsImported: 0, repliesImported: 0, edited: 0, removed: 0, retried: 0, error: String(err) });
      }
    }
    return out;
  } finally {
    ticking = false;
  }
}

/**
 * Sync one org if its last poll is older than `maxAgeSec` — for a forum page
 * to call before rendering, so a reader rarely waits a whole tick. Bounded
 * by `timeoutMs`; a slow Nextcloud never holds the page.
 */
export async function syncOrgNcForumIfStale(orgId: string, opts: { maxAgeSec?: number; timeoutMs?: number } = {}): Promise<void> {
  const forum = await getOrgNcForum(orgId).catch(() => null);
  if (!forum) return;
  const age = forum.lastPolledAt ? (Date.now() - new Date(forum.lastPolledAt).getTime()) / 1000 : Infinity;
  if (age < (opts.maxAgeSec ?? 60)) return;
  // Claim the slot first so concurrent page loads don't all start a sync.
  await db`UPDATE org_nc_forum SET last_polled_at = NOW() WHERE org_id = ${orgId}`;
  const run = syncOrgNcForum(orgId).catch((err) => console.error(`[nc-forum] sync ${orgId}:`, err));
  await Promise.race([run, new Promise((r) => setTimeout(r, opts.timeoutMs ?? 2500))]);
}

// ── the category TREE: Nextcloud sub-categories become site sub-feeds ──────

interface NcCatNode {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
}

/**
 * Every category, flat, with its parent — the shape the site needs.
 *
 * `/categories` answers with HEADERS at the top level, each holding a
 * `categories` array; nesting WITHIN that array is expressed by `parentId`,
 * not by further nesting, so a sub-category arrives as a sibling of its
 * parent and only `parentId` tells them apart. Flattening here keeps that
 * one oddity in one place.
 */
async function listNcCategoryTree(): Promise<NcCatNode[]> {
  const r = await ocs<Array<{ categories?: Array<{ id: number; name: string; slug: string; parentId?: number | null }> }>>(
    robotCred(),
    'GET',
    '/categories'
  );
  if (!r.ok) return [];
  return (r.data ?? []).flatMap((h) =>
    (h.categories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId ?? null,
    }))
  );
}

/**
 * The NC categories this org owns, each paired with the site feed that mirrors
 * it — the org's root category plus every descendant, creating feeds as
 * needed.
 *
 * The user's call (2026-09-23): mirror Nextcloud's tree literally, so a child
 * of the root category becomes a child of the feed the root maps to. On
 * inner_group the root is category 8 → feed `general`, so `Marketing` (9,
 * parent 8) becomes feed `marketing` with `parent_slug = 'general'`.
 *
 * New sub-categories are adopted automatically on the next poll. A feed made
 * this way inherits the ORG category's visibility rather than defaulting to
 * public: these mirror a Team-scoped Nextcloud category, and a conversation
 * that was members-only there must not become world-readable by being
 * synced here.
 *
 * Depth is bounded. The tree comes from Nextcloud and cannot contain a cycle
 * today, but this runs unattended every three minutes and a malformed parent
 * chain must not become an infinite loop.
 */
const NC_CATEGORY_MAX_DEPTH = 6;

async function resolveOrgCategoryFeeds(
  orgId: string,
  forum: OrgNcForum
): Promise<Array<{ ncCategoryId: number; feedSlug: string }>> {
  const rootFeed =
    (await getOrgFeed(orgId, forum.siteFeedSlug)) ?? (await getOrgFeed(orgId, 'general'));
  const rootSlug = rootFeed?.slug ?? 'general';
  const pairs = [{ ncCategoryId: forum.ncCategoryId, feedSlug: rootSlug }];

  const all = await listNcCategoryTree();
  if (all.length === 0) return pairs;

  const byParent = new Map<number, NcCatNode[]>();
  for (const c of all) {
    if (c.parentId == null) continue;
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }

  // Breadth-first so a parent's feed always exists before its children's.
  let frontier: Array<{ cat: NcCatNode; parentFeed: string }> = (
    byParent.get(forum.ncCategoryId) ?? []
  ).map((cat) => ({ cat, parentFeed: rootSlug }));

  for (let depth = 0; depth < NC_CATEGORY_MAX_DEPTH && frontier.length > 0; depth++) {
    const next: Array<{ cat: NcCatNode; parentFeed: string }> = [];
    for (const { cat, parentFeed } of frontier) {
      const slug = await ensureFeedForNcCategory(orgId, cat, parentFeed, forum.isPublic);
      if (!slug) continue;
      pairs.push({ ncCategoryId: cat.id, feedSlug: slug });
      for (const child of byParent.get(cat.id) ?? []) {
        next.push({ cat: child, parentFeed: slug });
      }
    }
    frontier = next;
  }
  return pairs;
}

/**
 * The feed mirroring one NC category, made if it is not there yet.
 *
 * Matched on `nc_category_id` FIRST so that renaming a category in Nextcloud
 * moves the existing feed rather than stranding it and creating a second one.
 * Returns null rather than throwing: a category the site cannot mirror should
 * cost that category, not the whole sync.
 */
async function ensureFeedForNcCategory(
  orgId: string,
  cat: NcCatNode,
  parentSlug: string,
  isPublic: boolean
): Promise<string | null> {
  try {
    const [existing] = await db<Array<{ slug: string }>>`
      SELECT slug FROM org_feeds WHERE org_id = ${orgId} AND nc_category_id = ${cat.id} LIMIT 1
    `;
    if (existing) {
      await db`
        UPDATE org_feeds SET name = ${cat.name}, parent_slug = ${parentSlug}, updated_at = NOW()
        WHERE org_id = ${orgId} AND slug = ${existing.slug}
      `;
      return existing.slug;
    }

    // A feed slug is a URL segment on the org's site and must be unique per
    // org, so an unrelated feed already holding this slug gets a suffix
    // rather than being claimed.
    const base = slugify(cat.slug || cat.name) || `nc-${cat.id}`;
    let slug = base;
    for (let n = 2; n < 20; n++) {
      const [clash] = await db<Array<{ slug: string }>>`
        SELECT slug FROM org_feeds WHERE org_id = ${orgId} AND slug = ${slug} LIMIT 1
      `;
      if (!clash) break;
      slug = `${base}-${n}`;
    }

    await db`
      INSERT INTO org_feeds (org_id, slug, name, parent_slug, nc_category_id, is_public, sort_order)
      VALUES (${orgId}, ${slug}, ${cat.name}, ${parentSlug}, ${cat.id}, ${isPublic}, 500)
      ON CONFLICT (org_id, slug) DO NOTHING
    `;
    return slug;
  } catch (err) {
    console.error(`[nc-forum] could not mirror NC category ${cat.id} for ${orgId}:`, err);
    return null;
  }
}

// ── admin: bringing existing NC content under an org ───────────────────────

/** Every category in the NC forum, flattened out of its headers. */
export async function listNcCategories(): Promise<Array<{ id: number; name: string; slug: string; threadCount: number; header: string }>> {
  const r = await ocs<Array<{ name: string; categories?: Array<{ id: number; name: string; slug: string; threadCount: number }> }>>(robotCred(), 'GET', '/categories');
  if (!r.ok) throw new Error(`list categories: ${r.status} ${r.error}`);
  return (r.data ?? []).flatMap((h) => (h.categories ?? []).map((c) => ({ ...c, header: h.name })));
}

/**
 * Move NC threads into an org's category, where the next sync brings them
 * onto the site. Pick them by category, or by id — the forum app's global
 * thread index 500s on this instance, and threads whose category was
 * deleted can only be reached by id.
 */
export async function moveNcThreadsToOrg(
  orgId: string,
  opts: { fromCategoryIds?: number[]; threadIds?: number[] }
): Promise<{ moved: Array<{ id: number; title: string }>; failed: Array<{ id: number; error: string }> }> {
  const forum = await getOrgNcForum(orgId);
  if (!forum) throw new Error(`${orgId} has no Nextcloud forum category — ensureOrgNcCategory first.`);
  const ids = new Set<number>(opts.threadIds ?? []);
  for (const c of opts.fromCategoryIds ?? []) {
    const list = await listCategoryThreads(c);
    if (!list) throw new Error(`could not list category ${c}`);
    for (const t of list) ids.add(t.id);
  }
  const moved: Array<{ id: number; title: string }> = [];
  const failed: Array<{ id: number; error: string }> = [];
  for (const id of ids) {
    const t = await ocs<NcThread>(robotCred(), 'GET', `/threads/${id}?incrementView=0`);
    if (!t.ok) { failed.push({ id, error: `${t.status} ${t.error}` }); continue; }
    if (t.data.categoryId === forum.ncCategoryId) continue;
    const r = await ocs(robotCred(), 'PUT', `/threads/${id}/move`, { categoryId: forum.ncCategoryId });
    if (r.ok) moved.push({ id, title: t.data.title });
    else failed.push({ id, error: `${r.status} ${r.error}` });
  }
  return { moved, failed };
}
