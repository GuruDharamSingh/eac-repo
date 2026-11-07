"use server";

/**
 * The one server action that performs any registry entry on this host
 * (@elkdonis/actions; docs/open/LMS_ACTION_LAYER_BRIEF_2026-11-06.md §3.1).
 * The actor is the verified session's user, never anything in `input`:
 * this endpoint serves every entry, so the registry's own checks decide
 * what each one may do.
 *
 * For an org-scoped entry the organisation is resolved here too: `opts.org`
 * is a claim, honoured only when the person may manage that org (owner or
 * guide), else the org they own — the same rule as the lesson's task boxes
 * (lib/lms/connectors.tsx `orgFor`) and /api/actions, shared as
 * `actionOrgId` (packages/actions/src/server/org.ts). The entry's own
 * `allowed` check runs after that, on the org this function settled on.
 *
 * A `thread` entry (thread-edit, thread-publish, thread-pin) names its post in
 * `opts.subject`; performAction loads it and takes the org from the post's row
 * (actionOrgId returns null for that scope). This door is `via: 'app'`, the one
 * from which publishing, pinning and editing a published post are allowed.
 */

import { actionOrgId, performAction } from "@elkdonis/actions/server";
import type { ActionResult } from "@elkdonis/actions";
import { getCurrentUser } from "@/lib/session";

export async function runAction(id: string, input: unknown = undefined, opts: { org?: string | null; subject?: string | null } = {}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first.", code: "auth" };
  const entry = String(id);
  const orgId = await actionOrgId(entry, user.id, opts?.org);
  const subjectId = typeof opts?.subject === "string" && opts.subject.trim() ? opts.subject.trim() : null;
  return performAction(entry, { userId: user.id, email: user.email, orgId, subjectId }, input);
}
