/**
 * MCP keys and the grants behind them (2026-11-08; PLAN.md §2.3).
 *
 * A key is `eacm_` + 32 random bytes (base64url). Only its SHA-256 is stored, in
 * `mcp_grants` (migration parked in docs/open/mcp-foundations/migrations until
 * Justin runs it). The prefix is not `eacd_`, so auth-server's `deviceTokenUser`
 * never treats an MCP key as a session: the key opens /api/mcp and nothing else.
 *
 * A grant is the RFC 8693 pair kept as columns: `user_id` is the person the
 * agent speaks for, `client_id` the client that carries it ('personal' for an
 * operator-minted key; the OAuth client later). `org_scope` is one org id, or
 * '*' for every org the person manages.
 */
import { createHash, randomBytes } from 'node:crypto';
import { db } from '@elkdonis/db';

export const MCP_KEY_PREFIX = 'eacm_';

export type McpScope = 'mcp:read' | 'mcp:draft';

export interface McpGrant {
  /** mcp_grants.id: the agent id on audit rows. */
  id: string;
  userId: string;
  email: string;
  clientId: string;
  label: string;
  /** One organizations.id, or '*'. */
  orgScope: string;
  scopes: McpScope[];
  expiresAt: Date | null;
}

/** 'unavailable': the store cannot answer (the table is missing). The handler answers 503, not 401. */
export interface GrantStore {
  findByKey(key: string): Promise<McpGrant | null | 'unavailable'>;
}

export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

export function newKey(): string {
  return MCP_KEY_PREFIX + randomBytes(32).toString('base64url');
}

/** The key from `Authorization: Bearer eacm_…`, or null. Tokens are never read from the query string. */
export function bearerKey(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h) return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(h);
  if (!m || !m[1].startsWith(MCP_KEY_PREFIX)) return null;
  return m[1].length <= 128 ? m[1] : null;
}

const SCOPES: readonly McpScope[] = ['mcp:read', 'mcp:draft'];
const toScopes = (raw: string | null | undefined): McpScope[] => String(raw ?? '').split(/\s+/).filter((s): s is McpScope => SCOPES.includes(s as McpScope));

let lastTouch = new Map<string, number>();

/** The `mcp_grants` table. A missing table answers 'unavailable' (migration not applied). */
export function dbGrantStore(): GrantStore {
  return {
    async findByKey(key) {
      type Row = { id: string; user_id: string; email: string | null; client_id: string; label: string; org_scope: string; scopes: string; expires_at: Date | null };
      let row: Row | undefined;
      try {
        [row] = await db<Row[]>`
          SELECT g.id, g.user_id, u.email, g.client_id, g.label, g.org_scope, g.scopes, g.expires_at
          FROM mcp_grants g JOIN users u ON u.id = g.user_id
          WHERE g.token_hash = ${hashKey(key)} AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > now())
          LIMIT 1
        `;
      } catch (err) {
        if ((err as { code?: string })?.code === '42P01') return 'unavailable';
        console.error('[mcp] grant lookup failed', err);
        return 'unavailable';
      }
      if (!row) return null;
      // Note use at most hourly per process; never block the request on it.
      const now = Date.now();
      if ((lastTouch.get(row.id) ?? 0) < now - 3600_000) {
        lastTouch.set(row.id, now);
        if (lastTouch.size > 5000) lastTouch = new Map([[row.id, now]]);
        db`UPDATE mcp_grants SET last_used_at = now() WHERE id = ${row.id}`.catch(() => {});
      }
      return { id: row.id, userId: row.user_id, email: row.email ?? '', clientId: row.client_id, label: row.label, orgScope: row.org_scope, scopes: toScopes(row.scopes), expiresAt: row.expires_at };
    },
  };
}

/** Grants held in memory, for tests and local runs: `[key, grant]` pairs. */
export function memoryGrantStore(entries: ReadonlyArray<[string, McpGrant]>): GrantStore {
  const byHash = new Map(entries.map(([k, g]) => [hashKey(k), g]));
  return {
    async findByKey(key) {
      const g = byHash.get(hashKey(key));
      if (!g) return null;
      if (g.expiresAt && g.expiresAt.getTime() <= Date.now()) return null;
      return g;
    },
  };
}

export interface MintInput {
  userId: string;
  label: string;
  /** organizations.id, or '*'. */
  orgScope: string;
  scopes?: McpScope[];
  /** Default 90. */
  days?: number;
  clientId?: string;
}

/** Create a grant and return its key (shown once, never stored). For the operator script. */
export async function mintGrant(input: MintInput): Promise<{ id: string; key: string; expiresAt: Date }> {
  const key = newKey();
  const days = input.days ?? 90;
  const expiresAt = new Date(Date.now() + days * 86400_000);
  const scopes = (input.scopes?.length ? input.scopes : ['mcp:read']).join(' ');
  const [row] = await db<Array<{ id: string }>>`
    INSERT INTO mcp_grants (user_id, client_id, label, org_scope, scopes, token_hash, expires_at)
    VALUES (${input.userId}, ${input.clientId ?? 'personal'}, ${input.label.slice(0, 80)}, ${input.orgScope}, ${scopes}, ${hashKey(key)}, ${expiresAt})
    RETURNING id
  `;
  return { id: row.id, key, expiresAt };
}

/** Revoke a grant by id (the key stops working on the next request). */
export async function revokeGrant(id: string): Promise<boolean> {
  const rows = await db`UPDATE mcp_grants SET revoked_at = now() WHERE id = ${id} AND revoked_at IS NULL RETURNING id`;
  return rows.length > 0;
}
