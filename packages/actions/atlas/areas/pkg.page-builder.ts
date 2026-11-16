import type { Area, Capability, Host, HostKey } from '../types';

// packages/page-builder: the Puck page stores. 2026-11-16, round 3. Conventions: atlas/JOURNAL.md.
// Three raw SQL writes: savePage (site pages in site_config), saveUserPage and publishUserPage (a person’s own
// pages in user_pages). All three validate the shape, sanitise rich text and cap size; NONE authorises (the caller
// must), so each row names the callers it backs.

const SRC = 'packages/page-builder/src/';
const V = '2026-11-16 read packages/page-builder/src/{store,user-store,user-page-key}.ts';
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const hs = (key: HostKey, service: string[], how: string, note?: string): Host => ({ key, service, address: { app: 'page-builder', path: 'packages/page-builder', how }, note });

const capabilities: Capability[] = [
  {
    id: 'pkg-page-builder-page-save',
    area: 'pkg.page-builder',
    label: 'Write a site page',
    does: 'Stores one designed (Puck) page of an organisation’s site in site_config under the key for the slug, after checking the slug is usable, sanitising rich text, validating the page shape and capping it at 512 KB.',
    class: 'internal',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      hs(sq('store.ts', 'savePage'), ['@elkdonis/blocks#sanitizeRichValues', '(raw INSERT site_config ON CONFLICT)'], 'the Publish button of the direct-edit canvas, through each app’s savePageAction', 'No authorisation inside: the app action checks the editor first.'),
    ],
    status: 'the site_config row for the page key holds the saved page',
    risk: ['public'],
    drift: 'backs orgapps.editing.ts:page-save (the savePageAction copies in seven apps, one writer here)',
    canonical: 'page-builder savePage (already the single writer)',
    open: 'GOOD: slug check (isValidPagePath), sanitizeRichValues, validatePage and a size cap before the write (store.ts:68-90). The record keeps no author or revision: the row is overwritten (updated_at only).',
    verified: V,
  },
  {
    id: 'pkg-page-builder-user-page-save',
    area: 'pkg.page-builder',
    label: 'Write a person’s own page draft',
    does: 'Stores the Puck design of one of a person’s own pages for an organisation in user_pages as a draft; a saved edit of a published page returns it to draft (the live copy is untouched until it is resubmitted).',
    class: 'internal',
    actors: ['person'],
    scope: 'person',
    hosts: [
      hs(sq('user-store.ts', 'saveUserPage'), ['@elkdonis/blocks#sanitizeRichValues', '(raw INSERT user_pages ON CONFLICT)'], 'the Save and Publish buttons of the person-page and store-panel editors', 'Keyed by (user, org, key); the user id comes from the caller’s session.'),
    ],
    status: 'a user_pages row for (user, org, key) holds the saved data with status draft',
    risk: ['none'],
    drift: 'backs apps.art-auction.rest.ts:market-store-panel-save and apps.artdirect.dossier.ts:artdirect-person-page-draft-save',
    canonical: 'page-builder saveUserPage',
    open: 'GOOD: key shape check, sanitising, validation, 512 KB cap (user-store.ts:116-129); the conflict update never raises status past draft. The function does not check that the org exists or that the person belongs to it (see the SECURITY note on market-store-panel-save).',
    verified: V,
  },
  {
    id: 'pkg-page-builder-user-page-publish',
    area: 'pkg.page-builder',
    label: 'Publish a person’s own page without review',
    does: 'Writes a person’s page straight to published (clearing any review stamp), for organisations whose person pages go live on Publish (ArtDirect).',
    class: 'internal',
    actors: ['person'],
    scope: 'person',
    hosts: [
      hs(sq('user-store.ts', 'publishUserPage'), ['@elkdonis/blocks#sanitizeRichValues', '(raw INSERT user_pages ON CONFLICT)'], 'the Publish button of the ArtDirect page designer', 'The caller must first check the org publishes without review (services publishesWithoutReview).'),
    ],
    status: 'a user_pages row for (user, org, key) holds the data with status published',
    risk: ['public'],
    drift: 'backs apps.artdirect.dossier.ts:artdirect-person-page-publish',
    canonical: 'page-builder publishUserPage',
    open: 'SECURITY (note): the function itself never checks that the org may publish without review; the comment makes that the caller’s duty (user-store.ts:151-161). A second caller that forgets bypasses the review queue.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
