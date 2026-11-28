// In-process check of the MCP content tools (Content Cornerstone Step 6, agent G, 2026-11-26).
// Calls the real handler with web Requests (as test.mts does), synthetic in-memory grants and an in-memory audit sink
// (nothing is written to action_events). The content readers are the real searchContent / resolveContentRefs over the dev DB
// (searchContent drains content_index_queue, as any search does).
//
//   pnpm --filter @elkdonis/lms exec tsx ../mcp/scripts/content-tools-check.mts   (in an eac container)
import './react-shim.mjs';
import { db } from '@elkdonis/db';
import { mcpHandler, memoryAudit, memoryGrantStore, newKey, type McpGrant } from '../src/server/index';
import type { McpContent } from '../src/server/types';
import { searchContent, resolveContentRefs } from '../../content/src/server/index';
import { defaultHost } from '../../content/src/host';

const ORIGIN = 'https://arts-collective.com';
let fails = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && extra !== undefined ? ` :: ${JSON.stringify(extra).slice(0, 500)}` : ''}`);
};

// A user who runs org market (owner or guide), else anyone who runs some org.
const [m] = await db<Array<{ user_id: string; email: string }>>`
  SELECT uo.user_id, u.email FROM user_organizations uo JOIN users u ON u.id = uo.user_id
  WHERE uo.org_id = 'market' AND uo.role IN ('owner', 'guide') ORDER BY uo.role LIMIT 1`;
if (!m) {
  console.log('no owner or guide of org market on this database; cannot run the org-scoped cases');
  process.exit(2);
}
const [foreign] = await db<Array<{ id: string }>>`
  SELECT o.id FROM organizations o WHERE o.id <> 'market' AND NOT EXISTS (SELECT 1 FROM user_organizations x WHERE x.org_id = o.id AND x.user_id = ${m.user_id} AND x.role IN ('owner','guide')) LIMIT 1`;

const host = defaultHost();
const content: McpContent = {
  search: async (userId, q) => {
    const r = await searchContent(userId ? { userId } : null, q as never, host);
    return { items: r.items as never, nextCursor: r.nextCursor, missing: r.missing };
  },
  resolve: async (userId, keys) => {
    const r = await resolveContentRefs(userId ? { userId } : null, keys, host);
    return { results: r.results as never, missing: r.missing };
  },
};

const mk = (id: string, orgScope: string): McpGrant => ({ id, userId: m.user_id, email: m.email ?? 'x@test.invalid', clientId: 'personal', label: `content check ${id}`, orgScope, scopes: ['mcp:read'], expiresAt: null });
const keys = { market: newKey(), any: newKey() };
const audit = memoryAudit();
const handle = mcpHandler({
  publicOrigin: ORIGIN,
  links: { hub: '', artdirect: 'https://artdirect.arts-collective.com', networkHost: 'arts-collective.com' },
  linkHosts: ['market.arts-collective.com'],
  content,
  grants: memoryGrantStore([
    [keys.market, mk('00000000-0000-4000-8000-0000000000a1', 'market')],
    [keys.any, mk('00000000-0000-4000-8000-0000000000a2', '*')],
  ]),
  audit,
  enabled: true,
});

let id = 1;
async function rpc(key: string, method: string, params: Record<string, unknown> = {}) {
  const res = await handle(new Request(`${ORIGIN}/api/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', host: 'arts-collective.com', authorization: `Bearer ${key}`, 'mcp-protocol-version': '2025-11-25' },
    body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params }),
  }));
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { const l = text.split('\n').filter((x) => x.startsWith('data:')).pop(); if (l) json = JSON.parse(l.slice(5)); }
  return json?.result ?? json;
}
const callTool = (key: string, name: string, args: Record<string, unknown>) => rpc(key, 'tools/call', { name, arguments: args });
const body = (r: any) => r?.structuredContent ?? (() => { try { return JSON.parse(r?.content?.[0]?.text ?? ''); } catch { return null; } })();
const text = (r: any) => String(r?.content?.[0]?.text ?? '');

await rpc(keys.market, 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'eac-content-check', version: '0.0.1' } });

const list = await rpc(keys.market, 'tools/list');
const names = (list?.tools ?? []).map((t: any) => t.name);
check('tools/list offers content.search and content.resolve, both read-only', names.includes('content.search') && names.includes('content.resolve') && (list.tools as any[]).filter((t) => t.name.startsWith('content.')).every((t) => t.annotations?.readOnlyHint === true), names);

