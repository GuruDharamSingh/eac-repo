import type { ReactNode } from "react";
import type { SeriesSite } from "@elkdonis/series-site/config";
import "@elkdonis/series-site/site.css";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { getForumViewer } from "@/lib/forum";

/** The page body for the shared site styles. The root layout draws the header and footer. */
export function SiteShell({ children }: { children: ReactNode }) {
  return <div className="ifs pts">{children}</div>;
}

const NoChrome = () => null;

/** Para Theater's series, on the shared pages and routes (`@elkdonis/series-site`). */
export const seriesSite: SeriesSite = {
  orgId: siteConfig.orgId,
  orgName: siteConfig.orgName,
  shortName: siteConfig.shortName,
  domain: siteConfig.domain,
  tagline: siteConfig.tagline,
  audience: "Para Theater members and followers",
  onlineLabel: "Online",
  alsoZones: [siteConfig.timeZone],
  ownerEmail: siteConfig.fallbackNotifyEmail,
  showRota: false,
  hostHref: ({ slug }) => `/about/${slug}`,
  getViewer,
  getForumViewer,
  chrome: { Shell: SiteShell, Header: NoChrome, Footer: NoChrome },
};
