import "server-only";
import { db } from "@elkdonis/db";
import { siteChannelLoader } from "@elkdonis/channel/site";
import { channelHubData } from "@elkdonis/channel/hub/server";
import type { ChannelHubData } from "@elkdonis/channel/hub";
import { siteConfig } from "@/config/site";

/**
 * The market's own Channel (Content cornerstone Step 4, 2026-11-26): the shared site loader scoped to the marketplace
 * org (`market`). The loader reads the org's stores (owned by it, or pinned to its site) and lists their artworks as
 * pieces next to the org's threads, so the market's pieces are artworks. It admits an org channel only for a person
 * who is an owner or guide of that org; for anyone else it falls back to their personal channel, which this file
 * refuses (returns null), so a keeper who is not a member of the org simply gets no card.
 *
 * The market has no /channel page of its own: "Open the Channel page" goes to the network's Channel for this org.
 * Threads belong to their owning site, so they carry no market link (`threadPath` answers null).
 */
const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_URL = `${NETWORK_HOST.includes("localhost") ? "http" : "https"}://${NETWORK_HOST}`;

const loader = siteChannelLoader({ orgId: siteConfig.marketplaceOrgId, threadPath: () => null });

/** The reader for the door's `channel-plan` entry. */
export const marketPlanProposals = loader.planProposals;

export async function loadMarketChannel(viewer: { userId: string; email?: string | null }): Promise<ChannelHubData | null> {
  let email = viewer.email ?? "";
  if (!email) {
    const [u] = (await db`SELECT email FROM users WHERE id = ${viewer.userId} LIMIT 1`) as unknown as Array<{ email: string | null }>;
    email = u?.email ?? "";
  }
  const model = await loader.load({ userId: viewer.userId, email });
  // Not scoped to the market org: the person does not run it. No card.
  if (model.identities.length !== 1 || model.identities[0]?.orgId !== siteConfig.marketplaceOrgId) return null;
  return channelHubData(
    model,
    {
      channel: `${NETWORK_URL}/channel?org=${encodeURIComponent(siteConfig.marketplaceOrgId)}`,
      // The seller's edit page for an artwork; the studio home otherwise. No Make into on the market.
      studio: (o = {}) => (o.id && (o.kind === "artwork" || o.kind === "product") ? `/studio/artworks/${o.id}/edit` : "/studio"),
    },
    siteConfig.name,
  );
}
