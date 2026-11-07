import {
  listPages as listPagesFor,
  loadPage as loadPageFor,
  savePage as savePageFor,
} from "@elkdonis/page-builder/server";
import { siteConfig } from "@/config/site";

// ============================================================================
// This site's pages. The store is shared and takes the org id as an argument;
// these lines are where it becomes Katie's, bound here so no route can read
// or write another org's pages by getting one argument wrong. Pages live in
// `site_config` under `puck:<path>`.
// ============================================================================

export const loadPage = (slug: string, knownTypes?: Set<string>) => loadPageFor(siteConfig.orgId, slug, knownTypes);

export const savePage = (slug: string, data: unknown) => savePageFor(siteConfig.orgId, slug, data);

export const listPages = () => listPagesFor(siteConfig.orgId);

/** The landing page's slug: `/` reads `puck:home`, or DEFAULT_HOME until it is published. */
export const HOME_SLUG = "home";

/**
 * Templates: documents that draw generated pages, edited at /studio/<slug>
 * like any page but never served at /<slug> (the catch-all refuses them).
 * `piece-detail` draws every /pieces/<slug> (and /preview/pieces/<slug>).
 */
export const PIECE_TEMPLATE = "piece-detail";
export const TEMPLATE_SLUGS: ReadonlySet<string> = new Set([PIECE_TEMPLATE]);
