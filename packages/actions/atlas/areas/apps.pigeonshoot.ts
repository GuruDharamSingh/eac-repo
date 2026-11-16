import type { Area, Capability, Host, HostKey, Risk } from '../types';

// pigeonshoot: pigeon trading cards. Anyone (guest or signed in) uploads photos and posts a card that publishes
// at once; editors rate, moderate and run the species, rubric and site copy from /manage. 2026-11-16, agent G.
// Conventions: atlas/JOURNAL.md. A sa host with raw SQL has a sql twin, claimed in the same capability.

const APP = 'pigeonshoot';
const SRC = 'apps/pigeonshoot/src/';
const V = '2026-11-16 read lib/manage/actions.ts, app/api/{cards,reports,upload}/route.ts, lib/{guest,rate-limit,auth}.ts';
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const api = (p: string, m: string): HostKey => `api:${SRC}${p}#${m}` as HostKey;
const MA = 'lib/manage/actions.ts';
const GATE = 'Gate: requireOrgEditor() inside the action (owner or guide of the org; others are redirected).';
const at = (path: string, how: string) => ({ app: APP, path, how });
const twin = (key: HostKey): Host => ({ key, note: 'sql twin of the sa/api host above' });
const act = (fn: string, path: string, how: string, service: string[] = []): Host[] => [
  { key: sa(MA, fn), service: service.length ? service : ['@elkdonis/db#db (raw SQL)'], address: at(path, how), note: GATE },
  twin(sq(MA, fn)),
];

function editor(c: {
  id: string; label: string; does: string; hosts: Host[]; status: string; text: string; risk: Risk[];
  drift?: string; canonical?: string; open?: string; inputs?: string;
}): Capability {
  return {
    id: c.id, area: 'pigeonshoot.manage', label: c.label, does: c.does, class: 'person', actors: ['owner', 'guide'],
    scope: 'org', hosts: c.hosts, entry: null, status: c.status, risk: c.risk,
    confirm: { text: c.text, status: 'draft', wave: 4 }, inputs: c.inputs, drift: c.drift, canonical: c.canonical,
    open: c.open, verified: V,
  };
}

