import "server-only";
import { siteChannelLoader } from "@elkdonis/channel/site";
import { siteConfig } from "@/config/site";

/**
 * This site's org channel through the shared loader (@elkdonis/channel/site, 2026-11-14).
 * Always siteConfig.orgId; the loader admits an org channel only for its owners and guides, and
 * the /channel route gates on getViewer().canEdit first. `sitePlanProposals` is the `channel-plan`
 * reader for this site's door (lib/channel-door.ts).
 */
const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_PROTO = /^(localhost|127\.0\.0\.1)(:|$)/.test(NETWORK_HOST) ? "http" : "https";

/**
 * This site's own pages are the shop and the Puck pages, so its threads (meetings, posts) live in
 * the network shell, <org>.arts-collective.com/<slug> (2026-11-15; "View live" on a thread).
 */
const loader = siteChannelLoader({
  orgId: siteConfig.orgId,
  threadPath: (t) => (t.orgId === siteConfig.orgId ? `${NETWORK_PROTO}://${siteConfig.orgId}.${NETWORK_HOST}/${t.slug}` : null),
});

export const loadSiteChannel = loader.load;
export const sitePlanProposals = loader.planProposals;
