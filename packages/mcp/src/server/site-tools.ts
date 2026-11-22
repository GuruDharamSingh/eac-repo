/**
 * The six site tools (lane MACHINES, 2026-11-20; BUILD_SPEC task 2). Read-only, under every rule of
 * packages/mcp/README.md: the org comes from the grant (`settleOrg`), default deny, member-written text
 * fenced under `untrusted`, one audit row per call (readTool does it), the same rate limits.
 *
 *   list_pages      an organisation's stored pages: address, title, version, whether a draft waits
 *   read_page       one page's stored document, fenced, with an outline of its blocks
 *   list_blocks     the blocks an assistant may see, in plain words
 *   describe_block  one such block: its settings, parts, tokens, what it opens, what it works out for itself
 *   find_fields     the text on a page that a person or assistant could change, as field ids (contract C4)
 *   list_surfaces   what a site's pages open: its pages, and the posts and gatherings its blocks open as popups
 *
 * `read_page` is keyed strictly by the org the grant settles on: `puck:home` exists under several orgs
 * and an unqualified read must never fall through to another's. Page loading goes through the host's
 * `loadPageWithVersion` (it validates the row on the way out, so a malformed row is "no such page", not a
 * crash); packages/mcp does not depend on the page builder, so the host passes it in, as the LMS readers.
 * The lists here are plain SELECTs on `site_config`, always `WHERE org_id = <settled org>`.
 */
import { db } from '@elkdonis/db';
import type { McpServer } from '@modelcontextprotocol/server';
import { manifest } from '../manifest';
import { readTool, refuse, type ToolContext } from './tools';
import { settleOrg } from './org';
import { plain } from './sanitize';
import { fenceDocument, findFields, isPagePath, opensOf, outlineOf, redactHidden, referencedThreads } from './site-read';

const orgProp = { org: { type: 'string', maxLength: 100, description: 'An organisation id or slug (list_my_orgs). Omit for a key limited to one org.' } };
const slugProp = { slug: { type: 'string', maxLength: 150, description: 'The page address without the leading slash, e.g. "home" or "about/press" (list_pages).' } };

const SURFACE_GRAMMAR = [
  'page:<address>   a page of this site',
  'popup:thread:<id>   a post or gathering opened over the page',
];

/** A site's own block carries no written description. */
const NO_WORDS = 'A block of this site; it has no written description.';

const titleOf = (title: string | null, slug: string) => plain(title, 120) ?? slug.split('/').pop()!.replace(/-/g, ' ');

