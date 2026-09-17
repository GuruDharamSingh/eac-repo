import {
  listPages as listPagesFor,
  loadPage as loadPageFor,
  savePage as savePageFor,
} from "@elkdonis/page-builder/server";
import { siteConfig } from "@/config/site";

// ============================================================================
// This site's pages.
//
// The store itself is shared and takes the org id as an argument; these three
// lines are where it becomes this site's. Bound here rather than passed at
// every call site so that no route can read or write another org's pages by
// getting one argument wrong.
// ============================================================================

export const loadPage = (slug: string, knownTypes?: Set<string>) =>
  loadPageFor(siteConfig.orgId, slug, knownTypes);

export const savePage = (slug: string, data: unknown) =>
  savePageFor(siteConfig.orgId, slug, data);

export const listPages = () => listPagesFor(siteConfig.orgId);
