import { db } from '@elkdonis/db';
import { deriveExcerpt, sanitizeRichText } from '@elkdonis/utils';
import { renderEssayHtml, type EssayDoc } from '@elkdonis/utils/essay';
import { createThread } from './posts';
import { ensureUniqueThreadSlug } from './thread-slug';
import { WRITING_KIND } from './thread-kinds';
import { PERSONAL_ORG_ID, listListableOrgs, listedOnClause, setThreadListing } from './thread-listing';

// ============================================================================
// A person's own writing — the blog behind a profile page.
//
// Threads with `kind='writing'`, authored by the person, homed in `oad`
// (ArtDirect) since 2026-09-26 and listed on the org sites they are read on
// (/artists/<slug>/writing/<post> on IFAC); see thread-listing.ts. Two
// deliberate consequences of that shape:
//
//   - it is the SAME substrate as every other piece of writing on the network,
//     so it gets the shared editor, the reading layer (@elkdonis/cms-ui/article),
//     slug allocation, excerpts and draft/published semantics for free
//   - it is NOT the org's voice. `OFF_FEED_KINDS` keeps it out of the org feed,
//     the forum, search and the cross-org network feed. The only place a piece
//     appears is on its author's own page, which is the whole point: an artist
//     writing about their practice is not filing a notice with the collective.
//
// Reads are always scoped by author, never by id alone, so a post slug can
// only ever resolve under the person who wrote it — two artists may both have
// a "studio-notes".
//
// Authorization is NOT in here, matching galleries.ts: every write takes an
// author id the caller has already established as the owner (or an admin
// acting for them) via canEditProfile. Keeping the check out of the data layer
// is what lets an app with a different rule reuse this.
// ============================================================================

export { WRITING_KIND };

export type WritingStatus = 'draft' | 'published';

export interface WritingSeo {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  noindex: boolean;
}

export interface WritingByline {
  userId: string;
  name: string;
}

export type WritingLayout = 'essay' | 'feature' | 'note' | 'announcement' | 'document';
export const WRITING_LAYOUTS: WritingLayout[] = ['essay', 'feature', 'note', 'announcement', 'document'];

export interface WritingPost {
  id: string;
  authorId: string;
  orgId: string;
  slug: string;
  title: string;
  /** The standfirst under the headline — `threads.excerpt`. */
  lede: string | null;
  /** Sanitized HTML, safe to render. */
  bodyHtml: string;
  /** The essay canvas's document when the body was rendered from one (body_format 'doc'). */
  bodyDoc: EssayDoc | null;
  bodyFormat: 'html' | 'md' | 'mdx' | 'doc';
  coverImageUrl: string | null;
  /** Reading layout preset (metadata.layout); null = the author's default, then 'essay'. */
  layout: WritingLayout | null;
  /** The series this piece is filed under on the author's page (metadata.series); free text. */
  series: string | null;
  /**
   * Who the piece is published as (metadata.byline): one of the account's
   * acting identities (identities.ts) — a pen name or an org. Null = the
   * author's own name. The author stays the owner (author_id) either way,
   * so membership, listing and drafts keep working (dev, 2026-09-27).
   */
  byline: WritingByline | null;
  /** Search and sharing overrides (metadata.seo). Each falls back to the piece's own fields. */
  seo: WritingSeo | null;
  status: WritingStatus;
  publishedAt: string | null;
  updatedAt: string;
  /** Estimated, from the body. Null when there is nothing to estimate from. */
  readingMinutes: number | null;
  /** A published reel (metadata.video), shown in the cover's place. */
  video: WritingVideo | null;
}

/**
 * A Studio reel published as a piece (reels.ts publishReel). `src` and
 * `poster` are public media URLs (a copy outside Private/); `reelId` ties
 * the piece back to its reel so publishing again updates the same piece.
 */
export interface WritingVideo {
  src: string;
  poster: string | null;
  durationS: number | null;
  reelId: string;
}

