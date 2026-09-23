// ============================================================================
// The unlock engine — one pure function. No I/O, no clock of its own.
// ============================================================================
import type { Access, PublishedStep, StepStatus, UnlockRule } from './types';

export interface UnlockContext {
  /** Every step of the pinned course version, in order. */
  steps: PublishedStep[];
  /** step id → status, for this enrolment. Empty when not enrolled. */
  status: Record<string, StepStatus | undefined>;
  /** What offsets count from. Null when not enrolled. */
  anchorAt: Date | null;
  now: Date;
  /** Staff see everything. */
  bypass?: boolean;
}

const done = (s: StepStatus | undefined) => s === 'completed' || s === 'waived';
const OPEN: Access = { allowed: true, reason: null, unlocksAt: null };

export const DEFAULT_RULE: UnlockRule = { kind: 'sequential' };

export function evaluateAccess(step: PublishedStep, ctx: UnlockContext): Access {
  if (ctx.bypass) return OPEN;
  // Something already begun or done is never taken away again — a new course
  // version or a changed rule must not lock a door behind someone.
  if (ctx.status[step.stepId]) return OPEN;

  const rule = step.unlock ?? DEFAULT_RULE;
  switch (rule.kind) {
    case 'open':
      return OPEN;

    case 'sequential': {
      for (let i = step.index - 1; i >= 0; i--) {
        const prev = ctx.steps[i];
        if (!prev.required) continue;
        return done(ctx.status[prev.stepId])
          ? OPEN
          : { allowed: false, reason: `Opens after “${prev.title}”.`, unlocksAt: null };
      }
      return OPEN; // nothing required comes before it
    }

    case 'after_module': {
      const pending = ctx.steps.find((s) => s.moduleId === rule.moduleId && s.required && !done(ctx.status[s.stepId]));
      if (!pending) return OPEN;
      return { allowed: false, reason: `Opens after “${pending.moduleTitle}”.`, unlocksAt: null };
    }

    case 'date': {
      const at = new Date(rule.at);
      if (Number.isNaN(at.getTime()) || ctx.now >= at) return OPEN;
      return { allowed: false, reason: `Opens ${fmt(at)}.`, unlocksAt: at };
    }

    case 'offset_days': {
      if (!ctx.anchorAt) return { allowed: false, reason: 'Opens after you begin.', unlocksAt: null };
      const at = new Date(ctx.anchorAt.getTime() + rule.days * 86_400_000);
      if (ctx.now >= at) return OPEN;
      return { allowed: false, reason: `Opens ${fmt(at)}.`, unlocksAt: at };
    }

    default:
      // A rule kind from the future: fail open rather than strand someone.
      return OPEN;
  }
}

function fmt(d: Date): string {
  return d.toLocaleDateString('en-CA', { month: 'long', day: 'numeric' });
}
