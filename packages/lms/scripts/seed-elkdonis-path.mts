// ============================================================================
// Seed the flagship: "The Elkdonis Path" on the `elkdonis` org.
//
// SCAFFOLDING, and it says so on the page. The step texts here exist to give
// the guide something to replace; the course is `unlisted` (reachable by link,
// noindex, off the catalogue and the sitemap) until he makes it `public`.
//
// Idempotent: re-running updates the drafts and republishes only if something
// changed. Run inside an app container:
//   docker exec eac-sophia sh -c "cd /app/packages/lms && pnpm seed:path"
// ============================================================================
import { db } from '@elkdonis/db';
import {
  createCourse, getCourseBySlug, upsertStepDraft, setDraftOutline, publishCourse, ensureDefaultRun, getCourseById,
  createRun, getRunBySlug, getDraft, type LmsViewer, type UpsertStepInput, type UnlockRule,
} from '../src/index.ts';

const ORG = 'elkdonis';
const SLUG = 'elkdonis-path';
const GUIDE_EMAIL = 'fnordj@gmail.com'; // Jason — first guide and admin (owner decision, 2026-09-18)

const [guide] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE email = ${GUIDE_EMAIL}`;
if (!guide) throw new Error(`No user ${GUIDE_EMAIL}`);
// He is an owner of inner_group, which stewards `elkdonis` (migration 138) — the
// same rule services' getViewerRoles applies, stated here rather than imported.
const viewer: LmsViewer = { userId: guide.id, roles: { [ORG]: 'guide' } };

let course = await getCourseBySlug(SLUG);
if (!course) {
  const r = await createCourse(viewer, {
    orgId: ORG, slug: SLUG, title: 'The Elkdonis Path', visibility: 'unlisted',
    summary: 'A first course from the Elkdonis Arts Collective: short steps, a practice in each, and reflections that are yours to keep.',
    descriptionHtml: '<p><em>This is an early outline. The steps below are scaffolding while the guide writes the course — expect them to change.</em></p><p>Everything is free to read. Take it at your own pace; when a group gathers to walk it together, it will be listed here.</p>',
  });
  if (r.ok === false) throw new Error(r.error);
  course = r.course;
}

const [meeting] = await db<Array<{ id: string }>>`SELECT id FROM threads WHERE org_id = 'inner_group' AND kind = 'meeting' AND status = 'published' AND visibility = 'PUBLIC' AND recurrence_pattern IS NOT NULL ORDER BY created_at LIMIT 1`;
const [topic] = await db<Array<{ id: string }>>`SELECT id FROM threads WHERE org_id = 'inner_group' AND kind = 'post' AND status = 'published' AND visibility = 'PUBLIC' ORDER BY created_at DESC LIMIT 1`;

type Seed = UpsertStepInput & { required?: boolean; unlock?: UnlockRule };
const modules: Array<{ id: string; title: string; summary: string; steps: Seed[] }> = [
  {
    id: 'arriving', title: 'Arriving', summary: 'How this works, a first practice, and a first question.',
    steps: [
      {
        type: 'reading', slug: 'welcome', title: 'Welcome — how this works',
        summary: 'What a step is, what stays private, and how to go at your own pace.',
        settings: { minutes: 3 },
        bodyHtml: '<p>Each step here is small. Most end in something to do, make or notice, and many leave room for a few words of your own.</p><p>What you write is <strong>yours</strong>. Every entry says who can read it, and the default is <em>only you</em>. You can show an entry to your guide, to the people walking this alongside you, or to anyone — one entry at a time — and you can remove it whenever you like.</p><p>Nothing here counts your days or notices a gap. When you come back, “Continue” takes you to where you were.</p>',
      },
      {
        type: 'practice', slug: 'a-first-sitting', title: 'A first sitting',
        summary: 'Five minutes of noticing, as a way of arriving.',
        settings: {
          minutes: 5,
          practice: 'Sit somewhere you won’t be interrupted for five minutes. Let your attention rest on whatever is already here — sounds, the body, the breath. When you notice you’ve gone somewhere else, that noticing is the practice. Come back.',
          alternative: 'If sitting still is uncomfortable, do the same thing walking slowly, eyes open, indoors or out.',
          prompt: 'What did you notice?',
        },
        bodyHtml: '<p><em>Placeholder practice, to be replaced by the guide.</em></p>',
      },
      {
        type: 'reflection', slug: 'what-brought-you-here', title: 'What brought you here?',
        summary: 'One question, answered for yourself first.',
        settings: { minutes: 10, prompt: 'What brought you here, now? Write for yourself; decide afterwards whether anyone else reads it.' },
      },
    ],
  },
  {
    id: 'with-others', title: 'With others', summary: 'The work is also done in company. These point at what already happens on the network.',
    steps: [
      ...(meeting ? [{
        type: 'session', slug: 'sit-with-the-group', title: 'Sit with the group', required: false, unlock: { kind: 'open' } as UnlockRule,
        summary: 'Join a standing gathering of the inner group, online.',
        refs: { threadId: meeting.id }, settings: { minutes: 30, prompt: 'What was it like to practise with others?' },
      } satisfies Seed] : []),
      ...(topic ? [{
        type: 'thread', slug: 'join-a-conversation', title: 'Join a conversation', required: false, unlock: { kind: 'open' } as UnlockRule,
        summary: 'Read a thread on the Grand Forum and add your voice if you wish.',
        refs: { threadId: topic.id }, settings: { minutes: 15 },
      } satisfies Seed] : []),
    ],
  },
  {
    id: 'going-on', title: 'Going on', summary: 'Where this might lead.',
    steps: [
      {
        type: 'reflection', slug: 'what-should-this-become', title: 'What should this become?',
        summary: 'Tell the guide what you would want from the rest of the Path.',
        settings: { minutes: 10, prompt: 'Having begun: what would you want the rest of this course to give you?' },
      },
    ],
  },
].filter((m) => m.steps.length);

const existing = await getDraft(viewer, course.id);
const bySlug = new Map(existing?.steps.map((s) => [s.slug, s.stepId]));
const outline = { modules: [] as Array<{ id: string; title: string; summary: string; steps: Array<{ stepId: string; required: boolean; unlock?: UnlockRule }> }> };
for (const m of modules) {
  const refs = [];
  for (const { required, unlock, ...s } of m.steps) {
    const r = await upsertStepDraft(viewer, course.id, { ...s, stepId: bySlug.get(s.slug!) });
    if (r.ok === false) throw new Error(`${s.title}: ${r.error}`);
    refs.push({ stepId: r.stepId, required: required !== false, unlock });
  }
  outline.modules.push({ id: m.id, title: m.title, summary: m.summary, steps: refs });
}
const o = await setDraftOutline(viewer, course.id, outline);
if (o.ok === false) throw new Error(o.error);

const pub = await publishCourse(viewer, course.id, 'Seeded scaffolding');
console.log('publish:', pub);

course = (await getCourseById(course.id))!;
const def = await ensureDefaultRun(course);
await db`INSERT INTO lms_run_staff (run_id, user_id, role) VALUES (${def!.id}, ${guide.id}, 'guide') ON CONFLICT DO NOTHING`;
await db`INSERT INTO lms_course_staff (course_id, user_id) VALUES (${course.id}, ${guide.id}) ON CONFLICT DO NOTHING`;

// The community classroom, ready but not yet open: a forum category for its
// conversations and a DRAFT cohort run. The guide opens it when a group is real.
await db`
  INSERT INTO org_feeds (org_id, slug, name, tagline, description, sort_order, is_public)
  VALUES (${ORG}, 'elkdonis-path', 'The Elkdonis Path', 'Talking through the course, step by step',
          'One conversation per step for groups walking the Elkdonis Path together on Sophia.', 4, TRUE)
  ON CONFLICT (org_id, slug) DO NOTHING
`;
if (!(await getRunBySlug(course.id, 'first-circle'))) {
  const r = await createRun(viewer, course.id, {
    title: 'First circle', slug: 'first-circle', mode: 'cohort', capacity: 20, discussionFeed: 'elkdonis-path',
    workshopThreadId: meeting?.id ?? null, guideIds: [guide.id],
  });
  if (r.ok === false) throw new Error(r.error);
  await db`UPDATE lms_runs SET status = 'draft' WHERE id = ${r.run.id}`;
}
await db`
  INSERT INTO lms_achievements (id, org_id, course_id, name, description)
  SELECT ${'ach_' + course.id}, ${ORG}, ${course.id}, 'The Elkdonis Path', 'Walked every required step of the Elkdonis Path.'
  WHERE NOT EXISTS (SELECT 1 FROM lms_achievements WHERE course_id = ${course.id})
`;
console.log(`seeded /${SLUG} (unlisted). default run ${def!.id}`);
process.exit(0);