/** What a shelf card needs — no body payload. */
export interface WritingSummary {
  id: string;
  slug: string;
  title: string;
  lede: string | null;
  coverImageUrl: string | null;
  series: string | null;
  status: WritingStatus;
  publishedAt: string | null;
  updatedAt: string;
  readingMinutes: number | null;
}

interface Row {
  id: string;
  author_id: string;
  org_id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  body_doc: EssayDoc | null;
  body_format: string | null;
  cover_image_url: string | null;
  layout: string | null;
  series: string | null;
  byline: { userId?: unknown; name?: unknown } | null;
  seo: { title?: unknown; description?: unknown; imageUrl?: unknown; noindex?: unknown } | null;
  video?: { src?: unknown; poster?: unknown; durationS?: unknown; reelId?: unknown } | null;
  status: string;
  published_at: Date | string | null;
  updated_at: Date | string;
}

/** Columns every read here selects, over alias `t`. */
const COLS = db`
  t.id, t.author_id, t.org_id, t.slug, t.title, t.excerpt, t.body, t.body_doc, t.body_format, t.status,
  t.metadata->>'coverImageUrl' AS cover_image_url,
  t.metadata->>'layout' AS layout,
  t.metadata->>'series' AS series,
  t.metadata->'byline' AS byline,
  t.metadata->'seo' AS seo,
  t.metadata->'video' AS video,
  t.published_at, t.updated_at
`;

/** Without the body — a shelf of 30 cards should not carry 30 articles. */
const SUMMARY_COLS = db`
  t.id, t.author_id, t.org_id, t.slug, t.title, t.excerpt, t.status,
  t.metadata->>'coverImageUrl' AS cover_image_url,
  t.metadata->>'layout' AS layout,
  t.metadata->>'series' AS series,
  t.metadata->'byline' AS byline,
  t.metadata->'seo' AS seo,
  t.published_at, t.updated_at,
  LENGTH(REGEXP_REPLACE(COALESCE(t.body, ''), '<[^>]*>', ' ', 'g')) AS body_length
`;

const iso = (v: Date | string | null): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : v;

/**
 * 230 words a minute over a rough word count, rounded up, and never shown for
 * anything under a minute — an estimate on a three-paragraph note is noise.
 */
function readingMinutes(chars: number): number | null {
  if (!chars) return null;
  const minutes = Math.ceil(chars / 5 / 230);
  return minutes >= 2 ? minutes : null;
}

function plainLength(html: string | null): number {
  if (!html) return 0;
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length;
}

