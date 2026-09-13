import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import { deriveExcerpt } from '@elkdonis/utils';
import { createThread } from './posts';

// ============================================================================
// Network-wide wiki — a single shared knowledge base across the whole EAC
// network, stored as threads with kind='wiki_page'.
//
// All wiki pages live under one org_id (WIKI_ORG) so that slugs are globally
// unique within the wiki — the org_id is a storage detail, not a scoping
// mechanism. Any authenticated user can read and edit any page. Slug
// uniqueness across wiki pages is enforced by a partial unique index
// (migration 122), not merely by that convention.
//
// `visibility` is NOT this wiki's access gate — the route does that with
// requireUser(). The enum has no value meaning "any authenticated network
// user" (PUBLIC | ORGANIZATION | INVITE_ONLY), so the only thing the column
// decides for a wiki page is which OTHER surfaces pick the row up: every feed
// predicate in the codebase whitelists PUBLIC, and several also admit
// ORGANIZATION for members of that org. Both would put wiki pages into
// WIKI_ORG's public site, its /offering slot and the cross-org community
// feed. INVITE_ONLY is the only value no feed matches. Do not "fix" this to
// PUBLIC — see the feed queries in apps/arts-collective/src/lib/org.ts.
//
// Edit history lives in wiki_revisions (migration 118), one full-snapshot
// row per save.
//
// Hierarchy: metadata.wikiParentId (no dedicated column — the wiki is tens
// of pages, not thousands; tree built in JS via buildWikiTree).
//
// Wikilinks: [[Page Title]] resolves at save time. Edges stored in
// thread_references (migration 031). Bodies hold data-wiki-slug/data-wiki-new
// attributes, not hrefs — the rendering app resolves those to routes.
// ============================================================================

const WIKI_ORG = 'elkdonis';

export interface WikiPage {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  excerpt: string | null;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  authorName?: string;
}

export interface WikiPageListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  parentId: string | null;
  updatedAt: Date;
}

export interface WikiTreeNode extends WikiPageListItem {
  children: WikiTreeNode[];
}

export interface WikiRevision {
  id: string;
  threadId: string;
  title: string;
  body: string | null;
  createdAt: Date;
  editorId: string;
  editorName?: string;
}

export interface WikiPageRef {
  id: string;
  slug: string;
  title: string;
}

function parentIdOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>).wikiParentId;
  return typeof value === 'string' && value ? value : null;
}

export async function createWikiPage(data: {
  authorId: string;
  title: string;
  body?: string;
  parentId?: string | null;
}): Promise<WikiPage> {
  const thread = await createThread({
    orgId: WIKI_ORG,
    authorId: data.authorId,
    kind: 'wiki_page',
    title: data.title,
    body: data.body,
    status: 'published',
    visibility: 'INVITE_ONLY',
    metadata: { wikiParentId: data.parentId ?? null },
  });

  const { body, linkedThreadIds } = await resolveWikilinks(
    data.body ?? '',
    thread.id
  );
  const excerpt = body ? deriveExcerpt(body) : (thread.excerpt ?? null);
  if (body !== (data.body ?? '')) {
    await db`
      UPDATE threads
      SET body = ${body || null}, excerpt = ${excerpt}
      WHERE id = ${thread.id}
    `;
  }
  await syncWikiLinks(thread.id, linkedThreadIds);

  await db`
    INSERT INTO wiki_revisions (id, thread_id, editor_id, title, body)
    VALUES (${nanoid()}, ${thread.id}, ${data.authorId}, ${data.title}, ${body || null})
  `;

  return {
    id: thread.id,
    slug: thread.slug,
    title: thread.title,
    body: body || null,
    excerpt,
    parentId: data.parentId ?? null,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    authorId: data.authorId,
  };
}

/**
 * Somebody else saved while this editor was typing.
 *
 * Thrown rather than silently winning: the wiki is open to everyone on the
 * network, so two people on one page is ordinary, and last-write-wins would
 * drop the other person's work with nothing on screen to say so. The loser of
 * the race gets their text back and the current version to merge against.
 */
