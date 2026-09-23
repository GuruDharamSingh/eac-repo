import { createGatherRoutes } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getApiMember } from "@/lib/auth";
import { threadHref } from "@/lib/gather";

/**
 * What a thread holds — the write half, plus the search behind "add something".
 *
 * The verbs are `createGatherRoutes`, shared with every other host; what is
 * stated here is only what is true of this site: its org, its membership check
 * and its URL scheme. See gather-route.ts for the two gates — membership to
 * read at all (this route resolves living-document links, and those shares are
 * public and writable), `canEdit` to change anything.
 */
export const dynamic = "force-dynamic";

export const { GET, POST, DELETE, PATCH } = createGatherRoutes({
  orgId: siteConfig.orgId,
  // This site serves the Deck board through /api/pipeline, so board cards are
  // attachable here.
  deck: true,
  hrefFor: threadHref,
  async viewer() {
    const viewer = await getApiMember();
    return viewer ? { userId: viewer.userId, canEdit: viewer.canEdit } : null;
  },
});
