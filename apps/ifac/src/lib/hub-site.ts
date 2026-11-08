import "server-only";

// IFAC as a hub card host (docs/open/hub-cards-handoff/PLAN.md §1.2). Builds
// the plain `site` and `viewer` the shared cards take, from this app's config
// and session. When the org-site kit lands, `site` comes from defineSite and
// this file shrinks to a re-export.

import { db } from "@elkdonis/db";
import type { HubSite, HubViewer } from "@elkdonis/hub/contract";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";

export const hubSite: HubSite = {
  orgId: siteConfig.orgId,
  name: siteConfig.orgName,
  mark: siteConfig.shortName,
  domain: siteConfig.domain,
  baseUrl: `https://${siteConfig.domain}`,
  basePath: "",
  timeZone: process.env.SITE_TIME_ZONE ?? "America/Toronto",
  features: {},
};

/** The signed-in person as the cards see them; null when signed out. */
export async function getHubCardViewer(): Promise<HubViewer | null> {
  const viewer = await getViewer();
  if (!viewer) return null;
  const [row] = await db<Array<{ display_name: string | null; is_admin: boolean | null }>>`
    SELECT display_name, is_admin FROM users WHERE id = ${viewer.userId} LIMIT 1
  `;
  return {
    userId: viewer.userId,
    name: row?.display_name || viewer.email,
    role: viewer.role,
    isNetworkAdmin: Boolean(row?.is_admin),
  };
}
