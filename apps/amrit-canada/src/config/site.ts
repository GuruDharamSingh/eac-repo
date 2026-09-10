/**
 * Single-tenant config. This app serves exactly one org; the deployment is
 * one domain per container (see the brand doc), so orgId is fixed rather than
 * resolved from the Host header.
 *
 * Authorisation is NOT configured here. It comes from user_organizations via
 * hasOrgRole() — see src/lib/auth.ts. The old ownerEmails allowlist was
 * removed in the 2026-07-26 rebuild: email allowlists don't survive contact
 * with a second site, and they ignored the `owner` membership row that
 * migration 067 had already created.
 */
export const siteConfig = {
  orgId: "amrit_canada",
  orgName: "Amrit Canada",
  tagline: "Kundalini Yoga and Sikh Dharma practice in Toronto",
  city: "Toronto",
  /**
   * Deliberately no `venue` or street address here.
   *
   * An earlier version of this config named Guru Ram Das Ashram as the venue
   * and rendered it under the site name on every page. Guru Dharam Singh
   * lives and practises there but holds no mandate from the ashram's board —
   * nor from Lotus Yoga — to present either as connected to this site. Any
   * venue or affiliation wording belongs in editable copy (org_site_sections,
   * via /manage/pages) where the owner controls it, never hardcoded here.
   */
  /** Fallback recipient for guest RSVP notifications when a thread has no author email. */
  fallbackNotifyEmail:
    process.env.AMRIT_CANADA_OWNER_EMAIL ?? "gurudharamsingh@gmail.com",
  /**
   * The network marketplace (art-auction). A member's store lives THERE; this
   * site only shows a window onto it when they switch the "store" section on
   * for their profile (users.profile_sections, migration 105).
   */
  marketplaceUrl: process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009",
} as const;

export type SiteConfig = typeof siteConfig;
