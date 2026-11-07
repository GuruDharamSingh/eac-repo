/**
 * Single-tenant config: this app serves exactly one org (one container, one
 * domain, hiddenenneagram.com), so orgId is fixed rather than resolved from
 * the Host header. Authorisation is NOT configured here: it comes from
 * user_organizations via getOrgRole() (src/lib/auth.ts). Ario
 * (aeon.g963@gmail.com) owns the org (migration 080).
 */
export const siteConfig = {
  orgId: "hidden-enneagram",
  orgSlug: "hidden-enneagram",
  orgName: "The Hidden Enneagram",
  tagline: "A map of nine fixations",
  /** Display name shown to buyers in payment instructions and emails. */
  payeeName: process.env.HIDDEN_ENNEAGRAM_PAYEE_NAME ?? "The Hidden Enneagram",
  /** Where a buyer sends the eTransfer — not stored in the DB. */
  payoutEmail: process.env.HIDDEN_ENNEAGRAM_PAYOUT_EMAIL ?? "info@elkdonis-arts.org",
  /** This site's own public origin (build-baked NEXT_PUBLIC_APP_URL). */
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3012",
  /**
   * Ario's course on Sophia, the network's learning host. Canonical host is
   * sophia.elkdonis-arts.org (sophia.arts-collective.com answers 404). The
   * course is `unlisted`: reachable by link, not listed. Ario decides whether
   * it goes public; this site only links to it.
   */
  sophiaUrl: (process.env.NEXT_PUBLIC_SOPHIA_URL ?? "https://sophia.elkdonis-arts.org").replace(/\/+$/, ""),
  courseSlug: "enneagram-foundations",
  /** The network marketplace (Collect Art), for the Center's links. */
  marketplaceUrl: process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "https://market.arts-collective.com",
  /** Ario works from Los Angeles; the Center's dates read in his zone. */
  timeZone: "America/Los_Angeles",
};

/** The course's public address on Sophia (a step slug goes after it). */
export function courseUrl(step?: string): string {
  const base = `${siteConfig.sophiaUrl}/${siteConfig.courseSlug}`;
  return step ? `${base}/${encodeURIComponent(step)}` : base;
}
