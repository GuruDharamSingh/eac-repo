// ============================================================================
// Seed "Clay and breath: a six week workshop": a show-off WORKSPACE for the
// workspace screens (slice 1b). Source: packages/workspace-ui/src/sample.ts.
// PRIVATE, org `sunjay`, one open cohort run, the named user as its guide, no
// enrolments, no default own-pace run. Safe to re-run (steps matched by slug).
//
//   docker compose run --rm --no-deps -e SEED_GUIDE_ID=<users.id> sophia \
//     sh -c "cd /app/packages/lms && npx tsx scripts/seed-workspace-clay.mts"
// Remove with:  DELETE FROM lms_courses WHERE slug = 'clay-and-breath';
// ============================================================================
import {
  createCourse, createRun, getCourseBySlug, getCourseById, getDraft, getRunBySlug, publishCourse, setDraftOutline, updateCourse,
  adoptLatestVersion, saveIntervalEntry, saveIntervalPlan, saveOngoingSession, upsertStepDraft, type LmsViewer, type ModuleLook, type UnlockRule, type UpsertStepInput,
} from '../src/index.ts';

const ORG = 'sunjay';
const guideId = process.env.SEED_GUIDE_ID;
if (!guideId) throw new Error('set SEED_GUIDE_ID');
const viewer: LmsViewer = { userId: guideId, roles: { [ORG]: 'guide' } };

type S = UpsertStepInput & { slug: string; required?: boolean; unlock?: UnlockRule };
interface M { id: string; title: string; summary: string; look: ModuleLook; steps: S[] }
const open = (id: string, name: string): NonNullable<ModuleLook['materials']>[number] => ({ id, name, access: 'open' });
const part = (id: string, name: string): NonNullable<ModuleLook['materials']>[number] => ({ id, name, access: 'participants' });

