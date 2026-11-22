import type { Area, Capability, Host, HostKey } from '../types';

// elktours media folders and the pickers' lists. 2026-11-21, closeout curator (added).
// Read: lib/media-folder-actions.ts, lib/media-folders.ts, lib/puck/mobile-pick-actions.ts, mobile-buttons-actions.ts,
// lib/puck/actions.ts (listEditablePagesAction), docs/open/ELKTOURS_BLOCK_FORWARD_2026-11-21/MEDIA.md.
//
// The gate on the folder actions is `requireOrgEditor()` (signed in and canEdit = owner or guide; others are redirected).
// None checks WHICH tour or place: any guide may scan any tour's or place's folder.

const APP = 'elktours';
const SRC = 'apps/elktours/src/lib/';
const V = '2026-11-21 read lib/media-folder-actions.ts, media-folders.ts, auth.ts (requireOrgEditor), puck/mobile-pick-actions.ts, puck/mobile-buttons-actions.ts, puck/actions.ts';
const sa = (f: string, fn: string): HostKey => `sa:${SRC}${f}#${fn}` as HostKey;
const sq = (f: string, fn: string): HostKey => `sql:${SRC}${f}#${fn}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, ...(note ? { note } : {}) });
const twin = (key: HostKey, of: HostKey): Host => ({ key, service: ['raw SQL'], note: `sql twin of ${of}` });

const capabilities: Capability[] = [
  {
    id: 'elktours-media-folders-make',
    area: 'elktours.media-folders',
    label: 'Make the missing picture folders for tours and places',
    does: "Makes a folder under Tours/ for every tour and under Places/ for every place that has none, and records the folder name on the tour (threads.metadata.mediaFolder) or the place (places.media_folder). No picture is moved or changed.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('media-folder-actions.ts', 'backfillFoldersAction'), ['requireOrgEditor', 'backfillFolders -> ensureTourFolder / ensurePlaceFolder', 'WebDAV MKCOL'], '/manage/media-folders', 'the Make folders button of the folders menu'),
      host(sq('media-folders.ts', 'ensureTourFolder'), ['raw UPDATE threads (metadata.mediaFolder)'], '/manage/media-folders', 'inner writer; also run in the background when a tour is saved (ensureFolderSoon from saveTourAction)'),
      host(sq('media-folders.ts', 'ensurePlaceFolder'), ['raw UPDATE places (media_folder)'], '/manage/media-folders', 'inner writer; also run in the background when a place is saved (ensureFolderSoon from place-actions and custom-place-actions)'),
    ],
    entry: null,
    status: 'every tour has metadata.mediaFolder and every place has media_folder, and the folder exists in storage',
    risk: ['none'],
    confirm: { text: 'Make the missing folders for tours and places? No pictures are moved.', status: 'draft' },
    inputs: 'none',
    drift: 'None: single copy.',
    open: 'The two ensure* writers are also reached without this action: saveTourAction and the place saves call ensureFolderSoon, so a folder appears when a tour or place is saved by an owner or guide through the office forms (their own gates).',
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'elktours-media-folder-scan',
    area: 'elktours.media-folders',
    label: "Scan a tour's or place's folder for new pictures",
    does: "Registers the pictures found in one tour's or place's folder that no row points at yet, as hidden rows with the Commons credit when the file is found there. Files in Private/, films and documents are listed as skipped.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'thread',
    hosts: [
      host(sa('media-folder-actions.ts', 'scanFolderAction'), ['requireOrgEditor', 'scanFolder (media-folders.ts: registers each file through the asset helper with visible: false)'], '/manage/tours/{id}/assets', 'the Scan button on a tour\'s pictures or a place\'s page'),
    ],
    entry: null,
    status: 'a tour_assets row with visible = false exists for each new file in the folder',
    risk: ['none'],
    confirm: { text: 'Look in this folder and add any new pictures as hidden? Nothing shows on the site until you switch one on.', status: 'draft' },
    inputs: 'tour id or place id',
    drift: 'None: single copy.',
    open: 'Any guide may scan any tour or place (the action checks the role, not the tour). The rows it makes are hidden, so the public effect is nil until someone switches one on.',
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'elktours-media-register-in-place',
    area: 'elktours.media-folders',
    label: 'Register the old Stops/ pictures where they sit',
    does: "Records what each picture in the Stops/ folders is of (a stop, a place or the tour overview), as a picture row pointing at the file where it already is. Nothing is moved or copied. A row that already points at the file is updated, never doubled. The plan is recomputed on the server; the count the reviewer saw must still match.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('media-folder-actions.ts', 'registerStopsAction'), ['requireOrgEditor', 'planStopsMove (recomputed here)', 'registerInPlace'], '/manage/media-folders', 'the Register button of the folders menu, after the per-file choices'),
      host(sq('media-folders.ts', 'registerInPlace'), ['raw INSERT tour_assets (visible = true), raw UPDATE tour_assets (owner pointers)'], '/manage/media-folders', 'inner writer'),
    ],
    entry: null,
    status: 'each Stops/ picture has a tour_assets row pointing at its storage key with the chosen owner',
    risk: ['public'],
    confirm: { text: 'Register these pictures where they are, as shown? Pictures set to a stop or place will appear on the public tour pages. Nothing is moved.', status: 'draft' },
    inputs: 'the number of pictures the reviewer saw, a choice per file (stop, place, overview or leave)',
    drift: 'Replaces the old physical move (runStopsMove), which nothing calls any more.',
    canonical: 'registerInPlace',
    open: "NOTE: MEDIA.md describes registering the pictures 'where they already are'; the INSERT sets visible = true, so a registered picture shows on the public tour page at once, unlike Scan, which registers hidden. The action revalidates the whole site layout. A picture that records where it was taken is refused (hasGps). Any guide may run it for every tour.",
    verified: V,
    added: '2026-11-21',
  },
];

const ignored: Area['ignored'] = [
  { key: sq('media-folders.ts', 'runStopsMove'), why: 'dead: the old physical move of Stops/ pictures into Tours/ and Places/, no caller in the repo; registering in place (registerInPlace) replaced it (MEDIA.md)' },
  { key: sa('puck/actions.ts', 'listEditablePagesAction'), why: "read exposed as a server action: this site's saved pages for the canvas's page switcher (editors only; returns [] for anyone else)" },
  { key: sa('puck/mobile-buttons-actions.ts', 'mobileButtonsAction'), why: "read exposed as a server action: the m-page-buttons draw for the editor (every button with who it is for for an owner or guide; for anyone else only what their own session would see)" },
  { key: sa('puck/mobile-pick-actions.ts', 'mobileExperiencesPickAction'), why: 'read exposed as a server action: the experiences panel draw (public data)' },
  { key: sa('puck/mobile-pick-actions.ts', 'mobileGuidesPickAction'), why: 'read exposed as a server action: the guides draw (public data)' },
  { key: sa('puck/mobile-pick-actions.ts', 'mobileMenuAction'), why: 'read exposed as a server action: the phone menu draw' },
  { key: sa('puck/mobile-pick-actions.ts', 'mobileShelfAction'), why: 'read exposed as a server action: the places shelf draw (public data)' },
  { key: sa('puck/mobile-pick-actions.ts', 'tourCardsAction'), why: 'read exposed as a server action: the tour cards draw (public data)' },
  { key: sa('puck/mobile-pick-actions.ts', 'pickSourcesAction'), why: 'read exposed as a server action: the From what? sources for place, cover, guide, experience and tour (editors only; [] for anyone else)' },
  { key: sa('puck/mobile-pick-actions.ts', 'pickChoicesAction'), why: 'read exposed as a server action: the From what? choices (editors only; [] for anyone else)' },
  { key: sa('puck/mobile-pick-actions.ts', 'pickDrawAction'), why: 'read exposed as a server action: the label of a chosen record (editors only; null for anyone else)' },
];

const area: Area = { capabilities, ignored };
export default area;
