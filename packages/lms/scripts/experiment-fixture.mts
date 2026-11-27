// ============================================================================
// Fixture for the EXPERIMENT preset: makes (or reuses) a small experiment in org `sunjay` with the
// TEST accounts only, using ENGINE FUNCTIONS only (no raw SQL writes). Safe to re-run.
//   guide A B are the three test users named in the PM brief.
// ============================================================================
import {
  agreeToParticipation, createWorkspaceInvite, listWorkspaceInvites, redeemWorkspaceInvite, revokeWorkspaceInvite, createWorkspace, decidePublication, getCourseBySlug, getWorkspaceView, listMyPublicationRequests, listOngoingSessions,
  listResultCandidates, listResults, requestPublication, saveIntervalEntry, saveOngoingSession, saveResultDraft, setWorkspaceEntryVisibility, type LmsViewer,
} from '../src/index.ts';

export const ORG = 'sunjay';
export const GUIDE_ID = 'bb77984c-0bdc-4e47-bb39-33dae6723794';
export const A_ID = 'e6bf54d9-ea1a-4549-b6d7-0df01f71d6f9';
export const B_ID = '7a75e3ce-02f0-4f6c-80d2-40dcaa979872';
export const NOROLE_ID = '15320221-b197-4de3-a3cb-57e16e5a7d4a';

export const guide: LmsViewer = { userId: GUIDE_ID, roles: { [ORG]: 'guide' } };
export const A: LmsViewer = { userId: A_ID, roles: { [ORG]: 'member' } };
export const B: LmsViewer = { userId: B_ID, roles: { [ORG]: 'member' } };
export const stranger: LmsViewer = { userId: NOROLE_ID, roles: {} };

const DAY = 86_400_000;
export const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

export interface Fixture { slug: string; runId: string; moduleId: string; resultId: string; items: Record<string, string>; created: boolean }

/** Words that mark each seeded entry, so they can be found again. */
export const WORDS = { a3: 'A-day3 shared: breath slowed after two minutes.', a2: 'A-day2 shared: noticed the jaw loosen.', a1: 'A-day1 GUIDE-ONLY: private worry for the guide.', a0: 'A-day0 ME-ONLY: only for me.',
  b3: 'B-day3 shared: restless, then calm.', b2: 'B-day2 shared: B will decline this one.', b1: 'B-day1 shared: ordinary day.' };

export async function buildExperiment(opts: { title: string; slug: string; withResult?: boolean; bConsents?: boolean }): Promise<Fixture> {
  let created = false;
  let course = await getCourseBySlug(opts.slug);
  let slug = opts.slug;
  if (!course) {
    const r = await createWorkspace(guide, { orgId: ORG, title: opts.title, line: 'A test of paying attention to the breath, kept as a daily log.', when: '', where: 'Online', sessions: 1, ongoing: true, experiment: true, visibility: 'private', join: 'invite' });
    if (r.ok === false) throw new Error('create: ' + r.error);
    slug = r.slug; created = true;
  }
  const view = await getWorkspaceView(guide, slug);
  if (!view?.run) throw new Error('no run');
  const runId = view.run.id;
  const [sess] = await listOngoingSessions(runId);
  if (!sess) throw new Error('no ongoing session');
  // Start the log four days back so there are days to write into.
  const start = daysAgo(4).toISOString().slice(0, 10);
  if (sess.start !== start && created) { const s = await saveOngoingSession(guide, runId, { ...sess, start }); if (s.ok === false) throw new Error('cadence: ' + s.error); }
  // The two participants join by an invite link (the test profiles are not members of the organisation); the link is revoked after.
  for (const v of [A, B]) {
    if ((await getWorkspaceView(v, slug))?.seated) continue;
    const inv = await createWorkspaceInvite(guide, slug, { label: 'seed', maxUses: 1, days: 1 });
    if (inv.ok === false) throw new Error('invite: ' + inv.error);
    const r = await redeemWorkspaceInvite(v, inv.token);
    if (r.ok === false) throw new Error('redeem: ' + r.error);
  }
  for (const i of (await listWorkspaceInvites(guide, slug)) ?? []) if (!i.revoked) await revokeWorkspaceInvite(guide, slug, i.id);
  const bOn = opts.bConsents !== false;
  for (const v of bOn ? [A, B] : [A]) { const g = await agreeToParticipation(v, slug); if (g.ok === false) throw new Error('agree: ' + g.error); }
  const write = async (v: LmsViewer, d: number, body: string, visibility: 'me' | 'guide' | 'circle') => {
    const r = await saveIntervalEntry(v, slug, sess.moduleId, { body, visibility, key: undefined, tz: 'America/Toronto' }, daysAgo(d));
    if (r.ok === false) throw new Error(`entry d${d}: ${r.error}`);
  };
  await write(A, 3, WORDS.a3, 'circle'); await write(A, 2, WORDS.a2, 'circle'); await write(A, 1, WORDS.a1, 'guide'); await write(A, 0, WORDS.a0, 'me');
  if (bOn) { await write(B, 3, WORDS.b3, 'circle'); await write(B, 2, WORDS.b2, 'circle'); await write(B, 1, WORDS.b1, 'circle'); }
  const out: Fixture = { slug, runId, moduleId: sess.moduleId, resultId: '', items: {}, created };
  if (opts.withResult === false) return out;
  const existing = ((await listResults(guide, slug)) ?? []).find((r) => r.status === 'draft' && r.title === 'What we noticed about the breath');
  const d = await saveResultDraft(guide, slug, { id: existing?.id, title: 'What we noticed about the breath', intro: 'Four people kept a daily log for a few days.', conclusion: 'Attention to the breath seemed to settle people.', audience: 'members' });
  if (d.ok === false) throw new Error('draft: ' + d.error);
  out.resultId = d.id;
  const cands = (await listResultCandidates(guide, slug, d.id)) ?? [];
  const idOf = (w: string) => cands.find((c) => c.body === w)?.responseId;
  const pick = [WORDS.a3, WORDS.a2, ...(bOn ? [WORDS.b3, WORDS.b2] : [])].map(idOf).filter((x): x is string => Boolean(x));
  const rq = await requestPublication(guide, slug, d.id, pick);
  if (rq.ok === false) throw new Error('request: ' + rq.error);
  const mine = async (v: LmsViewer) => listMyPublicationRequests(v, slug);
  const [ra, rb] = [await mine(A), await mine(B)];
  const it = (list: typeof ra, w: string) => list.find((x) => x.body === w)?.itemId;
  const a3 = it(ra, WORDS.a3), a2 = it(ra, WORDS.a2), b3 = it(rb, WORDS.b3), b2 = it(rb, WORDS.b2);
  out.items = { a3: a3 ?? '', a2: a2 ?? '', b3: b3 ?? '', b2: b2 ?? '' };
  if (a3) await decidePublication(A, slug, a3, 'agree', 'named');
  if (a2) await decidePublication(A, slug, a2, 'agree', 'anonymous');
  if (b3) await decidePublication(B, slug, b3, 'agree', 'anonymous');
  if (b2) await decidePublication(B, slug, b2, 'decline');
  return out;
}
export { setWorkspaceEntryVisibility };
