import { db } from '@elkdonis/db';
import { deriveExcerpt, sanitizeRichText } from '@elkdonis/utils';
import { createThread } from './posts';
import { ensureUniqueThreadSlug } from './thread-slug';
import { WRITING_KIND } from './thread-kinds';

// ============================================================================
// A person's own writing — the blog behind a profile page.
//
// Threads with `kind='writing'`, authored by the person and carried by the org
// whose site they are read on (/artists/<slug>/writing/<post> on IFAC). Two
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
  coverImageUrl: string | null;
  status: WritingStatus;
  publishedAt: string | null;
  updatedAt: string;
  /** Estimated, from the body. Null when there is nothing to estimate from. */
  readingMinutes: number | null;
}

/** What a shelf card needs — no body payload. */
export interface WritingSummary {
  id: string;
  slug: string;
  title: string;
  lede: string | null;
  coverImageUrl: string | null;
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
  cover_image_url: string | null;
  status: string;
  published_at: Date | string | null;
  updated_at: Date | string;
}

/** Columns every read here selects, over alias `t`. */
const COLS = db`
  t.id, t.author_id, t.org_id, t.slug, t.title, t.excerpt, t.body, t.status,
  t.metadata->>'coverImageUrl' AS cover_image_url,
  t.published_at, t.updated_at
`;

/** Without the body — a shelf of 30 cards should not carry 30 articles. */
const SUMMARY_COLS = db`
  t.id, t.author_id, t.org_id, t.slug, t.title, t.excerpt, t.status,
  t.metadata->>'coverImageUrl' AS cover_image_url,
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
    coverImageUrl: row.cover_image_url,
    status: row.status === 'draft' ? 'draft' : 'published',
    publishedAt: iso(row.published_at),
    updatedAt: iso(row.updated_at) ?? new Date().toISOString(),
    readingMinutes: readingMinutes(plainLength(row.body)),
  };
}

function mapSummary(row: Row & { body_length: number }): WritingSummary {
  return {
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
  /** Restrict to one org's site. Omit for everything the person has written. */
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
        ${opts.orgId ? db`AND t.org_id = ${opts.orgId}` : db``}
        ${opts.includeDrafts ? db`` : db`AND t.status = 'published'`}
      ORDER BY COALESCE(t.published_at, t.updated_at) DESC
      LIMIT ${limit}
    `;
    return rows.map(mapSummary);
  } catch (err) {
    console.error(`[writing] listWriting(${authorId}):`, err);
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
        ${opts.includeDrafts ? db`` : db`AND t.status = 'published'`}
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
        ${opts.includeDrafts ? db`` : db`AND t.status = 'published'`}
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
      SELECT ${COLS} FROM threads t WHERE t.id = ${id} AND t.kind = ${WRITING_KIND} LIMIT 1
    `;
    return rows[0] ? mapPost(rows[0]) : null;
  } catch (err) {
    console.error(`[writing] getWritingPostById(${id}):`, err);
    return null;
  }
}

export interface CreateWritingInput {
  authorId: string;
  /** The org whose site this is read on. */
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
    const created = await createThread({
      kind: WRITING_KIND,
      title,
      orgId: input.orgId,
      authorId: input.authorId,
      status: 'draft',
      // PUBLIC is the truth about a published piece: anyone may read it on the
      // author's page. It is OFF_FEED_KINDS, not visibility, that keeps it off
      // the org's own surfaces — see thread-kinds.ts.
      visibility: 'PUBLIC',
    });
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
  coverImageUrl?: string | null;
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

  const body =
    patch.bodyHtml === undefined ? undefined : sanitizeRichText(patch.bodyHtml);

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
        ${body !== undefined ? db`body = ${body}, body_format = 'html',` : db``}
        ${patch.coverImageUrl !== undefined
          ? db`metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json({ coverImageUrl: patch.coverImageUrl } as never)},`
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

/** Remove a piece for good. Replies and reactions cascade with the thread. */
export async function deleteWritingPost(id: string): Promise<boolean> {
  try {
    const rows = await db<Array<{ id: string }>>`
      DELETE FROM threads WHERE id = ${id} AND kind = ${WRITING_KIND} RETURNING id
    `;
    return rows.length > 0;
  } catch (err) {
    console.error(`[writing] deleteWritingPost(${id}):`, err);
    return false;
  }
}
