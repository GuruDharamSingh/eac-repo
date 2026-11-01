// ============================================================================
// Who reads what a learner wrote — checked through the services, against a
// real schema. This is the test for rule 9 of lms/SYNTHESIS.md.
//
// It runs ONLY against a scratch database whose name ends in `_test` and
// refuses anything else. Make one from the live schema (no data):
//
//   docker exec eac-postgres sh -c 'createdb -U postgres lms_test && pg_dump -U postgres -s elkdonis_dev | psql -U postgres -q lms_test'
//
// then run it inside the Sophia container with that database:
//
//   docker exec -e DATABASE_URL=postgresql://postgres:<password>@postgres:5432/lms_test eac-sophia \
//     sh -c "cd /app/packages/lms && pnpm test:visibility"
//
// Actors: a learner and a peer in the same group; the guide NAMED on that
// group; the org's owner (who starts the course, so guides its open run but
// not the group) and a global admin (named nowhere); a signed-in stranger;
// and nobody. The learner writes one entry at every level plus a
// note to the guide, and every reader is checked. Safe to re-run: it owns
// one org and the users at @vis-test.invalid, and removes them first.
// ============================================================================
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '@elkdonis/db';
import {
  acknowledge, createRun, enrol, ensureDefaultRun, getPublishedCourse, listCircleResponses, listGuideQueue, listJournal,
  listMyResponses, listPublicResponses, saveResponse, type LmsViewer, type ResponseKind, type ResponseVisibility,
} from '../src/index.ts';
import { seedCourse } from './seed-lib.mts';

const dbName = new URL(process.env.DATABASE_URL ?? 'postgresql://x/').pathname.slice(1);
if (!dbName.endsWith('_test')) throw new Error(`DATABASE_URL must name a scratch database ending in _test (got "${dbName || '(none)'}")`);

let checks = 0;
const check = (label: string, actual: unknown, expected: unknown) => { assert.deepEqual(actual, expected, label); checks++; };
const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id).sort();

// ── people and an org ───────────────────────────────────────────────────────
const ORG = 'vis_test_org';
await db`DELETE FROM organizations WHERE id = ${ORG}`;
await db`DELETE FROM users WHERE email LIKE '%@vis-test.invalid'`;
await db`INSERT INTO organizations (id, name, slug) VALUES (${ORG}, 'Visibility test org', 'vis-test-org')`;

async function person(name: string): Promise<string> {
  const id = randomUUID();
  await db`INSERT INTO users (id, auth_user_id, email, display_name) VALUES (${id}, ${id}, ${`${name}@vis-test.invalid`}, ${name})`;
  return id;
}
const [learner, peer, guide, owner, admin, stranger] = await Promise.all(['learner', 'peer', 'guide', 'owner', 'admin', 'stranger'].map(person));
const as = (userId: string | null, roles: Record<string, string> = {}, isGlobalAdmin = false): LmsViewer => ({ userId, roles, isGlobalAdmin });
const L = as(learner);
const P = as(peer);
const G = as(guide); // named on the group, no org role
const O = as(owner, { [ORG]: 'owner' }); // runs the org and starts the course; not named on the group
const A = as(admin, {}, true); // global admin, not named
const S = as(stranger);
const N = as(null);
const readers: Array<[LmsViewer, string]> = [[O, 'the org owner'], [A, 'a global admin'], [P, 'a peer'], [S, 'a stranger'], [N, 'nobody']];

// ── a public course with one reflection step, and a guided group ───────────
const { course } = await seedCourse(O, {
  orgId: ORG, slug: 'visibility-test', title: 'Visibility test', summary: 'Who reads what.', visibility: 'public', notes: 'test',
  modules: [{ id: 'm', title: 'One', steps: [{ type: 'reflection', slug: 'ask', title: 'A question', summary: 'Write something.', settings: { prompt: 'Well?' } }] }],
});
const stepId = (await getPublishedCourse(course.slug))!.steps[0].stepId;
const made = await createRun(O, course.id, { title: 'Circle', mode: 'cohort', guideIds: [guide] });
if (made.ok === false) throw new Error(made.error);
const run = made.run;
const eL = await enrol(L, run.id);
const eP = await enrol(P, run.id);
if (eL.ok === false || eP.ok === false) throw new Error('enrol failed');

// ── the learner writes at every level ───────────────────────────────────────
async function write(visibility: ResponseVisibility, kind: ResponseKind = 'reflection'): Promise<string> {
  const r = await saveResponse(L, { enrolmentId: eL.enrolment.id, stepId, body: `${kind} for ${visibility}`, kind, visibility });
  if (r.ok === false) throw new Error(`${visibility}/${kind}: ${r.error}`);
  return r.responseId;
}
const me = await write('me');
const toGuide = await write('guide');
const toCircle = await write('circle');
const toAll = await write('public');
const note = await write('guide', 'note');
const all = [me, toGuide, toCircle, toAll, note].sort();

// ── their own ──────────────────────────────────────────────────────────────
check('the learner sees everything they wrote on the step', ids(await listMyResponses(L, eL.enrolment.id, stepId)), all);
check('the journal holds everything they wrote', ids(await listJournal(L)), all);
check('the guide’s journal holds none of it', ids(await listJournal(G)), []);
check('a peer sees none of it as their own', ids(await listMyResponses(P, eP.enrolment.id, stepId)), []);