// 1. Org scope, key bound to market.
const org = await callTool(keys.market, 'content.search', { limit: 5 });
const ob = body(org);
check('bound market key: org search answers, scope org:market, at most 5 items', !org.isError && ob?.scope === 'org:market' && Array.isArray(ob.items) && ob.items.length <= 5, text(org).slice(0, 300));
console.log(`     market items: ${ob?.items?.length}, nextCursor: ${ob?.nextCursor ? 'yes' : 'no'}, notRead: ${JSON.stringify(ob?.notRead)}`);
const ALLOWED = new Set(['key', 'type', 'title', 'excerpt', 'status', 'site', 'owner', 'date', 'sale', 'link']);
check('items are trimmed to the declared fields only', (ob?.items ?? []).every((it: any) => Object.keys(it).every((k) => ALLOWED.has(k))), ob?.items?.[0]);
check('untrusted fields are named and the notice is present', (ob?.items?.length ? (ob.untrusted ?? []).includes('items[0].title') : true) && (!ob?.items?.length || /untrusted/.test(ob.notice ?? '')), ob?.untrusted);
if (ob?.items?.[0]) console.log('     first item:', JSON.stringify(ob.items[0]).slice(0, 300));

// 2. Network scope, public only.
const net = await callTool(keys.market, 'content.search', { scope: 'network', limit: 20 });
const nb = body(net);
const PUBLIC_STATUS = new Set(['published', 'live']);
check('network search: answers, scope network, at most 20, only published or live pieces', !net.isError && nb?.scope === 'network' && nb.items.length <= 20 && nb.items.every((it: any) => PUBLIC_STATUS.has(it.status)), text(net).slice(0, 300));
console.log(`     network items: ${nb?.items?.length}, statuses: ${[...new Set((nb?.items ?? []).map((i: any) => i.status))].join(',')}`);
const ask = await callTool(keys.market, 'content.search', { scope: 'network', q: 'a', types: ['artwork'], limit: 3 });
check('network search with q, types and limit 3 answers', !ask.isError && (body(ask)?.items ?? []).length <= 3, text(ask).slice(0, 200));

// 3. Org lock.
if (foreign) {
  const cross = await callTool(keys.market, 'content.search', { scope: 'org', org: foreign.id });
  check(`bound key naming another org (${foreign.id}) is refused`, cross.isError === true && /limited to another organisation/i.test(text(cross)), text(cross));
  const cross2 = await callTool(keys.any, 'content.search', { scope: 'org', org: foreign.id });
  check('unbound key naming an org the person does not run is refused', cross2.isError === true && /not an owner or guide|No such/i.test(text(cross2)), text(cross2));
  const cross3 = await callTool(keys.market, 'content.search', { scope: 'network', org: foreign.id });
  check('a network search that names a foreign org on a bound key is refused too', cross3.isError === true, text(cross3));
  const cross4 = await callTool(keys.market, 'content.resolve', { keys: ['artwork:x'], org: foreign.id });
  check('content.resolve naming a foreign org on a bound key is refused', cross4.isError === true, text(cross4));
} else console.log('skip: every org is run by this person, no foreign org to refuse');
const noOrg = await callTool(keys.any, 'content.search', {});
check('unbound key with no org (org scope) is told to name one', noOrg.isError === true && /Name the organisation/i.test(text(noOrg)), text(noOrg));
const badScope = await callTool(keys.market, 'content.search', { scope: 'site' });
check('an unknown scope is refused', badScope.isError === true, text(badScope));
const big = await callTool(keys.market, 'content.search', { limit: 99 });
check('limit 99 is refused or clamped to 20, never honoured', big.isError === true || (body(big)?.items ?? []).length <= 20, text(big).slice(0, 200));

// 4. Resolve.
const sample = (nb?.items?.[0]?.key ?? ob?.items?.[0]?.key) as string | undefined;
const rs = await callTool(keys.market, 'content.resolve', { keys: [...(sample ? [sample] : []), 'artwork:does-not-exist', 'bad key'] });
const rb = body(rs);
check('content.resolve: a real key resolves, a missing one and a malformed one are gone', !rs.isError && rb?.results?.length === (sample ? 3 : 2) && rb.results.slice(-2).every((r: any) => r.gone === true) && (!sample || !rb.results[0].gone), text(rs).slice(0, 300));

// 5. Audit rows (in memory).
const rows = audit.rows.filter((r) => r.tool.startsWith('content.'));
const okRow = rows.find((r) => r.tool === 'content.search' && r.ok);
const refRow = rows.find((r) => !r.ok && r.code === 'forbidden');
check('audit: content.search ok row has grant id, person, settled org market and the input', !!okRow && okRow.agentId.endsWith('a1') && okRow.userId === m.user_id && okRow.orgId === 'market' && (okRow.input as any)?.limit === 5, okRow);
check('audit: a refused call leaves a row with its code', !!refRow || !foreign, rows.map((r) => [r.tool, r.ok, r.code]));
console.log(`     audit rows (memory sink): ${rows.length}; live action_events untouched`);

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
await db.end?.({ timeout: 2 }).catch(() => {});
process.exit(fails ? 1 : 0);
