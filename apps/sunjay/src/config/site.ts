/**
 * Single-tenant config. This app serves exactly one org; the deployment is
 * one domain per container, so orgId is fixed rather than resolved from the
 * Host header.
 *
 * Authorisation is NOT configured here. It comes from user_organizations via
 * hasOrgRole() — see src/lib/auth.ts. No email allowlists: they don't survive
 * contact with a second site and they ignore the `owner` membership row.
 *
 * This app replaces `apps/blog-sunjay`, a Mantine-era blog that served the
 * same org. Nothing of it is carried over but the bio copy, which moved into
 * the database (org_profiles) where its subject can edit it.
 */
export const siteConfig = {
  orgId: "sunjay",
  orgName: "Para Theater",
  tagline: "Rock balancing, qi gong, and conscious creativity",
  /**
   * The person this site is about. The landing page's bio card and social
   * links are read from this user's network profile, so a bio written on
   * ArtDirect or any other EAC surface arrives here complete.
   *
   * Stored as a slug, not an id: `users.slug` is stable and readable, and
   * the same lookup (`getProfileBySlug`) every other site uses takes one.
   */
  guideSlug: "rev-dr-sunjye-fnord-p-p-p-i-ulc-ac",
  /**
   * What to call him in running copy ("From Sunjay").
   *
   * Explicit, because his display name is
   * "Rev Dr suNjye Fnord P.P. P.I. ulc. AC." and there is no rule that gets a
   * name out of it — taking the first word yields "Rev", which is a title.
   * A person's short name is a fact to be told, not derived.
   */
  guideShortName: "Sunjay",
  /** Fallback recipient for guest RSVP notifications when a thread has no author email. */
  fallbackNotifyEmail: process.env.SUNJAY_OWNER_EMAIL ?? "fnordj@gmail.com",
  /**
   * The network marketplace (art-auction). A member's store lives THERE; this
   * site only shows a window onto it when the "store" section is switched on
   * for their profile (users.profile_sections, migration 105).
   */
  marketplaceUrl: process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009",
  /** The collective this site belongs to — rendered in the social links row. */
  collectiveUrl: "https://elkdonis-arts.org",
} as const;

export type SiteConfig = typeof siteConfig;
