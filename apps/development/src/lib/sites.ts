// ============================================================================
// The Sites door: what the development app reads and writes about other organisations' pages.
//
// READING ACROSS ORGANISATIONS IS ALLOWED HERE ONLY because every page of this app, and every function
// in this file and in ./sites-actions.ts, is gated to network (platform) admins: `getNetworkAdmin()`
// (./gate.ts) runs inside each one, not only in the page that calls it. Nothing here may be reached by
// a member, an org owner or an anonymous visitor. The org id always comes from the address the admin
// opened and is checked to exist; it is never taken from a visitor's request on a public route.
//
// Pages come from the page store's own loaders (`listPages`, `loadPageWithVersion`: the row is validated
// on the way out, a malformed row is "no such page", never cast raw). Drafts come from lane DOOR's
// `loadDraft` / `listDrafts`. Titles are the one extra read: a plain SELECT keyed by org.
// ============================================================================
import { db } from "@elkdonis/db";
import { loadDraft, loadPageWithVersion, isValidPagePath, type PageDraft } from "@elkdonis/page-builder/server";
import { getNetworkAdmin, type NetworkAdmin } from "./gate";
import { listSitesFrom, type SiteRow } from "./sites-list";

export type { SiteRow, SitePageRow } from "./sites-list";

/** The signed-in network admin, or an error: the gate for every function of the Sites door. */
export async function adminOrThrow(): Promise<NetworkAdmin> {
  const admin = await getNetworkAdmin();
  if (!admin) throw new Error("Only network admins may use the Sites door.");
  return admin;
}

export async function listSites(): Promise<SiteRow[]> {
  await adminOrThrow();
  return listSitesFrom(db);
}

export interface SitePageData {
  org: { id: string; slug: string; name: string };
  slug: string;
  /** The published document and its version (`updated_at::text`), null when only a draft exists. */
  live: { data: unknown; version: string } | null;
  draft: PageDraft | null;
}

/** One page of one organisation: the published document and any waiting draft. Null when neither exists. */
export async function loadSitePage(orgRef: string, slug: string): Promise<SitePageData | null> {
  await adminOrThrow();
  if (!isValidPagePath(slug)) return null;
  const [org] = await db<Array<{ id: string; slug: string; name: string }>>`SELECT id, slug, name FROM organizations WHERE id = ${orgRef} LIMIT 1`;
  if (!org) return null;
  const [live, draft] = await Promise.all([loadPageWithVersion(org.id, slug), loadDraft(org.id, slug)]);
  if (!live && !draft) return null;
  return { org, slug, live: live ? { data: live.data, version: live.updatedAt } : null, draft };
}
