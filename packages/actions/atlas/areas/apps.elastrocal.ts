import type { Area, Capability, Host, HostKey, Risk } from '../types';

// elastrocal: the astrology app. Public chart calculator with saved charts (guest or signed-in), the owner-only
// Astro Studio (review deck, reasoning explorer, foundations, vocabulary, library notes, claim checks) and the
// /api/mobile/v1 routes the Jerusalem Android app and the personal app call with a device token.
// 2026-11-16, agent G. Conventions: atlas/JOURNAL.md.
// Left for agent E: hub/profile/actions.ts#saveProfileAction (profile editor) and services/[slug]/actions.ts#bookServiceAction (booking).

const APP = 'elastrocal';
const SRC = 'apps/elastrocal/src/';
const V = '2026-11-16 read app/hub/studio/**/actions.ts, app/hub/services/actions.ts, app/api/{charts,astro,mobile/v1}/**/route.ts, lib/{charts,auth,owner-api}.ts, app/link-device/actions.ts';
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const api = (p: string, m: string): HostKey => `api:${SRC}${p}#${m}` as HostKey;
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const h = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });
const twin = (key: HostKey): Host => ({ key, note: 'sql twin of the api host above' });
const OWNER = 'Gate: requireStudioReviewer (a signed-in owner of the elastrocal org; others are redirected to /hub).';
const OWNER_API = 'Gate: ownerOrResponse (401 signed out, 403 unless an owner); device token or session.';
const MOBILE = 'Also written by the Jerusalem app through /api/mobile/v1 (device token).';

function owner(c: {
  id: string; label: string; does: string; hosts: Host[]; status: string; text: string; risk?: Risk[];
  inputs?: string; drift?: string; canonical?: string; open?: string;
}): Capability {
  return {
    id: c.id, area: 'elastrocal.studio', label: c.label, does: c.does, class: 'person', actors: ['owner'], scope: 'other',
    hosts: c.hosts, entry: null, status: c.status, risk: c.risk ?? ['none'],
    confirm: { text: c.text, status: 'draft', wave: 4 }, inputs: c.inputs, drift: c.drift, canonical: c.canonical, open: c.open, verified: V,
  };
}