function mapPost(row: Row): WritingPost {
  return {
    id: row.id,
    authorId: row.author_id,
    orgId: row.org_id,
    slug: row.slug,
    title: row.title,
    lede: row.excerpt,
    // Sanitized on write, and again here: a row that predates the write path
    // (or was seeded by hand) must not reach a page as raw HTML.
    bodyHtml: sanitizeRichText(row.body),
    bodyDoc: row.body_format === 'doc' && row.body_doc && typeof row.body_doc === 'object' ? row.body_doc : null,
    bodyFormat:
      row.body_format === 'doc' || row.body_format === 'md' || row.body_format === 'mdx' ? row.body_format : 'html',
    coverImageUrl: row.cover_image_url,
    layout: (WRITING_LAYOUTS as string[]).includes(row.layout ?? '') ? (row.layout as WritingLayout) : null,
    series: row.series?.trim() || null,
    byline:
      row.byline && typeof row.byline === 'object' && typeof row.byline.userId === 'string' && typeof row.byline.name === 'string'
        ? { userId: row.byline.userId, name: row.byline.name }
        : null,
    seo: mapSeo(row.seo),
    status: row.status === 'draft' ? 'draft' : 'published',
    publishedAt: iso(row.published_at),
    updatedAt: iso(row.updated_at) ?? new Date().toISOString(),
    readingMinutes: readingMinutes(plainLength(row.body)),
    video: mapVideo(row.video),
  };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
function mapVideo(v: Row['video']): WritingVideo | null {
  if (!v || typeof v !== 'object') return null;
  const src = str(v.src);
  const reelId = str(v.reelId);
  // Only our own media route: metadata is written by publishReel, but a
  // hand-edited row must not put an arbitrary URL in a <video>.
  if (!src || !reelId || !src.startsWith('/api/media/')) return null;
  const poster = str(v.poster);
  return {
    src,
    poster: poster && poster.startsWith('/api/media/') ? poster : null,
    durationS: typeof v.durationS === 'number' ? v.durationS : null,
    reelId,
  };
}
function mapSeo(v: Row['seo']): WritingSeo | null {
  if (!v || typeof v !== 'object') return null;
  const seo = { title: str(v.title), description: str(v.description), imageUrl: str(v.imageUrl), noindex: v.noindex === true };
  return seo.title || seo.description || seo.imageUrl || seo.noindex ? seo : null;
}

function mapSummary(row: Row & { body_length: number }): WritingSummary {
  return {
    series: row.series?.trim() || null,
    id: row.id,
    slug: row.slug,
    title: row.title,
    lede: row.excerpt,
    coverImageUrl: row.cover_image_url,
    status: row.status === 'draft' ? 'draft' : 'published',
    publishedAt: iso(row.published_at),
    updatedAt: iso(row.updated_at) ?? new Date().toISOString(),
    readingMinutes: readingMinutes(Number(row.body_length) || 0),
  };
}

export interface ListWritingOptions {
  /**
   * Restrict to what one org's site shows: pieces homed there or listed there
   * (thread_orgs). Omit for everything the person has written.
   */
  orgId?: string;
  /** Drafts are the author's own business — only true for them or an admin. */
  includeDrafts?: boolean;
  limit?: number;
}

/**
 * One person's writing, newest first.
 *
 * Drafts sort by when they were last touched and published pieces by when they
 * appeared, so a draft a writer is working on stays at the top of their own
 * shelf without ever claiming a publication date it does not have.
 */
export async function listWriting(
  authorId: string,
  opts: ListWritingOptions = {}
): Promise<WritingSummary[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  try {
    const rows = await db<Array<Row & { body_length: number }>>`
      SELECT ${SUMMARY_COLS}
      FROM threads t
      WHERE t.author_id = ${authorId}::uuid
        AND t.kind = ${WRITING_KIND}
        ${opts.orgId ? db`AND ${listedOnClause(opts.orgId)}` : db``}
        ${opts.includeDrafts ? db`AND t.status IN ('draft', 'published')` : db`AND t.status = 'published'`}
      ORDER BY COALESCE(t.published_at, t.updated_at) DESC
      LIMIT ${limit}
    `;
    return rows.map(mapSummary);
  } catch (err) {
    console.error(`[writing] listWriting(${authorId}):`, err);
    return [];
  }
}

/** The author's series: distinct names over their pieces, most recent first, with counts. */
export async function listWritingSeries(authorId: string): Promise<Array<{ name: string; count: number }>> {
  try {
    const rows = await db<Array<{ name: string; count: number }>>`
      SELECT t.metadata->>'series' AS name, COUNT(*)::int AS count
      FROM threads t
      WHERE t.author_id = ${authorId}::uuid AND t.kind = ${WRITING_KIND}
        AND t.status IN ('draft', 'published') AND COALESCE(t.metadata->>'series', '') <> ''
      GROUP BY 1 ORDER BY MAX(COALESCE(t.published_at, t.updated_at)) DESC
    `;
    return rows.map((r) => ({ name: r.name, count: Number(r.count) }));
  } catch (err) {
    console.error(`[writing] listWritingSeries(${authorId}):`, err);
    return [];
  }
}

/** A published piece on an org's shelf, with the author it links through. */
export interface OrgWritingSummary extends WritingSummary {
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
    /** `users.slug`; null when the author has no public profile here. */
    slug: string | null;
    /** From `org_profiles.tags` — there is no kind column. */
    isDealer: boolean;
  };
}

