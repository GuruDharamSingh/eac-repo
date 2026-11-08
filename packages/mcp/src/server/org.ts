/**
 * Which organisation a tool call acts on (PLAN.md §3.2). The grant's org scope
 * is the lock:
 *   - bound grant (one org): an `org` argument must name that org, or be absent;
 *     the call acts on the bound org, never on another;
 *   - unbound grant ('*'): an `org` argument is honoured for the person's own
 *     owner/guide orgs only and is never widened. The registry's
 *     `resolveActionOrg` falls back to the owned org when a claim is refused
 *     (right for a lesson, wrong for an agent), so the claim is settled with
 *     its `siteOrgId` lock, which refuses instead.
 * Channel claims go through `resolveChannelOrg` (owners and guides, never `oad`).
 * No network-admin bypass anywhere.
 */
import { db } from '@elkdonis/db';
import { resolveActionOrg, resolveChannelOrg } from '@elkdonis/actions/server';
import type { McpGrant } from './grants';

export type Settled = { ok: true; orgId: string | null } | { ok: false; error: string };

/** An org named by id or slug → its id, or null. */
export async function orgIdOf(ref: string | null | undefined): Promise<string | null> {
  const r = typeof ref === 'string' ? ref.trim().slice(0, 100) : '';
  if (!r) return null;
  const [o] = await db<Array<{ id: string }>>`SELECT id FROM organizations WHERE id = ${r} OR lower(slug) = lower(${r}) LIMIT 1`;
  return o?.id ?? null;
}

export const boundOrg = (g: McpGrant): string | null => (g.orgScope && g.orgScope !== '*' ? g.orgScope : null);

const FOREIGN = 'This key is limited to another organisation.';
const NOT_YOURS = 'You are not an owner or guide of that organisation.';

/**
 * The org for an `org`-scoped read. `required`: with no claim and no binding,
 * refuse (the agent should name one) rather than guess.
 */
export async function settleOrg(g: McpGrant, claim: unknown, required: boolean): Promise<Settled> {
  const bound = boundOrg(g);
  const named = typeof claim === 'string' && claim.trim() ? claim : null;
  const id = named ? await orgIdOf(named) : null;
  if (named && !id) return { ok: false, error: 'No such organisation.' };
  if (bound && id && id !== bound) return { ok: false, error: FOREIGN };
  const target = bound ?? id;
  if (!target) return required ? { ok: false, error: 'Name the organisation (its id or slug; list_my_orgs lists them).' } : { ok: true, orgId: null };
  const settled = await resolveActionOrg(g.userId, target, { siteOrgId: target });
  return settled ? { ok: true, orgId: settled } : { ok: false, error: NOT_YOURS };
}

/**
 * The channel for a channel read: null = the person's own channel (which carries
 * the orgs they run), allowed for unbound grants only. A bound grant always reads
 * its org's channel, so it cannot see another org's board through the personal one.
 */
export async function settleChannel(g: McpGrant, claim: unknown): Promise<Settled> {
  const bound = boundOrg(g);
  const named = typeof claim === 'string' && claim.trim() ? claim : null;
  const id = named ? await orgIdOf(named) : null;
  if (named && !id) return { ok: false, error: 'No such organisation.' };
  if (bound && id && id !== bound) return { ok: false, error: FOREIGN };
  const target = bound ?? id;
  if (!target) return { ok: true, orgId: null };
  const settled = await resolveChannelOrg(g.userId, target);
  return settled ? { ok: true, orgId: settled } : { ok: false, error: 'You do not run that organisation’s channel.' };
}

/** The orgs the person manages (owner or guide), within the grant's scope. */
export async function managedOrgs(g: McpGrant): Promise<Array<{ id: string; slug: string; name: string; role: string; confirmed: boolean }>> {
  const bound = boundOrg(g);
  const rows = await db<Array<{ id: string; slug: string; name: string; role: string; subdomain_confirmed: boolean }>>`
    SELECT o.id, o.slug, o.name, uo.role, o.subdomain_confirmed
    FROM user_organizations uo JOIN organizations o ON o.id = uo.org_id
    WHERE uo.user_id = ${g.userId} AND uo.role IN ('owner', 'guide')
    ${bound ? db`AND o.id = ${bound}` : db``}
    ORDER BY lower(o.name)
    LIMIT 200
  `;
  return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, role: r.role, confirmed: r.subdomain_confirmed }));
}
