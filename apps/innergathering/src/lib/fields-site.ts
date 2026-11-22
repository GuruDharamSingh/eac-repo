// The live editor's two server doors on this site (wave 2, 2026-11-20). Server only. One thin bind: the logic is
// @elkdonis/house-editor's `createSiteFields`, shared by every canvas site. Words of a block on a page are saved as ONE
// `set_prop` step through this site's own gated page save (`savePageAction`: owners and guides, the slug rules, the
// resolver keys stripped, the stale-save guard). A card that shows a post offers its title read only here until this site
// depends on the actions package (then pass `performAction`); a gathering or a series is read only for good: no catalogue entry
// renames one, and nothing here writes the threads table.

import { contractOf } from "@elkdonis/blocks/contract";
import { db } from "@elkdonis/db";
import { createSiteFields } from "@elkdonis/house-editor/fields/server";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { savePageAction } from "@/lib/puck/actions";
import { serverBlocks, serverPuckConfig } from "@/lib/puck/config.server";
import { loadPageWithVersion } from "@/lib/puck/store";

export const siteFields = createSiteFields({
  contracts: contractOf(serverBlocks),
  config: serverPuckConfig,
  loadPage: (slug) => loadPageWithVersion(slug),
  save: savePageAction,
  orgId: siteConfig.orgId,
  sql: db,
  authorize: async () => {
    const viewer = await getViewer().catch(() => null);
    if (!viewer) return "Sign in as an editor to change this.";
    return viewer.canEdit ? true : "Only the organisation's editors can change this wording.";
  },
});
