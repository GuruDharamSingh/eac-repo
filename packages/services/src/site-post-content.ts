import { indexThread } from './content-index';
import { db } from '@elkdonis/db';
import { deriveExcerpt, sanitizePostBody, sanitizeRichText } from '@elkdonis/utils';
import { renderEssayHtml, type EssayDoc } from '@elkdonis/utils/essay';
import { createThread } from './posts';
import { canModerateOrg, statusForNewThread } from './moderation';
import { getOrgFeed } from './org-feeds';
import { getOrgRole } from './org-membership';
import { removeThreadAs } from './thread-admin';
import { ensureUniqueThreadSlug } from './thread-slug';
import { audienceToStorage, canViewThread, isAudience, storageToAudience, type Audience, type ThreadRole } from './thread-audience';
import { SERIES_KIND } from './thread-kinds';

// ============================================================================
// Posts on an org's own site: one save for the post part of the seven per-app
// `saveContentAction` copies (2026-11-14). Same shape and permission model as
// meeting-content.ts. The caller passes the acting `viewerId` (from
// getServerSession) and `orgId` (from siteConfig); neither is read from input.
//
// A field left out (`undefined`) keeps its stored value; an explicit `null`
// clears it. `title` is the only field always written. Revalidation, the
// pen-name byline and `showCycleBadge` stay in the app wrapper.
//
// Only `kind = 'post'` rows are handled. A series (kind `series`, or
// `metadata.series` an object) is the planner's and is refused.
// ============================================================================

const VISIBILITIES: Array<NonNullable<PostInput['visibility']>> = ['PUBLIC', 'ORGANIZATION', 'INVITE_ONLY'];
const ROLES: ThreadRole[] = ['viewer', 'member', 'guide', 'owner'];
const POST_KIND = 'post';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface PostInput {
  title: string;
  /** HTML. Sent without `bodyDoc` it also clears `threads.body_doc`. Both left out: body, document and `body_format` kept. */
  body?: string | null;
  /** Essay Canvas document: `body` is rendered from it; null clears the document and keeps the HTML unless `body` is sent. */
  bodyDoc?: EssayDoc | null;
  /** Left out: kept on edit, derived from the body on create. Empty or null: derived from the body. */
  excerpt?: string | null;
  /** `metadata.coverImageUrl`. Null removes the key. */
  coverImageUrl?: string | null;
  /** `org_feeds.slug`. Required on create unless `opts.sectionOptional`; left out on edit keeps it. */
  section?: string | null;
  /** Edit only: the slug is kept unless this is sent and differs; it is made unique with ensureUniqueThreadSlug(org, slug, id). */
  slug?: string;
  /** `audience` wins over `visibility`/`minRole` (thread-audience.ts). Left out: kept (new post: PUBLIC). */
  audience?: Audience;
  visibility?: 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY';
  minRole?: ThreadRole | null;
  /** `threads.share_to_network`. Left out: kept (new post: false). */
  shareToNetwork?: boolean;
  /** Keys merged into `threads.metadata` with `||`; a null value removes that key. Other keys are untouched. */
  metadata?: Record<string, JsonValue>;
  /** `media.id`s to attach as the post's materials. Left out: unchanged; [] detaches all. */
  materialIds?: string[];
}

export interface SavePostOptions {
  /** A save the person did not press: refused over any row that is not a draft. */
  autosave?: boolean;
  /** Let members of the org create posts (ifac). Default: owner, guide or network admin. */
  membersMayPost?: boolean;
  /** Do not require `section` on create. Default: required, as every app copy does. */
  sectionOptional?: boolean;
}

export interface PostRecord {
  id: string;
  orgId: string;
  slug: string;
  authorId: string;
  status: string;
  section: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  input: PostInput & {
    title: string;
    section: string | null;
    audience: Audience;
    visibility: NonNullable<PostInput['visibility']>;
    minRole: ThreadRole | null;
    materialIds: string[];
    /** The attached files, for the form's Materials row (2026-11-14). */
    materials: PostMaterial[];
  };
}