/**
 * The latest published writing across an org's members, newest first — a
 * home-page shelf, where `listWriting` is one person's.
 *
 * Only pieces shown on this org: homed here or listed here (thread_orgs,
 * see thread-listing.ts). The author's slug is returned only when their
 * profile on this org is public: a hidden profile has no page for the card
 * to link to.
 */
export async function listOrgWriting(
  orgId: string,
  opts: { limit?: number } = {}
): Promise<OrgWritingSummary[]> {
  const limit = Math.min(opts.limit ?? 6, 50);
  try {
    const rows = await db<
      Array<
        Row & {
          body_length: number;
          author_name: string | null;
          author_avatar: string | null;
          author_slug: string | null;
          author_public: boolean | null;
          author_tags: string[] | null;
        }
      >
    >`
      SELECT ${SUMMARY_COLS},
        u.display_name AS author_name,
        u.avatar_url AS author_avatar,
        u.slug AS author_slug,
        op.is_public AS author_public,
        op.tags AS author_tags
      FROM threads t
      JOIN users u ON u.id = t.author_id
      LEFT JOIN org_profiles op ON op.user_id = t.author_id AND op.org_id = ${orgId}
      WHERE ${listedOnClause(orgId)}
        AND t.kind = ${WRITING_KIND}
        AND t.status = 'published'
      ORDER BY COALESCE(t.published_at, t.updated_at) DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => ({
      ...mapSummary(row),
      author: {
        id: row.author_id,
        name: row.author_name?.trim() || 'A member',
        avatarUrl: row.author_avatar,
        slug: row.author_public ? row.author_slug : null,
        isDealer: Boolean(row.author_tags?.includes('dealer')),
      },
    }));
  } catch (err) {
    console.error(`[writing] listOrgWriting(${orgId}):`, err);
    return [];
  }
}

/** How many pieces this person has, for a profile card or a hub preview. */
export async function countWriting(
  authorId: string,
  opts: { orgId?: string; includeDrafts?: boolean } = {}
): Promise<number> {
  try {
    const [row] = await db<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n
      FROM threads t
      WHERE t.author_id = ${authorId}::uuid
        AND t.kind = ${WRITING_KIND}
        ${opts.orgId ? db`AND t.org_id = ${opts.orgId}` : db``}
        ${opts.includeDrafts ? db`AND t.status IN ('draft', 'published')` : db`AND t.status = 'published'`}
    `;
    return row?.n ?? 0;
  } catch (err) {
    console.error(`[writing] countWriting(${authorId}):`, err);
    return 0;
  }
}

/**
 * One piece, looked up under its AUTHOR.
 *
 * Scoping the read by author is what makes `/artists/<person>/writing/<slug>`
 * mean what it says: the slug is resolved inside that person's work, so the
 * route cannot be made to serve somebody else's post by guessing a slug.
 */
export async function getWritingPost(
  authorId: string,
  slug: string,
  opts: { includeDrafts?: boolean } = {}
): Promise<WritingPost | null> {
  try {
    const rows = await db<Row[]>`
      SELECT ${COLS}
      FROM threads t
      WHERE t.author_id = ${authorId}::uuid
        AND t.kind = ${WRITING_KIND}
        AND t.slug = ${slug}
        ${opts.includeDrafts ? db`AND t.status IN ('draft', 'published')` : db`AND t.status = 'published'`}
      LIMIT 1
    `;
    return rows[0] ? mapPost(rows[0]) : null;
  } catch (err) {
    console.error(`[writing] getWritingPost(${authorId}, ${slug}):`, err);
    return null;
  }
}

/** By id — for a write path that has already authorized against the row. */
export async function getWritingPostById(id: string): Promise<WritingPost | null> {
  try {
    const rows = await db<Row[]>`
      SELECT ${COLS} FROM threads t
      WHERE t.id = ${id} AND t.kind = ${WRITING_KIND} AND t.status <> 'archived'
      LIMIT 1
    `;
    return rows[0] ? mapPost(rows[0]) : null;
  } catch (err) {
    console.error(`[writing] getWritingPostById(${id}):`, err);
    return null;
  }
}

