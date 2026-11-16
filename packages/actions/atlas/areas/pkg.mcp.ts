import type { Area, Capability, Host, HostKey } from '../types';

// packages/mcp: the platform MCP endpoint (/api/mcp, mounted by arts-collective; see arts-collective.network:serve-mcp)
// and the keys behind it. 2026-11-16, round 3. Conventions: atlas/JOURNAL.md. An agent door: read carefully.
// Read: server/{handler,grants,audit,org,limit,tools(top)}.ts and scripts/mint-key.mts.
// The tools are read-only in this slice (the scope mcp:draft exists in the key but no tool uses it).

const SRC = 'packages/mcp/src/server/';
const V = '2026-11-16 read packages/mcp/src/server/{handler,grants,audit,org,limit}.ts, tools.ts (header and readTool), scripts/mint-key.mts';
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const hm = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: 'arts-collective', path, how }, note });

const capabilities: Capability[] = [
  {
    id: 'pkg-mcp-grant-mint',
    area: 'pkg.mcp',
    label: 'Mint an MCP key for a person',
    does: 'The operator creates a personal key (eacm_ plus 32 random bytes) for a user, bound to one organisation or to every organisation they manage, with read or draft scope and a 90 day life by default. The key is printed once; only its hash is stored in mcp_grants.',
    class: 'admin',
    actors: ['operator'],
    scope: 'person',
    hosts: [
      hm(sq('grants.ts', 'mintGrant'), ['(raw INSERT mcp_grants)'], '/', 'no screen: the operator script packages/mcp/scripts/mint-key.mts (`pnpm --filter @elkdonis/lms exec tsx ../mcp/scripts/mint-key.mts <email> <org|*> "<label>" [days]`)', 'Run by the operator with database access; no web door.'),
    ],
    status: 'an mcp_grants row for the user with a token_hash, org_scope, scopes and expires_at exists, not revoked',
    risk: ['others'],
    inputs: 'email, org id or slug or *, label, days, scopes',
    drift: 'Operator runbooks point at apps/admin, but this has no admin-app screen: the only door is the script. A grant list, mint and revoke page in apps/admin is the missing piece (the mcp_grants migration is parked in docs/open/mcp-foundations/migrations until Justin runs it).',
    canonical: 'packages/mcp mintGrant',
    open: 'GOOD: only the SHA-256 is stored, expiry defaults to 90 days, the key prefix differs from a device token, the key is accepted at /api/mcp and nowhere else, labels are cut to 80 characters. SECURITY (notes): the script mints for ANY email without confirming the person asked for it; scopes default to mcp:read; a grant keeps working after the person loses their roles (the tools re-read roles per call, so it then sees nothing, but the row stays live until it expires); there is no list of live grants in any UI.',
    verified: V,
  },
  {
    id: 'pkg-mcp-grant-revoke',
    area: 'pkg.mcp',
    label: 'Revoke an MCP key',
    does: 'The operator revokes a grant by id: revoked_at is set and the key stops working on the next request.',
    class: 'admin',
    actors: ['operator'],
    scope: 'person',
    hosts: [
      hm(sq('grants.ts', 'revokeGrant'), ['(raw UPDATE mcp_grants)'], '/', 'no screen: `mint-key.mts --revoke <grant id>`', 'Operator script only.'),
    ],
    status: 'mcp_grants.revoked_at is set for the grant id',
    risk: ['none'],
    inputs: 'grant id',
    drift: 'Pair of pkg-mcp-grant-mint; neither has an admin-app screen.',
    canonical: 'packages/mcp revokeGrant',
    open: 'The grant id is only shown on the mint line; the audit rows (action_events agent_id) carry it, so an operator can find a misbehaving key there. No "revoke every key of this person" call.',
    verified: V,
  },
  {
    id: 'pkg-mcp-key-last-used',
    area: 'pkg.mcp',
    label: 'Note that an MCP key was used',
    does: 'On a valid key lookup, updates mcp_grants.last_used_at at most once an hour per process.',
    class: 'system',
    actors: ['system'],
    scope: 'person',
    hosts: [
      hm(sq('grants.ts', '<class>.findByKey'), ['(raw UPDATE mcp_grants)'], '/api/mcp', 'no screen: every authenticated call to POST /api/mcp'),
    ],
    status: 'mcp_grants.last_used_at is within the last hour for a key in use',
    risk: ['none'],
    drift: 'backs arts-collective.network:serve-mcp',
    open: 'Read carefully. GOOD: the endpoint refuses (in order) a switched-off door, any Host but the canonical one (so org hosts and mapped domains cannot reach it), a browser Origin not on the list, anything but POST, a missing or malformed key, an unknown, expired or revoked key (the lookup also requires revoked_at null and expires_at in the future), and a request over 120 per minute per grant (handler.ts:79-100); a bad key is a 401 and a missing key table is a 503. ' +
      'SECURITY (minor): the request rate limit is taken AFTER the key lookup (handler.ts:94-98), so unknown keys each cost one database query and are never limited (the key space is 256 bits, so this is cost, not guessing); limiter windows are per process and reset on restart, as the file says. Org scope is enforced per call (org.ts: a bound key cannot name another org; an unbound key reaches only orgs where the person is owner or guide; no network-admin bypass).',
    verified: V,
  },
  {
    id: 'pkg-mcp-audit-record',
    area: 'pkg.mcp',
    label: 'Record an MCP tool call',
    does: 'Writes one action_events row per tool call: action mcp:<tool>, the person, actor type ai, the organisation, the arguments (up to 4000 characters), the outcome and the duration. What the tool returned is not stored.',
    class: 'system',
    actors: ['system'],
    scope: 'org',
    hosts: [
      hm(sq('audit.ts', 'insert'), ['(raw INSERT action_events)'], '/api/mcp', 'no screen: written after every tool call; read in the registry audit views'),
    ],
    status: 'an action_events row with via mcp and the agent_id of the grant exists for the call',
    risk: ['none'],
    drift: 'backs arts-collective.network:serve-mcp; same table as the registry audit row (pkg-actions-record-audit).',
    canonical: 'one audit writer for both doors (packages/actions record)',
    open: 'Best effort: a failed insert is logged and the result stands, so a call can succeed with no audit row when the table or database is unavailable (audit.ts:177-198, retry after 10 min). The arguments are stored as sent: a prompt a person gave an agent (names, org ids) lands in action_events for as long as that table is kept.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
