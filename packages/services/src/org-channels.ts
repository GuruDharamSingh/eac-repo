/**
 * Org channels (migration 221, 2026-11-01): which outside accounts belong
 * to an organisation. Pointers only; the tokens stay in the members' own
 * connections. An owner or guide sets them from a connection that holds
 * the account, and a post filed under the org may go only to a listed
 * channel, through the clicking member's own connection.
 */

import { db } from '@elkdonis/db';
import { hasOrgRole } from './org-membership';

export type ChannelProvider = 'meta' | 'instagram' | 'threads' | 'youtube';

export interface OrgChannel {
  orgId: string;
  provider: ChannelProvider;
  externalId: string;
  label: string;
}

export async function listOrgChannels(orgId: string): Promise<OrgChannel[]> {
  const rows = await db<Array<{ org_id: string; provider: ChannelProvider; external_id: string; label: string }>>`
    SELECT org_id, provider, external_id, label FROM org_channels WHERE org_id = ${orgId} ORDER BY created_at
  `;
  return rows.map((r) => ({ orgId: r.org_id, provider: r.provider, externalId: r.external_id, label: r.label }));
}

/** Every channel of every org the person belongs to as owner or guide (the Connections tab's picker). */
export async function listChannelsForManager(userId: string): Promise<OrgChannel[]> {
  const rows = await db<Array<{ org_id: string; provider: ChannelProvider; external_id: string; label: string }>>`
    SELECT c.org_id, c.provider, c.external_id, c.label
    FROM org_channels c
    JOIN user_organizations uo ON uo.org_id = c.org_id AND uo.user_id = ${userId} AND uo.role IN ('owner', 'guide')
    ORDER BY c.created_at
  `;
  return rows.map((r) => ({ orgId: r.org_id, provider: r.provider, externalId: r.external_id, label: r.label }));
}

/**
 * Set or clear a channel. The caller has checked that the person's own
 * connection holds `externalId`; this checks they may speak for the org.
 */
export async function setOrgChannel(
  userId: string,
  input: { orgId: string; provider: ChannelProvider; externalId: string; label?: string; on: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await hasOrgRole(userId, input.orgId, ['owner', 'guide']))) {
    return { ok: false, error: 'Only an owner or guide of that organisation can set its channels.' };
  }
  if (input.on) {
    await db`
      INSERT INTO org_channels (org_id, provider, external_id, label, set_by)
      VALUES (${input.orgId}, ${input.provider}, ${input.externalId}, ${input.label ?? ''}, ${userId})
      ON CONFLICT (org_id, provider, external_id) DO UPDATE SET label = EXCLUDED.label, set_by = EXCLUDED.set_by
    `;
  } else {
    await db`DELETE FROM org_channels WHERE org_id = ${input.orgId} AND provider = ${input.provider} AND external_id = ${input.externalId}`;
  }
  return { ok: true };
}

/** Is this account one of the org's channels? */
export async function isOrgChannel(orgId: string, provider: ChannelProvider, externalId: string): Promise<boolean> {
  const rows = await db`SELECT 1 FROM org_channels WHERE org_id = ${orgId} AND provider = ${provider} AND external_id = ${externalId}`;
  return rows.length > 0;
}
