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
/** `/music` reads `puck:music`, or DEFAULT_MUSIC_PAGE. */
export const MUSIC_SLUG = "music";
/** Round 3: `/readings` (the services, then the writing), `puck:readings` or DEFAULT_READINGS_PAGE. */
export const READINGS_SLUG = "readings";
/** Round 3: `/about`, `puck:about` or DEFAULT_ABOUT_PAGE. */
export const ABOUT_SLUG = "about";
/** Round 3: the template around every `/services/<slug>`, `puck:service` or DEFAULT_SERVICE_PAGE. */
export const SERVICE_SLUG = "service";
/** Round 6: the template around every `/<feed>/<slug>` (an article), `puck:post` or DEFAULT_POST_PAGE. */
export const POST_SLUG = "post";
/** Round 6: the template around every `/about/<slug>` (a person), `puck:person` or DEFAULT_PERSON_PAGE. */
export const PERSON_SLUG = "person";

/**
 * Built-in documents drawn at an address other than `/<slug>` (home is `/`;
 * service is every `/services/<slug>`, post every `/<feed>/<slug>`, person
 * every `/about/<slug>`). `[page]` must not also serve them at `/home`,
 * `/service`, `/post` or `/person`.
 */
export const ELSEWHERE_SLUGS: ReadonlySet<string> = new Set([HOME_SLUG, SERVICE_SLUG, POST_SLUG, PERSON_SLUG]);

/** Pages drawn from a code default until one is published (always listed in /studio). */
export const BUILT_IN_SLUGS: ReadonlyArray<{ slug: string; label: string; href: string }> = [
  { slug: HOME_SLUG, label: "Landing (home page)", href: "/" },
  { slug: FIGURE_SLUG, label: "The Enneagram (the exposition)", href: "/enneagram" },
  { slug: READINGS_SLUG, label: "Readings (services and writing)", href: "/readings" },
  { slug: ABOUT_SLUG, label: "About", href: "/about" },
  { slug: SERVICE_SLUG, label: "A service page (every /services/…)", href: "/services" },
  { slug: POST_SLUG, label: "Article page", href: "/writing" },
  { slug: PERSON_SLUG, label: "Person page", href: "/about" },
  { slug: MUSIC_SLUG, label: "Music (the web of music)", href: "/music" },
];

/**
 * Addresses a new studio page may not take: this app's own routes (a page
 * there would never be served), the old exposition and contact addresses
 * (round 3: they redirect) and the org's feeds (a page would hide the feed
 * listing). "about" left this list in round 3: /about is a built-in page.
 */
export const ROUTE_SLUGS: ReadonlySet<string> = new Set([
  "account", "admin", "api", "center", "channel", "edit", "forum", "hub", "login",
  "manage", "services", "signup", "studio", "triads", "unsubscribe", "_next",
  // Round 3: redirected to /enneagram and /#contact (next.config.ts), so a page there would never show.
  "introduction", "centers", "contact",
  "type-1", "type-2", "type-3", "type-4", "type-5", "type-6", "type-7", "type-8", "type-9",
]);
