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
// (migration 119), not merely by that convention.
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

export async function updateWikiPage(
  id: string,
  editorId: string,
  data: { title: string; body?: string; parentId?: string | null }
): Promise<WikiPage> {
  const { body, linkedThreadIds } = await resolveWikilinks(data.body ?? '', id);
  const excerpt = deriveExcerpt(body);

  const [thread] = await db`
    UPDATE threads
    SET title = ${data.title},
        body = ${body || null},
        excerpt = ${excerpt},
        metadata = ${db.json({ wikiParentId: data.parentId ?? null } as any)},
        updated_at = NOW()
    WHERE id = ${id} AND kind = 'wiki_page'
    RETURNING *
  `;

  if (!thread) {
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

export async function resolveWikilinks(
  html: string,
  excludeThreadId?: string
): Promise<{ body: string; linkedThreadIds: string[] }> {
  const matches = [...html.matchAll(WIKILINK)];
  if (matches.length === 0) return { body: html, linkedThreadIds: [] };

  const titles = [...new Set(matches.map((m) => m[1].trim()).filter(Boolean))];
  const rows = await db<Array<{ id: string; slug: string; title: string }>>`
    SELECT id, slug, title
    FROM threads
    WHERE kind = 'wiki_page'
      AND LOWER(title) = ANY(${titles.map((t) => t.toLowerCase())})
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
