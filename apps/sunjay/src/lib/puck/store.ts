import {
  listPages as listPagesFor,
  loadPage as loadPageFor,
  savePage as savePageFor,
} from "@elkdonis/page-builder/server";
import { withOrg } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

// ============================================================================
// This site's pages.
//
// The store is shared and takes the org id as an argument; these three lines
// are where it becomes Para Theater's. Bound here so that no route can read or
// write another org's pages by getting one argument wrong.
//
// Pages are flat: one segment, `site_config` key `puck:<slug>`. A nested path
// would collide with `/[feed]/[slug]`, the thread route.
// ============================================================================

export const loadPage = (slug: string, knownTypes?: Set<string>) =>
  loadPageFor(siteConfig.orgId, slug, knownTypes);

export const savePage = (slug: string, data: unknown) =>
  savePageFor(siteConfig.orgId, slug, data);

export const listPages = () => listPagesFor(siteConfig.orgId);

/** The home page's slug. `/` reads this document. */
export const HOME_SLUG = "home";

/** Remove a page's stored document. Used to go back to a page as written in code. */
export async function deletePage(slug: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await withOrg(siteConfig.orgId, (sql) => sql`
      DELETE FROM site_config WHERE org_id = ${siteConfig.orgId} AND key = ${`puck:${slug}`}
    `);
    return { ok: true };
  } catch (err) {
    console.error("[puck] deletePage:", err);
    return { ok: false, error: "Could not restore the page." };
  }
}