const MODULES: M[] = [
  {
    id: 'first-touch', title: 'First touch', summary: 'We meet the clay, the studio and each other, and settle the breath before the hands begin.',
    look: { colour: '#2f4d68', date: 'Thu 14 Jan, 7:00 pm', length: '2 hours', coverLabel: 'hands on a clay ball', description: 'We meet the clay, the studio and each other, and settle the breath before the hands begin.', materials: [open('mt1', 'Studio notes.pdf'), open('mt2', 'What to bring.pdf')] },
    steps: [
      { slug: 'before-the-first-evening', type: 'task', title: 'Before the first evening', summary: 'Get ready so we can start on time.', settings: { minutes: 10, task: { id: 'profile', scope: 'person' } }, bodyHtml: '<p>Tick these off so we can start on time.</p><ul><li>Apron and a towel</li><li>Short nails, no rings</li><li>A glass of water</li><li>Read the studio notes</li></ul>' },
      { slug: 'why-we-start-with-breath', type: 'reading', title: 'Why we start with breath', summary: 'A short reading on breath and clay.', settings: { minutes: 4 }, bodyHtml: '<p>Clay answers pressure with memory. A held breath leaves a held wall. Before you touch the clay we will spend five minutes on a long exhale, and you will feel the difference in the first pinch.</p>' },
      { slug: 'first-impressions', type: 'reflection', title: 'First impressions', summary: 'What your hands noticed.', settings: { minutes: 10, prompt: 'What did your hands notice in the first ten minutes?' } },
    ],
  },
  {
    id: 'pinch-pots', title: 'Pinch pots and the long exhale', summary: 'We start from a single ball of clay and open it with the thumb, one slow breath per turn.',
    look: { colour: '#6b3f2e', date: 'Thu 21 Jan, 7:00 pm', length: '2 hours', coverLabel: 'Opening the clay, 18:42', hasVideo: true, description: 'We start from a single ball of clay and open it with the thumb, one slow breath per turn.', materials: [open('mt3', 'Pinch-pot steps.pdf'), part('mt4', 'Breath practice audio.mp3')] },
    steps: [
      { slug: 'opening-the-clay', type: 'reading', title: 'Opening the clay', summary: 'A short film: opening a ball of clay with the thumb (18 min 42 s).', settings: { minutes: 19 }, refs: { media: [{ kind: 'video', url: '/api/media/placeholder/opening-the-clay.mp4', title: 'Opening the clay (18:42), placeholder file', durationSeconds: 1122 }] }, bodyHtml: '<p>Watch once through, then once more with the sound off, looking only at the thumb.</p>' },
      { slug: 'ten-minutes-a-day', type: 'practice', title: 'Practice log: ten minutes a day', summary: 'Make one small pinch pot a day.', required: false, settings: { minutes: 10, practice: 'Make one small pinch pot a day and log the minutes.', alternative: 'If your hands are tired, only hold the clay for ten minutes and breathe.' } },
      { slug: 'what-did-your-hands-notice', type: 'reflection', title: 'What did your hands notice?', summary: 'Wall thickness and breath.', settings: { minutes: 10, prompt: 'Write a few lines about the thickness of the wall and your breath.' } },
      { slug: 'join-the-room', type: 'session', title: 'Join the room', summary: 'Meet in the upstairs studio.', required: false, settings: { minutes: 120, when: 'Thu 21 Jan, 7:00 pm', where: 'Lantern Row studio, upstairs' }, bodyHtml: '<p>We meet upstairs at the studio. There is a ramp at the side door.</p>' },
    ],
  },
  {
    id: 'coils', title: 'Coils', summary: 'Rolling, joining and building height without losing the breath.',
    look: { colour: '#6a5524', date: 'Thu 28 Jan, 7:00 pm', length: '2 hours', coverLabel: 'a coil pot in progress', description: 'Rolling, joining and building height without losing the breath.', materials: [part('mt5', 'Coil building notes.pdf')] },
    steps: [
      { slug: 'rolling-a-coil', type: 'reading', title: 'Rolling a coil', summary: 'How to roll an even coil.', settings: { minutes: 4 }, bodyHtml: '<p>Roll from the centre of the palm outward, light as a pencil. If the coil cracks, the clay is too dry: wet your fingers, not the clay.</p>' },
      { slug: 'group-talk-what-slowed-you-down', type: 'thread', title: 'Group talk: what slowed you down?', summary: 'A conversation with the group.', required: false, settings: { minutes: 10, prompt: 'Share one thing that slowed you down this week and what you did about it.' } },
      { slug: 'a-coil-a-day', type: 'practice', title: 'A coil a day', summary: 'Ten coils each day.', required: false, settings: { minutes: 10, practice: 'Roll ten coils each day and note the minutes.' } },
    ],
  },
  {
    id: 'slabs', title: 'Slabs', summary: 'Flat clay, clean edges, and patience at the seam.',
    look: { colour: '#5a3a5e', date: 'Thu 4 Feb, 7:00 pm', length: '2 hours', coverLabel: 'slab on the canvas', description: 'Flat clay, clean edges, and patience at the seam.', materials: [open('mt6', 'Slab thickness guide.pdf')] },
    steps: [
      { slug: 'slab-thickness-guide', type: 'resource', title: 'Slab thickness guide', summary: 'How thick a slab should be.', required: false, bodyHtml: '<p>For a small cup, aim for about 6 mm. For a plate, a little more. The full guide is in this week’s materials.</p>' },
      { slug: 'the-edge', type: 'reflection', title: 'The edge', summary: 'Where you rushed and where you waited.', settings: { minutes: 8, prompt: 'Where did you rush, and where did you wait?' } },
      { slug: 'joining-a-seam', type: 'reading', title: 'Joining a seam', summary: 'Scoring, slip and patience.', settings: { minutes: 5 }, bodyHtml: '<p>Score both edges, add a little slip, press from the middle outward, and then wait. The seam is finished when you stop touching it.</p>' },
    ],
  },
  {
    id: 'surface', title: 'Surface', summary: 'Burnishing, slip and the marks that are left.',
    look: { colour: '#3d5a46', date: 'Thu 11 Feb, 7:00 pm', length: '2 hours', coverLabel: 'burnished bowl', description: 'Burnishing, slip and the marks that are left.', materials: [part('mt7', 'Slip recipes.pdf')] },
    steps: [
      { slug: 'surface-as-attention', type: 'reading', title: 'Surface as attention', summary: 'A surface is a record of speed.', settings: { minutes: 3 }, bodyHtml: '<p>A surface is a record of speed. Burnish slowly and the clay shines; hurry and it drags.</p>' },
      { slug: 'burnishing-minutes', type: 'practice', title: 'Burnishing minutes', summary: 'Burnish one piece.', required: false, settings: { minutes: 15, practice: 'Burnish one piece and log the time.' } },
      { slug: 'what-does-your-surface-say', type: 'reflection', title: 'What does your surface say?', summary: 'Describe the surface you made.', settings: { minutes: 8, prompt: 'Describe the surface you made and how it came to be.' } },
    ],
  },
  {
    id: 'firing-day', title: 'Firing day', summary: 'We load the kiln together and close the workshop together.',
    look: { colour: '#6b3a3a', date: 'Thu 18 Feb, 6:00 pm', length: '3 hours', coverLabel: 'kiln room', description: 'We load the kiln together and close the workshop together.', materials: [open('mt8', 'Glaze and firing notes.pdf')] },
    steps: [
      { slug: 'firing-day-checklist', type: 'task', title: 'Firing day checklist', summary: 'What to do before the kiln.', settings: { minutes: 10, task: { id: 'profile', scope: 'person' } }, bodyHtml: '<ul><li>Name stamped on each piece</li><li>Pieces bone dry</li><li>Collection time agreed</li></ul>' },
      { slug: 'firing-day', type: 'session', title: 'Firing day', summary: 'Load the kiln together.', required: false, settings: { minutes: 180, when: 'Thu 18 Feb, 6:00 pm', where: 'Lantern Row kiln room' } },
      { slug: 'six-evenings', type: 'reflection', title: 'Six evenings', summary: 'A closing reflection.', settings: { minutes: 10, prompt: 'What will you carry out of this room?' } },
      { slug: 'keeping-the-practice', type: 'resource', title: 'Keeping the practice', summary: 'A short list of ways to carry on.', required: false, unlock: { kind: 'date', at: '2027-06-01' }, bodyHtml: '<p>Five minutes of clay and one long exhale, most days. That is the whole workshop.</p>' },
    ],
  },
  {
    id: 'five-minutes', title: 'Five minutes a day', summary: 'Practise for five minutes each day, at a time that suits you, and write down how it was.',
    look: { colour: '#4d4a2c', length: '5 minutes a day', coverLabel: 'a row of small pots', description: 'Practise for five minutes each day, at a time that suits you, and write down how it was. Post your note so everyone can see when you did it. A new day opens at midnight wherever you are, and yesterday closes.', materials: [] },
    steps: [
      { slug: 'five-minutes-a-day', type: 'practice', title: 'Five minutes', summary: 'Practise for five minutes, then write down how it was.', required: false, settings: { minutes: 5, practice: 'Practise for five minutes, whenever suits you today. Then write down how it was.' } },
    ],
  },
];

