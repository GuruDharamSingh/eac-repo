import type { SeriesSite } from "@elkdonis/series-site/config";
import { siteConfig } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { getForumViewer } from "@/lib/forum";
import { getDirectoryProfile } from "@/lib/directory";
import { PublicFooter, PublicHeader, PublicShell } from "@/components/site/chrome";

/** IFAC's series, on the shared pages and routes (`@elkdonis/series-site`). */
export const seriesSite: SeriesSite = {
  orgId: siteConfig.orgId,
  orgName: siteConfig.orgName,
  shortName: siteConfig.shortName,
  domain: siteConfig.domain,
  tagline: siteConfig.tagline,
  audience: "IFAC members and followers",
  onlineLabel: "Online · free",
  alsoZones: ["America/Los_Angeles", "America/New_York", "Europe/Paris"],
  ownerEmail: process.env.NEXT_PUBLIC_IFAC_OWNER_EMAIL ?? "info@ifacgroup.com",
  blankMark: { src: "/ifac-lettering.png", alt: "IFAC" },
  hostHref: ({ slug, tags }) => `/${tags.includes("dealer") ? "dealers" : "artists"}/${slug}`,
  getHostProfile: (slug) => getDirectoryProfile(slug),
  getViewer,
  getForumViewer,
  chrome: { Shell: PublicShell, Header: PublicHeader, Footer: PublicFooter },
};
