"use server";

/**
 * The dock's server actions on the market (2026-11-24), the same contract as arts-collective's
 * (apps/arts-collective/src/lib/actions/dock-actions.ts; DOCK_LOOP_SLICE1_2026-11-16.md §4).
 *
 * runDockAction performs an entry the dock offers through the registry's `performAction`
 * (`via: 'app'`), so the actor, the org rule and the audit row are the registry's. Only entries
 * the dock shows (`isDockAction`, never a money entry) and only after the dock's confirm card.
 * The actor is the verified session's user, never anything in `input`.
 *
 * dockDepart / dockReturn / dockChooseCourse / dockAckDone keep the person's place (lms_dock_state).
 * A return path is local to the host that stored it: a trip from the market to a hub address
 * comes back to the hub path, not here (isLocalPath); noted in the Center brief.
 */

import {
  actionOrgId,
  actionStatus,
  dockChoose,
  dockDepart as depart,
  dockMarkDone,
  dockMarkDoneSeen,
  dockReturn as back,
  isDockAction,
  performAction,
  type PerformedEvent,
} from "@elkdonis/actions/server";
import type { ActionResult } from "@elkdonis/actions";
import { settleTasksNaming } from "@elkdonis/lms";
import { getCurrentUser } from "@/lib/marketplace-auth";
import { DOCK_LINKS } from "@/lib/dock-links";

/** After an entry ran, re-check the person's course steps that name it (as arts-collective's lib/lms/completion.ts). */
async function onActionPerformed(e: PerformedEvent): Promise<void> {
  const settled = await settleTasksNaming(
    { userId: e.userId, roles: {} },
    {
      taskId: e.id,
      status: (task) =>
        actionStatus(task.id, { userId: e.userId, orgId: task.scope === "org" ? e.orgId : null, links: DOCK_LINKS, params: task.params ?? null }),
    },
  );
  for (const s of settled) if (s.completedNow) await dockMarkDone(e.userId, s.courseSlug, s.stepSlug);
}

export async function runDockAction(
  id: string,
  input?: unknown,
  opts: { org?: string | null; subject?: string | null; confirmed?: boolean } = {},
): Promise<ActionResult> {
  const entry = String(id);
  if (!isDockAction(entry)) return { ok: false, error: "The dock does not offer that.", code: "unknown" };
  if (opts?.confirmed !== true) return { ok: false, error: "Confirm it first.", code: "input" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first.", code: "auth" };
  const orgClaim = typeof opts?.org === "string" ? opts.org.slice(0, 64) : null;
  const orgId = await actionOrgId(entry, user.id, orgClaim);
  const subjectId = typeof opts?.subject === "string" && opts.subject.trim() ? opts.subject.trim() : null;
  return performAction(entry, { userId: user.id, email: user.email ?? "", orgId, orgClaim, subjectId, onPerformed: onActionPerformed }, input);
}

/** "Take me there": keep where to come back to. `ticket` is null when it could not be kept (the person still goes). */
export async function dockDepart(courseSlug: string, stepSlug: string, returnPath: string): Promise<{ ticket: string | null }> {
  const user = await getCurrentUser();
  if (!user) return { ticket: null };
  return { ticket: await depart(user.id, { courseSlug: String(courseSlug), stepSlug: String(stepSlug), returnPath: String(returnPath) }) };
}

/** "Back to the trail": the path to go back to, or null. */
export async function dockReturn(): Promise<{ href: string | null }> {
  const user = await getCurrentUser();
  return { href: user ? await back(user.id) : null };
}

export async function dockChooseCourse(courseSlug: string): Promise<void> {
  const user = await getCurrentUser();
  if (user) await dockChoose(user.id, String(courseSlug));
}

export async function dockAckDone(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await dockMarkDoneSeen(user.id);
}
