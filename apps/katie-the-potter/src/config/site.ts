/**
 * Single-tenant config, following apps/danamccool/src/config/site.ts: this
 * app serves exactly one org (one container, one domain), so orgId is fixed
 * rather than resolved from the Host header.
 *
 * Authorisation is NOT configured here. It comes from user_organizations via
 * getOrgRole() — see src/lib/auth.ts. Katie is seeded as `owner` of this org
 * by packages/db/migrations/243_katie_the_potter.sql, keyed by the email
 * below, which is a no-op until she signs up with that address.
 */
export const siteConfig = {
  orgId: "katie-the-potter",
  orgSlug: "katie-the-potter",
  orgName: "Katie the Potter",
  shortName: "Katie",
  tagline: "Ceramics, thrown and glazed by hand",
  /**
   * PLACEHOLDER until Katie's real address is known. Change the env var (and
   * the migration's email) — not this file — when it is.
   */
  ownerEmail: process.env.NEXT_PUBLIC_KATIE_THE_POTTER_OWNER_EMAIL ?? "katie@katiethepotter.example",
  /**
   * The network marketplace (art-auction, "Collect Art"). Her pieces are
   * listed in her store there, so "Buy / enquire" on this site goes to the
   * marketplace's own page for the piece — one checkout for the whole
   * network, no cart here.
   */
  marketUrl: process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "https://market.arts-collective.com",
  artdirectUrl: process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "https://artdirect.arts-collective.com",
  /** `?from=` on every marketplace link, so the marketplace can send people back. */
  marketRef: "katie-the-potter",
  /**
   * This site's own public origin (build-baked NEXT_PUBLIC_APP_URL). Stripe's
   * success/cancel URLs and every link in a confirmation are built from it,
   * never from the marketplace's. See lib/origin.ts for the localhost guard.
   */
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3023",
  /** How long an eTransfer order is held for the buyer. */
  etransferDueHours: 72,
  /**
   * Where Stripe's page lets a "Buy now" / "Pay now" buyer ship to (ISO
   * alpha-2). Canada and the US until Katie says otherwise; shipping itself is
   * arranged after payment (docs/SHIPPING_PLAN.md).
   */
  shipToCountries: ["CA", "US"],
} as const;

export type SiteConfig = typeof siteConfig;
