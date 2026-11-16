import type { Area, Capability, Host, HostKey } from '../types';

// elktours visitor suggestions (spots, routes, artist or place leads) and the editors' queue.
// 2026-11-16, round 2 curator (elktours). Rule in code: any signed-in person with a user_organizations row for the org
// (followers included, Viewer.isAffiliate) may suggest, DAILY_LIMIT per rolling 24 h (lib/suggestion-limits.ts).

const APP = 'elktours';
const SRC = 'apps/elktours/src/';
const SG = 'lib/suggestion-actions.ts';
const LEAD = 'lib/suggest-lead-actions.ts';
const V = '2026-11-16 read lib/suggestion-actions.ts, lib/suggest-lead-actions.ts, lib/auth.ts, components/places/visitor-suggest.tsx, components/manage/suggestions-queue.tsx, components/mobile/suggest-view.tsx (imports)';
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });
const twin = (key: HostKey, of: HostKey): Host => ({ key, service: ['raw SQL'], note: `twin of ${of}` });

const capabilities: Capability[] = [
  {
    id: 'elktours-suggest-spot',
    area: 'elktours.suggestions',
    label: 'Suggest a spot',
    does: 'A follower drops a pin and suggests a place. It is saved as pending in the editors queue, not in the catalogue.',
    class: 'person',
    actors: ['person'],
    scope: 'org',
    hosts: [
      host(sa(SG, 'suggestSpotAction'), ['insertSpot (raw SQL)', 'reverseGeocode (Photon)'], '/places', "the 'Add a spot of your own' form on the places map (components/places/visitor-suggest.tsx)"),
      { key: sq(SG, 'insertSpot'), service: ['raw SQL INSERT visitor_suggestions'], note: 'inner insert, shared with suggestSpotFromPhotoAction' },
    ],
    entry: null,
    status: 'a visitor_suggestions row of kind spot and status pending exists for the person',
    risk: ['none'],
    confirm: { text: 'Send “{title}” to {org} as a suggestion? The team will look at it before anything is added.', status: 'draft', wave: 6 },
    inputs: 'title, why, lat, lng, address',
    drift: 'None: single copy.',
    open: 'Daily limit counted per person with a count-then-insert (no lock), so a burst of parallel calls can pass the limit. Note is tag-stripped.',
    verified: V,
  },
  {
    id: 'elktours-suggest-spot-from-photo',
    area: 'elktours.suggestions',
    label: 'Suggest a spot from a photo',
    does: "A follower uploads a photo (up to 25 MB, checked on its bytes). The photo's GPS or a pin gives the place; the photo is kept as a hidden private pending asset until an editor accepts.",
    class: 'person',
    actors: ['person'],
    scope: 'org',
    hosts: [
      host(sa(SG, 'suggestSpotFromPhotoAction'), ['storePrivatePhoto', 'readPhotoGeo (exifr)', 'insertSpot (raw SQL)', 'raw SQL INSERT tour_assets'], '/places', "the photo option of the suggest form (components/places/visitor-suggest.tsx)"),
      twin(sq(SG, 'suggestSpotFromPhotoAction'), sa(SG, 'suggestSpotFromPhotoAction')),
    ],
    entry: null,
    status: 'a visitor_suggestions row with photo_asset_id and a tour_assets row with source photo_pending exist',
    risk: ['none'],
    confirm: { text: 'Send your photo {file} to {org} as a suggestion? It stays private until the team accepts it.', status: 'draft', wave: 6 },
    inputs: 'photo file, title, why, optional lat/lng',
    drift: 'Same intake as the editor path elktours-place-create-from-photo.',
    canonical: 'one shared photo-intake helper (lib/photo-geo.ts)',
    open: 'SECURITY: a follower (lowest affiliate role) can write a 25 MB private file into the org Nextcloud tree and a tour_assets row; the only brake is DAILY_LIMIT. The asset insert and the suggestion insert are separate statements, so a failure between them leaves an orphan hidden asset.',
    verified: V,
  },
  {
    id: 'elktours-suggest-route',
    area: 'elktours.suggestions',
    label: 'Suggest a walking route',
    does: 'A follower orders 2 to 15 catalogue places or pins into a route. The server computes the walking preview and saves it as a pending suggestion.',
    class: 'person',
    actors: ['person'],
    scope: 'org',
    hosts: [
      host(sa(SG, 'suggestRouteAction'), ['walkingLegs (FOSSGIS foot routing)', 'raw SQL INSERT visitor_suggestions'], '/places', "the route tab of the suggest form (components/places/visitor-suggest.tsx)"),
      twin(sq(SG, 'suggestRouteAction'), sa(SG, 'suggestRouteAction')),
    ],
    entry: null,
    status: 'a visitor_suggestions row of kind route and status pending exists for the person',
    risk: ['none'],
    confirm: { text: 'Send your route “{title}” to {org}? The team will look at it before it becomes a tour.', status: 'draft', wave: 6 },
    inputs: 'title, note, items (place ids or pins, 2 to 15)',
    drift: 'None: single copy.',
    open: 'Each submit calls an external routing service (walkingLegs) for a follower; daily limit applies but previewRouteAction (a read) does not count against it and has no rate limit.',
    verified: V,
  },
  {
    id: 'elktours-suggest-lead',
    area: 'elktours.suggestions',
    label: 'Suggest an artist or a place',
    does: "A follower suggests an artist or a place to feature, with a name, an optional web address, why and an optional email. Saved pending for the team. Needs migrations-draft columns, otherwise answers 'available after migration'.",
    class: 'person',
    actors: ['person'],
    scope: 'org',
    hosts: [
      host(sa(LEAD, 'submitSuggestionAction'), ['assertPublicUrl', 'raw SQL INSERT visitor_suggestions'], '/suggest', 'the Suggest button of the suggest sheet (components/mobile/suggest-view.tsx)'),
      twin(sq(LEAD, 'submitSuggestionAction'), sa(LEAD, 'submitSuggestionAction')),
    ],
    entry: null,
    status: 'a visitor_suggestions row of kind artist or place_lead and status pending exists for the person',
    risk: ['none'],
    confirm: { text: 'Send your suggestion of {name} to {org}? The team will look at it.', status: 'draft', wave: 6 },
    inputs: 'kind, name, url, why, email',
    drift: 'None: single copy; same daily limit as spots and routes.',
    open: 'The URL is checked with assertPublicUrl but never fetched here. The contact email is stored unverified and shown to editors only.',
    verified: V,
  },
  {
    id: 'elktours-suggestion-accept',
    area: 'elktours.suggestions',
    label: 'Accept a suggestion',
    does: 'An editor accepts a suggestion. A spot becomes a catalogue place credited to the suggester (its photo moves to the place). A route becomes a draft tour with one stop per item. An artist or place lead is only marked handled.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa(SG, 'acceptSuggestionAction'), ['createPlace (raw SQL)', '@elkdonis/commerce/server#saveTourStops', '@elkdonis/services#ensureUniqueThreadSlug', 'refreshTourRoute'], '/manage/suggestions', 'the Accept button on a suggestion card (components/manage/suggestions-queue.tsx)'),
      twin(sq(SG, 'acceptSuggestionAction'), sa(SG, 'acceptSuggestionAction')),
      { key: sq(SG, 'createPlace'), service: ['raw SQL INSERT places'], note: 'inner helper: writes the place with suggested_by' },
    ],
    entry: null,
    status: 'visitor_suggestions.status is accepted with result_place_id or result_thread_id set',
    risk: ['public'],
    confirm: { text: 'Accept {person}’s suggestion “{title}”? A spot becomes a place in the catalogue; a route becomes a draft tour.', status: 'draft', wave: 6 },
    inputs: 'suggestion id, optional new title',
    drift: 'None: single copy.',
    open: 'The route branch is not in a transaction: places are created one by one, then the draft tour, then the stops, then the status flip. A failure midway leaves places and maybe a tour with the suggestion still pending (lib/suggestion-actions.ts:362-413). The new place is created public by default (column default).',
    verified: V,
  },
  {
    id: 'elktours-suggestion-reject',
    area: 'elktours.suggestions',
    label: 'Reject a suggestion',
    does: 'An editor rejects a pending suggestion with an optional reason. The suggester can see the reason.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa(SG, 'rejectSuggestionAction'), ['raw SQL UPDATE visitor_suggestions'], '/manage/suggestions', 'the Reject button on a suggestion card (components/manage/suggestions-queue.tsx)'),
      twin(sq(SG, 'rejectSuggestionAction'), sa(SG, 'rejectSuggestionAction')),
    ],
    entry: null,
    status: 'visitor_suggestions.status is rejected for the id',
    risk: ['others'],
    confirm: { text: 'Reject {person}’s suggestion “{title}”? They will see your reason.', status: 'draft', wave: 6 },
    inputs: 'suggestion id, reason',
    drift: 'None: single copy.',
    open: 'No email goes out in this action (not traced elsewhere); the reason is shown in the suggester list.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [
  { key: sa(SG, 'listLeadSuggestionsAction'), why: 'read exposed as a server action' },
  { key: sa(SG, 'listMySuggestionsAction'), why: 'read exposed as a server action; no caller found' },
  { key: sa(SG, 'listSuggestionsAction'), why: 'read exposed as a server action' },
  { key: sa(SG, 'previewRouteAction'), why: 'read: walking preview from an external router, writes nothing' },
  { key: sa(SG, 'suggestionAllowanceAction'), why: 'read: how many suggestions are left today' },
  { key: sa(SG, 'withdrawSuggestionAction'), why: 'dead: no caller in the repo (no withdraw control exists)' },
  { key: sq(SG, 'withdrawSuggestionAction'), why: `twin of ${sa(SG, 'withdrawSuggestionAction')} (dead)` },
];

const area: Area = { capabilities, ignored };
export default area;
