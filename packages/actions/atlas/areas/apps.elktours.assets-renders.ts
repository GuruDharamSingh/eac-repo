import type { Area, Capability, Host, HostKey } from '../types';

// elktours asset registry (tour_assets: photos, films, posters, documents on a tour, a stop or a place) and the fly-over
// render requests (a film of the tour route rendered on the owner's PC by scripts/render-jobs.mts).
// 2026-11-16, round 2 curator (elktours). Editors are owner or guide (lib/auth.ts:16). Only owners accept, reject and
// re-queue fly-overs (ACCEPT_ROLES in lib/render-request-actions.ts:24).

const APP = 'elktours';
const SRC = 'apps/elktours/src/';
const AA = 'lib/asset-actions.ts';
const AS = 'lib/assets.ts';
const RA = 'lib/render-request-actions.ts';
const RR = 'lib/render-requests.ts';
const V = '2026-11-16 read lib/asset-actions.ts, lib/assets.ts (write functions), lib/render-request-actions.ts, lib/render-requests.ts (lifecycle and worker side), lib/tour-live-actions.ts caller, components/manage/{asset-panel,flyover-queue,flyover-panel}.tsx and mobile/tour-media-view.tsx (imports); scripts/render-jobs.mts header';
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });
const inner = (key: HostKey, what: string, note: string): Host => ({ key, service: [what], note });

const PANEL = 'components/manage/asset-panel.tsx';
const QUEUE = 'components/manage/flyover-queue.tsx';
const FPANEL = 'components/manage/flyover-panel.tsx';

