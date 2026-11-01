/**
 * Single-tenant config. This app serves exactly one org; the deployment is
 * one domain per container, so orgId is fixed rather than resolved from the
 * Host header.
 *
 * Authorisation is NOT configured here. It comes from user_organizations via
 * hasOrgRole() — see src/lib/auth.ts. Guides who run tours hold the `guide`
 * role in this org; the owner(s) hold `owner`.
 *
 * The public name and domain are provisional (2026-10-18): the org row carries
 * the same name, so a rename is this file plus `organizations.name`.
 */
export const siteConfig = {
  orgId: "elktours",
  orgName: "Elkdonis Tours & Experiences",
  tagline: "Guided walks and experiences in Paris",
  city: "Paris",
  /** Fallback recipient for guest notifications when a thread has no author email. */
  fallbackNotifyEmail: process.env.ELKTOURS_OWNER_EMAIL ?? "danamccoolart@gmail.com",
  /**
   * The network marketplace (art-auction). A member's store lives THERE; this
   * site only shows a window onto it when they switch the "store" section on
   * for their profile (users.profile_sections, migration 105).
   */
  marketplaceUrl: process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009",
  /** Tours run on Paris wall-clock time; every date on the site is shown in it. */
  timeZone: "Europe/Paris",
  /** Prices are entered and charged in this currency. */
  currency: "EUR",
  /** The feed slug tour threads are filed under (org_feeds row from migration 208). */
  toursFeed: "tours",
  /** Optional: a Google Maps Platform key switches the Street View slot from a link-out to an embedded panorama. */
  googleMapsKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null,
} as const;

export type SiteConfig = typeof siteConfig;
