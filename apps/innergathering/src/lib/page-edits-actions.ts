"use server";

import { cleanPatches } from "@elkdonis/direct-edit/block";
import { getViewer } from "@/lib/auth";
import { savePageEdits } from "@/lib/page-edits";

const PAGES = new Set(["home"]);

/** Owners and guides only; the check is here because a client component is not an authorisation boundary. */
export async function savePageEditsAction(page: string, doc: unknown): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to save." };
  if (!viewer.canEdit) return { ok: false, error: "Only owners and guides can change this page." };
  if (!PAGES.has(page)) return { ok: false, error: "This page cannot be edited." };
  // No revalidatePath: the landing reads cookies, so it is rendered per request, and a refresh
  // here would drop the public stylesheet back into the page underneath the open editor.
  return savePageEdits(page, cleanPatches(doc));
}
