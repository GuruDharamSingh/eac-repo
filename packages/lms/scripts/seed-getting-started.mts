// ============================================================================
// Seed "Getting started on the Arts Collective" — the onboarding course,
// served on the network host at arts-collective.com/learn/getting-started
// (docs/open/ONBOARDING_COURSE_BRIEF_2026-10-29.md). Most steps are `task`
// steps: they tick themselves when the thing they ask for exists on the
// platform (packages/actions/src/server/status.ts). Public; the network
// host enrols a signed-in visitor on first open.
//
// Safe to re-run: steps are matched by slug and publish is a no-op without
// changes. Remove with: DELETE FROM lms_courses WHERE slug = 'getting-started';
//
//   docker exec eac-sophia sh -c "cd /app/packages/lms && pnpm exec tsx scripts/seed-getting-started.mts"
// ============================================================================
import { db } from '@elkdonis/db';
import { newId } from '../src/util.ts';
import type { LmsViewer } from '../src/index.ts';
import { seedCourse, type SeedStep } from './seed-lib.mts';

const ORG = 'elkdonis';
const SLUG = 'getting-started';
const GUIDE_EMAIL = process.env.ONBOARDING_GUIDE_EMAIL ?? 'justin.gillisb@gmail.com';

const [guide] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE email = ${GUIDE_EMAIL} LIMIT 1`;
if (!guide) throw new Error(`guide user missing: ${GUIDE_EMAIL}`);
const viewer: LmsViewer = { userId: guide.id, roles: { [ORG]: 'guide' } };

const [meeting] = await db<Array<{ id: string }>>`
  SELECT id FROM threads WHERE org_id = 'inner_group' AND kind = 'meeting' AND status = 'published' AND visibility = 'PUBLIC'
    AND recurrence_pattern IS NOT NULL ORDER BY created_at LIMIT 1