export class WikiConflictError extends Error {
  readonly code = 'WIKI_CONFLICT';
  constructor(
    readonly currentUpdatedAt: Date,
    readonly currentBody: string | null,
    readonly currentTitle: string
  ) {
    super('This page was changed by someone else while you were editing it.');
    this.name = 'WikiConflictError';
  }
}

export async function updateWikiPage(
  id: string,
  editorId: string,
  data: {
    title: string;
    body?: string;
    parentId?: string | null;
    /**
     * The `updatedAt` the editor loaded. When given, the save is refused if
     * the page has moved since. Omit only where there is no editor to tell —
     * revertWikiPage, which is itself a deliberate overwrite.
     */
    expectedUpdatedAt?: Date | string | null;
  }
): Promise<WikiPage> {
  const { body, linkedThreadIds } = await resolveWikilinks(data.body ?? '', id);
  const excerpt = deriveExcerpt(body);

  const expected = data.expectedUpdatedAt ? new Date(data.expectedUpdatedAt) : null;

  // metadata is merged, not replaced: it also carries the thesaurus entry
  // (an "aliases" array), and a plain assignment would silently drop those on
  // every ordinary edit.
  //
  // The updated_at guard is part of the WHERE so the check and the write are
  // one statement — testing first and updating after would leave a window for
  // exactly the race it is meant to catch.

  const [thread] = await db`
    UPDATE threads
    SET title = ${data.title},
        body = ${body || null},
        excerpt = ${excerpt},
        metadata = COALESCE(metadata, '{}'::jsonb)
                   || ${db.json({ wikiParentId: data.parentId ?? null } as any)},
        updated_at = NOW()
    WHERE id = ${id} AND kind = 'wiki_page'
      ${
        expected
          ? // Both sides truncated to milliseconds: Postgres keeps timestamptz
            // to the microsecond, a JS Date cannot, so a value that has been
            // round-tripped through the client never equals the stored one.
            // Comparing raw made the guard reject every save, not just stale
            // ones.
            db`AND date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', ${expected}::timestamptz)`
          : db``
      }
    RETURNING *
  `;

  if (!thread) {
    // No row changed. Either the page is gone, or it moved under this editor.
    const [current] = await db<Array<any>>`
      SELECT title, body, updated_at FROM threads
      WHERE id = ${id} AND kind = 'wiki_page'
    `;
    if (current && expected) {
      throw new WikiConflictError(current.updated_at, current.body, current.title);
    }
    throw new Error(`Wiki page ${id} not found`);
  }

  await syncWikiLinks(id, linkedThreadIds);

  await db`
    INSERT INTO wiki_revisions (id, thread_id, editor_id, title, body)
    VALUES (${nanoid()}, ${id}, ${editorId}, ${data.title}, ${body || null})
  `;

  return {
    id: thread.id,
    slug: thread.slug,
    title: thread.title,
    body: thread.body,
    excerpt: thread.excerpt,
    parentId: parentIdOf(thread.metadata),
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
    authorId: thread.author_id,
  };
}

export async function getWikiPage(slug: string): Promise<WikiPage | null> {
  const [row] = await db<Array<any>>`
    SELECT t.*, u.display_name AS author_name
    FROM threads t
    LEFT JOIN users u ON u.id = t.author_id
    WHERE t.slug = ${slug}
      AND t.kind = 'wiki_page'
      AND t.status <> 'archived'
    LIMIT 1
  `;
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    excerpt: row.excerpt,
    parentId: parentIdOf(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorId: row.author_id,
    authorName: row.author_name || undefined,
  };
}

export async function listWikiPages(): Promise<WikiPageListItem[]> {
  const rows = await db<Array<any>>`
    SELECT id, slug, title, excerpt, metadata, updated_at
    FROM threads
    WHERE kind = 'wiki_page' AND status <> 'archived'
    ORDER BY title ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    parentId: parentIdOf(r.metadata),
    updatedAt: r.updated_at,
  }));
}

export function buildWikiTree(pages: WikiPageListItem[]): WikiTreeNode[] {
  const nodes = new Map<string, WikiTreeNode>(
    pages.map((p) => [p.id, { ...p, children: [] }])
  );
  const roots: WikiTreeNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent && parent.id !== node.id) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortLevel = (level: WikiTreeNode[]) => {
    level.sort((a, b) => a.title.localeCompare(b.title));
    level.forEach((n) => sortLevel(n.children));
  };
  sortLevel(roots);
  return roots;
}

