// ============================================================================
// Seed "Finish your store": the market's store course (2026-11-24;
// docs/open/MARKET_CENTER_AND_DOCK_2026-11-24.md, slice 2). A person whose own
// store opens on market.arts-collective.com is enrolled by the market
// (apps/art-auction/src/lib/store-course.ts) and the course becomes their dock
// trail. Steps are `task` steps that tick themselves from platform state
// (packages/actions/src/server/status.ts): store-front and ship-from are done in
// the dock; artwork and payouts take the person to the page on the market.
//
// Owner org: `market`. Public, so the lesson pages serve at
// arts-collective.com/learn/market-store. Tags: area 'publishing', builds on
// 'getting-started' (the dock's trail picker groups by them).
//
// Safe to re-run: steps are matched by slug and publish is a no-op without
// changes. `--dry` prints the plan and writes nothing.
// Remove with: DELETE FROM lms_courses WHERE slug = 'market-store';
//
//   docker compose run --rm --no-deps -w /app/packages/lms admin sh -c 'pnpm exec tsx scripts/seed-market-store.mts --dry'
// ============================================================================
import { db } from '@elkdonis/db';
import type { LmsViewer } from '../src/index.ts';
import { seedCourse, type SeedCourse, type SeedStep } from './seed-lib.mts';

const ORG = 'market';
const SLUG = 'market-store';
const AREA = 'publishing';
const BUILDS_ON = ['getting-started'];
const GUIDE_EMAIL = process.env.ONBOARDING_GUIDE_EMAIL ?? 'justin.gillisb@gmail.com';
const DRY = process.argv.includes('--dry');

const task = (id: string, slug: string, title: string, summary: string, bodyHtml: string, extra: Partial<SeedStep> = {}): SeedStep => ({
  type: 'task', slug, title, summary, bodyHtml, ...extra, settings: { ...(extra.settings ?? {}), task: { id, scope: 'person' } },
});

const spec: SeedCourse = {
  orgId: ORG,
  slug: SLUG,
  title: 'Finish your store',
  visibility: 'public',
  summary: 'Your store on Collect Art is open. Three steps finish its front: a description, where you ship from, and your first artwork. A fourth gets you paid.',
  descriptionHtml:
    '<p>Welcome to Collect Art, the market of the Elkdonis Arts Collective. Your store is open. Three steps finish its front, and each one is the real thing: the description you write is the one collectors read, the address you give is the one couriers quote from, and the artwork you add goes on sale.</p>' +
    '<p>The first two are done in the dock, the small box in the corner of the market, without leaving the page. The artwork step takes you to the New artwork button. A step you have already done shows ticked.</p>' +
    '<p>Your store is not your directory page. The store is how you sell on the market; your page in the artist directory is your own space on the network, apart from any store or organisation. You can start the store’s description from your directory bio, and change either one later without touching the other.</p>',
  notes: 'Market store course seed',
  modules: [
    {
      id: 'store-front',
      title: 'The front of your store',
      summary: 'What collectors read, and where your work ships from.',
      steps: [
        task('store-front', 'describe-your-store', 'Describe your store front', 'Two or three lines collectors read above your work.',
          '<p>The description sits at the top of your store page, above your work. Two or three lines are enough: what you make, how, and anything a collector should know first. If your directory page already has a bio, you can start from it and trim it to fit the store.</p>',
          { settings: { minutes: 3 } }),
        task('ship-from', 'where-you-ship-from', 'Where you ship from', 'The address couriers quote and label from. Only the city shows.',
          '<p>When a collector checks out, couriers quote from this address, and labels are printed from it. It stays private: your store shows the city only. One address serves every store that sells your work. The courier needs a phone number for the label.</p>',
          { settings: { minutes: 2 } }),
        task('artwork', 'your-first-artwork', 'Add your first artwork', 'Photos, a title, the size and a price, then publish.',
          '<p>Press New artwork at the top of your store’s page. Add one to six photos (the first is the cover), the title, medium, size and year, and a price. Publish, and the piece is on sale on the market and on your directory page.</p>',
          { settings: { minutes: 10 } }),
      ],
    },
    {
      id: 'get-paid',
      title: 'Get paid',
      summary: 'Where sales are paid.',
      steps: [
        task('payouts', 'get-paid', 'Set up payouts', 'Connect the account your sales are paid into.',
          '<p>Card payments reach you through Stripe, into your own bank account. Stripe asks for your identity and bank details once, and the collective never sees them. The collective keeps five percent of each sale to run the market; an organisation takes a share only where you have agreed to it. Until payouts are set up, sales still go through and your share is held for you.</p>',
          { required: false, settings: { minutes: 10 } }),
      ],
    },
  ],
};

if (DRY) {
  console.log(`[dry] would seed course '${SLUG}' (org ${ORG}, ${spec.visibility}): ${spec.title}`);
  for (const m of spec.modules) {
    console.log(`  module ${m.id}: ${m.title}`);
    for (const s of m.steps) console.log(`    ${s.slug}  task=${(s.settings as { task?: { id: string } })?.task?.id}  required=${s.required !== false}  "${s.title}"`);
  }
  console.log(`  then: area='${AREA}', builds_on=${JSON.stringify(BUILDS_ON)}; publish v1; default run opened.`);
  const [have] = await db<Array<{ id: string }>>`SELECT id FROM lms_courses WHERE slug = ${SLUG} LIMIT 1`;
  console.log(`  course row exists now: ${have ? 'yes (' + have.id + ')' : 'no'}`);
  await db.end();
  process.exit(0);
}

const [guide] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE email = ${GUIDE_EMAIL} LIMIT 1`;
if (!guide) throw new Error(`guide user missing: ${GUIDE_EMAIL}`);
const viewer: LmsViewer = { userId: guide.id, roles: { [ORG]: 'guide' } };

const { course, defaultRun } = await seedCourse(viewer, spec);
await db`UPDATE lms_courses SET area = ${AREA}, builds_on = ${BUILDS_ON}::text[], updated_at = NOW() WHERE id = ${course.id}`;
console.log(`[${SLUG}] course ${course.id}, default run ${defaultRun?.id ?? '(none)'}; tagged ${AREA}, builds on ${BUILDS_ON.join(', ')}`);
await db.end();
