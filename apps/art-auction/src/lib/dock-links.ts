import type { ActionLinks } from "@elkdonis/actions";
import { siteConfig } from "@/config/site";

const trim = (url: string | undefined | null) => (url ?? "").replace(/\/$/, "");

/**
 * Where the registry's addresses point from the market (2026-11-24). The market is not
 * the hub: `hub` is the arts-collective origin, so a course step whose control lives
 * on the hub (profile, gain-space, the journeys) opens there, and a lesson link goes
 * to arts-collective's /learn. Market-local addresses are a later pass
 * (docs/open/MARKET_CENTER_AND_DOCK_2026-11-24.md).
 */
export const DOCK_LINKS: ActionLinks = {
  hub: trim(siteConfig.network.artsCollectiveUrl),
  artdirect: trim(siteConfig.network.artdirectUrl),
  networkHost: process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com",
  nextcloud: trim(process.env.NEXT_PUBLIC_NEXTCLOUD_URL) || undefined,
  // This host is the market: entries with a market address (artwork, payouts) route here,
  // so "Take me there" and "Back to the trail" stay on the market (2026-11-24).
  market: "",
};
