import type { Area, Capability, Host, HostKey } from '../types';

// apps/development: the Sites door, the development organisation's own pages, and the sandbox's versions.
// 2026-11-21, closeout curator (added). Read: lib/sites-actions.ts, sites-pages-actions.ts, versions-actions.ts, versions.ts,
// sites.ts (adminOrThrow), gate.ts (getNetworkAdmin), packages/page-builder/src/drafts.ts.
//
// The gate is one: `getNetworkAdmin()` (users.is_admin through @elkdonis/auth-server), called first in every action;
// a signed-out or non-admin caller gets an error (the Sites door and the pages actions throw, the versions actions answer
// "denied"). The organisation is taken from the page the admin opened and must exist (sites door), or is fixed to
// `development` (pages actions). Nothing here is reachable by an organisation's own members.

const APP = 'development';
const SRC = 'apps/development/src/lib/';
const V = '2026-11-21 read lib/sites-actions.ts, sites-pages-actions.ts, sites-pages-core.ts, versions-actions.ts, versions.ts, sites.ts, gate.ts, packages/page-builder/src/drafts.ts';
const sa = (f: string, fn: string): HostKey => `sa:${SRC}${f}#${fn}` as HostKey;
const sq = (f: string, fn: string): HostKey => `sql:${SRC}${f}#${fn}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });
const twin = (key: HostKey, of: HostKey): Host => ({ key, service: ['raw SQL'], note: `sql twin of ${of}` });

const SITES = '/sites/{org}/{slug}';

const capabilities: Capability[] = [
  {
    id: 'dev-site-draft-save',
    area: 'development.sites',
    label: "Save a draft of another organisation's page",
    does: "A network admin changes a page of any organisation through the Sites door (words, look, blocks as steps). The steps are applied on the server to the page as stored and the result is kept as that page's draft; the published page is not touched.",
    class: 'admin',
    actors: ['admin'],
    scope: 'org',
    hosts: [
      host(sa('sites-actions.ts', 'saveSiteDraft'), ['getNetworkAdmin (adminOrThrow)', 'applySteps (sites-door)', '@elkdonis/page-builder/server#saveDraft'], SITES, 'the Words, Look, Blocks and Assistant hands of the Sites tab'),
    ],
    entry: null,
    status: "a site_config row puck-draft:<slug> for the org holds the steps' result",
    risk: ['none'],
    inputs: 'org, page slug, steps (at most 60), the version the screen opened, note',
    drift: 'None: single copy. The draft store is pkg-page-builder-draft-save.',
    canonical: 'page-builder saveDraft (already the single writer)',
    open: 'Compare-and-set both ways: the live page version and the waiting draft are checked against what the screen opened, and the draft write is one conditional statement, so a change made elsewhere is refused (stale), not overwritten. The draft author is labelled "Network admin, development app" with the admin id; no address is kept.',
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'dev-site-draft-publish',
    area: 'development.sites',
    label: "Publish a waiting draft of another organisation's page",
    does: "A network admin makes the waiting draft the live page. Refused for a page with an older layout or a block this app cannot check, and when the live page changed since the draft began (the draft is kept).",
    class: 'admin',
    actors: ['admin'],
    scope: 'org',
    hosts: [
      host(sa('sites-actions.ts', 'publishSiteDraft'), ['getNetworkAdmin (adminOrThrow)', '@elkdonis/page-builder/server#publishDraft', 'cleanBoxDoc(stripResolvedKeys)'], SITES, 'the Publish button of the draft review on the Sites tab'),
    ],
    entry: null,
    status: 'the site_config row puck:<slug> holds the draft data and the draft row is gone',
    risk: ['public'],
    inputs: 'org, page slug, the draft version the screen opened',
    drift: 'None: single copy. The store is pkg-page-builder-draft-publish.',
    canonical: 'page-builder publishDraft (already the single writer)',
    open: 'The only gate is the network-admin check; this reaches the live page of ANY organisation, including its published URL at once. The cleaner passes an empty resolver table (a draft is built from the stored page, which never held resolver output). It writes no audit row (the draft keeps its author and steps, which are deleted with it).',
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'dev-site-draft-discard',
    area: 'development.sites',
    label: "Throw away a waiting draft of another organisation's page",
    does: 'Deletes the waiting draft of one page. The published page is not touched.',
    class: 'admin',
    actors: ['admin'],
    scope: 'org',
    hosts: [
      host(sa('sites-actions.ts', 'discardSiteDraft'), ['getNetworkAdmin (adminOrThrow)', '@elkdonis/page-builder/server#discardDraft'], SITES, 'Throw away on the draft review of the Sites tab'),
    ],
    entry: null,
    status: 'no site_config row puck-draft:<slug> for the org',
    risk: ['irreversible'],
    inputs: 'org, page slug',
    drift: 'None: single copy. The store is pkg-page-builder-draft-discard.',
    open: 'Unconditional: it does not check that the draft is the one the screen opened, so it can throw away a draft saved a moment ago by someone else.',
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'dev-page-create',
    area: 'development.pages',
    label: "Start a new page of the development organisation",
    does: 'A network admin starts a page from a title as a draft in the `development` organisation. Refused when a page or a draft already has that address.',
    class: 'admin',
    actors: ['admin'],
    scope: 'org',
    hosts: [
      host(sa('sites-pages-actions.ts', 'createPageAction'), ['getNetworkAdmin (adminOrThrow)', 'createDraftPage (sites-pages-core)', '@elkdonis/page-builder/server#saveDraft'], '/pages', 'New page on /pages'),
    ],
    entry: null,
    status: 'a site_config row puck-draft:<slug> for org development exists',
    risk: ['none'],
    inputs: 'title',
    drift: 'None: single copy.',
    open: 'The organisation is fixed to `development` in code, never taken from the request. Nothing is live until the draft is published from the Sites tab.',
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'dev-page-words-save',
    area: 'development.pages',
    label: "Type on a page of the development organisation",
    does: "A network admin changes a word on a published page of the `development` organisation, on the page itself, as one step through the page's own checked save. The change goes live at once, with the stale-save guard.",
    class: 'admin',
    actors: ['admin'],
    scope: 'org',
    hosts: [
      host(sa('sites-pages-actions.ts', 'pagesFieldsSave'), ['getNetworkAdmin (adminOrThrow, then the lens authorize again)', 'createBlockFields (house-editor)', 'createSavePageAction (house-editor)', '@elkdonis/page-builder/server#savePage'], '/pages/{slug}', 'click a marked word on the page and type'),
    ],
    entry: null,
    status: 'the site_config row puck:<slug> for org development holds the typed word',
    risk: ['public'],
    inputs: 'field reference (block:<page>:<id>:<prop>), values, the page version the screen opened',
    drift: 'The same lens door as elktours, hidden-enneagram and innergathering (fields-block-save), with a different gate (network admin) and a fixed organisation.',
    canonical: 'createSavePageAction (house-editor), already shared.',
    open: 'Goes live with no draft step: the gate is the guard, and the development organisation has no public address (migration 283).',
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'dev-versions-save',
    area: 'development.versions',
    label: "Save or autosave a version of a block's sandbox",
    does: "A network admin saves a named version of a block's sandbox document (a branch starts when the parent already has a child), or autosaves the one working copy per block and person.",
    class: 'admin',
    actors: ['admin'],
    scope: 'other',
    hosts: [
      host(sa('versions-actions.ts', 'versionsSave'), ['getNetworkAdmin', 'saveVersion (versions.ts)'], '/', 'Save in the block workbench versions bar', 'writes dev_versions (migration 281), then deletes the author\'s draft'),
      host(sa('versions-actions.ts', 'versionsAutosave'), ['getNetworkAdmin', 'saveDraft (versions.ts)'], '/', 'the block workbench autosaves while typing (components/blocks/versions/useVersions.ts)', 'upserts the one draft row per (subject, author)'),
      twin(sq('versions.ts', 'saveVersion'), sa('versions-actions.ts', 'versionsSave')),
      twin(sq('versions.ts', 'saveDraft'), sa('versions-actions.ts', 'versionsAutosave')),
    ],
    entry: null,
    status: 'a dev_versions row for the subject exists with the saved document',
    risk: ['none'],
    inputs: 'subject (block:<app>:<id>), base version id, note, document (at most 1 MB), theme, branch name',
    drift: 'None: single copy.',
    open: 'Sandbox storage only (dev_versions); no page, site or live block reads it. A version is never updated or deleted, only the working copy is overwritten.',
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'dev-versions-discard',
    area: 'development.versions',
    label: 'Throw away the working copy of a block sandbox',
    does: 'Deletes the signed-in admin\'s own working copy for one block. Saved versions are not touched.',
    class: 'admin',
    actors: ['admin'],
    scope: 'other',
    hosts: [
      host(sa('versions-actions.ts', 'versionsDiscardDraft'), ['getNetworkAdmin', 'discardDraft (versions.ts)'], '/', 'Discard on the block workbench versions bar'),
      twin(sq('versions.ts', 'discardDraft'), sa('versions-actions.ts', 'versionsDiscardDraft')),
    ],
    entry: null,
    status: 'no dev_versions row of kind draft for the subject and the admin',
    risk: ['irreversible'],
    inputs: 'subject',
    drift: 'None: single copy.',
    open: 'Scoped to the caller (author_id = the admin), so one admin cannot discard another\'s working copy.',
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'dev-versions-keep',
    area: 'development.versions',
    label: 'Mark a sandbox version as the one to keep',
    does: 'Moves the "kept" mark to one saved version of a block sandbox, or clears it.',
    class: 'admin',
    actors: ['admin'],
    scope: 'other',
    hosts: [
      host(sa('versions-actions.ts', 'versionsKeep'), ['getNetworkAdmin', 'keepVersion / unkeepVersion (versions.ts)'], '/', 'Keep on a version in the block workbench versions bar'),
      twin(sq('versions.ts', 'keepVersion'), sa('versions-actions.ts', 'versionsKeep')),
      twin(sq('versions.ts', 'unkeepVersion'), sa('versions-actions.ts', 'versionsKeep')),
    ],
    entry: null,
    status: 'exactly one dev_versions row of the subject has kept = true (or none after clearing)',
    risk: ['none'],
    inputs: 'version id, keep on or off',
    drift: 'None: single copy.',
    open: 'Only the mark moves; no version is changed or deleted.',
    verified: V,
    added: '2026-11-21',
  },
];

const ignored: Area['ignored'] = [
  { key: sa('sites-pages-actions.ts', 'pagesFieldsLoad'), why: 'read exposed as a server action: a block\'s words and the page version for the live editor on /pages (admin-gated)' },
  { key: sa('versions-actions.ts', 'versionsList'), why: 'read exposed as a server action: the history of one subject (admin-gated)' },
  { key: sa('versions-actions.ts', 'versionsCounts'), why: 'read exposed as a server action: version counts per subject (admin-gated)' },
];

const area: Area = { capabilities, ignored };
export default area;
