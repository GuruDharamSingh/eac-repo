// Pure tests for the unlock engine. Run: pnpm --filter @elkdonis/lms test:unlock
import assert from 'node:assert/strict';
import { evaluateAccess } from '../src/unlock.ts';
import type { PublishedStep, UnlockRule } from '../src/types.ts';

const mk = (i: number, moduleId: string, unlock: UnlockRule, required = true): PublishedStep => ({
  stepId: `s${i}`, stepVersionId: `v${i}`, slug: `s${i}`, type: 'reading', moduleId, moduleTitle: `Module ${moduleId}`, index: i,
  required, unlock, title: `Step ${i}`, summary: null, bodyHtml: null, settings: {}, refs: {},
});
const steps = [
  mk(0, 'a', { kind: 'sequential' }),
  mk(1, 'a', { kind: 'sequential' }, false), // optional
  mk(2, 'a', { kind: 'sequential' }),
  mk(3, 'b', { kind: 'after_module', moduleId: 'a' }),
  mk(4, 'b', { kind: 'offset_days', days: 7 }),
  mk(5, 'b', { kind: 'date', at: '2030-01-01T00:00:00Z' }),
  mk(6, 'b', { kind: 'open' }),
];
const now = new Date('2026-09-18T12:00:00Z');
const ctx = (status: Record<string, 'started' | 'completed' | 'waived'>, anchorAt: Date | null = now) => ({ steps, status, anchorAt, now });

assert.equal(evaluateAccess(steps[0], ctx({})).allowed, true, 'first step is open');
assert.equal(evaluateAccess(steps[2], ctx({})).allowed, false, 'sequential waits for the previous required step');
assert.match(evaluateAccess(steps[2], ctx({})).reason!, /Step 0/, 'and names it — skipping the optional one');
assert.equal(evaluateAccess(steps[1], ctx({ s0: 'completed' })).allowed, true);
assert.equal(evaluateAccess(steps[2], ctx({ s0: 'completed' })).allowed, true, 'an optional step never blocks');
assert.equal(evaluateAccess(steps[2], ctx({ s0: 'waived' })).allowed, true, 'waived counts as done');
assert.equal(evaluateAccess(steps[3], ctx({ s0: 'completed' })).allowed, false, 'after_module waits for every required step');
assert.equal(evaluateAccess(steps[3], ctx({ s0: 'completed', s2: 'completed' })).allowed, true);
const off = evaluateAccess(steps[4], ctx({}));
assert.equal(off.allowed, false);
assert.equal(off.unlocksAt?.toISOString(), '2026-09-25T12:00:00.000Z', 'offset counts from the anchor');
assert.equal(evaluateAccess(steps[4], ctx({}, new Date('2026-09-01T00:00:00Z'))).allowed, true);
assert.equal(evaluateAccess(steps[4], ctx({}, null)).allowed, false, 'no anchor, no offset');
assert.equal(evaluateAccess(steps[5], ctx({})).allowed, false);
assert.equal(evaluateAccess(steps[6], ctx({})).allowed, true);
assert.equal(evaluateAccess(steps[5], ctx({ s5: 'started' })).allowed, true, 'a door already opened is never locked again');
assert.equal(evaluateAccess(steps[5], { ...ctx({}), bypass: true }).allowed, true, 'staff see everything');
assert.equal(evaluateAccess({ ...steps[2], unlock: { kind: 'from_the_future' } as never }, ctx({})).allowed, true, 'an unknown rule fails open');
console.log('unlock: 17 assertions passed');
