/**
 * Single-tenant config. One org, one domain, one container — so orgId is
 * fixed here rather than resolved from the Host header.
 *
 * The org row `fourth_way_book_readers` already existed (it predates this app;
 * an earlier stub at apps/fourth-way-book-readers pointed at it). This site is
 * that org's public face, so it reuses the id rather than minting a second one
 * with the same name.
 *
 * Authorisation is NOT configured here. It comes from user_organizations via
 * getOrgRole() — see src/lib/auth.ts. No email allowlists.
 */
export const siteConfig = {
  orgId: "fourth_way_book_readers",
  orgName: "Fourth Way Book Readers",
  shortName: "Fourth Way Book Readers",
  tagline: "A reading circle that reads aloud",
  /**
   * The line under the two-column split. Editable copy overrides it from
   * org_site_sections key `mission` — this is only the fallback.
   */
  missionLine:
    "Fourth Way Book Readers wants to improve the structure of reading sessions, and believes Fourth Way philosophy fits that purpose.",
  timeZone: "America/Toronto",
  /** Fallback recipient for guest RSVP notifications when a thread has no author email. */
  fallbackNotifyEmail: process.env.FOURTHWAY_OWNER_EMAIL ?? null,
  marketplaceUrl: process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009",
} as const;

export type SiteConfig = typeof siteConfig;