// ── the guide queue: only the guide named on the run ───────────────────────
const queue = await listGuideQueue(G);
check('the named guide sees guide, circle, public and the note', ids(queue), [toGuide, toCircle, toAll, note].sort());
check('… and never a private entry', queue.some((r) => r.visibility === 'me'), false);
for (const [who, label] of readers) check(`${label} has an empty guide queue`, ids(await listGuideQueue(who)), []);

// ── answering ───────────────────────────────────────────────────────────────
check('the named guide can answer', (await acknowledge(G, toGuide, { body: 'Seen.' })).ok, true);
check('the named guide cannot answer a private entry', (await acknowledge(G, me, { body: 'Seen.' })).ok, false);
for (const [who, label] of readers) check(`${label} cannot answer`, (await acknowledge(who, toGuide, { body: 'Seen.' })).ok, false);
check('the answer reaches the learner', (await listMyResponses(L, eL.enrolment.id, stepId)).find((r) => r.id === toGuide)!.acknowledgements.length, 1);

// ── the circle: people in the group, and its guide ─────────────────────────
check('a peer in the group sees circle and public entries', ids(await listCircleResponses(P, run.id, stepId)), [toCircle, toAll].sort());
check('the named guide sees the same on the circle panel', ids(await listCircleResponses(G, run.id, stepId)), [toCircle, toAll].sort());
for (const [who, label] of readers.filter(([v]) => v !== P)) check(`${label} sees nothing on the circle panel`, ids(await listCircleResponses(who, run.id, stepId)), []);

// ── the open web ────────────────────────────────────────────────────────────
check('the public page shows only the public entry', ids(await listPublicResponses(stepId)), [toAll]);

// ── the open run is guided by whoever started the course ───────────────────
const open = (await ensureDefaultRun(course))!;
const openStaff = await db<Array<{ user_id: string; role: string }>>`SELECT user_id, role FROM lms_run_staff WHERE run_id = ${open.id}`;
check('the open run names the course’s creator as its guide, and no one else', openStaff.map((r) => [r.user_id, r.role]), [[owner, 'guide']]);
check('asking for the open run again names no one twice', (await ensureDefaultRun(course))!.id, open.id);
check('… and still names only the creator', (await db`SELECT COUNT(*)::int AS n FROM lms_run_staff WHERE run_id = ${open.id}`)[0].n, 1);
const eS = await enrol(S, open.id);
if (eS.ok === false) throw new Error(eS.error);
const sGuide = await saveResponse(S, { enrolmentId: eS.enrolment.id, stepId, body: 'for my guide', visibility: 'guide' });
if (sGuide.ok === false) throw new Error(sGuide.error);
check('on the open run, the creator reads "my guide"', ids(await listGuideQueue(O)), [sGuide.responseId]);
check('… and can answer it', (await acknowledge(O, sGuide.responseId, { body: 'Seen.' })).ok, true);
check('the group’s guide does not read the open run', ids(await listGuideQueue(G)).includes(sGuide.responseId), false);
check('a global admin still reads nothing', ids(await listGuideQueue(A)), []);
check('a global admin still cannot answer', (await acknowledge(A, sGuide.responseId, { body: 'Seen.' })).ok, false);

// ── when the creator is gone, whoever published guides the open run ────────
const { course: orphan } = await seedCourse(as(guide, { [ORG]: 'guide' }), {
  orgId: ORG, slug: 'visibility-orphan', title: 'Orphan', summary: 'Its starter left.', visibility: 'public', notes: 'test',
  modules: [{ id: 'm', title: 'One', steps: [{ type: 'reflection', slug: 'ask', title: 'A question', summary: 'Write something.' }] }],
});
await db`DELETE FROM lms_runs WHERE course_id = ${orphan.id}`;
await db`UPDATE lms_courses SET created_by = NULL WHERE id = ${orphan.id}`;
const orphanOpen = (await ensureDefaultRun(orphan))!;
check('with no creator, the publisher guides the open run', (await db`SELECT user_id FROM lms_run_staff WHERE run_id = ${orphanOpen.id}`).map((r) => r.user_id), [guide]);

// ── a group with no guide named has no one to show "my guide" to ───────────
const bare = await createRun(O, course.id, { title: 'Unguided', mode: 'cohort' });
if (bare.ok === false) throw new Error(bare.error);
const eB = await enrol(S, bare.run.id);
if (eB.ok === false) throw new Error(eB.error);
check('with no guide named, "my guide" is refused', (await saveResponse(S, { enrolmentId: eB.enrolment.id, stepId, body: 'x', visibility: 'guide' })).ok, false);
check('with no guide named, a note to the guide is refused', (await saveResponse(S, { enrolmentId: eB.enrolment.id, stepId, body: 'x', kind: 'note' })).ok, false);
check('with no guide named, "only me" still works', (await saveResponse(S, { enrolmentId: eB.enrolment.id, stepId, body: 'x', visibility: 'me' })).ok, true);

// ── tidy up ─────────────────────────────────────────────────────────────────
await db`DELETE FROM organizations WHERE id = ${ORG}`;
await db`DELETE FROM users WHERE email LIKE '%@vis-test.invalid'`;
await db.end();
console.log(`visibility: ${checks} checks passed`);