export function collectSubtreeIds(pages: WikiPageListItem[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const p of pages) {
    if (!p.parentId) continue;
    const siblings = childrenOf.get(p.parentId) ?? [];
    siblings.push(p.id);
    childrenOf.set(p.parentId, siblings);
  }

  const ids = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    queue.push(...(childrenOf.get(id) ?? []));
  }
  return ids;
}

export async function getWikiAncestors(threadId: string): Promise<WikiPageRef[]> {
  const pages = await listWikiPages();
  const byId = new Map(pages.map((p) => [p.id, p]));

  const chain: WikiPageRef[] = [];
  const seen = new Set<string>([threadId]);
  let cursor = byId.get(threadId)?.parentId ?? null;

  while (cursor && !seen.has(cursor) && chain.length < 20) {
    const page = byId.get(cursor);
    if (!page) break;
    chain.unshift({ id: page.id, slug: page.slug, title: page.title });
    seen.add(cursor);
    cursor = page.parentId;
  }
  return chain;
}

export async function getWikiRevisions(threadId: string): Promise<WikiRevision[]> {
  const rows = await db<Array<any>>`
    SELECT r.*, u.display_name AS editor_name
    FROM wiki_revisions r
    LEFT JOIN users u ON u.id = r.editor_id
    WHERE r.thread_id = ${threadId}
    ORDER BY r.created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
    editorId: r.editor_id,
    editorName: r.editor_name || undefined,
  }));
}

export async function revertWikiPage(
  threadId: string,
  revisionId: string,
  editorId: string
): Promise<WikiPage> {
  const [revision] = await db<Array<any>>`
    SELECT * FROM wiki_revisions WHERE id = ${revisionId} AND thread_id = ${threadId}
  `;
  if (!revision) {
    throw new Error(`Revision ${revisionId} not found for wiki page ${threadId}`);
  }
  const current = await db<Array<any>>`
    SELECT metadata FROM threads WHERE id = ${threadId} AND kind = 'wiki_page'
  `;
  return updateWikiPage(threadId, editorId, {
    title: revision.title,
    body: revision.body || undefined,
    parentId: parentIdOf(current[0]?.metadata),
  });
}

export async function archiveWikiPage(
  id: string
): Promise<{ archived: boolean; orphanedChildren: number }> {
  const [row] = await db<Array<{ id: string }>>`
    UPDATE threads
    SET status = 'archived', updated_at = NOW()
    WHERE id = ${id} AND kind = 'wiki_page'
    RETURNING id
  `;
  if (!row) return { archived: false, orphanedChildren: 0 };

  const children = await db<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count
    FROM threads
    WHERE kind = 'wiki_page'
      AND status <> 'archived'
      AND metadata->>'wikiParentId' = ${id}
  `;
  return { archived: true, orphanedChildren: Number(children[0]?.count ?? 0) };
}

// ============================================================================
// Wikilinks
// ============================================================================

const WIKILINK = /\[\[([^\]|<>]+?)(?:\|([^\]<>]+?))?\]\]/g;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Anchors a previous save already resolved. */
const RESOLVED_LINK = /data-wiki-slug="([^"]*)"/g;

/**
 * Turn `[[Title]]` into anchors and report every page this body links to.
 *
 * It must read **both** forms, because what gets stored is the resolved
 * anchor, not the `[[…]]` source: an edit round-trips already-resolved
 * markup, so counting only `[[…]]` made every re-save look like a body with
 * no links at all — and syncWikiLinks would then delete the page's whole edge
 * set. Editing any page silently destroyed its "what links here" until this
 * scanned the anchors too.
 */
