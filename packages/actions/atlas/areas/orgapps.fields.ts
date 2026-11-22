import type { Area, Capability, Host, HostKey } from '../types';

// The Fields lens (live field editing): a person types a marked word on the page itself. 2026-11-21, closeout curator (added).
// Read: apps/{sunjay,hidden-enneagram,innergathering,elktours}/src/app/fields/actions.ts, elktours lib/fields-site.ts,
// fields-tour.ts, tour-fields.ts, sunjay lib/fields-blocks.ts, packages/house-editor/src/fields/{site,save,blocks}.ts.
//
// Every save action here is the same thin door: it hands the change to a per-kind route after `authorize()` (signed in and
// canEdit = owner or guide of the site's organisation, checked on every call, never from the request). Words of a block go
// through the site's own gated page save (the same checks as page-save, one `set_prop` step, stale-save guard included).
// Nothing is a draft: a save is live at once. The loads are reads exposed as server actions (ignored).

const V = '2026-11-21 read the four app/fields/actions.ts, lib/fields-site.ts, fields-tour.ts, tour-fields.ts, sunjay lib/fields-blocks.ts, house-editor fields/site.ts, save.ts';
const sa = (app: string, fn: string): HostKey => `sa:apps/${app}/src/app/fields/actions.ts#${fn}` as HostKey;
const sq = (fn: string): HostKey => `sql:apps/elktours/src/lib/tour-fields.ts#${fn}` as HostKey;
const host = (key: HostKey, app: string, service: string[], how: string, note?: string, c?: string): Host => ({
  key,
  service,
  address: { app, path: '/{page} (signed in as an editor)', how },
  ...(note ? { note } : {}),
  ...(c ? { case: c } : {}),
});
const twin = (key: HostKey, of: HostKey): Host => ({ key, service: ['raw SQL'], note: `sql twin of ${of}` });

const HOW = 'click a marked word on the page and type (the Fields lens)';
const BLOCK_PATH = ['(authorize: getViewer().canEdit = owner or guide)', 'createBlockFields: one set_prop step', "the site's savePageAction (createSavePageAction: gate, slug rules, resolver keys stripped, stale-save guard)", '@elkdonis/page-builder/server#savePage'];

