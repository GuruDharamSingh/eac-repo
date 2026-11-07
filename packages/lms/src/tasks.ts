// ============================================================================
// Task steps — "do it on the platform". A `task` step completes by itself when
// the host reports the thing exists (completion mode `derived`). The host owns
// the vocabulary of task ids and the lookups; this file decides when a
// report turns into a completed step, through the same `completeStep` path
// the buttons use, so the outline, Continue and awards see no difference.
// ============================================================================
import type { LmsViewer, PublishedStep, StepTask, TaskStatus } from './types';
import { getLearnerOutline, completeStep } from './record';
import { stepTypeDef } from './step-types';

/** The task a step asks for, or null when it is not a task step. */
export function stepTask(step: Pick<PublishedStep, 'type' | 'settings'>): StepTask | null {
  if (stepTypeDef(step.type).completion !== 'derived') return null;
  const t = step.settings.task;
  if (!t || typeof t.id !== 'string' || !t.id) return null;
  const params = t.params && typeof t.params === 'object'
    ? Object.fromEntries(Object.entries(t.params).filter((e): e is [string, string] => typeof e[1] === 'string'))
    : {};
  return {
    id: t.id,
    scope: t.scope === 'org' ? 'org' : 'person',
    ...(Object.keys(params).length ? { params } : {}),
    ...(t.repeat === 'daily' ? { repeat: 'daily' as const } : {}),
  };
}

export interface SettledTask {
  task: StepTask;
  status: TaskStatus;
  /** True when this call wrote the completion. */
  completedNow: boolean;
  courseCompleted: boolean;
}

/**
 * Before a task step renders: ask the host whether it is done and, if so,
 * record the completion for this learner. Returns null for non-task steps.
 * Never throws — a failed lookup leaves the step as it was.
 */
export async function settleTaskStep(
  viewer: LmsViewer,
  input: { courseId: string; stepSlug: string; status: (task: StepTask) => Promise<TaskStatus> },
): Promise<SettledTask | null> {
  const o = await getLearnerOutline(viewer, { courseId: input.courseId });
  const step = o?.steps.find((s) => s.slug === input.stepSlug);
  if (!o || !step) return null;
  const task = stepTask(step);
  if (!task) return null;
  let status: TaskStatus;
  try {
    status = await input.status(task);
  } catch (err) {
    console.error('[lms] task status:', task.id, err);
    status = { done: false, detail: null };
  }
  const already = step.status === 'completed' || step.status === 'waived';
  // A routine step is done for today only: report it, never record it.
  if (task.repeat || !status.done || already || !o.enrolment || !step.access.allowed) {
    return { task, status, completedNow: false, courseCompleted: false };
  }
  const r = await completeStep(viewer, o.enrolment.id, step.stepId);
  return { task, status, completedNow: r.ok, courseCompleted: r.ok ? r.courseCompleted : false };
}
