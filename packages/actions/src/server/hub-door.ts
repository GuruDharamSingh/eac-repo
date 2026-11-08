// The site-bound door for hub cards (architect review, 2026-11-08). A host
// mounts a 3-line 'use server' action:
//
//   'use server';
//   export async function runHubAction(id: string, input: unknown) {
//     return performHubAction(site, await sessionActor(), id, input, HUB_ALLOW);
//   }
//
// and hands it to the card as HubCardHost.act. This door:
//   - serves only `allow` (the mounted cards' `actions`): the allow-list;
//   - binds the org to the site (resolveActionOrg siteOrgId mode): a guide who
//     owns another org never writes there from this site;
//   - records via 'app', so the audit row is the person ('human'), and appOnly
//     entries may run (the HTTP routes and agents can't).
import type { ActionResult } from '../types';
import { resolveActionOrg } from './org';
import { performAction } from './run';

export interface HubDoorActor {
  userId: string;
  email: string;
}

export async function performHubAction(
  site: { orgId: string },
  actor: HubDoorActor | null,
  id: string,
  input: unknown,
  allow: readonly string[],
): Promise<ActionResult> {
  if (!actor?.userId) return { ok: false, error: 'Sign in first.', code: 'auth' };
  if (!allow.includes(id)) return { ok: false, error: 'This cannot be done from here.', code: 'unknown' };
  const orgId = await resolveActionOrg(actor.userId, site.orgId, { siteOrgId: site.orgId });
  if (!orgId) return { ok: false, error: 'Only the organisation’s owners and guides can change this.', code: 'forbidden' };
  return performAction(id, { userId: actor.userId, email: actor.email, orgId, siteOrgId: site.orgId, via: 'app' }, input);
}
