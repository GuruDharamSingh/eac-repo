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
} as const;

export type SiteConfig = typeof siteConfig;
