/**
 * Single-tenant config, following amrit-canada/ifac's src/config/site.ts
 * convention — this app serves exactly one org (one container, one domain),
 * so orgId is fixed rather than resolved from the Host header.
 *
 * Authorisation is NOT configured here. It comes from user_organizations via
 * getOrgRole() — see src/lib/auth.ts. Dana is seeded as 'owner' of this org
 * by packages/db/migrations/125_danamccool.sql, the same shape migration 067
 * used for her surrealistwriting org.
 */
export const siteConfig = {
  orgId: "danamccool",
  orgSlug: "danamccool",
  orgName: "Dana McCool",
  shortName: "Dana McCool",
  tagline: "Artist",
  ownerEmail: process.env.NEXT_PUBLIC_DANAMCCOOL_OWNER_EMAIL ?? "danamccoolart@gmail.com",
  /** Cross-network links her real nav points at (ELKDONIS ARTS, IFAC / ART COLLECTORS). */
  elkdonisArtsUrl: process.env.NEXT_PUBLIC_ELKDONIS_ARTS_URL ?? "http://localhost:3005",
  ifacUrl: process.env.NEXT_PUBLIC_IFAC_URL ?? "http://localhost:3008",
  ifacProfilePath: "/artists/danamccool",
  /**
   * The network marketplace (art-auction). Her artworks are listed in her
   * store there, so "Enquire / buy" on this site goes to the marketplace's
   * own page for the piece — one checkout for the whole network, not a second
   * one here.
   */
  marketUrl: process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "https://market.arts-collective.com",
  /**
   * Site-wide "in progress" gate — the site just went live on danamccool.com
   * before it's ready for the public. Read at request time (root layout is
   * `force-dynamic`), so flipping it back off later is a container restart,
   * not a rebuild. See src/lib/auth.ts's `canBypassComingSoon`.
   */
  comingSoon: process.env.DANAMCCOOL_COMING_SOON === "true",
} as const;

export type SiteConfig = typeof siteConfig;
