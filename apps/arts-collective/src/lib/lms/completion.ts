import { actionStatus, dockMarkDone, type PerformedEvent } from "@elkdonis/actions/server";
import { settleTasksNaming } from "@elkdonis/lms";
import { ACTION_LINKS } from "@/lib/actions/links";

/**
 * Pushed completion (docs/open/mcp-foundations/DOCK_LOOP_SLICE1_2026-11-16.md §4.5): after the registry
 * performed an entry for a person, re-check the course steps of theirs that name it. The step's status
 * stays authoritative (`actionStatus`): nothing ticks unless it says done. A step ticked here is
 * remembered in lms_dock_state so the dock shows its Done card once.
 * Passed to performAction as `onPerformed` by ./actions/run.ts and ./actions/routes.ts.
 */
export async function onActionPerformed(e: PerformedEvent): Promise<void> {
  const settled = await settleTasksNaming(
    { userId: e.userId, roles: {} },
    { taskId: e.id, status: (task) => actionStatus(task.id, { userId: e.userId, orgId: task.scope === "org" ? e.orgId : null, links: ACTION_LINKS, params: task.params ?? null }) },
  );
  for (const s of settled) if (s.completedNow) await dockMarkDone(e.userId, s.courseSlug, s.stepSlug);
}
