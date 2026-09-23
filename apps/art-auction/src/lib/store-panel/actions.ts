"use server";

import type { Data } from "@puckeditor/core";
import { saveUserPage } from "@elkdonis/page-builder/server";
import { submitUserPage, orgHostsStorePanels } from "@elkdonis/services";
import { getCurrentUserId } from "@/lib/marketplace-auth";

// ============================================================================
// Writing a store panel. Two actions, matching user_pages' own model: saving
// is always allowed and never changes status past draft (saveUserPage's own
// rule); submitting is the one step that asks the org to look, and only
// works at all when the org has opted in (member_store_panels).
//
// A client component is not an authorisation boundary, so both actions read
// the viewer from the session themselves rather than trusting a userId a
// caller might pass — the same posture every server action in this repo
// takes for the write it performs.
// ============================================================================

/**
 * PuckEditor's onPublish hands back (slug, data) — slug here is just the
 * page KEY ("store:1"); orgId is closed over by the client wrapper's own
 * arrow function at the call site, not threaded through Puck at all.
 */
export async function saveStorePanel(
  orgId: string,
  key: string,
  data: Data
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Sign in required." };
  return saveUserPage(userId, orgId, key, data);
}

export async function submitStorePanel(
  orgId: string,
  key: string
): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Sign in required." };
  if (!(await orgHostsStorePanels(orgId))) {
    return { ok: false, error: "This organisation does not host designed store panels." };
  }
  return submitUserPage(userId, orgId, key);
}