const capabilities: Capability[] = [
  {
    id: 'elktours-asset-save',
    where: {"mode": "dock", "why": "A picture or file and a few words."},
    area: 'elktours.assets',
    label: 'Save a tour, stop or place asset',
    does: 'Registers or edits an asset (photo, film, poster, document) on a tour, an experience, a stop or a place: file or https link, role, caption, alt text, attribution and licence. New assets start hidden.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa(AA, 'upsertAssetAction'), ['raw SQL INSERT/UPDATE tour_assets (upsertAsset)'], '/manage/tours/{id}/assets', 'the Add and Save controls of the asset panel (' + PANEL + '; also the experience form and mobile/tour-media-view.tsx)'),
      inner(sq(AS, 'upsertAsset'), 'raw SQL INSERT/UPDATE tour_assets', 'inner writer: validates stop, tour and place belong to the org (assertOwners), url is /api/media/ or https'),
    ],
    entry: null,
    status: 'a tour_assets row for the org with the url exists',
    risk: ['none'],
    confirm: { text: 'Save {file} on {where}? It stays hidden until you show it.', status: 'draft', wave: 6 },
    inputs: 'kind, url, role, variant, caption, alt text, attribution, licence note, thread, stop or place',
    drift: 'None: single copy.',
    open: 'SECURITY: guides are not limited to their own tours; any editor registers or edits assets on any tour (security doc #33 pattern). Update path: lib/assets.ts:246-257 re-saves url and fields without re-checking that the asset belongs to a tour the editor owns; org filter is present. acceptableUrl allows any https URL and any /api/media/ path without ".." (lib/assets.ts:78-86), so the media proxy decides what a /api/media/ key may reach.',
    verified: V,
  },
  {
    id: 'elktours-asset-visible-set',
    area: 'elktours.assets',
    label: 'Show or hide an asset',
    does: "The per-asset visible switch. Showing a file from the org's Private folder first copies it to the public Media folder (photos are re-encoded without EXIF, GPS included). Showing a hero film retires the previous hero set and rewrites the tour's film cache.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa(AA, 'setAssetVisibleAction'), ['setAssetVisible', 'publishPrivateFile (Nextcloud WebDAV)', 'writeFilmCache'], '/manage/tours/{id}/assets', "the 'On the page' / visible switch of the asset panel (" + PANEL + ' and components/mobile/tour-media-view.tsx)'),
      inner(sq(AS, 'setAssetVisible'), 'raw SQL UPDATE tour_assets', 'inner writer for the visibility flip and hero retirement'),
      inner(sq(AS, 'publishPrivateFile'), 'raw SQL UPDATE tour_assets + Nextcloud COPY/PUT', 'copies Private/ to public Media/ when an asset is shown'),
      inner(sq(AS, 'writeFilmCache'), 'raw SQL UPDATE threads.metadata.film', 'rewrites the tour film cache after a hero change; also called by syncHeroFilmFromUrls'),
    ],
    entry: null,
    status: 'tour_assets.visible equals the requested value and the public file exists for private originals',
    risk: ['public'],
    confirm: { text: 'Mark {file} as {state} on the public page of {where}? Visitors will see it.', status: 'draft', wave: 6 },
    inputs: 'asset id, visible flag',
    drift: 'None: single copy.',
    open: [
      'Good: photos are re-encoded with sharp and refused if any GPS survives (lib/assets.ts stripImageMetadata).',
      'SECURITY: publishPrivateFile (lib/assets.ts:485) copies ANY file whose storage key starts with this org\'s Private folder; the key comes from an asset url an editor typed (upsertAsset accepts a /api/media/<key> url, :225-227). So an editor can register an asset on any private file in the org tree (including visitors\' suggestion photos and other editors\' originals) and publish it. Editors are trusted; the note is that Private/ has no per-person protection against editors.',
      'Hiding the hero film updates sibling rows by render_request_id without an org filter (:307, :325, :333) but the request ids are already org-bound.',
    ].join(' '),
    verified: V,
  },
  {
    id: 'elktours-asset-archive',
    area: 'elktours.assets',
    label: 'Archive an asset',
    does: 'Hides the asset first, then archives it (soft delete; the file stays in storage).',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa(AA, 'archiveAssetAction'), ['archiveAsset'], '/manage/tours/{id}/assets', 'the Archive control of the asset panel (' + PANEL + ' and components/manage/experience-form.tsx)'),
      inner(sq(AS, 'archiveAsset'), 'raw SQL UPDATE tour_assets', 'inner writer'),
    ],
    entry: null,
    status: 'tour_assets.archived_at is set for the id',
    risk: ['irreversible'],
    confirm: { text: 'Archive {file}? It disappears from the page and the asset list. This cannot be undone here.', status: 'draft', wave: 6 },
    inputs: 'asset id',
    drift: 'None: single copy.',
    open: 'No restore control found. Any editor can archive any tour\'s asset.',
    verified: V,
  },
  {
    id: 'elktours-asset-copy-to-stop',
    where: {"mode": "dock", "why": "Pick a place’s picture and a stop."},
    area: 'elktours.assets',
    label: 'Use a place photo on a stop',
    does: "Offers a catalogue place's asset to a stop on a tour: copies it into a stop row (same file, hidden, source place).",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa(AA, 'copyPlaceAssetToStopAction'), ['copyPlaceAssetToStop'], '/manage/tours/{id}/assets', "the 'From the places catalogue' offer in the asset panel (" + PANEL + ')'),
      inner(sq(AS, 'copyPlaceAssetToStop'), 'raw SQL INSERT tour_assets', 'inner writer; skips a duplicate copy'),
    ],
    entry: null,
    status: 'a tour_assets row for the stop with meta.fromPlaceAssetId exists',
    risk: ['none'],
    confirm: { text: 'Add this place photo to the stop on {where}? It stays hidden until you show it.', status: 'draft', wave: 6 },
    inputs: 'place asset id, stop id',
    drift: 'None: single copy.',
    verified: V,
  },
  {
    id: 'elktours-hero-film-sync',
    area: 'elktours.assets',
    label: "Sync a tour's hero film from its film bar",
    does: "When the tour page's film bar sets or clears the hero film, makes the matching film, 720 and poster assets the visible hero set (creating them if missing) and rewrites the tour's film cache.",
    class: 'internal',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      inner(sq(AS, 'syncHeroFilmFromUrls'), 'raw SQL UPDATE/INSERT tour_assets, writeFilmCache', 'called from lib/tour-live-actions.ts (patchTourAction film patch); film urls are validated there as our own media'),
    ],
    status: 'tour_assets rows with role hero are visible for the film urls',
    risk: ['public'],
    inputs: 'tour id, film urls, user id',
    drift: 'The hero film is written two ways: by this sync (from the film bar) and by setAssetVisible (from the asset panel). Both end in writeFilmCache.',
    canonical: 'lib/assets.ts#setAssetVisible as the single hero switch',
    open: 'New asset rows carry fixed attribution "Google, Cesium" and a 3D Tiles licence note (:408-409), whatever the real source of the film.',
    verified: V,
  },
  {
    id: 'elktours-flyover-request',
    area: 'elktours.renders',
    label: 'Request a fly-over film',
    does: "An editor asks for a 30-second fly-over film of a tour's route (style and a note). One open request per tour. The owners accept it before anything renders.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa(RA, 'requestFlyoverAction'), ['createRequest'], '/manage/tours/{id}/flyover', "the 'Request a fly-over film' button (" + FPANEL + ' and components/mobile/tour-media-view.tsx)'),
      inner(sq(RR, 'createRequest'), 'raw SQL INSERT tour_render_requests', 'inner writer; checks the tour is on this org and no open request exists'),
    ],
    entry: null,
    status: 'a tour_render_requests row with status requested exists for the tour',
    risk: ['none'],
    confirm: { text: 'Ask for a fly-over film of “{title}”? The owners will review it before it renders.', status: 'draft', wave: 6 },
    inputs: 'tour id, style, note',
    drift: 'None: single copy.',
    open: 'SECURITY (security doc #33 pattern): createRequest checks only that the thread is a tour of this org (lib/render-requests.ts:233), so a guide can request fly-overs for tours they do not own. The cost is render time on the owner\'s PC, gated by owner accept.',
    verified: V,
  },
  {
    id: 'elktours-flyover-accept',
    area: 'elktours.renders',
    label: 'Accept a fly-over request',
    does: 'An owner accepts a fly-over request: the route, stops and style are frozen into the render payload (at most 30 seconds, Paris only) and the job is queued for the render PC.',
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      host(sa(RA, 'acceptFlyoverAction'), ['acceptRequest'], '/manage/flyovers', 'the Accept button on a request (' + QUEUE + ')'),
      inner(sq(RR, 'acceptRequest'), 'raw SQL UPDATE tour_render_requests', 'inner writer; refuses a tour that is not renderable'),
    ],
    entry: null,
    status: 'tour_render_requests.status is accepted and payload_sha256 is set',
    risk: ['none'],
    confirm: { text: 'Accept the fly-over of “{title}”? It will render on the studio PC and arrive hidden for you to review.', status: 'draft', wave: 6 },
    inputs: 'request id, priority, auto-publish flag',
    drift: 'None: single copy.',
    open: 'Owner-only by ACCEPT_ROLES. The auto_publish flag is a parameter of the action; the UI passes off by default (lib/render-request-actions.ts:58).',
    verified: V,
  },
  {
    id: 'elktours-flyover-reject',
    area: 'elktours.renders',
    label: 'Reject a fly-over request',
    does: 'An owner rejects a requested or accepted fly-over with a reason.',
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      host(sa(RA, 'rejectFlyoverAction'), ['rejectRequest'], '/manage/flyovers', 'the Reject control on a request (' + QUEUE + ')'),
      inner(sq(RR, 'rejectRequest'), 'raw SQL UPDATE tour_render_requests', 'inner writer'),
    ],
    entry: null,
    status: 'tour_render_requests.status is rejected for the id',
    risk: ['others'],
    confirm: { text: 'Reject the fly-over request for “{title}”? The requester will see your reason.', status: 'draft', wave: 6 },
    inputs: 'request id, reason',
    drift: 'None: single copy.',
    verified: V,
  },
  {
    id: 'elktours-flyover-cancel',
    area: 'elktours.renders',
    label: 'Cancel a fly-over request',
    does: 'The requester, or any owner, cancels a request that is still requested or accepted.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa(RA, 'cancelFlyoverAction'), ['cancelRequest'], '/manage/flyovers', 'the Cancel control on a request (' + QUEUE + ' and ' + FPANEL + ')'),
      inner(sq(RR, 'cancelRequest'), 'raw SQL UPDATE tour_render_requests', 'inner writer'),
    ],
    entry: null,
    status: 'tour_render_requests.status is cancelled for the id',
    risk: ['none'],
    confirm: { text: 'Cancel the fly-over request for “{title}”?', status: 'draft', wave: 6 },
    inputs: 'request id',
    drift: 'None: single copy.',
    open: 'Good: requester or owner is checked (lib/render-request-actions.ts:83).',
    verified: V,
  },
  {
    id: 'elktours-flyover-requeue',
    area: 'elktours.renders',
    label: 'Re-queue a failed fly-over',
    does: 'An owner sends a failed request back to the queue with a fresh payload and the attempt count reset.',
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      host(sa(RA, 'requeueFlyoverAction'), ['requeueRequest'], '/manage/flyovers', 'the Re-queue control on a failed request (' + QUEUE + ')'),
      inner(sq(RR, 'requeueRequest'), 'raw SQL UPDATE tour_render_requests', 'inner writer'),
    ],
    entry: null,
    status: 'tour_render_requests.status is accepted with attempts 0 for the id',
    risk: ['none'],
    confirm: { text: 'Try the fly-over of “{title}” again?', status: 'draft', wave: 6 },
    inputs: 'request id',
    drift: 'None: single copy.',
    verified: V,
  },
  {
    id: 'elktours-flyover-worker',
    area: 'elktours.renders',
    label: 'Render worker takes and reports jobs',
    does: 'The render PC (scripts/render-jobs.mts) claims the next accepted job (with SKIP LOCKED, stale claims taken over), sends heartbeats and progress, and reports failures with retry. Delivery registers hidden assets and marks the request delivered in the script itself.',
    class: 'system',
    actors: ['system'],
    scope: 'org',
    hosts: [
      inner(sq(RR, 'claimNext'), 'raw SQL UPDATE tour_render_requests (FOR UPDATE SKIP LOCKED)', 'called by scripts/render-jobs.mts on the studio PC'),
      inner(sq(RR, 'heartbeat'), 'raw SQL UPDATE tour_render_requests', 'worker heartbeat and progress'),
      inner(sq(RR, 'failJob'), 'raw SQL UPDATE tour_render_requests', 'retryable codes go back to accepted while attempts remain'),
    ],
    status: 'tour_render_requests rows move claimed, rendering, delivered or failed with worker_id set',
    risk: ['none'],
    inputs: 'worker id, request id, progress, error code',
    drift: 'None.',
    open: 'The delivered and gate_failed updates are in scripts/render-jobs.mts (outside src, not an inventory host): the script writes tour_assets and the request row directly with SQL. Worker identity is a free-text worker id; there is no per-worker secret in these functions (the script holds DB access).',
    verified: V,
  },
];

const ignored: Area['ignored'] = [
  { key: sa(AA, 'listAssetsAction'), why: 'read exposed as a server action; no caller found' },
  { key: sa(RA, 'canAcceptFlyoversAction'), why: 'read: whether the viewer may accept (owner), used to show queue buttons' },
  { key: sa(RA, 'listRenderRequestsAction'), why: 'read exposed as a server action; no caller found' },
];

const area: Area = { capabilities, ignored };
export default area;
