/**
 * Slugs no person or organisation may take.
 *
 * One list, three consumers, on purpose: `users.slug` (a person's ArtDirect
 * URL, reused wherever they are published), `organizations.slug` (an org's
 * network subdomain), and the arts-collective middleware's reserved
 * subdomains. They collide in two ways — a person slug equal to a static
 * route shadows that route on ArtDirect's root `/[slug]`, and an org slug
 * equal to an infrastructure host (`artdirect.arts-collective.com` is a
 * separate app, not an org) would claim a hostname the network already uses.
 * Keeping them in one place means adding a route or a subdomain is one edit.
 *
 * Pure module, no imports — the middleware runs on the Edge runtime.
 */

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // Infrastructure / network hosts
  "www",
  "api",
  "admin",
  "app",
  "auth",
  "cloud",
  "edit",
  "meetings",
  "artdirect",
  "market",
  "auction",
  "shop",
  // arts-collective top-level routes
  "hub",
  "sites",
  "artists",
  "directory",
  "account",
  "login",
  "signup",
  "wizard",
  "complete",
  "preview",
  "commitments",
  "inner-temple",
  // ArtDirect static routes (root-level people catch-all)
  "new",
  // The org subdomain's own pages. These are static routes under
  // /sites/[slug]/, and Next resolves static before [contentSlug] — a thread
  // that took one of these slugs would simply be unreachable.
  "offering",
  "profile",
  "community",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}
