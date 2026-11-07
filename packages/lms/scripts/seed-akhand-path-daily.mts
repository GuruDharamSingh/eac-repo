// ============================================================================
// Seed "Akhand Path, daily": the first routine course
// (docs/open/DAILY_ROUTINE_BRIEF_2026-11-06.md, step 2). Four task steps that
// repeat every day (`task.repeat: 'daily'`, never recorded as completed); each
// asks the action registry about today (packages/actions paath-* entries,
// @elkdonis/services/paath-day). Private to fourth_way_book_readers; the
// reading's two readers are enrolled.
//
// Safe to re-run: steps are matched by slug, publish is a no-op without
// changes, enrolment is idempotent. Remove with:
//   DELETE FROM lms_courses WHERE slug = 'akhand-path-daily';
//
//   docker exec eac-sophia sh -c "cd /app/packages/lms && pnpm exec tsx scripts/seed-akhand-path-daily.mts"
// ============================================================================
import { db } from '@elkdonis/db';
import { enrol, type LmsViewer } from '../src/index.ts';
import { seedCourse, type SeedStep } from './seed-lib.mts';

const ORG = 'fourth_way_book_readers';
const SLUG = 'akhand-path-daily';
const AUTHOR_EMAIL = 'justin.gillisb@gmail.com';
const READER_EMAILS = ['justin.gillisb@gmail.com', 'gurudharamsingh@gmail.com'];

const people = await db<Array<{ id: string; email: string; role: string | null }>>`
  SELECT u.id, u.email, o.role FROM users u
  LEFT JOIN user_organizations o ON o.user_id = u.id AND o.org_id = ${ORG}
  WHERE u.email = ANY(${READER_EMAILS})
`;
const author = people.find((p) => p.email === AUTHOR_EMAIL);
if (!author || author.role !== 'owner') throw new Error(`${AUTHOR_EMAIL} must be an owner of ${ORG}`);
const asViewer = (p: { id: string; role: string | null }): LmsViewer => ({ userId: p.id, roles: p.role ? { [ORG]: p.role as never } : {} });

const daily = (id: string, slug: string, title: string, summary: string, bodyHtml: string): SeedStep => ({
  type: 'task', slug, title, summary, bodyHtml, required: false, unlock: { kind: 'open' },
  settings: { task: { id, scope: 'person', repeat: 'daily' } },
});

const { course, defaultRun } = await seedCourse(asViewer(author), {
  orgId: ORG,
  slug: SLUG,
  title: 'Akhand Path, daily',
  visibility: 'private',
  summary: 'The day’s part of the reading: the passages, a recording, the note, and the recording sent on.',
  descriptionHtml:
    '<p>Four steps for each day of the Akhand Path. They tick themselves from the reading page: what you mark read, record and write there. They start again each morning, in Toronto time.</p>',
  notes: 'Akhand Path daily seed',
  modules: [
    {
      id: 'today',
      title: 'Today',
      summary: 'The day’s reading, in four steps.',
      steps: [
        daily('paath-read', 'read', 'Read today’s passages', 'Mark the day’s passages read on the reading page.',
          '<p>Open the day’s page and read on from where the last reading stopped. Each passage you mark read counts for today.</p>'),
        daily('paath-record', 'record', 'Record the reading', 'Record on the day’s page, or start the call and record it there.',
          '<p>A recording from the page goes into the day’s folder straight away. A call recording is moved there the next time the reading page opens.</p>'),
        daily('paath-note', 'note', 'Write the day’s note', 'A few words, or the point where the reading stopped.',
          '<p>The note and the stop point are on the day’s page. Either one is enough for today.</p>'),
        daily('paath-publish', 'send', 'Send the recording', 'Approve the day’s recording for YouTube.',
          '<p>New recordings wait for approval in the reading page’s admin details, then go up as private videos on the channel set there.</p>'),
      ],
    },
  ],
});

await db`INSERT INTO lms_course_staff (course_id, user_id, role) VALUES (${course.id}, ${author.id}, 'author') ON CONFLICT DO NOTHING`;
for (const p of people) {
  const r = await enrol(asViewer(p), defaultRun.id);
  console.log(`[${SLUG}] enrol ${p.email}:`, r.ok ? (r.isNew ? 'new' : 'already') : r.error);
}
console.log(`[${SLUG}] ${course.id} org=${course.orgId} visibility=${course.visibility} run=${defaultRun.id}`);
await db.end();
