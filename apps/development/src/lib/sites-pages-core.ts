// ============================================================================
// The development organisation's own pages (lane DEV, wave 2): the parts with no gate and no session, so a check can
// run them against the database inside a transaction. The gated doors are in ./sites-pages-actions.ts.
//
// The org `development` (migration 283) belongs to this app: its owners are the network admins who build here, and
// its pages exist so blocks can be tried end to end (made, filled in, restyled, published, changed in place).
// ============================================================================
import { db } from "@elkdonis/db";
import { isValidPagePath, loadDraft, saveDraft, type DraftAuthor } from "@elkdonis/page-builder/server";
import type { PageDoc } from "./sites-door";

/** The organisation this app builds in. */
export const DEV_ORG = "development";

/** A page address from a title, in plain letters and digits ("My First Page!" becomes "my-first-page"), or null. */
export function slugOfTitle(title: string): string | null {
  const slug = String(title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug && isValidPagePath(slug) ? slug : null;
}

/** A new page: its title and no blocks. */
export function newPageDoc(title: string): PageDoc {
  return { root: { props: { title: String(title).trim().slice(0, 120) } }, content: [] };
}

type Sql = typeof db;

/**
 * Start a new page as a DRAFT (nothing is live until it is published). Refused when a page or a draft already has
 * that address. `tx` runs the work on the caller's transaction.
 */
export async function createDraftPage(orgId: string, slug: string, title: string, author: DraftAuthor, o: { tx?: Sql } = {}): Promise<{ ok: boolean; say: string }> {
  const sql = o.tx ?? db;
  if (typeof slug !== "string" || !isValidPagePath(slug)) return { ok: false, say: "That page name is not usable. Use letters, numbers and dashes." };
  const [live] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM site_config WHERE org_id = ${orgId} AND key = ${"puck:" + slug}`;
  if (live && live.n > 0) return { ok: false, say: "There is already a page with that name." };
  if (await loadDraft(orgId, slug, { tx: o.tx })) return { ok: false, say: "There is already a draft with that name." };
  const res = await saveDraft(orgId, slug, { data: newPageDoc(title), base: null, author, note: "A new page, started from nothing.", expected: null }, { tx: o.tx });
  return res.ok ? { ok: true, say: "The new page is started as a draft. Nothing is live yet." } : { ok: false, say: res.error ?? "The page could not be started." };
}