/** A file attached to a post (`media`, attached_to_type 'thread'). */
export interface PostMaterial {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

/** One line of an org's posts, for a form's "Start from" and lists. */
export interface PostSummary {
  id: string;
  title: string;
  status: string;
  section: string | null;
  updatedAt: string;
}

export type PostResult<T = void> = { ok: true; value: T; warnings?: string[] } | { ok: false; error: string };

type Row = {
  id: string; org_id: string; author_id: string; kind: string; slug: string; title: string;
  body: string | null; body_doc: unknown; excerpt: string | null; status: string;
  visibility: string; min_role: string | null; share_to_network: boolean; section: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date; updated_at: Date; published_at: Date | null; is_series: boolean;
};

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString();
}

async function readRow(id: string, orgId: string): Promise<Row | null> {
  const [row] = await db<Row[]>`
    SELECT t.*, (t.kind = ${SERIES_KIND} OR COALESCE(jsonb_typeof(t.metadata->'series') = 'object', false)) AS is_series
    FROM threads t WHERE t.id = ${id} AND t.org_id = ${orgId} LIMIT 1
  `;
  return row ?? null;
}

/** Author, or an owner/guide/admin who could open the row (a guide may not edit an owners-only post). */
async function mayChange(viewerId: string, row: Row): Promise<boolean> {
  if (row.author_id === viewerId) return true;
  if (!(await canModerateOrg(viewerId, row.org_id).catch(() => false))) return false;
  const [u] = await db<Array<{ is_admin: boolean }>>`SELECT is_admin FROM users WHERE id = ${viewerId}`;
  const role = await getOrgRole(viewerId, row.org_id).catch(() => null);
  return canViewThread(
    { visibility: row.visibility, minRole: row.min_role, authorId: row.author_id, status: row.status },
    { userId: viewerId, role: (role as ThreadRole | null) ?? null, isGlobalAdmin: Boolean(u?.is_admin) }
  );
}

function readAccess(input: PostInput): { visibility: NonNullable<PostInput['visibility']> | null; minRole: ThreadRole | null | undefined } {
  if (input.audience !== undefined) return audienceToStorage(input.audience);
  const visibility = input.visibility ?? null;
  return { visibility, minRole: visibility && visibility !== 'INVITE_ONLY' ? null : input.minRole };
}

