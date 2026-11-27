import type { Area, Capability, Host, HostKey } from '../types';

// elktours tour-side actions that are not in lib/tour-actions.ts or lib/slot-actions.ts (those are claimed in
// orgapps.commerce.tours.ts and orgapps.cms.ts): the repeat scheduler, the hero lead, the tour page layout.
// 2026-11-16, round 2 curator (elktours).
//
// Re-check of the known lead (security doc #33), lib/tour-actions.ts: CONFIRMED. saveTourAction (:63), setTourStatusAction
// (:124), setTourPinnedAction (:141), saveStopsAction (:150), saveDepartureAction (:182), addDeparturesAction (:207),
// cancelDepartureAction (:229) and cancelBookingAction (:240) gate only on requireOrgEditor (owner OR guide of the org). None compares the
// tour's author_id (threads.author_id) with the viewer, and cancelDeparture / cancelTourBooking take (ORG, id) only,
// so any guide can edit, publish, schedule, cancel departures and cancel bookings (customers are emailed) on another
// guide's tours. lib/slot-actions.ts is the contrast: it enforces "guides act only on slots they lead or whose tour
// they wrote; owners on all" (:62-69, :130, :509). lib/collaborate-actions.ts also enforces author_id (:44, :120).
// The same gap repeats in the files mapped here: schedule-actions, hero-actions, stop-note-actions, asset-actions,
// render-request-actions, place-actions (stops).

const APP = 'elktours';
const SRC = 'apps/elktours/src/';
const V = '2026-11-16 read lib/schedule-actions.ts, lib/hero-actions.ts, app/studio/actions.ts, lib/tour-actions.ts (auth lines), lib/slot-actions.ts (auth lines), lib/departures.ts createDeparture, lib/auth.ts, components/manage/repeat-scheduler.tsx and mobile/tour-media-view.tsx (imports)';
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });
const twin = (key: HostKey, of: HostKey): Host => ({ key, service: ['raw SQL'], note: `twin of ${of}` });