`;

const task = (id: string, scope: 'person' | 'org', slug: string, title: string, summary: string, bodyHtml: string, extra: Partial<SeedStep> = {}): SeedStep => ({
  type: 'task', slug, title, summary, bodyHtml, ...extra, settings: { ...(extra.settings ?? {}), task: { id, scope } },
});

const { course } = await seedCourse(viewer, {
  orgId: ORG,
  slug: SLUG,
  title: 'Getting started on the Arts Collective',
  visibility: 'public',
  summary: 'Your place on the network, one step at a time: a profile, a page, something to offer, a way to be paid — and, if you want one, a collective of your own.',
  descriptionHtml:
    '<p>The Arts Collective is a place artists run for themselves: open source, not for profit, and yours to keep — your work and your files stay with you. This short course walks you through setting up what you need here. Each step does the real thing, not a rehearsal: the profile you fill in is your profile, the store you open is your store.</p>' +
    '<p>Take it in order or jump around. A step ticks itself off when the thing it asks for exists, so if you have already done some of this, you will find those steps done.</p>',
  notes: 'Getting-started seed',
  modules: [
    {
      id: 'arrive',
      title: 'Arrive',
      summary: 'Who you are here.',
      steps: [
        {
          type: 'reading', slug: 'what-this-is', title: 'What this is', summary: 'A network of sites run by and for artists, with one sign-in.', settings: { minutes: 3 },
          bodyHtml:
            '<p>You have one account for the whole network: the directory of artists, the market, the forum, the collectives that host their sites here, and this course. Sign in once and the other sites know you.</p>' +
            '<h2>What you can have</h2><ul><li><strong>A page</strong> in the artist directory, with your writing, your services and your work for sale.</li><li><strong>A store</strong> on the market, with payouts to your own account.</li><li><strong>A collective</strong> of your own: a site at its own address, with people, a calendar, files and mail.</li></ul>' +
            '<p>Nothing here is rented from a platform that can change its mind. The code is open, the collective is a not-for-profit, and everything you make stays yours.</p>',
        },
        task('profile', 'person', 'your-name-and-face', 'Your name and face', 'A name, a photo and one line about what you do.',
          '<p>This is what other people see of you everywhere on the network: on your page, next to what you write, in the directory. Three things are enough to start: your name as you want it shown, a photo, and one line about what you do.</p><p>You can come back and add a longer statement, where you are, and links to your other places.</p>',
          { settings: { minutes: 5 } }),
        task('gain-space', 'person', 'take-your-space', 'Take your space', 'A folder of your own and a place in the directory.',
          '<p>Taking your space gives you two things: a folder of your own on the collective’s cloud (images, audio, video, documents) and a listing in the artist directory. It makes you an artist of the collective. That is all it does; it signs you up for nothing else.</p>',
          { settings: { minutes: 1 } }),
        {
          type: 'reflection', slug: 'what-do-you-make', title: 'What do you make?', summary: 'A few words for yourself about the work you bring here.', required: false,
          settings: { minutes: 5, prompt: 'What do you make, and what would you like this place to do for it? Write for yourself first; nobody reads this unless you choose.' },
          bodyHtml: '<p>Not a form. A moment to say, in your own words, what you are here with. It stays private unless you decide otherwise.</p>',
        },
      ],
    },
    {
      id: 'your-page',
      title: 'Your page',
      summary: 'Where people find you.',
      steps: [
        task('listing', 'person', 'your-page-in-the-directory', 'Your page in the directory', 'Your address on the network, and the switch that lists you.',
          '<p>Your page lives in the artist directory at an address made from your name. Choose that address under Details in your profile, then make sure the directory switch under “Where you show” is on. If you took your space in the last module, it already is.</p>',
          { settings: { minutes: 3 } }),
        task('studio', 'person', 'write-your-first-piece', 'Write your first piece', 'Open the Studio, write something, publish it.',
          '<p>The Studio is where you write: an essay, a note, a page of thoughts. A published piece shows on your page in the directory. It can be short. Open the Studio, write a few lines, give it a title and press Publish.</p>',
          { settings: { minutes: 15 } }),
        task('show-on', 'person', 'show-it-where-you-belong', 'Show it where you belong', 'List a piece on a collective’s site as well as your own.', 
          '<p>A piece you publish is yours and shows on your page. If you belong to a collective on the network, you can also show it there, on their site, without copying it. “Show on” in your profile lists every piece and the sites that may carry it.</p>',
          { required: false, settings: { minutes: 3 } }),
        task('cloud', 'person', 'your-files', 'Your files', 'Link your cloud sign-in so your folders follow you.',
          '<p>Your folder lives on the collective’s cloud. To open it there directly — to upload from your phone, share a folder, or use the calendar — sign in to the cloud once with “Sign in with Elkdonis”. After that your folders appear within about ten minutes, and the sites here can file things into them for you.</p>',
          { required: false, settings: { minutes: 5 } }),
      ],
    },
    {
      id: 'offer',
      title: 'Offer and earn',
      summary: 'Something to offer, somewhere to sell, a way to be paid.',
      steps: [
        task('service', 'person', 'offer-a-service', 'Offer a service', 'A lesson, a commission, a reading, a workshop seat — on your page.',
          '<p>A service is something people can book from your page: a lesson, a sitting, a commission, a seat at a workshop. Give it a title, a line about it and a price (or leave the price blank for free), then publish it. It appears on your page with a booking button; payment arrives once you have set up payouts, below.</p>',
          { settings: { minutes: 10 } }),
        task('store', 'person', 'open-a-store', 'Open a store on the market', 'Your own store on the collective’s market.',
          '<p>The market is the collective’s shared store. Your store in it is yours: your works, your prices, your payouts. Opening it takes one press. The collective keeps five percent of each sale to run the place; the rest is yours.</p>',
          { settings: { minutes: 2 } }),
        task('artwork', 'person', 'put-up-a-work', 'Put up a work', 'One piece with a photo, a title and a price.',
          '<p>Add one work to your store: a photo, a title, the medium, the size, the price. You can add several in one sitting and publish them together. A work needs a photo to go up.</p>',
          { settings: { minutes: 10 } }),
        task('payouts', 'person', 'get-paid', 'Get paid', 'Connect the account your sales and bookings are paid into.',
          '<p>Sales and bookings are paid to you through Stripe, into your own bank account. Stripe asks for your details once — country, identity, bank — and brings you back here when it is done. The collective never sees your bank details; the connection is between you and Stripe.</p>',
          { settings: { minutes: 10 } }),
      ],
    },
    {
      id: 'collective',
      title: 'Your own collective',
      summary: 'A site of its own, for a group. Optional.',
      steps: [
        task('org', 'person', 'start-an-organisation', 'Name it and give it an address', 'A collective of your own, at its own address.',
          '<p>A collective is a group with a site of its own: an address under the network, a landing page, a calendar, people with roles, files and mail. If you run a studio, a reading circle, a company or a group of any kind, this is where it lives.</p><p>Give it a name and choose its address. The address becomes a site the moment the collective confirms it.</p>',
          { required: false, unlock: { kind: 'open' }, settings: { minutes: 5 } }),
        task('org-details', 'org', 'say-what-it-is-for', 'Say what it is for', 'A line, a description and an image for the site’s front.',
          '<p>Your site’s front is made from three things: a line about what it is, a description, and an image or logo. Fill them in and the site has a face before it has any posts.</p>',
          { required: false, unlock: { kind: 'open' }, settings: { minutes: 10 } }),
        task('org-offering', 'org', 'your-first-offering', 'Your first offering on your site', 'Publish something and pin it so it leads the site.',
          '<p>The site’s landing page leads with one thing: whatever you pin, or the latest thing you publish. From your console, publish a post, an event, a meeting or a service. Pin the one that should greet visitors.</p>',
          { required: false, unlock: { kind: 'open' }, settings: { minutes: 10 } }),
        task('org-people', 'org', 'who-is-in-it', 'Who is in it', 'Bring in the people and give them roles.',
          '<p>Anyone who signs in and follows your site is a viewer. You make them members, or guides who can publish and manage. Members get the collective’s folder on the cloud and its calendar.</p>',
          { required: false, unlock: { kind: 'open' }, settings: { minutes: 5 } }),
        task('org-email', 'org', 'mail-from-your-collective', 'Mail from your collective', 'A sending name and a reply-to address for letters and notices.',
          '<p>Your collective can send letters and notices — to members, to people who booked, to a list. Give it a sending name and a reply-to address so mail arrives as yours and replies come back to you. Sending from an address at your own domain is a separate step the collective sets up with you.</p>',
          { required: false, unlock: { kind: 'open' }, settings: { minutes: 5 } }),
        task('org-site', 'org', 'going-live', 'Going live', 'The address is confirmed by the collective and added to the edge.',
          '<p>Nothing to press here. A new address is confirmed by the collective and added to the network’s edge by an operator; until then visitors see “being set up” and you see everything. This step ticks when the site is live.</p>',
          { required: false, unlock: { kind: 'open' }, settings: { minutes: 1 } }),
      ],
    },
    {
      id: 'go-deeper',
      title: 'Go deeper',
      summary: 'The people, and the Path.',
      steps: [
        {
          type: 'practice', slug: 'introduce-yourself', title: 'Introduce yourself', summary: 'A few lines on the forum: who you are and what you make.', required: false,
          settings: { minutes: 10, practice: 'Open the Grand Forum, find the Arts Collective categories, and post a short introduction: who you are, what you make, what brought you here.' },
          bodyHtml: '<p>The forum is where the network talks: announcements, feedback, ideas, and the conversations of each collective. Every category is open to read; sign in to write.</p>',
          refs: { links: [{ url: `${process.env.FORUM_URL ?? process.env.NEXT_PUBLIC_FORUM_URL ?? 'https://forum.arts-collective.com'}/o/arts-collective`, title: 'The Arts Collective on the Grand Forum', description: 'Announcements, feedback and introductions.' }] },
        },
        ...(meeting ? [{
          type: 'session', slug: 'the-weekly-gathering', title: 'The weekly gathering', summary: 'The core group meets online every week. Come once.', required: false,
          refs: { threadId: meeting.id }, settings: { minutes: 60, prompt: 'What was it like?' },
          bodyHtml: '<p>The collective’s core group keeps a standing online meeting. It is open: come once, say hello, see how things are decided. The room opens from the gathering’s page; no account is needed to join the call.</p>',
        } as SeedStep] : []),
        {
          type: 'resource', slug: 'the-elkdonis-path', title: 'The Elkdonis Path', summary: 'The collective’s own curriculum, for when you want to go further.', required: false, settings: { minutes: 2 },
          bodyHtml: '<p>Beyond setting up, the collective offers a path of its own: a course of readings, practices and reflections taken at your own pace, with a guide who answers. It opens from the hub when it is ready for you.</p>',
          refs: { links: [{ url: '/hub/arts-collective#ekh-course', title: 'The Elkdonis Course, on the hub', description: 'Where the Path opens.' }] },
        },
      ],
    },
  ],
});

// Staff and the completion award, once.
await db`INSERT INTO lms_course_staff (course_id, user_id, role) VALUES (${course.id}, ${guide.id}, 'author') ON CONFLICT DO NOTHING`;
const [ach] = await db<Array<{ id: string }>>`SELECT id FROM lms_achievements WHERE course_id = ${course.id} LIMIT 1`;
if (!ach) {
  await db`
    INSERT INTO lms_achievements (id, org_id, course_id, name, description, criteria)
    VALUES (${newId()}, ${ORG}, ${course.id}, 'Settled in', 'Set up a profile, a page, something to offer and a way to be paid on the Arts Collective.', ${db.json({ kind: 'course_completed' })})
  `;
}
console.log(`[${SLUG}] ${course.id} org=${course.orgId} visibility=${course.visibility}`);
await db.end();
