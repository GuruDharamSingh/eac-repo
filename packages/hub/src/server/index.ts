import 'server-only';

// @elkdonis/hub/server: loaders and the capability resolver. Server-only, so
// a face never pulls database code. Card loaders land in passes 1 and 3.

import type { HubSite } from '../contract';

export type GrantLookup = (orgId: string, key: string) => Promise<boolean>;

/**
 * The one capability rule (architect, 2026-11-08):
 *   site.features[key]   the code ceiling (absent = on)
 *   ∧ org_grants          for granted keys such as 'nextcloud_access'
 *   ∧ org_capabilities    once that table exists (default on with no row)
 * Today it reads the first two. Adding the table later is a change to this file only.
 */
export async function capabilityOn(
  site: HubSite,
  key: string,
  deps: { hasGrant: GrantLookup; granted: ReadonlySet<string> },
): Promise<boolean> {
  if (site.features[key] === false) return false;
  if (deps.granted.has(key) && !(await deps.hasGrant(site.orgId, key))) return false;
  return true;
}

/** Keys that need an org_grants row (the table's CHECK allows only these today). */
export const GRANTED_CAPABILITIES: ReadonlySet<string> = new Set(['nextcloud_access']);