const capabilities: Capability[] = [
  // ---------------- Astro Studio (owner only) ----------------
  owner({
    id: 'astro-question-review',
    label: 'Answer a review-deck question',
    does: 'Records the owner\'s move on a deck question: pick the better of two readings, rate one, fix one, write his own, tag, flag or skip.',
    hosts: [
      h(sa('app/hub/studio/actions.ts', 'submitReviewAction'), ['@elkdonis/astro-corpus/server#recordReview'], '/hub/studio/deck', 'the lever buttons of the review deck (app/hub/studio/deck)', OWNER + ' The corpus layer checks every text id belongs to the question.'),
      h(api('app/api/mobile/v1/deck/scenarios/route.ts', 'POST'), ['@elkdonis/astro-corpus/server#recordReview'], '/hub/studio/deck', 'the scenario answer sheet of the Jerusalem app (api/mobile/v1/deck/scenarios)', OWNER_API),
    ],
    status: 'an astro_reviews row for the reviewer, question and action exists',
    text: 'Save this answer? It is stored with your reviews and used to train the astrology models. Only you and the studio see it.',
    inputs: 'question, action, candidate ids, stance, seconds, payload',
    drift: 'The web studio and the app both end in recordReview with the reviewer taken from the session or token. The reasoning-explorer reviews use the same service with questionId null (astro-reasoning-review).',
    canonical: '@elkdonis/astro-corpus/server#recordReview',
    open: 'Zod payload shapes are per action; the corpus layer is the authority on the rest (not re-read).',
  }),
  owner({
    id: 'astro-reasoning-review',
    label: 'Review a step of an interpretation',
    does: 'Records the owner\'s verdict on a chain, step or passage in the reasoning explorer.',
    hosts: [h(sa('app/hub/studio/interpret/actions.ts', 'reasoningReviewAction'), ['@elkdonis/astro-corpus/server#recordReview'], '/hub/studio/interpret', 'the review buttons of the reasoning explorer (app/hub/studio/interpret)', OWNER)],
    status: 'an astro_reviews row with questionId null and a reasoning action exists',
    text: 'Save your verdict on this step? It feeds the training data. Only you see it.',
    drift: 'Same recordReview service as astro-question-review with questionId null.',
  }),
  owner({
    id: 'astro-reference-vote',
    label: 'Vote on a reference for a chart',
    does: 'Records a helpful or not-helpful vote (with optional reason) on a reference shown for a chart or event.',
    hosts: [h(api('app/api/astro/ref-votes/route.ts', 'POST'), ['@elkdonis/astro-corpus/server#recordRefVote'], '/hub/readings', 'the Helpful / Not helpful buttons beside a reference (app/hub/readings)', OWNER_API)],
    status: 'a ref-vote row for the reviewer and reference exists',
    text: 'Save your vote on this reference? Votes become training labels. Only you see them.',
    open: 'The route comment says statements digest books whose licences are unknown, so it is owner-only.',
  }),
  owner({
    id: 'astro-claim-review',
    label: 'Check an AI claim',
    does: 'Records the owner\'s check of a claim the AI made about a passage (accept, correct, remove tags, add tags).',
    hosts: [
      h(sa('app/hub/studio/claims/actions.ts', 'claimReviewAction'), ['@elkdonis/astro-corpus/server#recordClaimReview'], '/hub/studio/claims', 'the claim cards of Check AI claims (app/hub/studio/claims)', OWNER),
      h(api('app/api/mobile/v1/deck/claims/route.ts', 'POST'), ['@elkdonis/astro-corpus/server#recordClaimReview'], '/hub/studio/claims', 'the claims deck of the Jerusalem app (api/mobile/v1/deck/claims)', OWNER_API),
    ],
    status: 'an astro_reviews row with a claim action exists for the claim',
    text: 'Save your check of this claim? It can change which tags the passage keeps. Only you see your marks.',
    drift: 'Web and app copies share recordClaimReview; only the gate helper differs (requireStudioReviewer vs ownerOrResponse).',
    open: 'Removing tags changes the corpus tags the claim carried, so this one edits shared data, not only a review row (inside recordClaimReview).',
  }),
  owner({
    id: 'astro-vocab-review',
    label: 'Sort the vocabulary',
    does: 'Records the owner\'s grouping, renaming or merging of vocabulary cards.',
    hosts: [
      h(sa('app/hub/studio/vocabulary/actions.ts', 'vocabReviewAction'), ['@elkdonis/astro-corpus/server#recordVocabReview'], '/hub/studio/vocabulary', 'the sorting board (app/hub/studio/vocabulary)', OWNER),
      h(api('app/api/mobile/v1/deck/vocab/route.ts', 'POST'), ['@elkdonis/astro-corpus/server#recordVocabReview'], '/hub/studio/vocabulary', 'the vocabulary deck of the Jerusalem app (api/mobile/v1/deck/vocab)', OWNER_API),
    ],
    status: 'an astro_reviews row with a vocab action exists',
    text: 'Save how you sorted these cards? Only you see your groups.',
    drift: 'Web and app share recordVocabReview.',
  }),
  owner({
    id: 'astro-vocab-term-add',
    label: 'Add a vocabulary term',
    does: 'Adds a card for a term of the owner\'s own to the vocabulary.',
    hosts: [h(sa('app/hub/studio/vocabulary/actions.ts', 'addVocabTermAction'), ['@elkdonis/astro-corpus/server#addVocabTerm'], '/hub/studio/vocabulary', 'the Add a term box (app/hub/studio/vocabulary)', OWNER)],
    status: 'an astro_vocab card for the term exists',
    text: 'Add “{title}” to the vocabulary? It becomes a card you can sort.',
  }),
  owner({
    id: 'astro-foundation-review',
    label: 'Review a foundations item',
    does: 'Records the owner\'s mark on a quality, picture or note of the foundations layer (sign, planet, element, quality).',
    hosts: [h(sa('app/hub/studio/foundations/actions.ts', 'foundationReviewAction'), ['@elkdonis/astro-corpus/server#recordFoundationReview'], '/hub/studio/foundations', 'the item controls of Foundations (app/hub/studio/foundations)', OWNER)],
    status: 'a foundation review row for the item exists',
    text: 'Save your mark on this item? Your entries become the standard definition. Only you see the marking.',
    open: 'Per the layered-meaning model, the owner\'s entries become the standard for the app.',
  }),
  owner({
    id: 'astro-foundation-item-add',
    label: 'Add a foundations item',
    does: 'Adds a quality, picture or note of his own to a concept (or reports that it already exists).',
    hosts: [h(sa('app/hub/studio/foundations/actions.ts', 'addFoundationItemAction'), ['@elkdonis/astro-corpus/server#addFoundationItem'], '/hub/studio/foundations', 'the Add box under a concept (app/hub/studio/foundations)', OWNER)],
    status: 'an astro_foundation_items row for the concept and text exists',
    text: 'Add this to {title}? It becomes part of the foundations list.',
  }),
  owner({
    id: 'astro-correspondence-cell-add',
    label: 'Add a correspondence value',
    does: 'Adds a value of his own to a cell of the correspondence table.',
    hosts: [h(sa('app/hub/studio/foundations/actions.ts', 'addCorrespondenceCellAction'), ['@elkdonis/astro-corpus/server#addCorrespondenceCell'], '/hub/studio/foundations/correspondences', 'the cell editor of the correspondence table (app/hub/studio/foundations/correspondences)', OWNER)],
    status: 'an astro_correspondence_cells row for the subject and category exists',
    text: 'Add this value to the correspondence table? It becomes part of the table.',
  }),
  owner({
    id: 'astro-library-note',
    label: 'Write a library note',
    does: 'Saves a free-text note on a library entry.',
    hosts: [h(sa('app/hub/studio/library/actions.ts', 'libraryNoteAction'), ['@elkdonis/astro-corpus/server#recordLibraryNote'], '/hub/studio/library', 'the note box of a library entry (app/hub/studio/library)', OWNER)],
    status: 'a library-note review row for the target exists',
    text: 'Save this note on the entry? Only you see it.',
  }),
  owner({
    id: 'astro-interpretation-create',
    label: 'Write an interpretation of a chart',
    does: 'Saves the owner\'s interpretation of one of his charts and queues it for the worker to analyse.',
    hosts: [h(sa('app/hub/studio/interpret/actions.ts', 'createInterpretationAction'), ['@elkdonis/astro-corpus/server#createInterpretation'], '/hub/studio/interpret', 'the Interpret form (app/hub/studio/interpret)', OWNER + ' The service checks the chart is his.')],
    status: 'an interpretation row for the chart exists, queued',
    text: 'Save your interpretation and queue it for analysis? Only you see it.',
  }),
  owner({
    id: 'astro-question-interpretation-create',
    label: 'Explain my thinking on a deck question',
    does: 'Saves the owner\'s written answer to a deck question and queues it for the worker.',
    hosts: [h(sa('app/hub/studio/interpret/actions.ts', 'createQuestionInterpretationAction'), ['@elkdonis/astro-corpus/server#createQuestionInterpretation'], '/hub/studio/deck', 'the Explain my thinking button of the deck (app/hub/studio/deck)', OWNER + ' The service refuses questions in the blind test set.')],
    status: 'an interpretation row for the question exists, queued',
    text: 'Save your explanation and queue it for analysis? Only you see it.',
  }),
  owner({
    id: 'astro-interpretation-requeue',
    label: 'Send an interpretation to the worker again',
    does: 'Puts an interpretation back in the worker\'s queue.',
    hosts: [h(sa('app/hub/studio/interpret/actions.ts', 'requeueInterpretationAction'), ['@elkdonis/astro-corpus/server#requeueInterpretation'], '/hub/studio/interpret', 'the Run again button of an interpretation (app/hub/studio/interpret)', OWNER)],
    status: 'the interpretation row is queued',
    text: 'Send this interpretation to the worker again? It re-runs the analysis, which can take a while.',
  }),
  // ---------------- charts (public calculator) ----------------
  {
    id: 'chart-save', area: 'elastrocal.charts', label: 'Save a chart',
    does: 'Saves a birth chart under the signed-in person, or under a guest cookie for a signed-out browser (a guest id is minted on the first save).',
    class: 'person', actors: ['visitor', 'person'], scope: 'person',
    hosts: [
      h(api('app/api/charts/route.ts', 'POST'), ['(lib) createChart', '(lib) claimGuestCharts'], '/charts', 'the Save chart button of the chart form (app/calculate and app/charts)', 'No sign-in needed. A signed-in save also claims the guest\'s charts.'),
      { key: sq('lib/charts.ts', 'createChart'), note: 'raw INSERT into astro_charts' },
    ],
    entry: null, status: 'an astro_charts row for the owner or guest exists', risk: ['none'],
    confirm: { text: 'Save this chart as “{title}”? Only you can open it from this browser or your account.', status: 'draft', wave: 4 },
    drift: 'Single copy.',
    open: 'No rate limit or cap on charts per guest or user: the route is open to anonymous posting and every call inserts a row with a computed json. No spam control seen (pigeonshoot has one in lib/rate-limit.ts).',
    verified: V,
  },
  {
    id: 'chart-update', area: 'elastrocal.charts', label: 'Rename, favourite or annotate a chart',
    does: 'Changes the name, favourite mark or notes of one of the keeper\'s charts.',
    class: 'person', actors: ['visitor', 'person'], scope: 'person',
    hosts: [
      h(api('app/api/charts/[id]/route.ts', 'PATCH'), ['(lib) updateChart'], '/charts/{id}', 'the rename, star and notes controls of the chart page (app/charts/[id])', 'Ownership is in the UPDATE itself (keptBy(keeper) and org id), 404 otherwise.'),
      { key: sq('lib/charts.ts', 'updateChart'), note: 'raw UPDATE' },
    ],
    entry: null, status: 'the astro_charts row holds the new values', risk: ['none'],
    confirm: { text: 'Save your changes to the chart “{title}”? Only you see them.', status: 'draft', wave: 4 },
    drift: 'Single copy.', verified: V,
  },
  {
    id: 'chart-delete', area: 'elastrocal.charts', label: 'Delete a chart',
    does: 'Deletes one of the keeper\'s saved charts.',
    class: 'person', actors: ['visitor', 'person'], scope: 'person',
    hosts: [
      h(api('app/api/charts/[id]/route.ts', 'DELETE'), ['(lib) deleteChart'], '/charts/{id}', 'the Delete control of the chart page (app/charts/[id])', 'Ownership is in the DELETE itself (keptBy(keeper) and org id).'),
      { key: sq('lib/charts.ts', 'deleteChart'), note: 'raw DELETE' },
    ],
    entry: null, status: 'the astro_charts row is gone', risk: ['irreversible'],
    confirm: { text: 'Delete the chart “{title}”? It cannot be brought back.', status: 'draft', wave: 4 },
    drift: 'Single copy.', verified: V,
  },
  {
    id: 'chart-guest-claim', area: 'elastrocal.charts', label: 'Move a guest\'s charts to an account',
    does: 'When a guest signs in, the charts saved under their guest cookie become the account\'s.',
    class: 'internal', actors: ['person'], scope: 'person',
    hosts: [{ key: sq('lib/charts.ts', 'claimGuestCharts'), service: ['(lib) claimGuestCharts'], note: 'Called from POST api/charts and the sign-in pages; moves only rows with owner_id null and the cookie\'s guest id.', address: { app: APP, path: '/charts', how: 'no control: runs at the first save after sign-in' } }],
    risk: ['none'], drift: 'Idempotent: guest_id is cleared once claimed.', verified: V,
  },
  {
    id: 'chart-cache-refresh', area: 'elastrocal.charts', label: 'Refresh a chart\'s cached calculation',
    does: 'When the engine version has changed, a chart is recomputed as it is opened and the cached result is rewritten.',
    class: 'system', actors: ['system'], scope: 'person',
    hosts: [{ key: sq('lib/charts.ts', 'getChart'), service: ['(lib) getChart'], note: 'A write inside a read: UPDATE astro_charts SET computed ... on page load.' }],
    risk: ['none'], open: 'Write on read; errors are swallowed. Harmless (a cache), listed so the inventory is covered.', verified: V,
  },
  // ---------------- link a device, Jerusalem / personal app ----------------
  {
    id: 'device-link', area: 'elastrocal.devices', label: 'Link a device',
    does: 'Mints a device token for the signed-in person and returns the app URL that carries it, so the Jerusalem or personal app can call the API.',
    class: 'person', actors: ['person'], scope: 'person',
    hosts: [h(sa('app/link-device/actions.ts', 'linkDevice'), ['@elkdonis/auth-server#createDeviceToken'], '/link-device', 'the Link button of the link-device page (app/link-device)', 'Gate: getViewer; the target app must be in LINK_APPS (whitelist).')],
    entry: null, status: 'a device token row for the user, app and label exists', risk: ['others'],
    confirm: { text: 'Link this device to your account as “{title}”? The app will be able to read and write your data until you unlink it.', status: 'draft', wave: 4 },
    drift: 'Single copy.',
    open: 'The token (eacd_...) travels in the returned URL query string, so it can end up in browser history and referrers; state is a client-chosen value echoed back (cleanState). Token scope: acts as the viewer, with owner rights when the viewer is an owner.',
    verified: V,
  },
  {
    id: 'device-unlink', area: 'elastrocal.devices', label: 'Unlink this device',
    does: 'The app revokes the device token its request carries.',
    class: 'person', actors: ['person'], scope: 'person',
    hosts: [h(api('app/api/mobile/v1/me/route.ts', 'DELETE'), ['@elkdonis/auth-server#revokeRequestDeviceToken'], '/link-device', 'the Unlink button inside the Jerusalem app (api/mobile/v1/me)', 'Revokes the token on the request, no other.')],
    entry: null, status: 'the device token row is revoked', risk: ['none'],
    confirm: { text: 'Unlink this device? The app will stop working until you link it again.', status: 'draft', wave: 4 },
    drift: 'Single copy.', verified: V,
  },
  {
    id: 'app-records-sync', area: 'elastrocal.devices', label: 'Sync an app\'s records',
    does: 'Two-way sync of an app\'s own records (marks, journal and so on) between a device and the server: last write wins on updatedAt, deletes leave a tombstone.',
    class: 'internal', actors: ['person'], scope: 'person',
    hosts: [
      h(api('app/api/mobile/v1/sync/route.ts', 'POST'), [], '/api/mobile/v1/sync', 'no visible control: the apps call it in the background', 'Gate: getViewer (any signed-in person may sync their own records); app must be in the APPS whitelist.'),
      twin(sq('app/api/mobile/v1/sync/route.ts', 'POST')),
    ],
    risk: ['none'], drift: 'Single copy.',
    open: 'Capped by MAX_RECORDS and MAX_BYTES per record; keyed by (user, app, kind, record id), so a person only writes their own rows.',
    verified: V,
  },
  {
    id: 'jerusalem-media-upload', area: 'elastrocal.devices', label: 'Upload a recording or picture from the app',
    does: 'Streams an audio, image or video file from the Jerusalem app into the owner\'s private Jerusalem folder on Nextcloud and returns its path.',
    class: 'internal', actors: ['owner'], scope: 'person',
    hosts: [h(api('app/api/mobile/v1/media/route.ts', 'PUT'), ['@elkdonis/services#davPutStream', '@elkdonis/services#davMkcol'], '/api/mobile/v1/media', 'no visible control: the app uploads through it', 'Gate: getViewer and role owner.')],
    risk: ['none'], drift: 'Same job as other upload routes (arts-collective my-file-upload, art-auction artwork-image-upload) with its own type table.',
    verified: V,
  },
  {
    id: 'jerusalem-video-publish', area: 'elastrocal.devices', label: 'Queue a video for YouTube',
    does: 'The owner queues an uploaded video for publishing on his connected YouTube channel, with title, description and privacy.',
    class: 'person', actors: ['owner'], scope: 'person',
    hosts: [
      h(api('app/api/mobile/v1/publish/route.ts', 'POST'), [], '/api/mobile/v1/publish', 'the Publish button of the video screen in the Jerusalem app (api/mobile/v1/publish)', 'Gate: getViewer and role owner; the source must be under Private/Jerusalem/ with no "..".'),
      twin(sq('app/api/mobile/v1/publish/route.ts', 'POST')),
    ],
    entry: null, status: 'a video_uploads row for the source path exists with status queued', risk: ['public', 'emails'],
    confirm: { text: 'Queue “{title}” for YouTube on your connected channel as {privacy}? Once it uploads, viewers on YouTube can see it.', status: 'draft', wave: 4 },
    drift: 'Same video_uploads queue the arts-collective broadcast/video routes write.',
    open: 'The row is inserted already approved (approved_by set), so no second look happens before the worker uploads it. Dedupe: 409 "already queued".',
    verified: V,
  },
  // ---------------- Jerusalem app: marks, outlines, Lam Rim ----------------
  {
    id: 'astro-passage-mark-save', area: 'elastrocal.devices', label: 'Mark a passage',
    does: 'Saves the owner\'s mark on a corpus passage from the app (good, missed, wrong or note; highlighted span, chips, conviction 0-5, voice memo, outline role and subjects).',
    class: 'person', actors: ['owner'], scope: 'other',
    hosts: [
      h(api('app/api/mobile/v1/marks/route.ts', 'POST'), ['@elkdonis/astro-corpus#isFactorKey'], '/api/mobile/v1/marks', 'the Mark buttons of the passage view in the Jerusalem app', OWNER_API + ' ' + MOBILE),
      twin(sq('app/api/mobile/v1/marks/route.ts', 'POST')),
    ],
    entry: null, status: "an astro_reviews row with action 'passage-mark' for the reviewer and text exists", risk: ['none'],
    confirm: { text: 'Save this mark on the passage? Only you see it, and it feeds the training data.', status: 'draft', wave: 4 },
    drift: 'Single copy; the studio\'s reviews use recordReview, this route inserts astro_reviews directly with raw SQL.',
    canonical: '@elkdonis/astro-corpus/server#recordReview (so the checks live in one place)',
    verified: V,
  },
  {
    id: 'astro-passage-mark-delete', area: 'elastrocal.devices', label: 'Delete a passage mark',
    does: 'Deletes one of the owner\'s own passage marks.',
    class: 'person', actors: ['owner'], scope: 'other',
    hosts: [
      h(api('app/api/mobile/v1/marks/route.ts', 'DELETE'), [], '/api/mobile/v1/marks', 'the Delete control of a mark in the Jerusalem app', OWNER_API + ' Scoped to reviewer_id = viewer and action passage-mark.'),
      twin(sq('app/api/mobile/v1/marks/route.ts', 'DELETE')),
    ],
    entry: null, status: 'the astro_reviews row is gone', risk: ['irreversible'],
    confirm: { text: 'Delete this mark? It cannot be brought back.', status: 'draft', wave: 4 },
    drift: 'Single copy.', verified: V,
  },
  {
    id: 'book-outline-save', area: 'elastrocal.devices', label: 'Save a book outline',
    does: 'Replaces the section outline (ranges and roles) of a book with the owner\'s edit, and records an audit review row.',
    class: 'person', actors: ['owner'], scope: 'other',
    hosts: [
      h(api('app/api/mobile/v1/outlines/route.ts', 'PUT'), [], '/api/mobile/v1/outlines', 'the outline editor of the Jerusalem app', OWNER_API + ' Sections are validated for integer ranges that do not overlap.'),
      twin(sq('app/api/mobile/v1/outlines/route.ts', 'PUT')),
    ],
    entry: null, status: 'astro_book_outlines holds the saved sections', risk: ['none'],
    confirm: { text: 'Save this outline for the book? It replaces the outline the app and the studio use.', status: 'draft', wave: 4 },
    drift: 'Single copy.', verified: V,
  },
  {
    id: 'lamrim-review-save', area: 'elastrocal.devices', label: 'Save a Lam Rim judgement',
    does: 'Saves the owner\'s verdict, reading or note on a Lam Rim study item (accurate, partly, wrong; conviction; voice).',
    class: 'person', actors: ['owner'], scope: 'other',
    hosts: [
      h(api('app/api/mobile/v1/lamrim/review/route.ts', 'POST'), [], '/api/mobile/v1/lamrim/review', 'the verdict buttons of the Lam Rim tab in the Jerusalem app', OWNER_API),
      twin(sq('app/api/mobile/v1/lamrim/review/route.ts', 'POST')),
    ],
    entry: null, status: 'a lamrim_reviews row for the user and target exists', risk: ['none'],
    confirm: { text: 'Save your judgement on this Lam Rim item? Only you see it.', status: 'draft', wave: 4 },
    drift: 'Single copy.', verified: V,
  },
  {
    id: 'lamrim-review-delete', area: 'elastrocal.devices', label: 'Delete a Lam Rim judgement',
    does: 'Deletes one of the owner\'s own Lam Rim judgements.',
    class: 'person', actors: ['owner'], scope: 'other',
    hosts: [
      h(api('app/api/mobile/v1/lamrim/review/route.ts', 'DELETE'), [], '/api/mobile/v1/lamrim/review', 'the Delete control of a judgement in the Jerusalem app', OWNER_API + ' Scoped to user_id = viewer.'),
      twin(sq('app/api/mobile/v1/lamrim/review/route.ts', 'DELETE')),
    ],
    entry: null, status: 'the lamrim_reviews row is gone', risk: ['irreversible'],
    confirm: { text: 'Delete this judgement? It cannot be brought back.', status: 'draft', wave: 4 },
    drift: 'Single copy.', verified: V,
  },
  {
    id: 'scenario-question-draft', area: 'elastrocal.devices', label: 'Draft a new scenario question',
    does: 'Each time the app asks for the next scenario, the route generates one and stores it as an astro_questions row (idempotent on its hash) before returning it.',
    class: 'system', actors: ['owner'], scope: 'other',
    hosts: [{ key: sq('app/api/mobile/v1/deck/scenarios/route.ts', 'GET'), service: [], note: 'A write inside a GET: INSERT ... ON CONFLICT DO NOTHING into astro_questions. Gate: ownerOrResponse.' }],
    risk: ['none'], open: 'Idempotent, owner-only; listed because the inventory counts it as a write.', verified: V,
  },
  // ---------------- services offered on the hub ----------------
  {
    id: 'elastrocal-service-save', area: 'elastrocal.hub', label: 'Save a service offering',
    does: 'Creates or updates a service offering (a thread in the services feed) from the shared composer, as draft or published.',
    class: 'person', actors: ['owner', 'guide'], scope: 'org',
    hosts: [h(sa('app/hub/services/actions.ts', 'saveServiceAction'), ['@elkdonis/services#upsertServiceOffering', '@elkdonis/services#serviceInputFromAnswers', '@elkdonis/services#validateServiceInput'], '/hub/services', 'the Save and Publish buttons of the service composer (app/hub/services)', 'Gate: requireOrgEditor("/hub/services"); visibility forced PUBLIC and section services.')],
    entry: null, status: "a threads row kind service for the org with status published exists", risk: ['public', 'money'],
    confirm: { text: 'Publish the service “{title}” on {org}\'s site? Visitors will see it and can book it; payment happens on the checkout page.', status: 'draft', wave: 4 },
    inputs: 'composer answers (title, price, details), status, optional thread id',
    drift: 'Same service call as the hidden-enneagram and ArtDirect copies (own-service-save in orgapps.money is the ifac and innergathering copy); this one forces PUBLIC and the services section.',
    canonical: '@elkdonis/services#upsertServiceOffering behind one kit action',
    open: 'requireOrgEditor was not read here; priced offerings take money through the booking flow (agent E).',
    verified: V,
  },
  {
    id: 'elastrocal-service-remove', area: 'elastrocal.hub', label: 'Remove a service offering',
    does: 'Takes a service offering off the site (archived, not deleted).',
    class: 'person', actors: ['owner', 'guide'], scope: 'org',
    hosts: [h(sa('app/hub/services/actions.ts', 'deleteServiceAction'), ['@elkdonis/services#deleteServiceOffering'], '/hub/services', 'the Remove control in the services list (app/hub/services)', 'Gate: requireOrgEditor; the service filters by org and kind.')],
    entry: null, status: 'the threads row has status archived', risk: ['public'],
    confirm: { text: 'Take the service “{title}” off {org}\'s site? It is archived, not erased.', status: 'draft', wave: 4 },
    drift: 'Same as service-offering-remove (orgapps.cms, hidden-enneagram copy).', canonical: 'removeThreadAs for everything, as noted there',
    verified: V,
  },
];

export default {
  capabilities,
  ignored: [
    { key: sa('app/hub/studio/foundations/actions.ts', 'foundationSourcesAction'), why: 'Read: loads the source quotes of items.' },
    { key: sa('app/hub/studio/library/actions.ts', 'libraryPassageAction'), why: 'Read: loads the whole text of a passage.' },
    { key: sa('app/hub/studio/vocabulary/actions.ts', 'searchVocabAction'), why: 'Read: searches vocabulary cards.' },
    { key: api('app/api/charts/calculate/route.ts', 'POST'), why: 'Read: calculates a chart from birth data and returns it; nothing is stored.' },
    { key: api('app/api/charts/span/route.ts', 'POST'), why: 'Read: calculates a span of ephemeris data; nothing is stored.' },
    { key: api('app/api/mobile/v1/facets/route.ts', 'POST'), why: 'Read: ranks passages for a set of facets (POST because the body is large); public, no write.' },
  ],
} satisfies Area;
