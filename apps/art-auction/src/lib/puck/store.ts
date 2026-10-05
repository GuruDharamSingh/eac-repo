import {
  listPages as listPagesFor,
  loadPage as loadPageFor,
  savePage as savePageFor,
} from "@elkdonis/page-builder/server";
import { siteConfig } from "@/config/site";

// ============================================================================
// This site's designed pages, in `site_config` under org `market`
// (key `puck:<slug>`). Bound here so no route can read or write another org's
// pages by getting one argument wrong. Pages are one segment: `/<slug>`.
//
// There is deliberately no `home` page. `/` is the catalogue (and `/artworks`
// redirects to it), so a designed home would remove the marketplace's front
// door; designed pages are extra rooms beside it.
// ============================================================================

const ORG = siteConfig.marketplaceOrgId;

export const loadPage = (slug: string, knownTypes?: Set<string>) => loadPageFor(ORG, slug, knownTypes);
export const savePage = (slug: string, data: unknown) => savePageFor(ORG, slug, data);
export const listPages = () => listPagesFor(ORG);
