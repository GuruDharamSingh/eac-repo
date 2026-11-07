"use server";

/**
 * The dock's one server action (packages/dock; brief §3.3, slice 1): performs an
 * entry the dock offers through this host's `runAction` (`via: 'app'`), so the
 * actor, the org rule and the audit row are the registry's. Limited to the
 * entries the dock shows: course entries and the post entries thread-publish and
 * thread-pin (`isDockAction`).
 */

import { isDockAction } from "@elkdonis/actions/server";
import type { ActionResult } from "@elkdonis/actions";
import { runAction } from "./run";

export async function runDockAction(id: string, input?: unknown, opts: { org?: string | null; subject?: string | null } = {}): Promise<ActionResult> {
  const entry = String(id);
  if (!isDockAction(entry)) return { ok: false, error: "The dock does not offer that.", code: "unknown" };
  return runAction(entry, input, { org: opts?.org ?? null, subject: opts?.subject ?? null });
}
