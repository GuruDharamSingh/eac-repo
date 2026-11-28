import type { ReactNode } from "react";
import type { Metadata } from "next";
import { releaseExpiredOrders, settleExpiredLots } from "@elkdonis/commerce/server";
import { requireKeeper } from "@/lib/marketplace-auth";
import { siteConfig } from "@/config/site";
import { HubSurfaces } from "./_components/hub-surfaces";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hub" };

/**
 * /hub: the market's keepers (owners of the market org and network admins), replacing /admin. The same gate and
 * the same per-visit housekeeping as /admin's layout (lapsed payment windows, finished auctions).
 */
export default async function HubLayout({ children }: { children: ReactNode }) {
  await requireKeeper();
  await Promise.all([
    releaseExpiredOrders().catch(() => 0),
    settleExpiredLots({ payUrlBase: siteConfig.url }).catch(() => null),
  ]);
  return <HubSurfaces>{children}</HubSurfaces>;
}
