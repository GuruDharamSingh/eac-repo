/**
 * seed-totm-circle.mts — create the "Talk of the Month" reading circle and its
 * plan: one unit per TOTM issue (seed/totm-units.json, 99 issues, titles and
 * page counts read from the PDFs on 2026-09-26).
 *
 * Run inside the app container (needs DATABASE_URL and NEXTCLOUD_*):
 *   docker compose exec -w /app fourthway-bookreaders node \
 *     node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs \
 *     apps/fourthwayBookreaders/scripts/seed-totm-circle.mts \
 *     --author <email> [--start 2026-10-01T19:30:00-04:00] [--monthly] \
 *     [--duration 60] [--pace 1] [--draft] [--dry-run]
 *
 * Idempotent: an existing circle (slug talk-of-the-month) is reused, its space
 * is only completed, and units are added only when it has none. Target dates
 * are set only when the circle has a schedule.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '@elkdonis/db';
import { createThread } from '../../../packages/services/src/posts.ts';
import {
  addCircleUnits,
  baselineCircleTargets,
  ensureCircleSpace,
  listCircleUnits,
} from '../../../packages/services/src/reading-circle.ts';

const ORG = 'fourth_way_book_readers';
const SLUG = 'talk-of-the-month';
const TITLE = 'Talk of the Month';

const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] ?? null : null;
};
const flag = (name: string) => argv.includes(`--${name}`);
const DRY = flag('dry-run');

const authorEmail = opt('author');
if (!authorEmail) {
  console.error('--author <email> is required');
  process.exit(1);
}
const start = opt('start') ? new Date(opt('start')!) : null;
if (start && Number.isNaN(start.getTime())) {
  console.error('--start must be an ISO timestamp with an offset, e.g. 2026-10-01T19:30:00-04:00');
  process.exit(1);
}
const recurrence = start ? (flag('monthly') ? 'MONTHLY' : 'WEEKLY') : null;
const duration = Number(opt('duration') ?? 60);
const pace = Number(opt('pace') ?? 1);

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, '../seed/totm-units.json'), 'utf8')) as Array<{
  label: string;
  title: string;
  pages: number;
  file: string;
}>;

const [author] = await db<{ id: string }[]>`SELECT id FROM users WHERE lower(email) = lower(${authorEmail})`;
if (!author) {
  console.error(`No user with email ${authorEmail}`);
  process.exit(1);
}

let [circle] = await db<{ id: string }[]>`
  SELECT id FROM threads WHERE org_id = ${ORG} AND kind = 'reading_group' AND slug = ${SLUG}
`;
console.log(circle ? `circle exists: ${circle.id}` : `circle missing: would create "${TITLE}"`);
console.log(`schedule: ${start ? `${start.toISOString()} ${recurrence}, ${duration} min` : 'none (set later)'}; pace ${pace}; ${seed.length} units in seed`);
if (DRY) process.exit(0);

if (!circle) {
  const t = await createThread({
    kind: 'reading_group',
    orgId: ORG,
    authorId: author.id,
    title: TITLE,
    slug: SLUG,
    status: flag('draft') ? 'draft' : 'published',
    visibility: 'PUBLIC',
    section: 'groups',
    scheduledAt: start,
    durationMinutes: duration,
    format: 'online',
    isRsvpEnabled: true,
    metadata: { book: { title: 'Talk of the Month (IDHHB)', author: null } },
  } as never);
  circle = { id: t.id };
  await db`
    UPDATE threads SET recurrence_pattern = ${recurrence}
    WHERE id = ${circle.id} AND org_id = ${ORG}
  `;
  console.log(`created circle ${circle.id}`);
} else if (start) {
  await db`
    UPDATE threads
    SET scheduled_at = ${start}, recurrence_pattern = ${recurrence}, duration_minutes = ${duration}
    WHERE id = ${circle.id} AND org_id = ${ORG}
  `;
  console.log('schedule updated');
}

const space = await ensureCircleSpace(ORG, circle.id);
console.log(`space: folder ${space.folder}, talk ${space.talkToken ?? '-'}, feed ${space.feedSlug ?? '-'}`);
for (const w of space.warnings) console.warn(`  warning: ${w}`);

const existing = await listCircleUnits(ORG, circle.id);
if (existing.length === 0) {
  const added = await addCircleUnits(
    ORG,
    circle.id,
    seed.map((u) => ({
      label: u.label,
      title: u.title,
      kind: 'document' as const,
      length: u.pages,
      lengthUnit: 'pages' as const,
      sourcePath: `${space.folder}/Material/TOTM-Collection/${u.file}`,
    }))
  );
  console.log(`added ${added} units`);
} else {
  console.log(`units exist (${existing.length}); none added`);
}

if (start) {
  const n = await baselineCircleTargets(ORG, circle.id, pace);
  console.log(`target dates set for ${n} units`);
}
process.exit(0);