export async function resolveWikilinks(
  html: string,
  excludeThreadId?: string
): Promise<{ body: string; linkedThreadIds: string[] }> {
  const matches = [...html.matchAll(WIKILINK)];
  const already = [
    ...new Set([...html.matchAll(RESOLVED_LINK)].map((m) => m[1].trim().toLowerCase())),
  ].filter(Boolean);

  if (matches.length === 0 && already.length === 0) {
    return { body: html, linkedThreadIds: [] };
  }

  const titles = [...new Set(matches.map((m) => m[1].trim()).filter(Boolean))];
  const rows = await db<Array<{ id: string; slug: string; title: string }>>`
    SELECT id, slug, title
    FROM threads
    WHERE kind = 'wiki_page'
      AND (
        LOWER(title) = ANY(${titles.map((t) => t.toLowerCase())})
        OR LOWER(slug) = ANY(${[...titles.map((t) => t.toLowerCase()), ...already]})
      )
  `;

  const bySlug = new Map(rows.map((r) => [r.slug.toLowerCase(), r]));
  const byTitle = new Map(rows.map((r) => [r.title.toLowerCase(), r]));
  const linked = new Set<string>();

  const body = html.replace(WIKILINK, (_full, rawTarget: string, rawLabel?: string) => {
    const target = rawTarget.trim();
    const label = (rawLabel ?? rawTarget).trim();
    const hit = byTitle.get(target.toLowerCase()) ?? bySlug.get(target.toLowerCase());

    if (!hit) {
      return `<a class="wikilink wikilink-new" data-wiki-new="${escapeHtml(target)}">${escapeHtml(label)}</a>`;
    }
    if (hit.id !== excludeThreadId) linked.add(hit.id);
    return `<a class="wikilink" data-wiki-slug="${escapeHtml(hit.slug)}">${escapeHtml(label)}</a>`;
  });

  // Edges the body already carried, so a re-save keeps them.
  for (const slug of already) {
    const hit = bySlug.get(slug);
    if (hit && hit.id !== excludeThreadId) linked.add(hit.id);
  }

  return { body, linkedThreadIds: [...linked] };
}

async function syncWikiLinks(threadId: string, linkedThreadIds: string[]): Promise<void> {
  if (linkedThreadIds.length === 0) {
    await db`DELETE FROM thread_references WHERE thread_id = ${threadId}`;
    return;
  }

  await db`
    DELETE FROM thread_references
    WHERE thread_id = ${threadId}
      AND references_thread_id != ALL(${linkedThreadIds}::text[])
  `;

  const rows = linkedThreadIds.map((target) => ({
    id: nanoid(),
    thread_id: threadId,
    references_thread_id: target,
  }));
  await db`
    INSERT INTO thread_references ${db(rows)}
    ON CONFLICT (thread_id, references_thread_id) DO NOTHING
  `;
}

// ============================================================================
// Search
// ============================================================================

/** One run of text from a search hit; `hit` marks what matched the query. */
export interface WikiSearchSpan {
  text: string;
  hit: boolean;
}

export interface WikiSearchHit {
  id: string;
  slug: string;
  title: string;
  /** The title as spans, so a caller can emphasise matches without HTML. */
  titleSpans: WikiSearchSpan[];
  /** A matching fragment of the body or a definition, as spans. */
  snippetSpans: WikiSearchSpan[];
  /** True when the hit came from a definition rather than the page body. */
  viaDefinition: boolean;
  updatedAt: Date;
}

/**
 * ts_headline marks matches with control characters rather than `<mark>`.
 *
 * Deliberate: its output would otherwise be raw HTML needing
 * dangerouslySetInnerHTML at the call site, and wiki **titles are never
 * HTML-sanitised** — the action only trims them, because everywhere else a
 * title is rendered as a React child and escaped. A title containing markup
 * would become an injection the moment search rendered it as HTML. Returning
 * spans keeps that impossible instead of merely unlikely.
 *
 * STX/ETX are used because they cannot occur in prose typed into a form.
 */
const MARK_START = '\u0002';
const MARK_END = '\u0003';

const WIKI_TITLE_OPTS = `StartSel=${MARK_START},StopSel=${MARK_END},HighlightAll=true`;
const WIKI_SNIPPET_OPTS =
  `StartSel=${MARK_START},StopSel=${MARK_END},MaxWords=34,MinWords=14,MaxFragments=1,FragmentDelimiter= … `;

