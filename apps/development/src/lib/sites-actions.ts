"use server";

// ============================================================================
// What an admin can DO to another organisation's page from the Sites door (lane MACHINES, 2026-11-20).
//
// A machine proposes, a person publishes (doctrine rule 6): a change is never written to the live page. It
// is a list of STEPS (contract C2), applied here, on the server, to the page as stored, and the result is
// kept as the page's DRAFT (contract C3) with the signed-in admin as its author. "Publish" is a separate
// action, offered only for a page whose every block this app could check.
//
// Every action calls `getNetworkAdmin()` first (through adminOrThrow). The org is taken from the page the
// admin opened and must exist; the page store's own validation and sanitising run on save and publish.
// ============================================================================

import { db } from "@elkdonis/db";
import { cleanBoxDoc } from "@elkdonis/direct-edit/block";
import { stripResolvedKeys } from "@elkdonis/blocks/record";
import { discardDraft, isValidPagePath, loadDraft, loadPageWithVersion, publishDraft, saveDraft } from "@elkdonis/page-builder/server";
import { adminOrThrow } from "./sites";
import { applySteps, type PageDoc } from "./sites-door";
import { checkable, hasLegacyZones, unknownTypesOn } from "./sites-contracts";

export interface SiteActionResult {
  ok: boolean;
  /** Plain words for the person at the screen. */
  say: string;
  /** True when the page or its draft changed under the admin: nothing was written. */
  stale?: boolean;
  /** The new draft's save time, to hand back as `draftSavedAt` on the next action. */
  draftSavedAt?: string;
}

/** What the admin's screen started from, so a change made elsewhere in the meantime is noticed. */
export interface SiteBasis {
  /** The published page's version when it was opened; null for a page that is not published yet. */
  liveVersion: string | null;
  /** The waiting draft's `savedAt` when it was opened; null when there was none. */
  draftSavedAt: string | null;
}

const NO_SUCH_ORG = "No such organisation.";
const MAX_STEPS = 60;

async function orgExists(id: unknown): Promise<string | null> {
  if (typeof id !== "string" || id.length === 0 || id.length > 100) return null;
  const [o] = await db<Array<{ id: string }>>`SELECT id FROM organizations WHERE id = ${id} LIMIT 1`;
  return o?.id ?? null;
}

/**
 * Apply steps to the page (its waiting draft if there is one, else the published page) and keep the result
 * as the draft. Refuses the whole list at the first step the page's own blocks refuse, and says why.
 */
export async function saveSiteDraft(orgRef: string, slug: string, steps: unknown[], basis: SiteBasis, note?: string): Promise<SiteActionResult> {
  const admin = await adminOrThrow();
  const orgId = await orgExists(orgRef);
  if (!orgId) return { ok: false, say: NO_SUCH_ORG };
  if (typeof slug !== "string" || !isValidPagePath(slug)) return { ok: false, say: "That page name is not usable." };
  if (!Array.isArray(steps) || steps.length === 0) return { ok: false, say: "There is nothing to save yet." };
  if (steps.length > MAX_STEPS) return { ok: false, say: `Save in smaller pieces: ${MAX_STEPS} changes at most at once.` };

  const [live, draft] = await Promise.all([loadPageWithVersion(orgId, slug), loadDraft(orgId, slug)]);
  if ((live?.updatedAt ?? null) !== (basis?.liveVersion ?? null) || (draft?.savedAt ?? null) !== (basis?.draftSavedAt ?? null)) {
    return { ok: false, stale: true, say: "This page changed since you opened it. Reload it to see the latest, then make your changes again." };
  }
  const start = (draft?.data ?? live?.data) as PageDoc | undefined;
  if (!start) return { ok: false, say: "This page has nothing to change yet." };

  const { contracts, config } = checkable();
  const out = applySteps(start, steps, { contracts, config, allowUnknownTypes: true });
  if (!out.ok) {
    const bad = out.results[out.results.length - 1];
    return { ok: false, say: bad?.say ?? "That change was not accepted." };
  }
  const base = draft ? draft.base : (live?.updatedAt ?? null);
  const keptSteps = [...(draft?.steps ?? []), ...steps].slice(-200);
  const res = await saveDraft(orgId, slug, {
    data: out.doc,
    base,
    // The label names the door, not the person: no address is kept in a page's draft.
    author: { id: admin.userId, kind: "person", label: "Network admin, development app" },
    ...(note ? { note: note.slice(0, 500) } : {}),
    steps: keptSteps,
    // Compare-and-set: what this save started from (the draft it loaded, or none). A draft saved or discarded since is not overwritten.
    expected: draft?.savedAt ?? null,
  });
  if (!res.ok) {
    if (res.code === "draft_changed") return { ok: false, stale: true, say: "Someone saved or removed this page's draft while you were working, so nothing was saved. Reload the page to see theirs, then make your changes again." };
    return { ok: false, say: res.error ?? "The draft could not be saved." };
  }
  const saved = await loadDraft(orgId, slug);
  return { ok: true, say: "Saved as a draft. The published page has not changed.", draftSavedAt: saved?.savedAt };
}

/** Publish the waiting draft. Refused when the page holds a block this app cannot check, or when the page changed since the draft began. */
export async function publishSiteDraft(orgRef: string, slug: string, basis: SiteBasis): Promise<SiteActionResult> {
  await adminOrThrow();
  const orgId = await orgExists(orgRef);
  if (!orgId) return { ok: false, say: NO_SUCH_ORG };
  if (typeof slug !== "string" || !isValidPagePath(slug)) return { ok: false, say: "That page name is not usable." };
  const draft = await loadDraft(orgId, slug);
  if (!draft) return { ok: false, say: "There is no draft waiting to publish." };
  if ((draft.savedAt ?? null) !== (basis?.draftSavedAt ?? null)) {
    return { ok: false, stale: true, say: "The draft changed since you opened it. Reload it and look again before you publish." };
  }
  if (hasLegacyZones(draft.data)) return { ok: false, say: "This page uses an older layout that this app cannot check, so it cannot be published from here." };
  const odd = unknownTypesOn(draft.data);
  if (odd.length) {
    return { ok: false, say: `This page holds blocks this app cannot check (${odd.slice(0, 4).join(", ")}${odd.length > 4 ? ", and more" : ""}), so it cannot be published from here.` };
  }
  const res = await publishDraft(orgId, slug, { clean: (data) => cleanBoxDoc(stripResolvedKeys(data, {})) }); // an empty table: a draft is built from the stored page, which never held resolver output
  if (res.ok) return { ok: true, say: "Published. The draft is cleared." };
  if (res.stale) return { ok: false, stale: true, say: "The published page changed since this draft began, so nothing was published. The draft is kept." };
  return { ok: false, say: res.error ?? "Could not publish." };
}

/** Throw the waiting draft away. The published page is not touched. */
export async function discardSiteDraft(orgRef: string, slug: string): Promise<SiteActionResult> {
  await adminOrThrow();
  const orgId = await orgExists(orgRef);
  if (!orgId) return { ok: false, say: NO_SUCH_ORG };
  if (typeof slug !== "string" || !isValidPagePath(slug)) return { ok: false, say: "That page name is not usable." };
  await discardDraft(orgId, slug);
  return { ok: true, say: "The draft is thrown away. The published page was not touched." };
}
