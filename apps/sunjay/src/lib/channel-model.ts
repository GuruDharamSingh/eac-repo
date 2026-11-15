import { siteChannelLoader } from "@elkdonis/channel/site";
import { siteConfig } from "@/config/site";
import { threadHref } from "@/lib/gather";

/**
 * This site's org channel through the shared loader (@elkdonis/channel/site, 2026-11-14).
 * Always siteConfig.orgId; the loader admits an org channel only for its owners and guides, and
 * the /channel route gates on getViewer().canEdit first. `sitePlanProposals` is the `channel-plan`
 * reader for this site's door (lib/channel-door.ts).
 */
// Threads live where the site links them (lib/gather.ts threadHref: /<feed>/<slug>), 2026-11-15.
const loader = siteChannelLoader({ orgId: siteConfig.orgId, threadPath: (t) => threadHref(t) });

export const loadSiteChannel = loader.load;
export const sitePlanProposals = loader.planProposals;
