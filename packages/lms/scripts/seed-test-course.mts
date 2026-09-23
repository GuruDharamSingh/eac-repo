// ============================================================================
// Seed "Sophia test course": every step type, every unlock rule, media with a
// transcript, an unknown step type, and three runs (open, drip, cohort).
//
// PRIVATE: only people with a role on the `elkdonis` org (and its stewards,
// the inner group) can see it; it is never listed, indexed or in the sitemap.
// Safe to re-run. Remove with:  DELETE FROM lms_courses WHERE slug = 'sophia-test-course';
//
//   docker exec eac-sophia sh -c "cd /app/packages/lms && pnpm seed:test"
// ============================================================================
import { db } from '@elkdonis/db';
import { createRun, getRunBySlug, type LmsViewer } from '../src/index.ts';
import { seedCourse } from './seed-lib.mts';

const ORG = 'elkdonis';
const [guide] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE email = 'fnordj@gmail.com'`;
if (!guide) throw new Error('guide user missing');
const viewer: LmsViewer = { userId: guide.id, roles: { [ORG]: 'guide' } };

const [meeting] = await db<Array<{ id: string }>>`SELECT id FROM threads WHERE org_id = 'inner_group' AND kind = 'meeting' AND status = 'published' AND visibility = 'PUBLIC' AND recurrence_pattern IS NOT NULL ORDER BY created_at LIMIT 1`;
const [topic] = await db<Array<{ id: string }>>`SELECT id FROM threads WHERE org_id = 'inner_group' AND kind = 'post' AND status = 'published' AND visibility = 'PUBLIC' ORDER BY created_at DESC LIMIT 1`;

const BELL = { kind: 'audio' as const, url: '/test/bell.wav', title: 'A bell (8 seconds)', durationSeconds: 8, transcript: 'A single bell tone at 432 Hz that rings and fades over eight seconds. There are no words.\n\nThis transcript exists to show where one goes: on the page, under the player, readable by everyone and by search engines.' };

const { course, defaultRun } = await seedCourse(viewer, {
  orgId: ORG, slug: 'sophia-test-course', title: 'Sophia test course', visibility: 'private',
  summary: 'Not a real course. One of everything Sophia can do, for the people building and guiding on it.',
  descriptionHtml: '<p><strong>This is a test course.</strong> It is private to the Elkdonis org and the inner group. Use it to see how each kind of step reads, how doors open, and how the quiet and classroom modes differ. Write anything you like — then remove it from your journal.</p>',
  notes: 'Test course seed',
  modules: [
    {
      id: 'kinds', title: 'Every kind of step', summary: 'Reading, practice, reflection, gathering, conversation, resource — and one the platform has never heard of.',
      steps: [
        { type: 'reading', slug: 'a-reading', title: 'A reading', summary: 'Rich text: headings, a quotation, a list, a link.', settings: { minutes: 4 },
          bodyHtml: '<p>A reading step is something to take in. The body is rich text from the shared editor, sanitised on save.</p><h2>A heading</h2><p>Paragraphs set in a reading face at a comfortable measure. <a href="/care">Links</a> look like this, <strong>strong</strong> and <em>emphasis</em> like that.</p><blockquote>A quotation is set apart, with a gold rule.</blockquote><ul><li>One item</li><li>Another</li></ul><h3>A smaller heading</h3><p>The button at the foot says “I’ve taken this in”.</p>' },
        { type: 'practice', slug: 'a-practice-with-audio', title: 'A practice, with audio', summary: 'A practice block, another way in, and an audio file with its transcript.', settings: { minutes: 5, practice: 'Play the bell. Listen until you can no longer tell whether you still hear it.\nThen sit for one more minute.', alternative: 'If sound is difficult, watch the second hand of a clock for one full minute instead.', prompt: 'When did the sound end?' }, refs: { media: [BELL] } },
        { type: 'reflection', slug: 'a-reflection', title: 'A reflection', summary: 'One question. Saving your words is what completes it.', settings: { minutes: 5, prompt: 'What are you testing for? (Try each of the “who can read this” choices.)' } },
        ...(meeting ? [{ type: 'session', slug: 'a-gathering', title: 'A gathering', summary: 'Points at a standing meeting that already exists on the network.', required: false, refs: { threadId: meeting.id }, settings: { minutes: 15, prompt: 'What was it like?' } }] : []),
        ...(topic ? [{ type: 'thread', slug: 'a-conversation', title: 'A conversation', summary: 'Points at a thread on the Grand Forum.', required: false, refs: { threadId: topic.id }, settings: { minutes: 10 } }] : []),
        { type: 'session', slug: 'a-missing-gathering', title: 'A gathering that is gone', summary: 'Points at a thread that does not exist, to show that a step degrades politely.', required: false, refs: { threadId: 'th_does_not_exist_000' } },
        { type: 'resource', slug: 'a-resource', title: 'A resource', summary: 'A file to download. Optional, as resources usually are.', required: false, refs: { media: [{ kind: 'file', url: '/test/bell.wav', title: 'the bell (WAV)' }] }, bodyHtml: '<p>Resources are for reference: a PDF, a score, a reading list.</p>' },
        { type: 'ritual', slug: 'an-unknown-kind', title: 'A kind Sophia has never heard of', summary: 'Its type is “ritual”, which no one has registered. It still shows its body and can be completed.', required: false, bodyHtml: '<p>Step types are open text. An unregistered one is treated as a plain step you mark done yourself.</p>', settings: { practice: 'Notice that nothing broke.' } },
      ],
    },
    {
      id: 'doors', title: 'Every kind of door', summary: 'How steps open: always, in order, after a module, after some days, on a date.',
      steps: [
        { type: 'reading', slug: 'door-always-open', title: 'Always open', summary: 'Rule: open. Available from the first moment.', unlock: { kind: 'open' }, required: false, bodyHtml: '<p>You can read and complete this before anything else.</p>' },
        { type: 'reading', slug: 'door-after-module', title: 'After the first module', summary: 'Rule: after_module. Opens when every REQUIRED step of “Every kind of step” is done.', unlock: { kind: 'after_module', moduleId: 'kinds' }, bodyHtml: '<p>Optional steps in that module never hold this door shut.</p>' },
        { type: 'reading', slug: 'door-in-order', title: 'In order', summary: 'Rule: sequential (the default). Opens after the previous required step.', bodyHtml: '<p>The previous <em>required</em> step is “After the first module”.</p>' },
        { type: 'reading', slug: 'door-three-days', title: 'Three days in', summary: 'Rule: offset_days 3. Counts from when you began — or, in a cohort, from the day the group starts.', unlock: { kind: 'offset_days', days: 3 }, required: false, bodyHtml: '<p>This is how a drip works.</p>' },
        { type: 'reading', slug: 'door-past-date', title: 'A date already past', summary: 'Rule: date 2026-01-01. Open.', unlock: { kind: 'date', at: '2026-01-01T00:00:00Z' }, required: false, bodyHtml: '<p>The day came.</p>' },
        { type: 'reading', slug: 'door-future-date', title: 'A date still to come', summary: 'Rule: date 2030-01-01. Closed, and says when.', unlock: { kind: 'date', at: '2030-01-01T00:00:00Z' }, required: false, bodyHtml: '<p>You should not be able to read this before 2030 unless you are staff.</p>' },
      ],
    },
    {
      id: 'finishing', title: 'Finishing', summary: 'Completing the last required step completes the course and grants the award.',
      steps: [
        { type: 'reflection', slug: 'last-words', title: 'Last words', summary: 'The final required step.', settings: { minutes: 3, prompt: 'What should be fixed first?' } },
      ],
    },
  ],
});

await db`INSERT INTO lms_run_staff (run_id, user_id, role) VALUES (${defaultRun.id}, ${guide.id}, 'guide') ON CONFLICT DO NOTHING`;
await db`
  INSERT INTO org_feeds (org_id, slug, name, tagline, sort_order, is_public, min_role)
  VALUES (${ORG}, 'sophia-test', 'Sophia test circle', 'Conversations for the test course', 90, FALSE, 'member')
  ON CONFLICT (org_id, slug) DO NOTHING
`;
if (!(await getRunBySlug(course.id, 'a-little-at-a-time'))) {
  const r = await createRun(viewer, course.id, { title: 'A little at a time (drip)', slug: 'a-little-at-a-time', mode: 'drip', guideIds: [guide.id] });
  if (r.ok === false) throw new Error(r.error);
}
if (!(await getRunBySlug(course.id, 'test-circle'))) {
  const r = await createRun(viewer, course.id, {
    title: 'Test circle (cohort)', slug: 'test-circle', mode: 'cohort', capacity: 5, discussionFeed: 'sophia-test',
    startsAt: new Date(Date.now() + 7 * 86_400_000), workshopThreadId: meeting?.id ?? null, guideIds: [guide.id],
  });
  if (r.ok === false) throw new Error(r.error);
}
await db`
  INSERT INTO lms_achievements (id, org_id, course_id, name, description)
  SELECT ${'ach_' + course.id}, ${ORG}, ${course.id}, 'Tested Sophia', 'Completed every required step of the test course.'
  WHERE NOT EXISTS (SELECT 1 FROM lms_achievements WHERE course_id = ${course.id})
`;
console.log(`seeded /sophia-test-course (private): ${course.id}`);
process.exit(0);