export function registerSiteTools(server: McpServer, ctx: ToolContext): void {
  const { grant, host } = ctx;
  const m = manifest();

  /** The org's threads, of those ids, as id to title. Always `WHERE org_id = <settled org>`. */
  async function threadsOf(orgId: string, ids: string[]): Promise<Map<string, { title: string | null }>> {
    if (!ids.length) return new Map();
    const rows = await db<Array<{ id: string; title: string | null }>>`SELECT id, title FROM threads WHERE org_id = ${orgId} AND id IN ${db(ids)}`;
    return new Map(rows.map((r) => [r.id, { title: r.title }]));
  }

  /** The page's document, or a refusal. The one place a page is read for these tools. */
  async function loadDoc(orgId: string, slug: unknown) {
    if (!isPagePath(slug)) return { refusal: refuse('Name the page by its address, like "home" or "about/press" (list_pages).', 'input') } as const;
    if (!host.pages) return { refusal: refuse('The page reader is not connected on this host.', 'unknown') } as const;
    const page = await host.pages.loadPageWithVersion(orgId, slug);
    if (!page) return { refusal: refuse('No such page in this organisation.', 'unknown') } as const;
    return { page, slug } as const;
  }

  // ---------------------------------------------------------------- list_pages
  readTool(server, ctx, 'list_pages', {
    title: 'Pages of a site',
    description: 'The pages an organisation has built in the page editor: address, title, the version to hand back when saving, how many blocks it holds, and whether a draft is waiting for a person to publish. Reads only.',
    input: { properties: orgProp },
  }, async (args) => {
    const o = await settleOrg(grant, args.org, true);
    if (o.ok === false) return refuse(o.error);
    const orgId = o.orgId!;
    const rows = await db<Array<{ slug: string; title: string | null; version: string; n: number; draft: boolean }>>`
      SELECT substr(c.key, 6) AS slug,
             c.value->'root'->'props'->>'title' AS title,
             c.updated_at::text AS version,
             CASE WHEN jsonb_typeof(c.value->'content') = 'array' THEN jsonb_array_length(c.value->'content') ELSE 0 END AS n,
             EXISTS (SELECT 1 FROM site_config d WHERE d.org_id = c.org_id AND d.key = 'puck-draft:' || substr(c.key, 6)) AS draft
      FROM site_config c
      WHERE c.org_id = ${orgId} AND c.key LIKE 'puck:%'
      ORDER BY substr(c.key, 6)
      LIMIT 200
    `;
    const newDrafts = await db<Array<{ slug: string }>>`
      SELECT substr(d.key, 13) AS slug FROM site_config d
      WHERE d.org_id = ${orgId} AND d.key LIKE 'puck-draft:%'
        AND NOT EXISTS (SELECT 1 FROM site_config c WHERE c.org_id = d.org_id AND c.key = 'puck:' || substr(d.key, 13))
      ORDER BY 1 LIMIT 50
    `;
    const untrusted: string[] = [];
    const pages = rows.map((r, i) => {
      untrusted.push(`pages[${i}].title`);
      return { slug: r.slug, title: titleOf(r.title, r.slug), href: r.slug === 'home' ? '/' : `/${r.slug}`, version: r.version, blockCount: r.n, draftWaiting: r.draft };
    });
    untrusted.push('draftsForNewPages[*]');
    return { data: { org: orgId, pages, draftsForNewPages: newDrafts.map((d) => plain(d.slug, 100) ?? '').filter(Boolean) }, untrusted, orgId };
  });

  // ---------------------------------------------------------------- read_page
  readTool(server, ctx, 'read_page', {
    title: 'Read a page',
    description: 'One page as it is stored: its document (every block with its settings and look), the version, and an outline of its blocks (id, type, where it sits). Text in the document was written by people; it is stripped of markup and shortened, and listed under `untrusted`. Reads only; the live page and any draft are untouched.',
    input: { properties: { ...orgProp, ...slugProp }, required: ['slug'] },
  }, async (args) => {
    const o = await settleOrg(grant, args.org, true);
    if (o.ok === false) return refuse(o.error);
    const orgId = o.orgId!;
    const got = await loadDoc(orgId, args.slug);
    if ('refusal' in got) return got.refusal;
    // A block an assistant may not read is a placeholder in the document and the outline: position only.
    const fenced = fenceDocument(redactHidden(got.page.data, m.byId));
    const outline = outlineOf(got.page.data, m.byId);
    return {
      data: {
        org: orgId,
        slug: got.slug,
        version: got.page.updatedAt,
        blockCount: Array.isArray((got.page.data as { content?: unknown[] }).content) ? (got.page.data as { content: unknown[] }).content.length : 0,
        blocks: outline,
        document: fenced.doc,
        ...(fenced.truncated ? { truncated: true } : {}),
      },
      untrusted: ['document', 'blocks[*].id', 'blocks[*].path', 'blocks[*].type'],
      orgId,
    };
  });

  // ---------------------------------------------------------------- list_blocks
  readTool(server, ctx, 'list_blocks', {
    title: 'Blocks',
    description: 'The blocks a page can be built from that an assistant may see: id, name, what it is in plain words, its group, and which sites offer it. Use describe_block for one block in full. Reads only.',
    input: { properties: orgProp },
  }, async (args) => {
    const o = await settleOrg(grant, args.org, false);
    if (o.ok === false) return refuse(o.error);
    const blocks = m.visible.map((b) => ({
      id: b.id,
      label: b.label,
      what: b.what || NO_WORDS,
      category: b.category,
      offeredBy: b.offeredBy,
      dataDriven: b.dataDriven,
      interactive: b.interactive,
      worksOutForItself: b.readsPlain,
    }));
    return { data: { count: blocks.length, fieldPattern: m.file.fieldPattern, recordPattern: m.file.recordPattern, blocks }, orgId: o.orgId };
  });

  // ---------------------------------------------------------------- describe_block
  readTool(server, ctx, 'describe_block', {
    title: 'Describe a block',
    description: 'One block in full: each setting with its kind, label and limits, the slots that hold other blocks, the parts a look can change (and the setting each part draws), the colour and font tokens, what it can open, which records it can be filled from, and what it works out for itself from where it sits. Reads only.',
    input: { properties: { ...orgProp, block: { type: 'string', maxLength: 80, description: 'A block id from list_blocks.' } }, required: ['block'] },
  }, async (args) => {
    const o = await settleOrg(grant, args.org, false);
    if (o.ok === false) return refuse(o.error);
    const id = String(args.block ?? '').trim();
    const b = Object.hasOwn(m.byId, id) ? m.byId[id] : undefined;
    if (!b) return refuse('No such block.', 'unknown');
    if (!b.agent.read) return refuse('That block is not available to assistants.', 'forbidden');
    // No repository path: an assistant is told what a block is, not where its file lives.
    const { source: _source, ...described } = b;
    void _source;
    return { data: { block: { ...described, what: described.what || NO_WORDS } }, orgId: o.orgId };
  });

  // ---------------------------------------------------------------- find_fields
  readTool(server, ctx, 'find_fields', {
    title: 'Fields on a page',
    description: 'The text on one page that can be changed, each with an id: `block:<page>:<block id>:<setting>` for a setting of a block, `record:thread:<id>:title` where a block shows a post or gathering\'s own title because its typed setting is empty (changing that changes the post or gathering itself, everywhere). Plain text settings only. Values are written by people: stripped, shortened, listed under `untrusted`. Reads only.',
    input: { properties: { ...orgProp, ...slugProp }, required: ['slug'] },
  }, async (args) => {
    const o = await settleOrg(grant, args.org, true);
    if (o.ok === false) return refuse(o.error);
    const orgId = o.orgId!;
    const got = await loadDoc(orgId, args.slug);
    if ('refusal' in got) return got.refusal;
    const threads = await threadsOf(orgId, referencedThreads(got.page.data, m.byId));
    const fields = findFields({ slug: got.slug, doc: got.page.data, blocks: m.byId, threads });
    return { data: { org: orgId, slug: got.slug, version: got.page.updatedAt, fields }, untrusted: ['fields[*].value', 'fields[*].block.path'], orgId };
  });

  // ---------------------------------------------------------------- list_surfaces
  readTool(server, ctx, 'list_surfaces', {
    title: 'What a site opens',
    description: 'Where a site\'s blocks can take a visitor: its pages (`page:<address>`) and the posts and gatherings its blocks open as popups (`popup:thread:<id>`, only those that belong to this organisation). Descriptors and titles only, no page content. Reads only.',
    input: { properties: orgProp },
    heavy: true,
  }, async (args) => {
    const o = await settleOrg(grant, args.org, true);
    if (o.ok === false) return refuse(o.error);
    const orgId = o.orgId!;
    const rows = await db<Array<{ slug: string; title: string | null }>>`
      SELECT substr(key, 6) AS slug, value->'root'->'props'->>'title' AS title FROM site_config
      WHERE org_id = ${orgId} AND key LIKE 'puck:%' ORDER BY substr(key, 6) LIMIT 40
    `;
    const untrusted: string[] = [];
    const surfaces: Array<Record<string, unknown>> = rows.map((r, i) => {
      untrusted.push(`surfaces[${i}].title`);
      return { kind: 'page', descriptor: `page:${r.slug}`, title: titleOf(r.title, r.slug), href: r.slug === 'home' ? '/' : `/${r.slug}` };
    });
    const popupThreads = new Set<string>();
    if (host.pages) {
      for (const r of rows) {
        const page = await host.pages.loadPageWithVersion(orgId, r.slug);
        if (page) for (const t of opensOf(page.data, m.byId).threads) popupThreads.add(t);
        if (popupThreads.size >= 60) break;
      }
    }
    const threads = await threadsOf(orgId, [...popupThreads]);
    for (const [id, t] of threads) {
      untrusted.push(`surfaces[${surfaces.length}].title`);
      surfaces.push({ kind: 'popup', descriptor: `popup:thread:${id}`, title: plain(t.title, 120) });
    }
    return { data: { org: orgId, grammar: SURFACE_GRAMMAR, surfaces }, untrusted, orgId };
  });

}
