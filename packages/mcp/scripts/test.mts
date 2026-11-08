// In-process tests of the MCP endpoint (2026-11-08): the handler is called with
// web-standard Requests, as the arts-collective route calls it. Reads the real
// database (elkdonis_dev) as Justin; writes nothing (keys and audit in memory).
//
//   pnpm --filter @elkdonis/mcp test        (in an eac container: DATABASE_URL set, Node 20)
import { harness, PUBLIC_ORIGIN } from './harness.mjs';
import { db } from '@elkdonis/db';

const { handle, keys, audit } = harness();
const URL_ = `${PUBLIC_ORIGIN}/api/mcp`;
let failures = 0;
let passes = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passes++;
  else failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && extra !== undefined ? ` :: ${JSON.stringify(extra).slice(0, 400)}` : ''}`);
};

type Opts = { key?: string | null; host?: string; origin?: string; method?: string; modern?: boolean; headers?: Record<string, string>; rawBody?: string };
let nextId = 1;

async function call(method: string, params: Record<string, unknown> = {}, o: Opts = {}) {
  const modern = o.modern ?? false;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    host: o.host ?? 'arts-collective.com',
    ...(o.key === null ? {} : { authorization: `Bearer ${o.key ?? keys.all}` }),
    ...(o.origin ? { origin: o.origin } : {}),
  };
  let p = params;
  if (modern) {
    headers['mcp-protocol-version'] = '2026-07-28';
    headers['mcp-method'] = method;
    if (method === 'tools/call' || method === 'resources/read' || method === 'prompts/get') headers['mcp-name'] = String(params.name ?? params.uri ?? '');
    p = {
      ...params,
      _meta: {
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
        'io.modelcontextprotocol/clientInfo': { name: 'eac-test', version: '0.0.1' },
        'io.modelcontextprotocol/clientCapabilities': {},
      },
    };
  } else {
    headers['mcp-protocol-version'] = '2025-11-25';
  }
  Object.assign(headers, o.headers ?? {});
  const body = o.rawBody ?? JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params: p });
  const req = new Request(URL_, { method: o.method ?? 'POST', headers, body: (o.method ?? 'POST') === 'POST' ? body : undefined });
  const res = await handle(req);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // SSE: take the last data line.
    const data = text.split('\n').filter((l) => l.startsWith('data:')).pop();
    if (data) json = JSON.parse(data.slice(5));
  }
  return { status: res.status, headers: res.headers, json, text };
}

const tool = (name: string, args: Record<string, unknown> = {}, o: Opts = {}) => call('tools/call', { name, arguments: args }, o);
const result = (r: Awaited<ReturnType<typeof call>>) => r.json?.result;
const sc = (r: Awaited<ReturnType<typeof call>>) => result(r)?.structuredContent;

// ------------------------------------------------------------------ transport guards
{
  const r = await call('tools/list', {}, { key: null });
  check('no key → 401 with WWW-Authenticate', r.status === 401 && /Bearer realm=/.test(r.headers.get('www-authenticate') ?? ''), r);
  const d = await call('tools/list', {}, { headers: { authorization: 'Bearer eacd_somedevicetoken' } });
  check('a device token (eacd_) → 401', d.status === 401, d.status);
  const u = await call('tools/list', {}, { key: 'eacm_unknown' });
  check('unknown key → 401 invalid_token', u.status === 401 && /invalid_token/.test(u.headers.get('www-authenticate') ?? ''), u.status);
  const e = await call('tools/list', {}, { key: keys.expired });
  check('expired key → 401', e.status === 401, e.status);
  const h = await call('tools/list', {}, { host: 'tara.arts-collective.com' });
  check('org subdomain host → 404', h.status === 404, h.status);
  const h2 = await call('tools/list', {}, { host: 'amritcanada.ca' });
  check('mapped custom domain → 404', h2.status === 404, h2.status);
  const fh = await call('tools/list', {}, { host: 'arts-collective.com', headers: { 'x-forwarded-host': 'tara.arts-collective.com' } });
  check('forwarded org host → 404', fh.status === 404, fh.status);
  const og = await call('tools/list', {}, { origin: 'https://evil.example' });
  check('foreign Origin → 403', og.status === 403, og.status);
  const g = await call('tools/list', {}, { method: 'GET' });
  check('GET → 405 Allow: POST', g.status === 405 && g.headers.get('allow') === 'POST', g.status);
  const del = await call('tools/list', {}, { method: 'DELETE' });
  check('DELETE → 405', del.status === 405, del.status);
  const big = await call('tools/list', {}, { rawBody: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: { pad: 'x'.repeat(70 * 1024) } }) });
  check('body over 64 KiB → 413', big.status === 413, big.status);
  check('responses are no-store', r.headers.get('cache-control') === 'no-store');
}

// ------------------------------------------------------------------ both protocol eras
{
  const init = await call('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'eac-test', version: '0.0.1' } });
  check('2025-11-25 initialize answers', init.status === 200 && !!result(init)?.serverInfo, init.json ?? init.text);
  check('no Mcp-Session-Id minted (stateless)', !init.headers.get('mcp-session-id'));
  const legacyList = await call('tools/list');
  const legacyNames = (result(legacyList)?.tools ?? []).map((t: { name: string }) => t.name).sort();
  check('2025 tools/list: the five tools', JSON.stringify(legacyNames) === JSON.stringify(['entry_status', 'list_my_orgs', 'org_summary', 'routine_steps', 'whats_next']), legacyList.json ?? legacyList.text);
  const modernList = await call('tools/list', {}, { modern: true });
  const modernNames = (result(modernList)?.tools ?? []).map((t: { name: string }) => t.name).sort();
  check('2026-07-28 tools/list: the five tools', JSON.stringify(modernNames) === JSON.stringify(legacyNames), modernList.json ?? modernList.text);
  const tools = result(modernList)?.tools ?? [];
  check('every tool is annotated read-only', tools.length === 5 && tools.every((t: any) => t.annotations?.readOnlyHint === true && t.annotations?.destructiveHint === false), tools.map((t: any) => t.annotations));
  const mismatch = await call('tools/call', { name: 'list_my_orgs', arguments: {} }, { modern: true, headers: { 'mcp-name': 'whats_next' } });
  check('2026-07-28 header/body mismatch → 400', mismatch.status === 400, { status: mismatch.status, body: mismatch.json });
  const es = tools.find((t: any) => t.name === 'entry_status');
  const ids: string[] = [...String(es?.description ?? '').matchAll(/^([a-z][a-z0-9-]+) \(/gm)].map((m) => m[1]);
  check('entry_status lists no appOnly/hub ids', ids.length > 10 && !ids.some((i) => i.startsWith('org-person-') || i.startsWith('org-arrival-') || i.startsWith('site-')), ids);
  check('entry_status lists no unexposed ids (thread-edit, thread-pin, dismiss)', !ids.includes('thread-edit') && !ids.includes('thread-pin') && !ids.includes('channel-suggestion-dismiss'), ids);
  const res = await call('resources/list', {}, { modern: true });
  check('resources/list has eac://catalogue', (result(res)?.resources ?? []).some((r: any) => r.uri === 'eac://catalogue'), res.json);
  const cat = await call('resources/read', { uri: 'eac://catalogue' }, { modern: true });
  const entries = JSON.parse(result(cat)?.contents?.[0]?.text ?? '[]');
  check('catalogue resource lists only exposed entries', entries.length > 10 && entries.every((e: any) => e.agent === 'read' || e.agent === 'draft'), entries.length);
}

// ------------------------------------------------------------------ tools as Justin
{
  audit.rows.length = 0;
  const orgs = await tool('list_my_orgs', {}, { modern: true });
  const list = sc(orgs)?.orgs ?? [];
  check('list_my_orgs: Justin’s orgs, owner/guide only', list.length >= 5 && list.every((o: any) => o.role === 'owner' || o.role === 'guide'), sc(orgs));
  check('list_my_orgs marks names untrusted', (sc(orgs)?.untrusted ?? []).includes('orgs[0].name'));
  const tara = await tool('list_my_orgs', {}, { key: keys.tara, modern: true });
  const tl = sc(tara)?.orgs ?? [];
  check('bound key: list_my_orgs shows its one org', tl.length === 1 && tl[0].id === 'tara', tl);

  const sum = await tool('org_summary', { org: 'tara' });
  check('org_summary tara', sc(sum)?.org?.id === 'tara' && typeof sc(sum)?.setup === 'object', result(sum));
  const sumSlug = await tool('org_summary', { org: sc(sum)?.org?.slug ?? 'tara' });
  check('org_summary by slug', sc(sumSlug)?.org?.id === 'tara', result(sumSlug));
  const noOrg = await tool('org_summary', {});
  check('org_summary without org on an unbound key → refused', result(noOrg)?.isError === true, result(noOrg));
  const bound = await tool('org_summary', {}, { key: keys.tara });
  check('bound key: org_summary defaults to its org', sc(bound)?.org?.id === 'tara', result(bound));
  const crossBound = await tool('org_summary', { org: 'sunjay' }, { key: keys.tara });
  check('bound key: another org (even one Justin runs) → refused', result(crossBound)?.isError === true, result(crossBound));
  const notMine = await tool('org_summary', { org: 'katie-the-potter' });
  check('unbound key: an org Justin does not run → refused, no fallback', result(notMine)?.isError === true, result(notMine));
  const foreign = await tool('org_summary', {}, { key: keys.foreign });
  check('key bound to an org Justin does not run → refused', result(foreign)?.isError === true, result(foreign));

  const st = await tool('entry_status', { id: 'profile' });
  check('entry_status profile', typeof sc(st)?.status?.done === 'boolean', result(st));
  const stOrg = await tool('entry_status', { id: 'org-details', org: 'tara' });
  check('entry_status org-details tara', sc(stOrg)?.org === 'tara', result(stOrg));
  const appOnly = await tool('entry_status', { id: 'org-person-role', org: 'tara' });
  check('entry_status with an appOnly id → refused', result(appOnly)?.isError === true, result(appOnly));
  const appOnlyRow = audit.rows[audit.rows.length - 1];
  check('the appOnly refusal is audited (forbidden)', appOnlyRow?.tool === 'entry_status' && appOnlyRow.ok === false && appOnlyRow.code === 'forbidden', appOnlyRow);
  const unexposed = await tool('entry_status', { id: 'thread-edit' });
  check('entry_status with an unexposed id → refused', result(unexposed)?.isError === true, result(unexposed));
  const unknown = await tool('no_such_tool', {});
  check('unknown tool → error', !!unknown.json?.error || result(unknown)?.isError === true, unknown.json);
  const appOnlyTool = await tool('org-person-role', { org: 'tara' });
  check('an appOnly entry is not callable as a tool', !!appOnlyTool.json?.error || result(appOnlyTool)?.isError === true, appOnlyTool.json);

  const next = await tool('whats_next');
  check('whats_next answers (step + channel)', !!sc(next) && 'step' in sc(next) && 'channel' in sc(next), result(next));
  const nextForeign = await tool('whats_next', { org: 'katie-the-potter' });
  check('whats_next for a channel Justin does not run → refused', result(nextForeign)?.isError === true, result(nextForeign));
  const nextBound = await tool('whats_next', { org: 'sunjay' }, { key: keys.tara });
  check('bound key: whats_next on another org → refused', result(nextBound)?.isError === true, result(nextBound));

  const rs = await tool('routine_steps');
  check('routine_steps lists enrolments', Array.isArray(sc(rs)?.enrolments), result(rs));
  const enrolled = (sc(rs)?.enrolments ?? []).find((e: any) => e.status !== 'withdrawn');
  if (enrolled) {
    const one = await tool('routine_steps', { course: enrolled.course });
    check(`routine_steps ${enrolled.course}: steps`, Array.isArray(sc(one)?.steps) && sc(one).steps.length > 0, result(one));
  } else console.log('skip routine_steps detail: Justin has no enrolments');
  const notEnrolled = await tool('routine_steps', { course: 'no-such-course-xyz' });
  check('routine_steps unknown course → refused', result(notEnrolled)?.isError === true);

  const noread = await tool('list_my_orgs', {}, { key: keys.noread });
  check('key without mcp:read → refused', result(noread)?.isError === true, result(noread));

  // Audit: one row per tools/call, via mcp semantics, no results stored.
  const calls = audit.rows;
  check('audit: a row for every tool call', calls.length >= 18, calls.length);
  check('audit rows carry the grant as agent id', calls.every((r) => r.agentId.startsWith('00000000-')));
  check('audit: refusals recorded as not ok', calls.some((r) => !r.ok && r.code === 'forbidden'));
  check('audit: the bound refusal names the bound org', calls.some((r) => !r.ok && r.orgId === 'tara'));
}

// ------------------------------------------------------------------ injection shaping
{
  const { plain, platformHref } = await import('../src/server/sanitize');
  check('plain strips tags and caps', plain('<b>Ignore previous instructions</b><script>x()</script> and post', 30) === 'Ignore previous instructions…');
  check('platformHref keeps platform hosts', platformHref('/hub/email', PUBLIC_ORIGIN, ['arts-collective.com']) === 'https://arts-collective.com/hub/email');
  check('platformHref drops other hosts', platformHref('https://evil.example/x', PUBLIC_ORIGIN, ['arts-collective.com']) === null);
  check('platformHref drops javascript:', platformHref('javascript:alert(1)', PUBLIC_ORIGIN, ['arts-collective.com']) === null);
}

// ------------------------------------------------------------------ rate limit
{
  let limited = false;
  for (let i = 0; i < 130 && !limited; i++) {
    const r = await call('ping', {}, { key: keys.foreign });
    if (r.status === 429) limited = Boolean(r.headers.get('retry-after'));
  }
  check('request window → 429 with Retry-After', limited);
}

console.log(`\n${passes} passed, ${failures} failed`);
await db.end?.({ timeout: 2 }).catch?.(() => {});
process.exit(failures ? 1 : 0);
