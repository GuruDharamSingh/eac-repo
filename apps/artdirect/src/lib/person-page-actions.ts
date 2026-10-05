"use server";

import type { Data } from "@puckeditor/core";
import { publishUserPage, saveUserPage } from "@elkdonis/page-builder/server";
import { canEditProfile, getProfileBySlug, publishesWithoutReview } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";
import { PERSON_PAGE_ORG, draftKey, isPersonPageKind, liveKey, stripResolved, type PersonPageKind } from "@/lib/person-pages";

// ============================================================================
// Saving and publishing a person's designed page (profile or featured).
//
// The acting user is read from the session here, never taken from the
// caller; the page being edited is named by slug and the session user must be
// allowed to edit that person (themselves, or a global admin —
// canEditProfile). Publishing goes live at once: `oad` pages are the person's
// own (services `publishesWithoutReview`), unlike an org's store panels.
// ============================================================================

type Result = { ok: boolean; error?: string };

async function authorise(slug: string, kind: unknown): Promise<{ ok: true; userId: string; kind: PersonPageKind } | { ok: false; error: string }> {
  if (!isPersonPageKind(kind)) return { ok: false, error: "Unknown page." };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to save your page." };
  const profile = await getProfileBySlug(slug);
  if (!profile) return { ok: false, error: "That page does not exist." };
  if (!(await canEditProfile(user.id, profile.userId))) {
    return { ok: false, error: "You can only design your own page." };
  }
  return { ok: true, userId: profile.userId, kind };
}

/** Keep work without publishing it: the draft row only. */
export async function savePersonPageDraftAction(slug: string, kind: PersonPageKind, data: Data): Promise<Result> {
  const who = await authorise(slug, kind);
  if (!who.ok) return who;
  return saveUserPage(who.userId, PERSON_PAGE_ORG, draftKey(who.kind), stripResolved(data));
}

/** Put the document live now, and keep the draft in step with it. */
export async function publishPersonPageAction(slug: string, kind: PersonPageKind, data: Data): Promise<Result> {
  const who = await authorise(slug, kind);
  if (!who.ok) return who;
  if (!publishesWithoutReview(PERSON_PAGE_ORG)) {
    return { ok: false, error: "Pages here are reviewed before they go live." };
  }
  const clean = stripResolved(data);
  const live = await publishUserPage(who.userId, PERSON_PAGE_ORG, liveKey(who.kind), clean);
  if (!live.ok) return live;
  const draft = await saveUserPage(who.userId, PERSON_PAGE_ORG, draftKey(who.kind), clean);
  if (!draft.ok) console.error(`[artdirect] publish ${slug}/${who.kind}: live saved, draft not:`, draft.error);
  return { ok: true };
}
