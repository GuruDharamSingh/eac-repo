"use server";

/**
 * The dock's server actions (packages/dock; brief §3.3, slice 1; DOCK_LOOP_SLICE1_2026-11-16.md §4).
 *
 * runDockAction performs an entry the dock offers through this host's `runAction` (`via: 'app'`), so the
 * actor, the org rule and the audit row are the registry's. Limited to the entries the dock shows (course
 * entries, post entries, channel moves: `isDockAction`; never a money entry) and only after the dock's
 * confirm card (`confirmed: true`). That is policy for the UI path, not a boundary against the person:
 * they can do the same in the console.
 *
 * dockDepart / dockReturn / dockChoose / dockAckDone keep the person's place (lms_dock_state).
 */

import { dockChoose, dockDepart as depart, dockMarkDoneSeen, dockReturn as back, isDockAction } from "@elkdonis/actions/server";
import type { ActionResult } from "@elkdonis/actions";
import { getCurrentUser } from "@/lib/session";
import { runAction } from "./run";

export async function runDockAction(
  id: string,
  input?: unknown,
  opts: { org?: string | null; subject?: string | null; confirmed?: boolean } = {},
): Promise<ActionResult> {
  const entry = String(id);
  if (!isDockAction(entry)) return { ok: false, error: "The dock does not offer that.", code: "unknown" };
  if (opts?.confirmed !== true) return { ok: false, error: "Confirm it first.", code: "input" };
  return runAction(entry, input, { org: opts?.org ?? null, subject: opts?.subject ?? null });
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
