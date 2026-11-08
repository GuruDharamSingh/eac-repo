/**
 * What a path means on an org's own host (`<org>.arts-collective.com` or an
 * org_domains custom domain), as opposed to the canonical network host.
 *
 * Pure, no imports: the middleware runs on the Edge runtime, and
 * scripts/tenant-paths-check.ts tests this table directly.
 *
 * Until 2026-11-08 a flat PASSTHROUGH_PATHS list rendered `/hub`, `/wizard`,
 * `/directory` and more as the NETWORK's pages on every tenant host. The hub
 * is now a shared, site-bound package (`@elkdonis/hub`), so a tenant host's
 * `/hub` is that org's hub, and network-only consoles hop to the canonical
 * host instead of drawing there (NETWORK_SERVING_ARCHITECTURE §4, D-3).
 *
 * Four outcomes for the first path segment:
 *
 *   network    render the root app route as-is on the tenant host. Only
 *              person- or auth-scoped pages that must work on whatever host
 *              the person signed in on (the session cookie is host-only until
 *              D-4). None of them shows org admin data.
 *   tenant     rewrite onto the org's tree, /sites/<slug>/<path>. This is the
 *              default for any segment not listed here.
 *   canonical  redirect to the same path on the canonical network host.
 *              `withOrg` adds `?org=<slug>` (Channel, Studio, Email, hub
 *              consoles) so the console opens on the org the person came from.
 *   manage     `/manage[/*]` → this host's `/hub` (the kit's rule).
 *
 * `/sites/*` is handled by the middleware before this table (own slug →
 * canonical path, any other slug → 404). `/api`, `/_next/{static,image}` and
 * files never reach middleware (see its matcher); the table still lists `api`
 * and `_next` as network so a matcher change cannot send them into a tree.
 */

export type TenantRoute =
  | { kind: "network" }
  | { kind: "tenant" }
  | { kind: "canonical"; withOrg: boolean }
  | { kind: "manage" };

/** Person- and auth-scoped root routes that render on any host. */
export const TENANT_NETWORK_PATHS: ReadonlySet<string> = new Set([
  // Framework and API paths. The matcher already skips /api and
  // /_next/{static,image}; anything else under /_next (data, HMR) must
  // never be rewritten into an org's tree either.
  "_next",
  "api",
  "login",
  "signup",
  // Auth callbacks / SSO handoff pages (most of auth lives under /api/auth).
  "auth",
  // The signed-in person's own account: their data, not the org's.
  "account",
  // A buyer's private booking link (/bookings/<token>, migration 174).
  "bookings",
]);

/** Network consoles and network content: hop to the canonical host. */
export const TENANT_CANONICAL_PATHS: ReadonlyMap<string, { withOrg: boolean }> = new Map([
  // Consoles that take ?org= (D-3: full Studio opens by hop).
  ["channel", { withOrg: true }],
  ["studio", { withOrg: true }],
  ["email", { withOrg: true }],
  // Network directories and network-only pages.
  ["directory", { withOrg: false }],
  ["artists", { withOrg: false }],
  ["learn", { withOrg: false }],
  ["inner-temple", { withOrg: false }],
  // Network onboarding (artist profile wizard, its completion and commitments).
  ["wizard", { withOrg: false }],
  ["complete", { withOrg: false }],
  ["commitments", { withOrg: false }],
  // Network tools that take a slug of their own (Silex editor, template preview).
  ["edit", { withOrg: false }],
  ["preview", { withOrg: false }],
]);

/** `/hub/<card>` routes the tenant hub draws itself (app/sites/[slug]/hub/*). */
export const TENANT_HUB_CARDS: ReadonlySet<string> = new Set(["members", "review"]);

export function tenantRoute(segments: readonly string[]): TenantRoute {
  const first = segments[0];
  if (!first) return { kind: "tenant" };

  if (first === "hub") {
    // The org's own hub and its card pages. Every other /hub/* is a network
    // console (organization, network, admin, sites/<slug>/design, workshops,
    // store, bookings, analytics…): hop with the org, never draw it here.
    if (segments.length === 1) return { kind: "tenant" };
    if (segments.length === 2 && TENANT_HUB_CARDS.has(segments[1])) return { kind: "tenant" };
    return { kind: "canonical", withOrg: true };
  }

  if (first === "manage") return { kind: "manage" };
  if (TENANT_NETWORK_PATHS.has(first)) return { kind: "network" };

  const hop = TENANT_CANONICAL_PATHS.get(first);
  if (hop) return { kind: "canonical", withOrg: hop.withOrg };

  return { kind: "tenant" };
}
