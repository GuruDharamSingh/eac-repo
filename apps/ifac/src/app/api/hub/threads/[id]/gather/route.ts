import { createGatherRoutes } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { forbidden, getHubViewer } from "@/lib/hub-auth";
import { threadHref } from "@/lib/gather";

/**
 * What a thread holds — the write half, plus the search behind "add something".
 *
 * The verbs are `createGatherRoutes`, shared with every other host; what is
 * stated here is only what is true of IFAC: its org, its membership check and
 * its URL scheme. See gather-route.ts for the two gates (membership to read at
 * all, `canEdit` to change anything) and why the read is members-only.
 */
export const dynamic = "force-dynamic";

export const { GET, POST, DELETE, PATCH } = createGatherRoutes({
  orgId: siteConfig.orgId,
  // IFAC serves the whole Deck API already, so board cards are attachable here.
  deck: true,
  hrefFor: threadHref,
  forbidden,
  async viewer() {
    const viewer = await getHubViewer();
    return viewer ? { userId: viewer.userId, canEdit: viewer.canEdit } : null;
  },
});
