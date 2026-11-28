/**
 * The content tools (Content Cornerstone Step 6, 2026-11-26). Read-only, under every rule of packages/mcp/README.md:
 *
 *   content.search   one search over threads and artworks (the cornerstone's `searchContent`), org-locked
 *   content.resolve  the current state of stored piece keys (`resolveContentRefs`), gone ones marked
 *   content.suggest  type-ahead names: pieces, listed people, public orgs (`suggestContent`), when the host passes `suggest`
 *
 * The lock: scope is the grant's org (`org:<id>`, settled by `settleOrg`: a bound key only its org, an unbound key
 * only an org the person owns or guides, a refused claim is refused) or `network` (public, published pieces only,
 * read as nobody). The viewer is always the grant's own person (never another); on `network` there is none.
 * Titles, excerpts and names are member-written, so they sit in fields named under `untrusted`. Links go to platform
 * hosts only. packages/mcp does not link @elkdonis/content: the host passes `content` (`McpContent`), as it passes
 * the page reader; without it the tools are not registered (the existing tool list is unchanged).
 */
import { db } from '@elkdonis/db';
import type { McpServer } from '@modelcontextprotocol/server';
import { readTool, refuse, type Json, type ToolContext } from './tools';
import { boundOrg, settleOrg } from './org';
import { platformHref, plain } from './sanitize';
import type { McpContentItem } from './types';

const MAX_LIMIT = 20;
const MAX_KEYS = 50;
const VIEWS = ['published', 'all'] as const;
const KEY_RE = /^(thread|artwork):[A-Za-z0-9_-]{1,64}$/;

/** One piece, trimmed for an agent. Returns the shaped item and pushes the fields that hold other people's text. */
function shapeItem(ctx: ToolContext, it: McpContentItem, path: string, untrusted: string[]): Json {
  untrusted.push(`${path}.title`, `${path}.excerpt`, `${path}.site`, `${path}.owner`);
  return {
    key: it.key,
    type: it.type,
    title: plain(it.title, 200),
    excerpt: plain(it.excerpt, 300),
    status: it.status,
    site: plain(it.siteName, 120),
    owner: plain(it.ownerName ?? null, 120),
    date: typeof it.date === 'string' ? it.date : null,
    sale: it.sale ? { state: it.sale.state, price: plain(it.sale.price, 40) } : null,
    link: platformHref(it.links?.public, ctx.host.publicOrigin, ctx.linkHosts),
  };
}

