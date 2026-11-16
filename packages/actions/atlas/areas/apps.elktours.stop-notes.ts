import type { Area, Capability, Host, HostKey } from '../types';

// elktours stop excerpts and private stop notes "from the event" (editors only).
// 2026-11-16, round 2 curator (elktours). Notes never reach a public page; promoting a note copies it into the stop's
// public excerpt (tour_stops.excerpt, migration 239).

const APP = 'elktours';
const SRC = 'apps/elktours/src/';
const F = 'lib/stop-note-actions.ts';
const V = '2026-11-16 read lib/stop-note-actions.ts, lib/auth.ts, components/tours/stop-admin.tsx (imports)';
const sa = (fn: string): HostKey => `sa:${SRC}${F}#${fn}` as HostKey;
const sq = (fn: string): HostKey => `sql:${SRC}${F}#${fn}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });
const twin = (key: HostKey, of: HostKey): Host => ({ key, service: ['raw SQL'], note: `twin of ${of}` });

const ADMIN = 'components/tours/stop-admin.tsx';

const capabilities: Capability[] = [
  {
    id: 'elktours-stop-note-add',
    area: 'elktours.stop-notes',
    label: 'Add a private note to a stop',
    does: 'An editor writes a private note on a tour stop from a run (optionally tied to a departure or a date). Plain text, up to 8000 characters; never shown publicly.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('addStopNoteAction'), ['raw SQL INSERT tour_stop_notes'], '/manage/tours/{id}/stops', 'the note box under a stop, shown "Editors only" (' + ADMIN + ')'),
      twin(sq('addStopNoteAction'), sa('addStopNoteAction')),
    ],
    entry: null,
    status: 'a tour_stop_notes row for the stop with the body exists',
    risk: ['none'],
    confirm: { text: 'Save this private note on the stop? Only editors can read it.', status: 'draft', wave: 6 },
    inputs: 'stop id, body, optional departure id, optional run date',
    drift: 'None: single copy.',
    open: 'SECURITY (security doc #33 pattern): any guide can add notes to a stop on any tour; the stop is checked by id and org only (lib/stop-note-actions.ts:48-55). Tags are stripped from the body with a regex; the notes are only rendered inside the editor tool.',
    verified: V,
  },
  {
    id: 'elktours-stop-note-delete',
    area: 'elktours.stop-notes',
    label: 'Delete a private stop note',
    does: 'Deletes a private stop note.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('deleteStopNoteAction'), ['raw SQL DELETE tour_stop_notes'], '/manage/tours/{id}/stops', 'the delete control on a note in Past notes (' + ADMIN + ')'),
      twin(sq('deleteStopNoteAction'), sa('deleteStopNoteAction')),
    ],
    entry: null,
    status: 'no tour_stop_notes row for the id',
    risk: ['irreversible'],
    confirm: { text: 'Delete this private note? This cannot be undone.', status: 'draft', wave: 6 },
    inputs: 'note id',
    drift: 'None: single copy.',
    open: 'A guide can delete another guide\'s notes: the only filter is org_id (lib/stop-note-actions.ts:133), no author check.',
    verified: V,
  },
  {
    id: 'elktours-stop-note-promote',
    area: 'elktours.stop-notes',
    label: 'Promote a note to the stop text',
    does: "Copies a private note (optionally shortened or edited, max 300 characters, plain text) into the stop's public excerpt and marks the note as promoted.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('promoteStopNoteAction'), ['writeExcerpt (raw SQL)', 'raw SQL UPDATE tour_stop_notes'], '/manage/tours/{id}/stops', 'the Promote control on a note (' + ADMIN + ')'),
      twin(sq('promoteStopNoteAction'), sa('promoteStopNoteAction')),
    ],
    entry: null,
    status: 'tour_stops.excerpt equals the note text and the note has promoted_at set',
    risk: ['public'],
    confirm: { text: 'Show this note as the public text of the stop? Visitors will see it on the tour page.', status: 'draft', wave: 6 },
    inputs: 'note id, optional shortened text',
    drift: 'None: single copy.',
    open: 'Same missing guide-ownership check as the other stop-note actions. The public excerpt is rendered by the tour popup (not read here).',
    verified: V,
  },
  {
    id: 'elktours-stop-excerpt-set',
    area: 'elktours.stop-notes',
    label: "Set a stop's short text",
    does: "Sets or clears the stop's short public excerpt (one or two lines for the tour popup; plain text, max 300).",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('setStopExcerptAction'), ['writeExcerpt (raw SQL)'], '/manage/tours/{id}/stops', 'the short-text field of a stop (' + ADMIN + ')'),
      { key: sq('writeExcerpt'), service: ['raw SQL UPDATE tour_stops'], note: 'inner writer; also reached by promoteStopNoteAction' },
    ],
    entry: null,
    status: 'tour_stops.excerpt for the stop equals the text (or null)',
    risk: ['public'],
    confirm: { text: 'Set the public text of this stop? Visitors will see it on the tour page.', status: 'draft', wave: 6 },
    inputs: 'stop id, excerpt or null',
    drift: 'None: single copy.',
    open: 'No ownership check for guides on a stop (stopRow filters by org only).',
    verified: V,
  },
];

const ignored: Area['ignored'] = [
  { key: sa('listStopNotesAction'), why: 'read exposed as a server action' },
  { key: sa('listTourStopNotesAction'), why: 'read exposed as a server action; no caller found' },
  { key: sa('updateStopNoteAction'), why: 'dead: no caller in the repo (the notes panel has add, delete and promote only)' },
  { key: sq('updateStopNoteAction'), why: `twin of ${sa('updateStopNoteAction')} (dead)` },
];

const area: Area = { capabilities, ignored };
export default area;
