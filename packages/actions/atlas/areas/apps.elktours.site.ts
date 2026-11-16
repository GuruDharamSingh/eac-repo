import type { Area, Capability, Host, HostKey } from '../types';

// elktours site-level actions: the site settings, the Discover feed (guide posts and the office queue), the reminder tick.
// 2026-11-16, round 2 curator (elktours). Roles: lib/auth.ts (owner and guide are editors; isMember adds member).

const APP = 'elktours';
const SRC = 'apps/elktours/src/';
const V = '2026-11-16 read app/manage/settings/actions.ts, lib/site-settings.ts, lib/feed-actions.ts, lib/reminders.ts, lib/suggest.ts (cache), lib/auth.ts, components/mobile/{settings-view,share-post-view,feed-review-view}.tsx and app/manage/feed-review/page.tsx (imports), src/instrumentation.ts';
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });

const capabilities: Capability[] = [
  {
    id: 'elktours-settings-save',
    area: 'elktours.site',
    label: 'Save the site settings',
    does: 'An owner chooses what happens when a departure closes below its minimum (the guide decides, or it is cancelled and refunded automatically) and whether guides\' feed posts wait for the office before going public.',
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      host(sa('app/manage/settings/actions.ts', 'saveSettingsAction'), ['saveSiteSettings'], '/manage/settings', "the 'Below the minimum' and 'Guides\' posts' switches (components/mobile/settings-view.tsx)"),
      { key: sq('lib/site-settings.ts', 'saveSiteSettings'), service: ['raw SQL INSERT/UPDATE site_config via withOrg'], note: 'inner writer; this is where the owner check lives (viewer.role === owner)' },
    ],
    entry: null,
    status: "a site_config row key elktours:settings for the org holds the chosen values",
    risk: ['money', 'public'],
    confirm: { text: 'Save the site settings for {org}? "Cancel and refund" cancels any slot that closes below its minimum without asking the guide. Payments happen on the checkout or Stripe page, not here.', status: 'draft', wave: 6 },
    inputs: 'belowMinimumRule (guide_decides or auto_cancel), holdGuidePosts',
    drift: 'None: single copy. The owner check is in the lib function, not the action wrapper.',
    open: 'Good: the owner check, value validation and org-scoped withOrg write are in saveSiteSettings (lib/site-settings.ts:55-73). A refund by auto_cancel follows the departure cancel path, whose refund handling is not issued by code (see the booking rows in orgapps.commerce.tours.ts). Preview fixtures refuse the save (fixturesOn).',
    verified: V,
  },
  {
    id: 'elktours-feed-post-submit',
    area: 'elktours.site',
    label: 'Share a post or link to the feed',
    does: "A guide or owner shares a post or a link to the public Discover feed. A guide's post waits for the office when the hold setting is on; an owner's publishes at once. Links are checked as public addresses and shown as a preview card.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('lib/feed-actions.ts', 'submitFeedPostAction'), ['@elkdonis/services#createThread', '@elkdonis/services#statusForNewThread', '@elkdonis/utils/unfurl#assertPublicUrl', '@elkdonis/utils/unfurl#unfurl'], '/manage/share', 'the Share button (components/mobile/share-post-view.tsx)'),
    ],
    entry: null,
    status: 'a threads row of kind post in the feed section exists, status pending or published',
    risk: ['public'],
    confirm: { text: 'Share “{title}” on the {org} feed? Visitors can see it once it is published.', status: 'draft', wave: 6 },
    inputs: 'title, body, optional link',
    drift: 'Different from the generic post path (createPostAnywhere, createWritingPost, createThread): this one escapes the body to paragraphs itself and always sets visibility PUBLIC.',
    canonical: '@elkdonis/services#createThread behind the shared post kit action',
    open: 'Good: body is HTML-escaped before it becomes paragraphs (lib/feed-actions.ts:52); the link goes through assertPublicUrl before the fetch, and link preview data is stored in metadata. The unfurl fetch follows redirects inside unfurl (not re-read here).',
    verified: V,
  },
  {
    id: 'elktours-feed-post-review',
    area: 'elktours.site',
    label: 'Confirm or decline a guide post',
    does: "An owner approves (publishes) or declines a guide's pending feed post.",
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      host(sa('lib/feed-actions.ts', 'reviewFeedPostAction'), ['@elkdonis/services#reviewThread'], '/manage/feed-review', 'the Put on Discover and Decline buttons (components/mobile/feed-review-view.tsx)'),
    ],
    entry: null,
    status: 'the post threads row has status published or rejected',
    risk: ['public', 'others'],
    confirm: { text: 'Put {person}’s post “{title}” on the feed, or decline it? The author will see your decision.', status: 'draft', wave: 6 },
    inputs: 'post id, approve or decline',
    drift: 'Same pattern as elktours-experience-decide: owner decides through reviewThread with approverRoles owner.',
    canonical: '@elkdonis/services#reviewThread',
    open: 'Owner-only; the post lookup is by id, org, feed section and kind.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [
  { key: sq('lib/suggest.ts', 'cached'), why: 'cache write: stores Photon and Overpass answers in geo_suggest_cache (7 days) as a side effect of a read-only map search; not a person action' },
];

const area: Area = { capabilities, ignored };
export default area;