export interface CreateWritingInput {
  authorId: string;
  /**
   * The org whose site the piece is started on. The piece is homed in
   * PERSONAL_ORG_ID (ArtDirect) and listed on this org when the author is a
   * member there; otherwise it is homed here, as before 2026-09-26.
   */
  orgId: string;
  title: string;
}

export type WritingResult =
  | { ok: true; post: WritingPost }
  | { ok: false; error: string };

/**
 * Start a piece.
 *
 * Deliberately one field, exactly like starting a gallery page: a title, and
 * then you write ON the page, where you can see it. A new piece is a DRAFT —
 * nothing a person types appears on their public page until they say so.
 */
export async function createWritingPost(
  input: CreateWritingInput
): Promise<WritingResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Give the piece a title to start.' };
  if (title.length > 200) return { ok: false, error: 'That title is too long.' };

  try {
    // Personal content lives on the author's network page and is listed on
    // the site it was started from (PERSON_PAGES_BRIEF decision 1). An author
    // who cannot list there (not a member) keeps the old org-homed behaviour,
    // so the piece still appears on the page they are writing from.
    const listOn =
      input.orgId !== PERSONAL_ORG_ID &&
      (await listListableOrgs(input.authorId)).some((o) => o.orgId === input.orgId);
    const homeOrgId = listOn || input.orgId === PERSONAL_ORG_ID ? PERSONAL_ORG_ID : input.orgId;
    const created = await createThread({
      kind: WRITING_KIND,
      title,
      orgId: homeOrgId,
      authorId: input.authorId,
      status: 'draft',
      // PUBLIC is the truth about a published piece: anyone may read it on the
      // author's page. It is OFF_FEED_KINDS, not visibility, that keeps it off
      // the org's own surfaces — see thread-kinds.ts.
      visibility: 'PUBLIC',
    });
    if (listOn) {
      const listed = await setThreadListing(input.authorId, created.id, input.orgId, true);
      if (!listed.ok) console.error(`[writing] createWritingPost: listing on ${input.orgId}:`, listed.error);
    }
    const post = await getWritingPostById(created.id);
    return post
      ? { ok: true, post }
      : { ok: false, error: 'The piece was created but could not be read back.' };
  } catch (err) {
    console.error('[writing] createWritingPost:', err);
    return { ok: false, error: 'Could not start that piece.' };
  }
}

export interface UpdateWritingInput {
  title?: string;
  lede?: string | null;
  bodyHtml?: string;
  /**
   * The essay canvas's document. When given it wins over bodyHtml: the body
   * is rendered from it on the server (renderEssayHtml, then sanitised) and
   * body_format becomes 'doc'. The browser's HTML is never stored.
   */
  bodyDoc?: EssayDoc;
  coverImageUrl?: string | null;
  /** null clears it (back to the author's default). */
  layout?: WritingLayout | null;
  /** Series name; null takes the piece out of its series. */
  series?: string | null;
  /** Validated by the caller against the account's acting identities; null = own name. */
  byline?: WritingByline | null;
  /** Search and sharing; null clears. */
  seo?: Partial<WritingSeo> | null;
  /** A published reel; null removes it. Written by reels.ts publishReel. */
  video?: WritingVideo | null;
  status?: WritingStatus;
}

/**
 * Save a piece.
 *
 * The slug does not move when a title is edited. A published piece is a record
 * with an address someone may have kept; renaming it is a correction, not a
 * republication. (A draft has no such claim on anyone, so its slug is refreshed
 * from the title until the first time it is published.)
 *
 * `published_at` is stamped once, on the first publish, and survives a later
 * return to draft — so a piece pulled back for an edit and put out again keeps
 * the date it first appeared rather than claiming today.
 */