const capabilities: Capability[] = [
  // ---------------- public ----------------
  {
    id: 'pigeon-card-submit', area: 'pigeonshoot.cards', label: 'Post a pigeon card',
    does: 'A guest or signed-in person posts a card: one to four photos, a title, a story, a species (or a proposed name), the pinned place and the rubric items they claim. It publishes at once, with no approval step; moderation is a takedown afterwards.',
    class: 'person', actors: ['visitor', 'person'], scope: 'org',
    hosts: [
      { key: api('app/api/cards/route.ts', 'POST'), service: ['(lib) checkRate/recordRate', '(lib) requireWritableGuest', '(lib) evaluateAuto'], address: at('/submit', 'the Post my card button of the submit form (components/submit/submit-form.tsx)'), note: 'No sign-in needed. One transaction writes the thread, pigeon_cards, images, rubric claims and the guest counter.' },
      twin(sq('app/api/cards/route.ts', 'POST')),
    ],
    entry: null, status: "a threads row kind 'pigeon' with status published and a pigeon_cards row exist", risk: ['public'],
    confirm: { text: 'Post your card “{title}” to the public gallery? It appears straight away with your photos and the place you pinned, and anyone can report it.', status: 'draft', wave: 4 },
    inputs: 'title, story, images, species, place, claimed criteria',
    drift: 'Single copy.',
    open:
      'Good: whole card in one transaction; photos must be this org\'s, of type image, and not already attached to a card; coordinates plausibility-checked; rubric points frozen only at rating. CONCERNS: (1) rate limit is checked at the start and recorded only after success, so parallel requests all pass the check and can exceed the limit. (2) getClientIp trusts the FIRST x-forwarded-for hop; unless the proxy overwrites the header, a client can spoof the IP and dodge the IP bucket (guest and user buckets still apply, and a guest id is a cookie the client can drop). (3) the photo check does not tie the media row to the poster, so a caller who learns an unattached media id (nanoid, 21 chars, hard to guess) could attach someone else\'s upload. (4) cards publish immediately and anonymously to PUBLIC by design (migration 077); the only control is a report and a takedown. (5) getViewer errors are swallowed (.catch null), so an auth outage posts as a guest.',
    verified: V,
  },
  {
    id: 'pigeon-photo-upload', area: 'pigeonshoot.cards', label: 'Upload a card photo',
    does: 'Checks, re-encodes and stores one photo for a card in the org\'s media, and records a media row. The first step of posting a card.',
    class: 'internal', actors: ['visitor', 'person'], scope: 'org',
    hosts: [
      { key: api('app/api/upload/route.ts', 'POST'), service: ['@elkdonis/utils#validateUploadBuffer', '(lib) nextcloud upload', '(lib) checkRate/recordRate'], address: at('/submit', 'no visible control: the photo picker of the submit form posts here (components/submit/submit-form.tsx)'), note: 'identity, rate limit, size, magic bytes, EXIF read, re-encode, store.' },
      twin(sq('app/api/upload/route.ts', 'POST')),
    ],
    risk: ['none'],
    drift: 'Fourth upload route in the repo (arts-collective my-file-upload / upload-image, art-auction artwork-image-upload, elastrocal jerusalem-media-upload); this one re-encodes through sharp with a 100 MP cap and strips polyglots, which the others do not.',
    canonical: 'one shared upload service with this re-encode step',
    open: 'Good: size checked before reading the body; bytes validated; re-encoded so a polyglot cannot be served. The same rate-limit and IP caveats as pigeon-card-submit apply.',
    verified: V,
  },
  {
    id: 'pigeon-card-report', area: 'pigeonshoot.cards', label: 'Report a card',
    does: 'Anyone reports a card (not a pigeon, duplicate, identifiable person, wrong place, offensive, copyright, other). One open report per reporter per card; it raises the open-report count and shows the card in the editors\' queue but hides nothing.',
    class: 'person', actors: ['visitor', 'person'], scope: 'thread',
    hosts: [
      { key: api('app/api/reports/route.ts', 'POST'), service: ['(lib) checkRate/recordRate', '(lib) requireWritableGuest'], address: at('/cards/{slug}', 'the Report button on a card (components/report-button.tsx)'), note: 'Open to anyone; one transaction inserts the report and bumps pigeon_cards.open_report_count.' },
      twin(sq('app/api/reports/route.ts', 'POST')),
    ],
    entry: null, status: 'a pigeon_reports row with status open for the card and reporter exists', risk: ['none'],
    confirm: { text: 'Report this card as {reason}? A moderator will look at it. Nothing is hidden until they decide.', status: 'draft', wave: 4 },
    inputs: 'card, reason, detail',
    drift: 'Single copy.',
    open: 'A report with no guest and no user (guest minting refused) is stored anonymous, and the "one per reporter" check then cannot match, so that path can add unlimited reports (bounded by the rate limit only). Duplicate check and insert are not in one transaction, so a double click can add two.',
    verified: V,
  },
  {
    id: 'pigeon-guest-create', area: 'pigeonshoot.cards', label: 'Give a browser a guest identity',
    does: 'Creates (or refreshes) a guest row and cookie the first time a signed-out browser contributes, so its cards have a keeper and can be rate-limited or blocked.',
    class: 'system', actors: ['visitor'], scope: 'person',
    hosts: [{ key: sq('lib/guest.ts', 'getOrCreateGuest'), service: ['(lib) getOrCreateGuest'], note: 'INSERT into pigeon_guests with first and last IP and user agent; UPDATE of last_seen on return.' }],
    risk: ['none'], open: 'Stores the visitor\'s IP and user agent (private-data note for the privacy page).', verified: V,
  },
  {
    id: 'pigeon-guest-claim', area: 'pigeonshoot.cards', label: 'Move a guest\'s cards to an account',
    does: 'When a guest signs in, their guest cards and the threads\' authorship move to the account, so the cards read as written by a real person.',
    class: 'internal', actors: ['person'], scope: 'person',
    hosts: [{ key: sq('lib/guest.ts', 'claimGuestCards'), service: ['(lib) claimGuestCards'], note: 'Three UPDATEs in one transaction.' }],
    risk: ['none'],
    open: 'No caller of claimGuestCards was found anywhere in the app (not in lib/auth.ts, login or the pages), so signing in does not claim anything today. Either it is wired in an auth callback I did not find or it is dead and the guest-to-account promise in its comment is unmet.',
    verified: V,
  },
  {
    id: 'pigeon-rate-event', area: 'pigeonshoot.system', label: 'Record and prune rate-limit events',
    does: 'Records each accepted upload, card, report or species proposal against guest, user and IP, and prunes events older than 14 days.',
    class: 'system', actors: ['system'], scope: 'other',
    hosts: [
      { key: sq('lib/rate-limit.ts', 'record'), service: ['(lib) recordRate'], note: 'INSERT into pigeon_rate_events.' },
      { key: sq('lib/rate-limit.ts', 'maybePrune'), service: [], note: 'DELETE older than 14 days, fire and forget.' },
    ],
    risk: ['none'], verified: V,
  },
  // ---------------- editors ----------------
  editor({
    id: 'pigeon-card-rate', label: 'Rate a card',
    does: 'The editor confirms which rubric criteria a card earns and picks its tier. Each criterion\'s points are frozen on the row at that moment, so re-weighting later does not re-score old cards.',
    hosts: act('rateCard', '/manage/queue', 'the Save rating button of the rating panel (components/manage/rating-panel.tsx)'),
    status: 'pigeon_cards.owner_score, tier_slug and rated_at are set and card criteria rows match',
    risk: ['public'],
    text: 'Save this rating for “{title}”? The tier and score show on the public card.',
    inputs: 'card, tier, confirmed criteria, note',
    drift: 'Single copy.',
    open: 'Points come from pigeon_criteria on the server, not from the client; the tier slug is whatever the client sends (not checked against the score or against pigeon_tiers); the UPDATE is keyed by thread_id only, with no org filter (single org app today).',
  }),
  editor({
    id: 'pigeon-card-moderate', label: 'Hide, restore or remove a card',
    does: 'Sets a card live, hidden (kept) or removed. Removing permanently deletes the stored photos from Nextcloud and archives the thread.',
    hosts: act('moderateCard', '/manage/reports', 'the Hide / Restore / Remove buttons of a report row (components/manage/report-row.tsx)'),
    status: "pigeon_cards.moderation_state holds the new state and threads.status is published or archived",
    risk: ['public', 'irreversible'],
    text: 'Set “{title}” to {state}? Removing deletes the photos for good and cannot be undone.',
    inputs: 'card, state, note',
    drift: 'Single copy.',
    open:
      'SECURITY / CORRECTNESS: the "UPDATE threads SET status = ... WHERE id = threadId" has NO org or kind filter (updateCard on the same table does filter by org_id), and moderateCard never checks that the id is a pigeon card. An editor of this org who supplies any thread id (a draft or archived post of another org) can set it published or archived. Fix: add AND org_id = ORG AND kind = "pigeon". ORDER: on "removed" the photos are deleted first and the DB state written after, so a DB failure leaves a visible card with its photos gone. Deletion is best effort per file and the thumbnail path is derived by string replace of /Media/Images/.',
  }),
  editor({
    id: 'pigeon-report-resolve', label: 'Resolve a report',
    does: 'Dismisses a report or marks it actioned and lowers the card\'s open-report count.',
    hosts: act('resolveReport', '/manage/reports', 'the Dismiss / Actioned buttons of a report row (components/manage/report-row.tsx)'),
    status: "pigeon_reports.status is dismissed or actioned",
    risk: ['none'],
    text: 'Mark this report as {status}? It leaves the open queue.',
    drift: 'Single copy.',
    open: 'GOOD: the UPDATE is conditional on status open, so a second resolve does nothing and the count cannot go negative.',
  }),
  editor({
    id: 'pigeon-guest-block', label: 'Block or unblock a contributor',
    does: 'Blocks a guest browser from contributing (with a reason) or lifts the block.',
    hosts: act('setGuestBlocked', '/manage/guests', 'the Block / Unblock button of a guest row (components/manage/guest-row.tsx)'),
    status: 'pigeon_guests.is_blocked holds the new value',
    risk: ['others'],
    text: 'Block this contributor? They can no longer post cards or upload photos from this browser. Their cards stay.',
    drift: 'Single copy.',
    open: 'A guest is a cookie, so a block is evaded by clearing cookies unless the IP bucket also holds (see IP caveat on pigeon-card-submit). Signed-in users cannot be blocked here.',
  }),
  editor({
    id: 'pigeon-species-status', label: 'Publish, merge or reject a species',
    does: 'Sets a species to proposed, published, merged or rejected. Merging moves the cards to the target species.',
    hosts: act('updateSpeciesStatus', '/manage/species', 'the status buttons of the species manager (components/manage/species-manager.tsx)'),
    status: 'pigeon_species.status holds the new value (and cards point at the target when merged)',
    risk: ['public'],
    text: 'Set the species “{title}” to {status}? Merging moves all its cards to the other species.',
    inputs: 'species, status, merge target',
    drift: 'Single copy.',
    open: 'The merge target is not validated: it can equal the source, be of another org, or itself be merged or rejected, and the cards move regardless. A merged species is not reversible from the UI.',
  }),
  editor({
    id: 'pigeon-species-promote', label: 'Make a proposed name a species',
    does: 'Turns a contributor\'s proposed species name on a card into a published species and attaches the card to it.',
    hosts: act('promoteProposedSpecies', '/manage/species', 'the Make species button beside a proposed name (components/manage/species-manager.tsx)', ['@elkdonis/utils#slugify']),
    status: 'a published pigeon_species row for the name exists and the card points at it',
    risk: ['public'],
    text: 'Make “{title}” a species? It appears on the species list and the card is filed under it.',
    drift: 'Single copy.',
    open: 'ON CONFLICT (org, slug) DO UPDATE SET status = published, so promoting a name whose slug matches a rejected or merged species republishes it.',
  }),
  editor({
    id: 'pigeon-criterion-save', label: 'Save a rubric criterion',
    does: 'Adds or edits a rating criterion: key, label, hint, category, points, source (submitter, auto, owner), auto-check and order.',
    hosts: act('upsertCriterion', '/manage/rubric', 'the Save button of a criterion row (components/manage/rubric-editor.tsx)', ['@elkdonis/utils#slugify']),
    status: 'pigeon_criteria holds the row with the new values',
    risk: ['public'],
    text: 'Save the criterion “{title}”? It changes what contributors can claim and how future cards score. Past ratings keep their points.',
    drift: 'Single copy.',
    open: 'autoCheck names a function evaluateAuto runs; the value is not validated against the known checks here. Points are not range-checked.',
  }),
  editor({
    id: 'pigeon-criterion-retire', label: 'Retire a rubric criterion',
    does: 'Deactivates a criterion so it leaves the submit form and rubric page; history is kept.',
    hosts: act('deactivateCriterion', '/manage/rubric', 'the Retire button of a criterion row (components/manage/rubric-editor.tsx)'),
    status: 'pigeon_criteria.is_active is false',
    risk: ['public'],
    text: 'Retire the criterion “{title}”? It leaves the submit form. Existing ratings keep it.',
    drift: 'Single copy.',
  }),
  editor({
    id: 'pigeon-tier-save', label: 'Save a tier',
    does: 'Adds or edits a card tier: slug, label, blurb, minimum score, colour, frame style and order.',
    hosts: act('upsertTier', '/manage/rubric', 'the tier editor of the rubric page (components/manage/rubric-editor.tsx)', ['@elkdonis/utils#slugify']),
    status: 'pigeon_tiers holds the row with the new values',
    risk: ['public'],
    text: 'Save the tier “{title}”? Cards in this tier change their frame and colour.',
    drift: 'Single copy.',
    open: 'Colour is validated as #rrggbb; frame style is a union type only (not checked at runtime by this action).',
  }),
  editor({
    id: 'pigeon-site-copy-save', label: 'Save a block of site copy',
    does: 'Saves the text of one named section of the site (home, about, rubric copy).',
    hosts: act('saveSection', '/manage/pages', 'the Save button of the section editor (components/manage/section-editor.tsx)'),
    status: 'an org_site_sections row for the key holds the new content',
    risk: ['public'],
    text: 'Save this text on the site? Visitors see it straight away.',
    inputs: 'section key, content map',
    drift: 'Same org_site_sections write as amrit-canada\'s site-copy editor, copied here with raw SQL; the cms family in the other org apps (agent E) edits the same table through lib/cms.',
    canonical: 'one services saveOrgSiteSection',
    open: 'The section key is free text from the client (not checked against the keys the pages read), so an editor can create arbitrary rows; the content map is not size-limited.',
  }),
];

export default {
  capabilities,
  ignored: [
    { key: sa(MA, 'updateCard'), why: 'Dead: no importer found in app or components; the card editor it served does not exist.' },
    { key: sq(MA, 'updateCard'), why: 'Dead: sql twin of updateCard (no caller).' },
  ],
} satisfies Area;
