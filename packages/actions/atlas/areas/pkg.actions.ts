import type { Area, Capability, Host, HostKey } from '../types';

// packages/actions: the action registry runners. 2026-11-16, round 3. Conventions: atlas/JOURNAL.md.
// Three raw SQL writes inside the runner table and the audit row. Each is an `internal` or `system` row that BACKS an
// app-facing row mapped in another file (named in `drift`). Read: server/run.ts (runners thread-publish, thread-pin,
// org-email, record), server/sb-runners.ts (site-section-save, page-create).

const SRC = 'packages/actions/src/server/';
const V = '2026-11-16 read packages/actions/src/server/{run.ts (thread-pin runner, org-email runner, record, actorType),sb-runners.ts (site-section-save)}';
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const hs = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: 'arts-collective', path, how }, note });

const capabilities: Capability[] = [
  {
    id: 'pkg-actions-thread-pin-runner',
    area: 'pkg.actions',
    label: 'Lead the site with a post (registry step)',
    does: 'The registry runner of thread-pin: makes one published public post the one that leads the organisation’s site, unpinning any other, in one transaction (or clears the pin).',
    class: 'internal',
    actors: ['owner', 'guide'],
    scope: 'thread',
    hosts: [
      hs(sq('run.ts', '<class>.run'), ['(raw UPDATE threads pinned, in db.begin)'], '/hub/organization?org={org}', 'the Lead the site with this button in the post popup (reached through the registry door, runAction); gate in the runner: hostDoor plus orgEditor', 'Only from the host’s own pages (hostDoor): an agent or the dock cannot run it.'),
    ],
    status: 'threads.pinned is true for exactly this post in the organisation',
    risk: ['public'],
    drift: 'backs arts-collective.hub:lead-site-with-post (the same effect through togglePinAction)',
    canonical: 'the registry runner (one pin writer for every app)',
    open: 'GOOD: both statements are in one transaction and the UPDATEs carry org_id (run.ts:~303-306); only a published PUBLIC post can lead (checked from the loaded thread, not the request).',
    verified: V,
  },
  {
    id: 'pkg-actions-site-section-save-runner',
    area: 'pkg.actions',
    label: 'Save a page’s copy slots (Site Builder runner)',
    does: 'The Site Builder runner of site-section-save: for each copy slot sent, merges the text into the organisation’s org_site_sections row (an empty field is dropped so the layout default shows).',
    class: 'internal',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      hs(sq('sb-runners.ts', '<class>.run'), ['(raw INSERT org_site_sections ON CONFLICT)'], '/hub/sites/{org}/pages', 'the copy fields of Site Builder (registry entry site-section-save, through the hub door); gate: canManageOrgPeople settled by the door'),
    ],
    status: 'org_site_sections has a row for (org, section_key) holding the merged content',
    risk: ['public'],
    drift: 'backs orgapps.cms:site-section-copy-save (the four /manage/pages copies of saveSectionAction) and the hub path of the same entry',
    canonical: 'this runner (merging, slot-checked)',
    open: 'GOOD: unlike the four app copies (which replace content and accept any key), this runner accepts only keys that are slots of the page template (sb-runners.ts:~57-63), merges, caps each value (zod, 20000 characters, 80 for keys) and records updated_by. It is the canonical path for site-section-save.',
    verified: V,
  },
  {
    id: 'pkg-actions-record-audit',
    area: 'pkg.actions',
    label: 'Record a registry step in the audit log',
    does: 'After every registry step (from the app, a script, the dock, a courier or MCP), writes one action_events row: the step, the person, actor type (human, ai, system by door), the organisation, the input (up to 4000 characters), the result and the duration.',
    class: 'system',
    actors: ['system'],
    scope: 'org',
    hosts: [
      hs(sq('run.ts', 'record'), ['(raw INSERT action_events)'], '/', 'no screen: written by runAction and performAction; read by the registry audit views'),
    ],
    status: 'an action_events row exists for the call with the actor type of its door',
    risk: ['none'],
    drift: 'backs arts-collective.network:run-registry-action; same table as pkg-mcp-audit-record',
    canonical: 'one audit writer for every door',
    open: 'Best effort: the audit row is written AFTER the action, and an insert failure or a missing table only logs (run.ts:~540-580), so a step can succeed with no audit row. A refused call’s input comes from the caller and is stored (cut to 4000 characters), including free text a person typed. The `via` is taken from the door, not from the request.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