const SLUG = 'clay-and-breath';
const TITLE = 'Clay and breath: a six week workshop';
const SUMMARY = 'Six evenings of slow hand-building, Thursdays 14 Jan to 18 Feb at the Lantern Row studio.';
const DESC = '<p>We build three small vessels by hand, slowly, with attention on breath and posture as much as on the clay. No wheel, no experience needed. Bring an apron and a towel; clay is provided. Twelve places.</p>';

let course = await getCourseBySlug(SLUG);
if (!course) {
  const r = await createCourse(viewer, { orgId: ORG, slug: SLUG, title: TITLE, summary: SUMMARY, descriptionHtml: DESC, visibility: 'private' });
  if (r.ok === false) throw new Error(r.error);
  course = r.course;
} else {
  const r = await updateCourse(viewer, course.id, { title: TITLE, summary: SUMMARY, descriptionHtml: DESC, visibility: 'private' });
  if (r.ok === false) throw new Error(r.error);
}
const draft = await getDraft(viewer, course.id);
const bySlug = new Map(draft?.steps.map((s) => [s.slug, s.stepId]));
let ongoingStepId = "";
const outline = { modules: [] as Array<{ id: string; title: string; summary: string; look: ModuleLook; steps: Array<{ stepId: string; required: boolean; unlock?: UnlockRule }> }> };
for (const m of MODULES) {
  const refs: Array<{ stepId: string; required: boolean; unlock?: UnlockRule }> = [];
  for (const { required, unlock, ...s } of m.steps) {
    const r = await upsertStepDraft(viewer, course.id, { ...s, stepId: bySlug.get(s.slug) });
    if (r.ok === false) throw new Error(`${s.title}: ${r.error}`);
    // Pacing: open, so a visitor can read the whole outline (the workspace screens do not lock anything yet).
    refs.push({ stepId: r.stepId, required: required !== false, unlock: unlock ?? { kind: 'open' as const } });
  }
  if (m.id === "five-minutes") ongoingStepId = refs[0].stepId;
  outline.modules.push({ id: m.id, title: m.title, summary: m.summary, look: m.look, steps: refs });
}
const o = await setDraftOutline(viewer, course.id, outline);
if (o.ok === false) throw new Error(o.error);
const pub = await publishCourse(viewer, course.id, 'Seed for the workspace screens');
console.log('publish:', pub.ok ? `v${pub.versionNo} ${pub.changeKind}, ${pub.stepsFrozen} step(s) frozen` : pub.error);
course = (await getCourseById(course.id))!;