/** Split ts_headline's sentinel-marked text into alternating plain/hit spans. */
function toSpans(marked: string | null): WikiSearchSpan[] {
  if (!marked) return [];
  const spans: WikiSearchSpan[] = [];
  // Split keeps the delimiters out, and the marks strictly alternate, so a
  // simple state machine over the pieces is enough.
  for (const chunk of marked.split(MARK_START)) {
    const [hit, rest] = chunk.split(MARK_END);
    if (rest === undefined) {
      if (hit) spans.push({ text: hit, hit: false });
    } else {
      if (hit) spans.push({ text: hit, hit: true });
      if (rest) spans.push({ text: rest, hit: false });
    }
  }
  return spans;
}

/**
 * Search the wiki.
 *
 * `threads.search_tsv` is a stored generated column (title weight A, excerpt
 * B, body C with tags stripped), so there is nothing to maintain — it is
 * already indexed for every wiki page. `websearch_to_tsquery` takes what a
 * person actually types, including quoted phrases, `or`, and a leading `-` to
 * exclude, and never throws on syntax the way `to_tsquery` does.
 *
 * Titles are also matched by trigram similarity (`%`, backed by
 * idx_threads_title_trgm), so a near-miss spelling still finds the page —
 * which matters more here than on the forum, since people search a
 * dictionary for words they are unsure how to spell.
 *
 * Definitions are searched separately and unioned in. They live in
 * `metadata.definitions`, which the generated column cannot see, so a sense
 * somebody contributed would otherwise be invisible to search even though it
 * is the most quotable sentence about that term.
 */
export async function searchWiki(q: string, limit = 20): Promise<WikiSearchHit[]> {
  const query = (q ?? '').trim();
  if (query.length < 2) return [];

  const rows = await db<Array<any>>`
    WITH matches AS (
      SELECT t.id, t.slug, t.title, t.updated_at,
             ts_headline('english', t.title,
                         websearch_to_tsquery('english', ${query}), ${WIKI_TITLE_OPTS}) AS title_html,
             ts_headline('english',
                         COALESCE(NULLIF(t.excerpt, ''),
                                  REGEXP_REPLACE(COALESCE(t.body, ''), '<[^>]*>', ' ', 'g'),
                                  t.title),
                         websearch_to_tsquery('english', ${query}), ${WIKI_SNIPPET_OPTS}) AS snippet,
             FALSE AS via_definition,
             GREATEST(
               ts_rank(t.search_tsv, websearch_to_tsquery('english', ${query})),
               similarity(t.title, ${query})
             ) AS rank
      FROM threads t
      WHERE t.kind = 'wiki_page' AND t.status <> 'archived'
        AND (t.search_tsv @@ websearch_to_tsquery('english', ${query})
             OR t.title % ${query})

      UNION ALL

      -- Contributed senses. metadata is outside the generated tsvector, so
      -- these are matched on the fly; the set is small (tens of pages).
      SELECT t.id, t.slug, t.title, t.updated_at,
             ts_headline('english', t.title,
                         websearch_to_tsquery('english', ${query}), ${WIKI_TITLE_OPTS}),
             ts_headline('english', d.value->>'text',
                         websearch_to_tsquery('english', ${query}), ${WIKI_SNIPPET_OPTS}),
             TRUE,
             ts_rank(to_tsvector('english', d.value->>'text'),
                     websearch_to_tsquery('english', ${query}))
      FROM threads t
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(t.metadata->'definitions') = 'array'
             THEN t.metadata->'definitions' ELSE '[]'::jsonb END
      ) AS d(value)
      WHERE t.kind = 'wiki_page' AND t.status <> 'archived'
        AND to_tsvector('english', d.value->>'text')
            @@ websearch_to_tsquery('english', ${query})
    )
    -- One row per page: the best-ranking reason it matched wins, so a page
    -- whose title and three senses all match appears once, not four times.
    SELECT DISTINCT ON (id) *
    FROM matches
    ORDER BY id, rank DESC
    LIMIT ${Math.min(limit, 100)}
  `;

  return rows
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      titleSpans: toSpans(r.title_html),
      snippetSpans: toSpans(r.snippet),
      viaDefinition: r.via_definition,
      updatedAt: r.updated_at,
      rank: Number(r.rank),
    }))
    // DISTINCT ON forced an ORDER BY id, so rank ordering is restored here.
    .sort((a, b) => b.rank - a.rank)
    .map(({ rank: _rank, ...hit }) => hit);
}