const capabilities: Capability[] = [
  {
    id: 'elktours-schedule-repeat-create',
    area: 'elktours.tours',
    label: 'Repeat a tour on a schedule',
    does: "Creates dated departures for a tour from weekdays, start times, a date range, a capacity and an optional guide. The server re-plans against existing departures, so a slot added elsewhere is skipped, not doubled.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('lib/schedule-actions.ts', 'createScheduleAction'), ['@/lib/departures#createDeparture', 'planRepeat'], '/manage/schedule/new', "the 'Preview dates' then Create controls of the repeat scheduler (components/manage/repeat-scheduler.tsx)"),
    ],
    entry: null,
    status: 'tour departures (booking slots) exist for the tour at the planned times',
    risk: ['public', 'money'],
    confirm: { text: 'Add {count} dates for “{title}”, from {when}? They open for booking at once. Payments happen on the checkout or Stripe page, not here.', status: 'draft', wave: 6 },
    inputs: 'tour id, weekdays, times, from, to, capacity, guide user id',
    drift: 'Slot creation in slot-actions.ts (the mobile new-slots view) validates the guide with listGuides and limits guides to their own tours (:124-153); this action does neither: guideUserId is only a free string, and any editor can schedule any tour.',
    canonical: 'lib/slot-actions.ts plan() and createSlots as the single entry; retire the legacy schedule path when booking tables replace tour_departures',
    open: [
      'SECURITY: no ownership check: requireOrgEditor then getTourById by org only (lib/schedule-actions.ts:81, :50); a guide can create departures on another guide\'s tour.',
      'SECURITY: guideUserId is not checked against the org\'s guides (:22, :89-93) while slot-actions rejects a non-guide (slot-actions.ts:148-151). createDeparture (lib/departures.ts:97) goes through booking offers only when BOOKING_TABLES is on, otherwise the legacy path; the guide check there was not read.',
      'Departures are created one at a time in a loop with no transaction; a failure midway reports "N created, then: ..." (:98-103).',
    ].join(' '),
    verified: V,
    updated: '2026-11-24',
  },
  {
    id: 'elktours-hero-lead-set',
    area: 'elktours.tours',
    label: 'Choose what guests see first on a tour',
    does: "Sets which hero a tour page opens with (film, 3D map or photos), or clears the choice.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('lib/hero-actions.ts', 'setHeroLeadAction'), ['raw SQL UPDATE threads.metadata'], '/manage/tours/{id}/assets', "the 'Opens with' / 'What guests see first' choice of the tour media view (components/mobile/tour-media-view.tsx)"),
      twin(sq('lib/hero-actions.ts', 'setHeroLeadAction'), sa('lib/hero-actions.ts', 'setHeroLeadAction')),
    ],
    entry: null,
    status: 'threads.metadata.heroLead for the tour equals the choice',
    risk: ['public'],
    confirm: { text: 'Open the tour page of “{title}” with {state}? Visitors see it at once.', status: 'draft', wave: 6 },
    inputs: 'tour id, film, map3d, photos or null',
    drift: 'None: single copy.',
    open: 'SECURITY (security doc #33 pattern): update is WHERE id AND org_id AND kind tour only (lib/hero-actions.ts:19-23); a guide can change another guide\'s tour page.',
    verified: V,
  },
  {
    id: 'elktours-tour-cover-set',
    area: 'elktours.tours',
    label: 'Choose a tour\'s cover photo',
    does: "Sets or clears a tour's cover photo (threads.metadata.coverImageUrl): the picture in the tour page's arch and on its cards. Without one the phone tour page opens on the 3D route.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('lib/hero-actions.ts', 'setTourCoverAction'), ['raw SQL UPDATE threads.metadata'], '/manage/tours/{id}/assets', "the 'Cover photo' picker of the phone tour media view (components/mobile/tour-media-view.tsx)"),
      twin(sq('lib/hero-actions.ts', 'setTourCoverAction'), sa('lib/hero-actions.ts', 'setTourCoverAction')),
    ],
    entry: null,
    status: 'threads.metadata.coverImageUrl for the tour equals the chosen picture, or the key is absent',
    risk: ['public'],
    confirm: { text: 'Use this picture as the cover of “{title}”? Visitors see it at once.', status: 'draft', wave: 6 },
    inputs: 'tour id, a /api/media/ path or https URL, or null',
    drift: 'The desktop tour form writes the same key through saveTourAction (lib/tour-actions.ts) as part of the whole form.',
    open: 'None known: owners change any tour, guides only tours they wrote (author_id in the UPDATE).',
    verified: '2026-11-17 written with lib/hero-actions.ts setTourCoverAction; 2026-11-17 later: also writes metadata.coverFrame (focal point and zoom, checked 0-100 / 1-4), cleared with the cover',
  },
  {
    id: 'elktours-tour-photo-add',
    area: 'elktours.tours',
    label: 'Add a photo to a tour',
    does: "Adds a picture to a tour's gallery from the phone media screen's picker and shows it on the tour page at once. An upload or a picture from the site's library is used as it is; a picture from the person's own files must be in their library and is copied into the site's Media/Images with its metadata (GPS) removed.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('lib/asset-actions.ts', 'addTourPhotoAction'), ['@/lib/assets#upsertAsset', '@/lib/assets#setAssetVisible', '@/lib/assets#importPhotoToOrg'], '/manage/tours/{id}/assets', "the 'Add a photo' sheet of the phone tour photos section (components/mobile/tour-photos.tsx)"),
    ],
    entry: null,
    status: 'a visible tour_assets row of kind image, role gallery, exists for the tour with the picture',
    risk: ['public'],
    confirm: { text: 'Add this photo to “{title}”? It shows on the tour page at once.', status: 'draft', wave: 6 },
    inputs: 'tour id, a picture URL from an upload, the site library or the person\'s own files',
    drift: 'The desktop asset panel adds pictures through upsertAssetAction switched off; this path switches them on at once.',
    open: 'None known: owners any tour, guides only tours they wrote; a My files picture must be listed by listUserMediaLibrary for the caller.',
    verified: '2026-11-17 written with lib/asset-actions.ts addTourPhotoAction',
  },
  {
    id: 'elktours-tour-layout-publish',
    area: 'elktours.tours',
    label: 'Publish the tour page layout',
    does: 'Saves the shared layout (Puck blocks) of every tour page for the site (site_config puck:tour-detail). Unknown blocks are dropped before the write.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('app/studio/actions.ts', 'publishTourLayoutAction'), ['readTourLayout', '@elkdonis/page-builder/server#savePage'], '/studio/tour-detail', 'the Publish button of the tour layout studio (components/studio/layout-studio.tsx)'),
    ],
    entry: null,
    status: "a site_config row key puck:tour-detail exists for the org with the layout",
    risk: ['public'],
    confirm: { text: 'Publish this layout for every tour page on {org}? Visitors see it at once.', status: 'draft', wave: 6 },
    inputs: 'Puck data',
    drift: 'Same job as publishExperienceDefaultLayoutAction (elktours-experience-default-layout-publish) but that one writes site_config directly; this one uses the shared page-builder savePage.',
    canonical: '@elkdonis/page-builder/server#savePage',
    open: 'Gate is getApiEditor (owner or guide): any guide can replace the site-wide tour layout. The studio shows "Work in progress — layout edits may not be kept".',
    verified: V,
  },
];

const ignored: Area['ignored'] = [
  { key: sa('lib/schedule-actions.ts', 'previewScheduleAction'), why: 'read: plans the dates without writing' },
  { key: sa('lib/office-actions.ts', 'getScheduleSheet'), why: 'read: tours and upcoming runs for the hub Offer a tour popup (2026-11-19)' },
  { key: sa('lib/office-actions.ts', 'getPlaceSheet'), why: 'read: one place and its website for the hub Add a place popup (2026-11-19)' },
  { key: sa('lib/office-actions.ts', 'listPlaceSheet'), why: 'read: the places list for the Add a place popup catalogue view (2026-11-19)' },
  { key: sa('lib/office-actions.ts', 'getTourSheet'), why: 'read: one tour and its stops for the Create a tour wizard (2026-11-19)' },
  { key: sa('lib/office-actions.ts', 'listEditableTourSheet'), why: 'read: tours the viewer may open in the wizard, drafts and published (2026-11-26; was listDraftTourSheet)' },
  { key: sa('lib/office-actions.ts', 'nearbyPlaceSheet'), why: 'read: our places near a point for the wizard Route map (2026-11-19)' },
];

const area: Area = { capabilities, ignored };
export default area;