let run = await getRunBySlug(course.id, 'thursday-evenings');
if (!run) {
  const r = await createRun(viewer, course.id, { title: 'Thursday evenings', mode: 'cohort', enrolPolicy: 'invite', defaultVisibility: 'circle', guideIds: [guideId] });
  if (r.ok === false) throw new Error(r.error);
  run = r.run;
}
if (run.courseVersionId !== course.publishedVersionId) { const a = await adoptLatestVersion(viewer, run.id); console.log('adopt:', a.ok ? 'ok' : a.error); run = (await getRunBySlug(course.id, 'thursday-evenings'))!; }

// ── the ongoing module "Five minutes a day" (migration 285) ─────────────────
if (ongoingStepId) {
  const ses = await saveOngoingSession(viewer, run.id, { moduleId: 'five-minutes', stepId: ongoingStepId, everyDays: 1, start: '2026-11-16', end: null, closes: true, readFirst: false, show: 5 });
  console.log('ongoing session:', ses.ok ? 'saved' : ses.error);
  const notes: Record<string, [string, string[]]> = {
    '2026-11-16': ['First day. Sit however is comfortable and let the five minutes be short.', ['Why we sit for five minutes (a one page note)']],
    '2026-11-17': ['Same practice. Notice where your attention goes in the last minute.', []],
    '2026-11-18': ['Same practice. If you miss a day, just write that down.', []],
    '2026-11-19': ['Same practice. Note the time you did it, so we can see when we each sat.', []],
    '2026-11-20': ['Last day of the week. Look back over your own notes before tonight.', ['Friday: we read the week’s notes together']],
    '2026-11-21': ['Rest day. No practice; read the week’s notes if you like.', []],
    '2026-11-22': ['A new week. Same five minutes.', []],
    '2026-11-23': ['Try it once with your eyes open.', ['A short breathing guide (audio)']],
    '2026-11-24': ['Same practice. Tomorrow we look at how the week went.', []],
    '2026-11-25': ['Bring one thing you noticed to the group.', ['Week two notes']],
  };
  for (const [key, [note, mats]] of Object.entries(notes)) {
    const r = await saveIntervalPlan(viewer, run.id, 'five-minutes', key, { note, items: mats.map((name, i) => ({ id: `${key}-${i}`, name, access: i === 0 && key !== '2026-11-20' ? ('open' as const) : ('participants' as const) })) });
    if (r.ok === false) console.log('plan', key, r.error);
  }
  await saveIntervalPlan(viewer, run.id, 'five-minutes', '', { note: 'Five minutes, every day. One entry each; you can change it until the day ends.', items: [{ id: 'general-1', name: 'How to sit (one page)', access: 'open' }] });

  const A = process.env.SEED_A, B = process.env.SEED_B;
  if (A && B) {
    const va: LmsViewer = { userId: A, roles: {} }, vb: LmsViewer = { userId: B, roles: {} };
    const TOR = 'America/Toronto', KOL = 'Asia/Kolkata';
    const put = async (label: string, v: LmsViewer, tz: string, iso: string, body: string, minutes: number, visibility?: 'me' | 'guide' | 'circle', key?: string) => {
      const r = await saveIntervalEntry(v, SLUG, 'five-minutes', { body, minutes, visibility, tz, key }, new Date(iso));
      console.log(label, r.ok ? `ok key=${r.key}` : `refused: ${r.error}`);
    };
    // Toronto is UTC-5 in November, Kolkata UTC+5:30.
    await put('A 11/16', va, TOR, '2026-11-16T13:00:00Z', 'Before the kettle boiled. Mind busy for four of the five minutes.', 5);
    await put('B 11/16', vb, KOL, '2026-11-16T03:30:00Z', 'Early, before the day. Quiet street.', 6);
    await put('A 11/17', va, TOR, '2026-11-17T12:30:00Z', 'Same time as yesterday. Noticed my jaw was tight; let it go.', 5);
    await put('B 11/17 (guide only)', vb, KOL, '2026-11-17T14:00:00Z', 'Evening. Sat badly, am telling only the guide.', 4, 'guide');
    // The clock cases: 11:58 pm and 12:01 am local, for a writer in Toronto and one in Kolkata.
    await put('A 11:58 pm 11/18 Toronto', va, TOR, '2026-11-19T04:58:00Z', 'Just in time, last thing at night.', 5);
    await put('B 11:58 pm 11/18 Kolkata', vb, KOL, '2026-11-18T18:28:00Z', 'Last minute, before midnight here.', 5);
    await put('A 12:01 am 11/19 Toronto', va, TOR, '2026-11-19T05:01:00Z', 'Just after midnight, so this is the 19th.', 5);
    await put('B 12:01 am 11/19 Kolkata', vb, KOL, '2026-11-18T18:31:00Z', 'Just after midnight here, so the 19th.', 5);
    // Closing is enforced on the server, on each writer's own clock.
    await put('A edits 11/18 at 12:01 am Toronto (must refuse)', va, TOR, '2026-11-19T05:01:00Z', 'Too late to change.', 5, undefined, '2026-11-18');
    await put('B edits 11/18 at 12:01 am Kolkata (must refuse)', vb, KOL, '2026-11-18T18:31:00Z', 'Too late to change.', 5, undefined, '2026-11-18');
    await put('A writes tomorrow (must refuse)', va, TOR, '2026-11-19T05:01:00Z', 'Early.', 5, undefined, '2026-11-20');
    await put('A 11/20', va, TOR, '2026-11-20T13:00:00Z', 'Rushed it, but it counts.', 5);
    await put('A 11/21', va, TOR, '2026-11-21T15:00:00Z', 'On the porch. A little cold.', 7);
    await put('B 11/21', vb, KOL, '2026-11-21T05:00:00Z', 'Morning sit, tea going cold.', 5);
    await put('A 11/22', va, TOR, '2026-11-22T12:00:00Z', 'Quiet. Liked it.', 5);
    await put('B 11/22 (only me)', vb, KOL, '2026-11-22T06:00:00Z', 'Private note to self: restless.', 5, 'me');
  }
}
console.log(JSON.stringify({ courseId: course.id, slug: course.slug, versionId: course.publishedVersionId, runId: run.id, runStatus: run.status, runVersion: run.courseVersionId }));
process.exit(0);