// ============================================================================
// Tags
//
// Reuses `topics` + `thread_topics` rather than a wiki-specific tag table, so
// a wiki page and a forum thread carrying the same tag are carrying the same
// row — which is the only way a tag can lead somewhere across the network
// instead of within one surface. `listTopicChoices` supplies the picker.
// ============================================================================

export interface WikiTopic {
  id: string;
  slug: string;
  name: string;
}

export async function listWikiTopics(threadId: string): Promise<WikiTopic[]> {
  return db<WikiTopic[]>`
    SELECT tp.id, tp.slug, tp.name
    FROM thread_topics tt
    JOIN topics tp ON tp.id = tt.topic_id
    WHERE tt.thread_id = ${threadId}
    ORDER BY tp.name ASC
  `;
}

/** Replace a page's tags wholesale — the edit form posts the full set. */
export async function setWikiTopics(threadId: string, topicIds: string[]): Promise<void> {
  const wanted = [...new Set(topicIds.filter(Boolean))];

  if (wanted.length === 0) {
    await db`DELETE FROM thread_topics WHERE thread_id = ${threadId}`;
    return;
  }

  await db`
    DELETE FROM thread_topics
    WHERE thread_id = ${threadId} AND topic_id != ALL(${wanted}::text[])
  `;
  await db`
    INSERT INTO thread_topics ${db(wanted.map((id) => ({ thread_id: threadId, topic_id: id })))}
    ON CONFLICT (thread_id, topic_id) DO NOTHING
  `;
}