export async function updateWritingPost(
  id: string,
  patch: UpdateWritingInput
): Promise<WritingResult> {
  const existing = await getWritingPostById(id);
  if (!existing) return { ok: false, error: 'That piece no longer exists.' };

  const title = patch.title?.trim();
  if (title !== undefined && !title) {
    return { ok: false, error: 'A piece needs a title.' };
  }

  const fromDoc = patch.bodyDoc !== undefined;
  const body = fromDoc
    ? sanitizeRichText(renderEssayHtml(patch.bodyDoc))
    : patch.bodyHtml === undefined
      ? undefined
      : sanitizeRichText(patch.bodyHtml);

  // An explicit lede wins; a blank one falls back to a derived excerpt so a
  // shelf card is never empty, and an empty body derives nothing.
  let lede = patch.lede === undefined ? undefined : patch.lede?.trim() || null;
  if (lede === null && body !== undefined) lede = deriveExcerpt(body) || null;

  const nextTitle = title ?? existing.title;
  const slug =
    existing.status === 'draft' && title !== undefined && title !== existing.title
      ? await ensureUniqueThreadSlug(existing.orgId, title, id)
      : existing.slug;

  const publishing = patch.status === 'published' && !existing.publishedAt;

  try {
    await db`
      UPDATE threads SET
        title = ${nextTitle},
        slug = ${slug},
        ${patch.lede !== undefined || body !== undefined ? db`excerpt = ${lede ?? existing.lede},` : db``}
        ${body !== undefined
          ? fromDoc
            ? db`body = ${body}, body_doc = ${db.json(patch.bodyDoc as never)}, body_format = 'doc',`
            : db`body = ${body}, body_doc = NULL, body_format = 'html',`
          : db``}
        ${patch.coverImageUrl !== undefined || patch.layout !== undefined || patch.series !== undefined || patch.byline !== undefined || patch.seo !== undefined || patch.video !== undefined
          ? db`metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json({
              ...(patch.video !== undefined ? { video: patch.video } : {}),
              ...(patch.coverImageUrl !== undefined ? { coverImageUrl: patch.coverImageUrl } : {}),
              ...(patch.layout !== undefined ? { layout: patch.layout } : {}),
              ...(patch.series !== undefined ? { series: patch.series?.trim().slice(0, 120) || null } : {}),
              ...(patch.byline !== undefined ? { byline: patch.byline ? { userId: patch.byline.userId, name: patch.byline.name.slice(0, 120) } : null } : {}),
              ...(patch.seo !== undefined
                ? {
                    seo: patch.seo
                      ? {
                          title: patch.seo.title?.trim().slice(0, 160) || null,
                          description: patch.seo.description?.trim().slice(0, 320) || null,
                          imageUrl: patch.seo.imageUrl?.trim().slice(0, 500) || null,
                          noindex: patch.seo.noindex === true,
                        }
                      : null,
                  }
                : {}),
            } as never)},`
          : db``}
        ${patch.status !== undefined ? db`status = ${patch.status},` : db``}
        ${publishing ? db`published_at = NOW(),` : db``}
        updated_at = NOW()
      WHERE id = ${id} AND kind = ${WRITING_KIND}
    `;
  } catch (err) {
    console.error(`[writing] updateWritingPost(${id}):`, err);
    return { ok: false, error: 'Could not save that.' };
  }

  const post = await getWritingPostById(id);
  return post ? { ok: true, post } : { ok: false, error: 'Could not read the piece back.' };
}

/**
 * Take a piece down. Archived, not deleted, like every thread (removeThread in
 * thread-admin.ts): replies and reactions keep their keys. The reads above
 * skip archived rows, so to its author and readers the piece is gone. The
 * callers have already authorised against the row.
 */
export async function deleteWritingPost(id: string): Promise<boolean> {
  try {
    const rows = await db<Array<{ id: string }>>`
      UPDATE threads SET status = 'archived', updated_at = NOW()
      WHERE id = ${id} AND kind = ${WRITING_KIND} AND status <> 'archived'
      RETURNING id
    `;
    return rows.length > 0;
  } catch (err) {
    console.error(`[writing] deleteWritingPost(${id}):`, err);
    return false;
  }
}