async function validate(orgId: string, input: PostInput, creating: boolean, opts: SavePostOptions): Promise<string | null> {
  if ((input.title ?? '').trim().length < 2) return 'Give it a title.';
  if (input.visibility !== undefined && !VISIBILITIES.includes(input.visibility)) return 'Pick who can see it.';
  if (input.minRole != null && !ROLES.includes(input.minRole)) return 'Pick who can see it.';
  if (input.audience !== undefined && !isAudience(input.audience)) return 'Pick who can see it.';
  if (input.coverImageUrl && !/^(https?:)?\/\/|^\//.test(input.coverImageUrl)) return 'The cover must be an address or a path.';
  if (input.metadata && ('series' in input.metadata)) return 'That key belongs to the series planner.';
  if (input.section === null || input.section === '' || (creating && input.section === undefined)) {
    if (creating && !opts.sectionOptional) return 'Choose a page for it.';
  }
  if (input.section) {
    const feed = await getOrgFeed(orgId, input.section).catch(() => null);
    if (!feed) return 'That page does not exist on this site.';
  }
  return null;
}

/** One post with everything the form shows, or null when the viewer may not edit it (or it is not a post). */
export async function loadPostContent(viewerId: string, orgId: string, id: string): Promise<PostRecord | null> {
  const row = await readRow(id, orgId);
  if (!row || row.kind !== POST_KIND || !(await mayChange(viewerId, row))) return null;
  const meta = row.metadata ?? {};
  const mats = await db<Array<{ id: string; url: string | null; filename: string | null; mime_type: string | null; size_bytes: number | null }>>`
    SELECT id, url, filename, mime_type, size_bytes FROM media
    WHERE org_id = ${orgId} AND attached_to_type = 'thread' AND attached_to_id = ${id}
    ORDER BY created_at
  `;
  const access = audienceToStorage(storageAudience(row));
  return {
    id: row.id,
    orgId: row.org_id,
    slug: row.slug,
    authorId: row.author_id,
    status: row.status,
    section: row.section,
    publishedAt: iso(row.published_at),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
    input: {
      title: row.title,
      body: row.body,
      bodyDoc: row.body_doc && typeof row.body_doc === 'object' ? (row.body_doc as EssayDoc) : null,
      excerpt: row.excerpt,
      coverImageUrl: typeof meta.coverImageUrl === 'string' ? meta.coverImageUrl : null,
      section: row.section,
      slug: row.slug,
      audience: storageAudience(row),
      shareToNetwork: row.share_to_network,
      visibility: access.visibility,
      minRole: (row.min_role as ThreadRole | null) ?? null,
      materialIds: mats.map((m) => m.id),
      materials: mats.map((m) => ({ id: m.id, url: m.url ?? '', filename: m.filename ?? 'File', mimeType: m.mime_type ?? '', size: m.size_bytes ?? 0 })),
    },
  };
}

/**
 * An org's posts the viewer may edit, newest change first (2026-11-14): every post for an owner,
 * guide or network admin, the viewer's own otherwise. Archived rows are left out. The per-site
 * list actions (lib/forms/*-actions.ts sitePostListAction) read this.
 */
export async function listPostContent(viewerId: string, orgId: string, opts: { limit?: number } = {}): Promise<PostSummary[]> {
  if (!viewerId) return [];
  const limit = Math.max(1, Math.min(200, opts.limit ?? 50));
  const editor = await canModerateOrg(viewerId, orgId).catch(() => false);
  const rows = await db<Array<{ id: string; title: string; status: string; section: string | null; updated_at: Date }>>`
    SELECT id, title, status, section, updated_at FROM threads
    WHERE org_id = ${orgId} AND kind = ${POST_KIND} AND status <> 'archived'
      ${editor ? db`` : db`AND author_id = ${viewerId}`}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ id: r.id, title: r.title, status: r.status, section: r.section, updatedAt: iso(r.updated_at)! }));
}

function storageAudience(row: Row): Audience {
  return storageToAudience(row.visibility, row.min_role);
}

async function attachMaterials(orgId: string, threadId: string, materialIds: string[]): Promise<void> {
  await db`
    UPDATE media SET attached_to_type = NULL, attached_to_id = NULL
    WHERE org_id = ${orgId} AND attached_to_id = ${threadId}
      ${materialIds.length ? db`AND id <> ALL(${materialIds})` : db``}
  `;
  if (materialIds.length) {
    await db`
      UPDATE media SET attached_to_type = 'thread', attached_to_id = ${threadId}
      WHERE org_id = ${orgId} AND id = ANY(${materialIds})
    `;
  }
}

/**
 * Create (`threadId` absent) or update a post under `orgId`. `intent` is the button pressed; a
 * member's publish may become `pending` under the org's review rule (statusForNewThread).
 */
export async function savePostContent(
  viewerId: string,
  orgId: string,
  input: PostInput,
  intent: 'draft' | 'published',
  threadId?: string | null,
  opts: SavePostOptions = {}
): Promise<PostResult<PostRecord>> {
  const problem = await validate(orgId, input, !threadId, opts);
  if (problem) return { ok: false, error: problem };

  let id = threadId ?? null;
  let row: Row | null = null;
  if (id) {
    row = await readRow(id, orgId);
    if (!row) return { ok: false, error: 'That post no longer exists here.' };
    if (row.is_series) return { ok: false, error: 'This is a series: change it in its planner.' };
    if (row.kind !== POST_KIND) return { ok: false, error: 'That is not a post.' };
    if (!(await mayChange(viewerId, row))) return { ok: false, error: 'Only its author, or an owner or guide, can change this.' };
    if (opts.autosave && row.status !== 'draft') return { ok: false, error: 'Not saved automatically: it is no longer a draft. Press Save to update it.' };
  } else {
    const allowed = (await canModerateOrg(viewerId, orgId).catch(() => false)) ||
      (opts.membersMayPost && Boolean(await getOrgRole(viewerId, orgId).catch(() => null)));
    if (!allowed) return { ok: false, error: 'Only an owner or guide of this organisation can post here.' };
  }

  // A moderator editing keeps a published post published; an author without moderation goes
  // through the review rule again, as ifac's copy does.
  const status = await statusForNewThread(viewerId, orgId, intent);
  const title = input.title.trim().slice(0, 200);
  try {
    if (!id) {
      const created = await createThread({
        kind: POST_KIND, orgId, authorId: viewerId, title, status: 'draft',
        visibility: readAccess(input).visibility ?? 'PUBLIC',
        slug: input.slug || undefined,
      });
      id = created.id;
    }

    const doc = input.bodyDoc && typeof input.bodyDoc === 'object' ? input.bodyDoc : null;
    const setBody = doc !== null || input.body !== undefined;
    const setDoc = doc !== null || input.body !== undefined || input.bodyDoc === null;
    const body = doc ? sanitizeRichText(renderEssayHtml(doc)) || null : input.body?.trim() ? sanitizePostBody(input.body.trim()) : null;
    const access = readAccess(input);

    // Excerpt: left out keeps the stored one (create: derived); null or empty derives from the body.
    const bodyForExcerpt = setBody ? body : row?.body ?? null;
    const setExcerpt = input.excerpt !== undefined || !row;
    const excerpt = setExcerpt ? deriveExcerpt(bodyForExcerpt ?? '', { explicit: input.excerpt?.trim() || undefined }) || null : null;

    const slugChange = row && input.slug && input.slug !== row.slug ? await ensureUniqueThreadSlug(orgId, input.slug, id) : null;
    const slug = slugChange && slugChange !== row?.slug ? slugChange : null;

    const patch: Record<string, JsonValue> = {};
    const drop: string[] = [];
    if (input.coverImageUrl === null) drop.push('coverImageUrl');
    else if (input.coverImageUrl) patch.coverImageUrl = input.coverImageUrl;
    for (const [k, v] of Object.entries(input.metadata ?? {})) {
      if (v === null) drop.push(k);
      else patch[k] = v;
    }

    await db`
      UPDATE threads SET
        title       = ${title},
        slug        = COALESCE(${slug}::text, slug),
        body        = CASE WHEN ${setBody}::boolean THEN ${body}::text ELSE body END,
        body_doc    = CASE WHEN ${setDoc}::boolean THEN ${doc ? db.json(doc as never) : null}::jsonb ELSE body_doc END,
        body_format = CASE WHEN ${doc !== null}::boolean THEN 'doc'
                           WHEN ${setDoc}::boolean AND body_format = 'doc' THEN 'html'
                           ELSE body_format END,
        excerpt     = CASE WHEN ${setExcerpt}::boolean THEN ${excerpt}::text ELSE excerpt END,
        status      = ${status},
        share_to_network = CASE WHEN ${input.shareToNetwork !== undefined}::boolean THEN ${Boolean(input.shareToNetwork)} ELSE share_to_network END,
        visibility  = COALESCE(${access.visibility}::varchar, visibility),
        min_role    = CASE WHEN ${access.minRole !== undefined}::boolean THEN ${access.minRole ?? null}::varchar ELSE min_role END,
        section     = CASE WHEN ${input.section !== undefined}::boolean THEN ${input.section || null}::text ELSE section END,
        metadata    = (COALESCE(metadata, '{}'::jsonb) - ${drop}::text[]) || ${db.json(patch)},
        published_at = CASE WHEN ${status} = 'published' AND published_at IS NULL THEN NOW() ELSE published_at END,
        updated_at  = NOW()
      WHERE id = ${id} AND org_id = ${orgId}
    `;
    if (input.materialIds !== undefined) await attachMaterials(orgId, id, input.materialIds);
    await indexThread(id);

    // Read back as an editor of its own row: the author or moderator that just wrote it.
    const record = await loadPostContent(viewerId, orgId, id);
    if (!record) return { ok: false, error: 'Saved, but it could not be read back.' };
    return { ok: true, value: record, warnings: [] };
  } catch (err) {
    console.error('[site-post-content] savePostContent:', err);
    return { ok: false, error: 'Could not save that. Try again.' };
  }
}

/** Archive it (removeThread's rules: author or owner/guide/admin). Replies, RSVPs and gathers keep their keys. */
export async function removePostContent(viewerId: string, orgId: string, threadId: string): Promise<PostResult<{ section: string | null; slug: string }>> {
  const row = await readRow(threadId, orgId);
  if (!row || row.kind !== POST_KIND) return { ok: false, error: 'That post no longer exists.' };
  const editor = await canModerateOrg(viewerId, orgId).catch(() => false);
  const r = await removeThreadAs(viewerId, threadId, { editor });
  if (r.ok === false) return { ok: false, error: r.error };
  return { ok: true, value: { section: row.section, slug: row.slug } };
}