/** Wiki pages carrying a tag — what makes a tag worth clicking. */
export async function listWikiPagesByTopic(topicSlug: string): Promise<WikiPageListItem[]> {
  const rows = await db<Array<any>>`
    SELECT t.id, t.slug, t.title, t.excerpt, t.metadata, t.updated_at
    FROM threads t
    JOIN thread_topics tt ON tt.thread_id = t.id
    JOIN topics tp ON tp.id = tt.topic_id
    WHERE t.kind = 'wiki_page' AND t.status <> 'archived' AND tp.slug = ${topicSlug}
    ORDER BY t.title ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    parentId: parentIdOf(r.metadata),
    updatedAt: r.updated_at,
  }));
}

// ============================================================================
// The dictionary — terms defined while writing
// ============================================================================

/** One sense of a term, as somebody gave it. Append-only. */
export interface WikiDefinition {
  id: string;
  text: string;
  byId: string;
  byName?: string;
  at: string;
  /** The writing it was given from, when it came from an article. */
  sourceThreadId?: string;
}

export interface DefinedTerm {
  term: string;
  slug: string;
  threadId: string;
  /** False when the term already had a page and this added a sense to it. */
  created: boolean;
  /** Every sense the term now carries, oldest first. */
  definitions: WikiDefinition[];
  /** True when this exact wording was already recorded, so nothing was added. */
  duplicate: boolean;
}

/**
 * Define a term from inside a piece of writing, creating its wiki page
 * immediately.
 *
 * The dictionary is the wiki: a term is a wiki page whose title is the term,
 * so a definition written mid-article is a first-class page the moment it is
 * accepted rather than something queued until publish. That is deliberate —
 * the wiki is network-wide, so a stub is useful even if the article that
 * prompted it is never finished.
 *
 * **A term may hold several definitions, and that is the point.** A second
 * person defining a word does not overwrite the first and is not turned away
 * either: their wording is appended as another sense, attributed to them.
 * A collective holds more than one reading of its own vocabulary, and the
 * earlier definition is not more true for having been written first — so
 * `metadata.definitions` is append-only and nothing that was offered is
 * discarded. Only an exact repeat of existing wording is dropped, which makes
 * defining the same thing twice harmless rather than duplicative.
 *
 * The page body stays separate and curated: anyone may edit it into the
 * fuller treatment, while the senses below it record how the word has
 * actually been used. Matching is by title or by an alias in
 * `metadata.aliases` (case-insensitive), so a thesaurus entry adds its sense
 * to the page it belongs to.
 *
 * `sourceThreadId` records an edge from the writing to the term, which is
 * what makes the term page's "what links here" show the articles that use it.
 */
export async function defineTerm(input: {
  term: string;
  definition: string;
  authorId: string;
  sourceThreadId?: string;
}): Promise<DefinedTerm> {
  const term = input.term.trim();
  const text = input.definition.trim();
  if (!term) throw new Error('defineTerm: term is required');

  const existing = await findTermPage(term);

  const page =
    existing ??
    (await createWikiPage({
      authorId: input.authorId,
      title: term,
      // A page made from a definition starts as that definition, so it is
      // never an empty stub. Editors take it from there.
      body: text ? `<p>${escapeHtml(text)}</p>` : undefined,
    }));

  if (input.sourceThreadId && input.sourceThreadId !== page.id) {
    // Additive: syncWikiLinks replaces a thread's whole edge set, which would
    // drop the source article's other references.
    await db`
      INSERT INTO thread_references (id, thread_id, references_thread_id)
      VALUES (${nanoid()}, ${input.sourceThreadId}, ${page.id})
      ON CONFLICT (thread_id, references_thread_id) DO NOTHING
    `;
  }

  const before = await getTermDefinitions(page.id);
  const duplicate =
    !text || before.some((d) => d.text.trim().toLowerCase() === text.toLowerCase());

  if (!duplicate) {
    const entry: WikiDefinition = {
      id: nanoid(),
      text,
      byId: input.authorId,
      at: new Date().toISOString(),
      ...(input.sourceThreadId ? { sourceThreadId: input.sourceThreadId } : {}),
    };
    // `||` concatenates jsonb arrays, so this appends without reading and
    // rewriting the whole list — two people defining at once both survive.
    await db`
      UPDATE threads
      SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'definitions',
            COALESCE(metadata->'definitions', '[]'::jsonb) || ${db.json([entry] as any)}
          ),
          updated_at = NOW()
      WHERE id = ${page.id} AND kind = 'wiki_page'
    `;
  }

  return {
    term,
    slug: page.slug,
    threadId: page.id,
    created: !existing,
    definitions: await getTermDefinitions(page.id),
    duplicate,
  };
}

/** Every sense recorded on a term's page, oldest first, with who gave it. */
export async function getTermDefinitions(threadId: string): Promise<WikiDefinition[]> {
  const rows = await db<Array<any>>`
    SELECT d.value AS entry, u.display_name AS by_name
    FROM threads t
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(t.metadata->'definitions') = 'array'
           THEN t.metadata->'definitions' ELSE '[]'::jsonb END
    ) AS d(value)
    LEFT JOIN users u ON u.id = (d.value->>'byId')::uuid
    WHERE t.id = ${threadId}
  `;
  return rows.map((r) => ({
    id: r.entry.id,
    text: r.entry.text,
    byId: r.entry.byId,
    byName: r.by_name || undefined,
    at: r.entry.at,
    sourceThreadId: r.entry.sourceThreadId,
  }));
}

/** A wiki page for this term, by title or by a `metadata.aliases` entry. */
async function findTermPage(term: string): Promise<WikiPage | null> {
  const [row] = await db<Array<any>>`
    SELECT *
    FROM threads
    WHERE kind = 'wiki_page'
      AND status <> 'archived'
      AND (
        LOWER(title) = ${term.toLowerCase()}
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(metadata->'aliases') = 'array'
                 THEN metadata->'aliases' ELSE '[]'::jsonb END
          ) AS alias
          WHERE LOWER(alias) = ${term.toLowerCase()}
        )
      )
    LIMIT 1
  `;
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    excerpt: row.excerpt,
    parentId: parentIdOf(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorId: row.author_id,
  };
}

/** Does this term already have a page? For the "this will link, not create" hint. */
export async function lookupTerm(term: string): Promise<WikiPageRef | null> {
  const page = await findTermPage(term.trim());
  return page ? { id: page.id, slug: page.slug, title: page.title } : null;
}

const TERM_TAG = /<dfn\b([^>]*?)data-term="([^"]*)"([^>]*)>/gi;

export interface ResolvedTerms {
  html: string;
  /** Terms used here that have no wiki page yet. */
  undefined: string[];
}

/**
 * Fill in the definitions for `<dfn data-term="…">` spans at render time.
 *
 * The marks store only the term, so this is where a reader actually gets the
 * meaning. Doing it server-side is what lets a *public* article carry
 * definitions out of an auth-gated wiki: nothing about the wiki is exposed
 * except the sentence being quoted.
 *
 * One query for every distinct term on the page rather than one per span, and
 * every lookup honours aliases, so `[[colour]]` and "color" reach one entry.
 * A term with no page keeps its dotted styling but gains no tooltip — it is
 * reported in `undefined` so a writing surface can offer to fill it in.
 */
export async function resolveTerms(
  html: string,
  basePath?: string
): Promise<ResolvedTerms> {
  if (!html) return { html, undefined: [] };

  const terms = [...new Set([...html.matchAll(TERM_TAG)].map((m) => decodeAttr(m[2]).trim()))]
    .filter(Boolean);
  if (terms.length === 0) return { html, undefined: [] };

  const lowered = terms.map((t) => t.toLowerCase());
  const rows = await db<
    Array<{
      slug: string;
      title: string;
      excerpt: string | null;
      matched: string;
      first_sense: string | null;
      sense_count: number;
    }>
  >`
    SELECT t.slug, t.title, t.excerpt, LOWER(m.name) AS matched,
           t.metadata->'definitions'->0->>'text' AS first_sense,
           jsonb_array_length(
             CASE WHEN jsonb_typeof(t.metadata->'definitions') = 'array'
                  THEN t.metadata->'definitions' ELSE '[]'::jsonb END
           ) AS sense_count
    FROM threads t
    CROSS JOIN LATERAL (
      SELECT t.title AS name
      UNION ALL
      SELECT alias FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(t.metadata->'aliases') = 'array'
             THEN t.metadata->'aliases' ELSE '[]'::jsonb END
      ) AS alias
    ) m
    WHERE t.kind = 'wiki_page'
      AND t.status <> 'archived'
      AND LOWER(m.name) = ANY(${lowered})
  `;

  const byName = new Map(rows.map((r) => [r.matched, r]));
  const missing = new Set<string>();

  const out = html.replace(TERM_TAG, (full, before: string, raw: string, after: string) => {
    const term = decodeAttr(raw).trim();
    const hit = byName.get(term.toLowerCase());
    if (!hit) {
      missing.add(term);
      return full;
    }
    // A given sense wins over the page excerpt. Senses are written *as*
    // definitions — one or two sentences aimed at a reader meeting the word —
    // whereas the excerpt is a whole article flattened, headings and all,
    // which makes a poor tooltip. The excerpt is the fallback for a page
    // nobody has glossed.
    const definition = (hit.first_sense ?? hit.excerpt ?? '').trim();
    const senses = Number(hit.sense_count ?? 0);
    const attrs = [
      definition ? ` title="${escapeHtml(definition)}"` : '',
      definition ? ` data-definition="${escapeHtml(definition)}"` : '',
      // More than one reading exists — the surface can offer "3 senses" and
      // send the reader to the page rather than pretending there is one.
      senses > 1 ? ` data-senses="${senses}"` : '',
      basePath ? ` data-href="${escapeHtml(`${basePath}/${hit.slug}`)}"` : '',
    ].join('');
    return `<dfn${before}data-term="${escapeHtml(term)}"${after}${attrs}>`;
  });

  return { html: out, undefined: [...missing] };
}

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export async function getWikiBacklinks(threadId: string): Promise<WikiPageRef[]> {
  const rows = await db<Array<WikiPageRef>>`
    SELECT t.id, t.slug, t.title
    FROM thread_references r
    JOIN threads t ON t.id = r.thread_id
    WHERE r.references_thread_id = ${threadId}
      AND t.kind = 'wiki_page'
    ORDER BY t.title ASC
  `;
  return rows;
}
