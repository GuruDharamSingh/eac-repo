import type { Area, Host, HostKey } from '../types';

// elktours tour authoring (the thing departures hang off). Priced content: money risk follows the price field.
const V =
  '2026-11-16 read elktours lib/tour-actions.ts, lib/tour-live-actions.ts, lib/tour-type-actions.ts, lib/auth.ts requireOrgEditor, ' +
  'packages/commerce src/server/tours.ts saveTourStops';

const sa = (f: string, s: string) => `sa:apps/elktours/src/lib/${f}#${s}` as HostKey;
const sq = (f: string, s: string) => `sql:apps/elktours/src/lib/${f}#${s}` as HostKey;
const twin = (k: HostKey): Host => ({ key: k, note: 'sql twin' });

const AUTH_OPEN =
  'Gate is requireOrgEditor (owner or guide of the site). The UPDATE is scoped to org and kind=tour but not to the author, so any guide can edit, publish or pin any other guide\'s tour. slot-actions restricts guides to their own tours; the tour authoring actions do not.';

export default {
  capabilities: [
    {
      id: 'tour-save',
      area: 'orgapps.commerce.tours',
      label: 'Save a tour',
      does: "Creates or edits a tour: title, body, price per person, duration, meeting point, highlights, maximum party, and (in-page editing) its film.",
      class: 'person',
      actors: ['owner', 'guide'],
      scope: 'org',
      hosts: [
        { key: sa('tour-actions.ts', 'saveTourAction'), service: ['@elkdonis/services#ensureUniqueThreadSlug', '@elkdonis/utils#sanitizeRichText', 'elktours/lib/tour-cache#refreshTourRoute'], address: { app: 'elktours', path: '/manage/tours/{tour}', how: 'Save in the tour form (components/tours tour form)' } },
        twin(sq('tour-actions.ts', 'saveTourAction')),
        { key: sa('tour-live-actions.ts', 'patchTourAction'), service: ['@elkdonis/services#ensureUniqueThreadSlug', '@elkdonis/utils#sanitizeRichText'], address: { app: 'elktours', path: '/tours/{slug}', how: 'in-place editing on the tour page (components/tours/live)' } },
        twin(sq('tour-live-actions.ts', 'patchTourAction')),
      ],
      entry: null,
      status: "the thread of kind tour has the title, price and status saved",
      risk: ['public', 'money'],
      confirm: { text: 'Save {tour}? If it is published, visitors see the new details and price {price} per person on the booking page.', status: 'draft', wave: 5 },
      inputs: 'title, excerpt, body, cover, price, duration, location, meeting point, highlights, includes, languages, max party, effort, status, film',
      drift: "saveTourAction writes the whole form (and replaces metadata keys it owns); patchTourAction merges only touched fields and restricts film urls to this site's media. Both sanitise the body. Price is a server field the editor sets; buyers cannot change it (booking recomputes it from the thread).",
      canonical: 'patchTourAction (merging, schema-limited) for edits; saveTourAction for create only.',
      open: AUTH_OPEN + ' Also: saveTourAction accepts any coverImageUrl (up to 500 chars); patchTourAction restricts film urls only.',
      verified: V,
    },
    {
      id: 'tour-status-set',
      area: 'orgapps.commerce.tours',
      label: 'Publish, unpublish or pin a tour',
      does: "Switches a tour between draft, published and archived, or pins it to the top of the tours list.",
      class: 'person',
      actors: ['owner', 'guide'],
      scope: 'org',
      hosts: [
        { key: sa('tour-actions.ts', 'setTourStatusAction'), address: { app: 'elktours', path: '/manage/tours', how: 'status menu on a tour row (components/tours tours list)' } },
        twin(sq('tour-actions.ts', 'setTourStatusAction')),
        { key: sa('tour-actions.ts', 'setTourPinnedAction'), address: { app: 'elktours', path: '/manage/tours', how: 'Pin on a tour row' } },
        twin(sq('tour-actions.ts', 'setTourPinnedAction')),
      ],
      entry: null,
      status: 'threads.status (and pinned) of the tour equal the chosen values',
      risk: ['public'],
      confirm: { text: '{verb} {tour}? {effect}', status: 'draft', wave: 5 },
      drift: 'Raw SQL in the action; one per app copy only in elktours.',
      open: AUTH_OPEN + ' setTourPinnedAction also has no try/catch.',
      verified: V,
    },
    {
      id: 'tour-stops-save',
      area: 'orgapps.commerce.tours',
      label: "Save a tour's stops",
      does: "Replaces the stops of a tour (places, text, guide notes, experiences) and rebuilds its cached route and stop pictures.",
      class: 'person',
      actors: ['owner', 'guide'],
      scope: 'org',
      hosts: [
        { key: sa('tour-actions.ts', 'saveStopsAction'), service: ['@elkdonis/commerce/server#saveTourStops', '@elkdonis/utils#sanitizeRichText'], address: { app: 'elktours', path: '/manage/tours/{tour}', how: 'Save stops in the stops editor (components/tours stop editor)' } },
        { key: sql('packages/commerce/src/server/tours.ts', 'saveTourStops'), note: 'the write: transaction, up to 60 stops' } as Host,
        { key: sql('packages/commerce/src/server/tours.ts', 'setTourStopStill'), note: 'stop picture url, written by the still generator' } as Host,
        { key: sq('tour-cache.ts', 'refreshTourRoute'), note: 'cached route, rebuilt after stops change' },
      ],
      entry: null,
      status: 'tour_stops rows for the tour match the saved list',
      risk: ['public'],
      confirm: { text: 'Save {count} stops on {tour}? Visitors see the new route straight away.', status: 'draft', wave: 5 },
      inputs: 'stops (place, lat, lng, body, guide notes, experience)',
      drift: 'elktours only. Stop bodies and guide notes are sanitised in the action (not inside saveTourStops).',
      open: AUTH_OPEN,
      verified: V,
    },
    {
      id: 'tour-type-set',
      area: 'orgapps.commerce.tours',
      label: 'Set the type of a tour',
      does: "Tags a tour with one of the site's tour types, or clears it.",
      class: 'person',
      actors: ['owner', 'guide'],
      scope: 'org',
      hosts: [
        { key: sa('tour-type-actions.ts', 'setTourTypeAction'), address: { app: 'elktours', path: '/manage/tours/{tour}', how: 'tour type picker in the tour editor' } },
        twin(sq('tour-type-actions.ts', 'setTourTypeAction')),
      ],
      entry: null,
      status: "threads.metadata.tourType equals the chosen type",
      risk: ['public'],
      confirm: { text: 'Mark {tour} as {type}? It will be grouped that way on the tours page.', status: 'draft', wave: 5 },
      drift: 'elktours only. Validates the type against the fixed list; scoped to org and kind.',
      open: AUTH_OPEN,
      verified: V,
    },
  ],
  ignored: [],
} satisfies Area;

function sql(p: string, s: string): HostKey {
  return `sql:${p}#${s}` as HostKey;
}