const capabilities: Capability[] = [
  {
    id: 'fields-block-save',
    area: 'orgapps.fields',
    label: 'Type a word on a page',
    does: "An editor changes the words of one block on a published page by typing on the page itself. The change is one step through the site's own checked page save and is live at once. On Para Theater the same door also changes a section's words and the title of a post a card shows.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(
        sa('sunjay', 'saveFieldsAction'),
        'sunjay',
        ['(authorize: getViewer().canEdit)', 'createFieldsActions (house-editor)', 'blockFields -> savePageAction -> savePage', 'runHubAction(site-section-save) for a section', "performAction('thread-edit') for a post title"],
        HOW,
        'Three routes: block words (page save), a section (the hub runner site-section-save: hub gate, allow-list, merge, updated_by and an audit row), and a post title (thread-edit: the author or an owner or guide, with an audit row). A gathering or a series shows read only.'
      ),
      host(sa('hidden-enneagram', 'saveFieldsAction'), 'hidden-enneagram', BLOCK_PATH, HOW, 'Block words only. A post a card shows is read only here (this site does not depend on the actions package).'),
      host(sa('innergathering', 'saveFieldsAction'), 'innergathering', BLOCK_PATH, HOW, 'Block words only. A post a card shows is read only here.'),
      host(sa('elktours', 'saveFieldsAction'), 'elktours', BLOCK_PATH, HOW, 'Block words only for every kind except tour and tourstop, which go to elktours-tour-fields-save. The landing page is not marked (its slug is reserved for the canvas).', 'block-words'),
    ],
    entry: null,
    status: 'the site_config row puck:<slug> holds the typed word (a section row or the post title, on Para Theater)',
    risk: ['public'],
    confirm: { text: 'Save this wording on {org}’s site? Visitors see it at once.', status: 'draft' },
    inputs: 'field reference (block:<page>:<id>:<prop>, section or post on Para Theater), values, the page version the screen opened',
    drift: 'Four near-identical thin files; three of them (elktours, hidden-enneagram, innergathering) are one shared createSiteFields (house-editor). Only sunjay has its own copy, because it also routes sections and post titles.',
    canonical: 'house-editor createSiteFields, with sunjay moved onto it once its site depends on the same pieces.',
    open: 'No audit row for a block-words save on any site (page-save writes none either); only the two Para Theater routes that go through the runners leave one. Is a live word change on a published page meant to be unrecorded? The stale guard is optional in the page save (absent = unguarded) but the lens always sends the version it loaded.',
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'elktours-tour-fields-save',
    area: 'elktours.tours',
    label: "Change a tour's words on its own page",
    does: "The guide who leads a tour (or an owner) changes its title, what to expect, good-to-know bullets, contact line or one stop's line by typing on the tour page, or puts the previous version of one field back. One previous version per field is kept (who and when) in the same statement. Only a published, public tour can be changed from its page.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'thread',
    hosts: [
      host(sa('elktours', 'saveFieldsAction'), 'elktours', ['(authorize: canEdit)', 'tourFields.save -> saveTourFields / saveStopLine (lib/tour-fields.ts)', 'mayEditTour (per tour, every call)'], HOW, "Reached for the kinds tour and tourstop; every other kind is fields-block-save. The title change does not rewrite the slug.", 'tour'),
      host(sa('elktours', 'restoreFieldsAction'), 'elktours', ['(authorize: canEdit)', 'tourFields.restore -> putBackTourField / putBackStopLine', 'mayEditTour'], 'Put back the previous version beside a field the person has changed', 'Refuses any kind but tour and tourstop. The value it had trades places with the kept one, so putting back twice undoes itself.'),
      host(sq('saveTourFields'), 'elktours', ['raw UPDATE threads (title, excerpt, metadata.goodToKnow, .contact, .previousVersions)'], HOW, 'inner writer; also reached by putBackTourField'),
      twin(sq('saveStopLine'), sa('elktours', 'saveFieldsAction')),
    ],
    entry: null,
    status: "threads.title, excerpt or metadata for the tour (or tour_stops.excerpt for a stop) equals the typed value, and metadata.previousVersions holds the value it replaced",
    risk: ['public'],
    confirm: { text: 'Change this on the tour page? Visitors see it at once. The earlier wording is kept once, so you can put it back.', status: 'draft' },
    inputs: 'field reference (record:tour:<id>:<field> or record:tourstop:<id>:line), values, the version the screen opened',
    drift: 'Neither saveTourAction (the whole form, any owner or guide) nor setStopExcerptAction (any guide on any tour) is used: this door adds the per-tour check and the kept version, and keeps their cleaning limits (title 200, summary 300, bullets 30 x 300, stop line 300, plain text).',
    canonical: 'this door, for edits from the tour page; the office actions stay for the office.',
    open: 'GOOD: mayEditTour checks the person against THIS tour on every call: an owner, the tour\'s author, or a guide leading one of its coming dates; the tour must be published and public. The guide gate is narrower than the office actions\' (which let any guide change any tour). No audit row is written; the kept version records who and when for one step back only. The stop-line write is a single statement over tour_stops and the tour\'s metadata, so the line and its kept version change together or not at all.',
    verified: V,
    added: '2026-11-21',
  },
];

const ignored: Area['ignored'] = [
  { key: sa('sunjay', 'loadFieldsAction'), why: "read exposed as a server action: a record's stored words for the Fields lens (editors only)" },
  { key: sa('hidden-enneagram', 'loadFieldsAction'), why: "read exposed as a server action: a block's stored words for the Fields lens (editors only)" },
  { key: sa('innergathering', 'loadFieldsAction'), why: "read exposed as a server action: a block's stored words for the Fields lens (editors only)" },
  { key: sa('elktours', 'loadFieldsAction'), why: "read exposed as a server action: a block's, tour's or stop's words for the Fields lens (a tour's only for the person who may change it)" },
];

const area: Area = { capabilities, ignored };
export default area;
