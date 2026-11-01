import { db } from "@elkdonis/db";
import { loadPage, savePage } from "@elkdonis/page-builder/server";

// ============================================================================
// An org's designed landing page.
//
// The page-builder store is org-keyed (`site_config(org_id, 'puck:<slug>')`),
// and this app serves every org, so unlike sunjay's wrapper the org id stays
// an argument. One slug only: `home`, the subdomain root. The three templated
// pages (/offering, /profile, /community) are not designable.
// ============================================================================

import { HOME_SLUG } from "./home-slug";

export { HOME_SLUG };

export const loadOrgHome = (orgId: string, knownTypes?: Set<string>) =>
  loadPage(orgId, HOME_SLUG, knownTypes);

export const saveOrgHome = (orgId: string, data: unknown) => savePage(orgId, HOME_SLUG, data);

/** Whether a designed page exists, without validating or returning it. */
export async function hasOrgHome(orgId: string): Promise<boolean> {
  try {
    const rows = await db<Array<{ one: number }>>`
      SELECT 1 AS one FROM site_config WHERE org_id = ${orgId} AND key = ${`puck:${HOME_SLUG}`} LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** Remove the designed page; the subdomain root goes back to the offering or the default page. */
export async function deleteOrgHome(orgId: string): Promise<boolean> {
  try {
    await db`DELETE FROM site_config WHERE org_id = ${orgId} AND key = ${`puck:${HOME_SLUG}`}`;
    return true;
  } catch (err) {
    console.error("[puck] deleteOrgHome:", err);
    return false;
  }
}