export function registerContentTools(server: McpServer, ctx: ToolContext): void {
  const { grant, host } = ctx;
  const content = host.content;
  if (!content) return;

  readTool(server, ctx, 'content.search', {
    title: 'Search content',
    description:
      'Search the threads (posts, events, meetings) and artworks of ONE organisation the key covers, or of the whole network (public, published pieces only). ' +
      '`scope` is "org" (default; name `org` unless the key is limited to one) or "network". Reads as the key’s own person, never as anyone else. ' +
      `Returns up to ${MAX_LIMIT} trimmed pieces (key, type, title, excerpt, status, site, owner, link) and a cursor for the next page. Reads only.`,
    input: {
      properties: {
        q: { type: 'string', maxLength: 200, description: 'Words to search for. Omit to browse newest first.' },
        scope: { type: 'string', maxLength: 20, description: '"org" (default) or "network".' },
        org: { type: 'string', maxLength: 100, description: 'An organisation id or slug (list_my_orgs). Omit for a key limited to one org.' },
        types: { type: 'array', maxItems: 8, items: { type: 'string', maxLength: 20 }, description: 'Limit to these types, e.g. ["artwork","writing"].' },
        view: { type: 'string', maxLength: 20, description: '"published" (default) or "all" (adds drafts you may read; org scope only).' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, description: `Page size, at most ${MAX_LIMIT}.` },
        cursor: { type: 'string', maxLength: 512, description: 'The nextCursor of the previous page.' },
      },
    },
    heavy: true,
  }, async (args) => {
    const scope = typeof args.scope === 'string' && args.scope.trim() ? args.scope.trim() : 'org';
    if (scope !== 'org' && scope !== 'network') return refuse('scope is "org" or "network".', 'input');
    const view = typeof args.view === 'string' && args.view ? args.view : 'published';
    if (!(VIEWS as readonly string[]).includes(view)) return refuse('view is "published" or "all".', 'input');
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(args.limit) || 10)));
    const types = Array.isArray(args.types) ? args.types.filter((t): t is string => typeof t === 'string').slice(0, 8) : undefined;
    const q = typeof args.q === 'string' ? args.q.trim().slice(0, 200) : undefined;
    const cursor = typeof args.cursor === 'string' && args.cursor.length <= 512 ? args.cursor : null;

    let orgId: string | null = null;
    if (scope === 'org') {
      const o = await settleOrg(grant, args.org, true);
      if (o.ok === false) return refuse(o.error);
      orgId = o.orgId;
    } else if (typeof args.org === 'string' && args.org.trim()) {
      // A claim on the network scope is still checked against the key's lock: it must not name another org.
      const o = await settleOrg(grant, args.org, false);
      if (o.ok === false) return refuse(o.error);
    }
    // Network: nobody (public published only). Org: the grant's person.
    const r = await content.search(scope === 'org' ? grant.userId : null, {
      q: q || undefined,
      scope: scope === 'org' ? { kind: 'org', orgId: orgId! } : { kind: 'network' },
      view: scope === 'network' ? 'published' : (view as 'published' | 'all'),
      types,
      limit,
      cursor,
    });
    const untrusted: string[] = [];
    const items = r.items.slice(0, limit).map((it, i) => shapeItem(ctx, it, `items[${i}]`, untrusted));
    return {
      data: { scope: scope === 'org' ? `org:${orgId}` : 'network', items, nextCursor: r.nextCursor ?? null, notRead: r.missing?.length ? r.missing.slice(0, 10) : [] },
      untrusted,
      orgId,
    };
  });

  readTool(server, ctx, 'content.resolve', {
    title: 'Resolve content keys',
    description:
      `The current state of up to ${MAX_KEYS} stored piece keys (thread:<id>, artwork:<id>): the piece as it reads now, or gone when it is unpublished, hidden, deleted or not readable. ` +
      'Keys of the named (or bound) organisation are read as the key’s own person; every other key is read as public. Reads only.',
    input: {
      properties: {
        keys: { type: 'array', minItems: 1, maxItems: MAX_KEYS, items: { type: 'string', maxLength: 90 }, description: 'Piece keys, e.g. "artwork:abc123".' },
        org: { type: 'string', maxLength: 100, description: 'An organisation id or slug. Omit for a key limited to one org (or public reads only).' },
      },
      required: ['keys'],
    },
  }, async (args) => {
    const keys = Array.isArray(args.keys) ? args.keys.filter((k): k is string => typeof k === 'string').slice(0, MAX_KEYS) : [];
    if (!keys.length) return refuse('Name at least one piece key.', 'input');
    const wanted = keys.filter((k) => KEY_RE.test(k));
    let orgId: string | null = null;
    const claim = typeof args.org === 'string' && args.org.trim() ? args.org : null;
    if (claim || boundOrg(grant)) {
      const o = await settleOrg(grant, claim, false);
      if (o.ok === false) return refuse(o.error);
      orgId = o.orgId;
    }
    // Which of the keys belong to the settled org (the index's own org column); only those are read as the person.
    let own = new Set<string>();
    if (orgId && wanted.length) {
      const rows = await db<Array<{ key: string }>>`SELECT key FROM content_index WHERE key IN ${db(wanted)} AND org_id = ${orgId}`;
      own = new Set(rows.map((x) => x.key));
    }
    const mine = keys.filter((k) => own.has(k));
    const rest = keys.filter((k) => !own.has(k));
    const empty = { results: [] as Array<McpContentItem | { key: string; gone: true }>, missing: [] as string[] };
    const [a, b] = await Promise.all([
      mine.length ? content.resolve(grant.userId, mine) : Promise.resolve(empty),
      rest.length ? content.resolve(null, rest) : Promise.resolve(empty),
    ]);
    const byKey = new Map([...a.results, ...b.results].map((x) => [x.key, x]));
    const untrusted: string[] = [];
    const results = keys.map((k, i) => {
      const x = byKey.get(k);
      if (!x || 'gone' in x) return { key: k, gone: true } as Json;
      return shapeItem(ctx, x, `results[${i}]`, untrusted);
    });
    return { data: { results, notRead: [...a.missing, ...b.missing].slice(0, 10) }, untrusted, orgId };
  });

  const suggest = content.suggest?.bind(content);
  if (suggest) {
    readTool(server, ctx, 'content.suggest', {
      title: 'Suggest content',
      description:
        'Type-ahead for a few letters: up to `limit` matching pieces (key, title, type), listed people (name, profile link) and public organisations (name, home link). ' +
        'Pieces are read as the key’s own person within the org the key covers (or public pieces only with scope "network"); people and organisations are the publicly listed ones only. Reads only.',
      input: {
        properties: {
          q: { type: 'string', maxLength: 100, description: 'The letters typed so far. Omit for recent pieces.' },
          scope: { type: 'string', maxLength: 20, description: '"org" (default) or "network".' },
          org: { type: 'string', maxLength: 100, description: 'An organisation id or slug. Omit for a key limited to one org.' },
          limit: { type: 'integer', minimum: 1, maximum: 10, description: 'At most this many of each kind (default 5, at most 10).' },
        },
      },
    }, async (args) => {
      const scope = typeof args.scope === 'string' && args.scope.trim() ? args.scope.trim() : 'org';
      if (scope !== 'org' && scope !== 'network') return refuse('scope is "org" or "network".', 'input');
      const limit = Math.min(10, Math.max(1, Math.floor(Number(args.limit) || 5)));
      const q = typeof args.q === 'string' ? args.q.trim().slice(0, 100) : '';
      let orgId: string | null = null;
      if (scope === 'org') {
        const o = await settleOrg(grant, args.org, true);
        if (o.ok === false) return refuse(o.error);
        orgId = o.orgId;
      } else if (typeof args.org === 'string' && args.org.trim()) {
        const o = await settleOrg(grant, args.org, false);
        if (o.ok === false) return refuse(o.error);
      }
      const r = await suggest(scope === 'org' ? grant.userId : null, q, limit);
      const untrusted: string[] = [];
      const pieces = r.pieces.slice(0, limit).map((p, i) => {
        untrusted.push(`pieces[${i}].title`);
        return { key: p.key, type: p.type, title: plain(p.title, 200) } as Json;
      });
      const people = r.people.slice(0, limit).map((p, i) => {
        untrusted.push(`people[${i}].name`);
        return { name: plain(p.name, 120), link: platformHref(p.href, host.publicOrigin, ctx.linkHosts) } as Json;
      });
      const orgs = r.orgs.slice(0, limit).map((o, i) => {
        untrusted.push(`orgs[${i}].name`);
        return { id: o.id, name: plain(o.name, 120), link: platformHref(o.href, host.publicOrigin, ctx.linkHosts) } as Json;
      });
      return { data: { scope: scope === 'org' ? `org:${orgId}` : 'network', q, pieces, people, orgs }, untrusted, orgId };
    });
  }
}
