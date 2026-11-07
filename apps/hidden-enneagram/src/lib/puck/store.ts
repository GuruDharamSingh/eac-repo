import {
  listPages as listPagesFor,
  loadPage as loadPageFor,
  savePage as savePageFor,
} from "@elkdonis/page-builder/server";
import { siteConfig } from "@/config/site";

// ============================================================================
// This site's pages (katie's store.ts). The store is shared and takes the org
// id as an argument; these lines are where it becomes The Hidden Enneagram's,
// bound here so no route can read or write another org's pages by getting one
// argument wrong. Pages live in `site_config` under `puck:<slug>`.
// ============================================================================

export const loadPage = (slug: string, knownTypes?: Set<string>) => loadPageFor(siteConfig.orgId, slug, knownTypes);

export const savePage = (slug: string, data: unknown) => savePageFor(siteConfig.orgId, slug, data);

export const listPages = () => listPagesFor(siteConfig.orgId);

/** `/` reads `puck:home`, or DEFAULT_HOME until it is published. */
export const HOME_SLUG = "home";
/** `/enneagram` ("The Figure") reads `puck:enneagram`, or DEFAULT_FIGURE_PAGE. */
export const FIGURE_SLUG = "enneagram";

/** Pages drawn from a code default until one is published (always listed in /studio). */
export const BUILT_IN_SLUGS: ReadonlyArray<{ slug: string; label: string; href: string }> = [
  { slug: HOME_SLUG, label: "Home page", href: "/" },
  { slug: FIGURE_SLUG, label: "The Figure", href: "/enneagram" },
];

/**
 * Addresses a new studio page may not take: this app's own routes (a page
 * there would never be served) and the org's feeds (a page would hide the
 * feed listing). The Silex pages (/introduction, /type-1 ...) are allowed on
 * purpose: publishing a page at one of those addresses replaces the Silex
 * page there, which is how they move into the page builder one at a time.
 */
export const ROUTE_SLUGS: ReadonlySet<string> = new Set([
  "about", "account", "admin", "api", "center", "channel", "edit", "forum", "hub", "login",
  "manage", "services", "signup", "studio", "triads", "unsubscribe", "_next",
]);
