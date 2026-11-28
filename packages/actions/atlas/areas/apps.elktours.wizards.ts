import type { Area, Capability, Host, HostKey } from '../types';

// elktours artist wizard (design screens 35, 30), the office decision, artist invitations (collaborate, design screen 36)
// and service commissions. 2026-11-16, round 2 curator (elktours).
// Flow: artist saves a draft (kind experience, status draft, metadata.offer) -> submits (status pending) -> the office
// publishes it publicly, publishes it for members only, or sends it back with notes.
// Gate in code: canUseArtistWizard = signed in AND Viewer.isMember (owner, guide or member), lib/artist-wizard.ts:72.

const APP = 'elktours';
const SRC = 'apps/elktours/src/';
const AW = 'lib/artist-wizard-actions.ts';
const CO = 'lib/collaborate-actions.ts';
const CM = 'lib/commissions.ts';
const V = '2026-11-16 read lib/artist-wizard-actions.ts, lib/artist-wizard.ts (canUseArtistWizard), lib/collaborate-actions.ts, lib/commissions.ts, lib/auth.ts, components/mobile/{artist-wizard-view,artist-home-view,office-review-cards,collaborate-view,invitations-view}.tsx (imports)';
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });
const twin = (key: HostKey, of: HostKey): Host => ({ key, service: ['raw SQL'], note: `twin of ${of}` });

const WIZ = 'components/mobile/artist-wizard-view.tsx';

const capabilities: Capability[] = [
  {
    id: 'elktours-artist-profile-save',
    where: {"mode": "dock", "why": "A craft and a few lines."},
    area: 'elktours.wizards',
    label: 'Save your artist profile',
    does: "Step I of the artist wizard: the artist's craft and a few lines about them in this org. Name and area only fill gaps in their shared profile; empty fields never blank what is there.",
    class: 'person',
    actors: ['owner', 'guide', 'member'],
    scope: 'person',
    hosts: [
      host(sa(AW, 'saveArtistProfileAction'), ['raw SQL INSERT org_profiles', 'raw SQL UPDATE users'], '/artist/experiences/new', 'the first step ("A few lines about you") of the artist wizard (' + WIZ + ')'),
      twin(sq(AW, 'saveArtistProfileAction'), sa(AW, 'saveArtistProfileAction')),
    ],
    entry: null,
    status: 'an org_profiles row for the person and org has role_title and bio_override set',
    risk: ['public'],
    confirm: { text: 'Save your artist profile on {org}? Your craft and a few lines about you may show on your page.', status: 'draft', wave: 6 },
    inputs: 'name, craft, area, about',
    drift: 'The same profile idea is saved in orgapps by the profile editor (profile-section saves) and arts-collective edit-my-profile; this one writes org_profiles.bio_override and fills users.display_name and city only when empty.',
    canonical: 'one profile writer in services behind a shared kit action',
    open: 'Writes the global users row (display_name, city) when those are empty (lib/artist-wizard-actions.ts:72-75), so a member of this org can set a name that shows network-wide; only gap-filling, WHERE id = the viewer.',
    verified: V,
  },
  {
    id: 'elktours-experience-draft-save',
    area: 'elktours.wizards',
    label: 'Save your experience draft',
    does: 'Steps II to IV of the artist wizard: creates or updates the artist\'s own experience draft (title, pitch, description, format, place, length, group size, how it is offered and priced). Only while it is a draft or was sent back.',
    class: 'person',
    actors: ['owner', 'guide', 'member'],
    scope: 'person',
    hosts: [
      host(sa(AW, 'saveExperienceDraftAction'), ['@elkdonis/services#ensureUniqueThreadSlug', '@elkdonis/utils#sanitizeRichText', 'raw SQL INSERT/UPDATE threads', 'db.begin'], '/artist/experiences/new', 'the Next and Save steps of the artist wizard (' + WIZ + ')'),
      twin(sq(AW, 'saveExperienceDraftAction'), sa(AW, 'saveExperienceDraftAction')),
    ],
    entry: null,
    status: 'a threads row of kind experience, status draft, authored by the person, with metadata.offer exists',
    risk: ['none'],
    confirm: { text: 'Save your draft “{title}”? Nobody sees it until you send it to the office.', status: 'draft', wave: 6 },
    inputs: 'title, pitch, body, kind label, format, place, duration, group size, offer (on tour fee, standalone price, notice, visibility wanted)',
    drift: 'Differs from the office writer elktours-experience-save: artists cannot set status, visibility or cover; an artist may only change their own draft (author or linked artist), checked in the SELECT.',
    canonical: 'one experience writer in services with an artist and an office entry',
    open: 'Ownership is enforced (author or linked artist, status must be draft; lib/artist-wizard-actions.ts:97-103). The following UPDATE filters by id only (:110) after that checked SELECT. The new draft and its experience_people row are one transaction; the update path is not.',
    verified: V,
  },
  {
    id: 'elktours-experience-submit',
    area: 'elktours.wizards',
    label: 'Send your experience to the office',
    does: "The last wizard step: moves the artist's draft to pending after checking it has a line on what will happen, a place (or is online) and at least one way to offer it.",
    class: 'person',
    actors: ['owner', 'guide', 'member'],
    scope: 'person',
    hosts: [
      host(sa(AW, 'submitExperienceForReviewAction'), ['raw SQL UPDATE threads'], '/artist/experiences/{id}', 'the Send to the office button of the artist wizard (' + WIZ + ')'),
      twin(sq(AW, 'submitExperienceForReviewAction'), sa(AW, 'submitExperienceForReviewAction')),
    ],
    entry: null,
    status: 'threads.status for the experience is pending',
    risk: ['none'],
    confirm: { text: 'Send “{title}” to the office for review? You cannot change it until they answer.', status: 'draft', wave: 6 },
    inputs: 'experience id',
    drift: 'None: single copy.',
    open: 'No email or notification to the office is sent by this action; the office finds it in /manage or the mobile review cards.',
    verified: V,
  },
  {
    id: 'elktours-experience-decide',
    area: 'elktours.wizards',
    label: 'Decide on an artist experience',
    does: "The office (owners only) publishes a pending experience publicly, publishes it for members only, or sends it back to the artist with notes the artist sees.",
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      host(sa(AW, 'decideExperienceAction'), ['@elkdonis/services#reviewThread', 'raw SQL UPDATE threads'], '/manage', 'the Publish, Members only and Send back buttons on a pending experience card (components/mobile/office-review-cards.tsx)'),
      twin(sq(AW, 'decideExperienceAction'), sa(AW, 'decideExperienceAction')),
    ],
    entry: null,
    status: "threads.status is published (visibility PUBLIC or ORGANIZATION) or draft with metadata.review.notes",
    risk: ['public', 'others'],
    confirm: { text: 'Publish “{title}” for {state}? The artist will see your decision.', status: 'draft', wave: 6 },
    inputs: 'experience id, decision (publish, members, send_back), notes for send back',
    drift: 'Feed posts use the same pattern in elktours-feed-post-review (owner decides through reviewThread).',
    canonical: '@elkdonis/services#reviewThread',
    open: 'Owner-only (viewer.role check, lib/artist-wizard-actions.ts:168) and org filtered. The visibility UPDATE runs before reviewThread, so a failed approval leaves visibility changed on a still-pending experience (:186-188). No email is sent to the artist in this action.',
    verified: V,
  },
  {
    id: 'elktours-artist-availability-save',
    where: {"mode": "dock", "why": "Switches for weekdays and parts of the day."},
    area: 'elktours.wizards',
    label: 'Save your free times',
    does: 'Step III of the wizard and the artist home: replaces the artist\'s free weekday and part-of-day grid (7 x 3) and the notice they need (1, 2 or 7 days). Needs the artist_availability tables, otherwise answers "available after migration".',
    class: 'person',
    actors: ['owner', 'guide', 'member'],
    scope: 'person',
    hosts: [
      host(sa(AW, 'saveAvailabilityAction'), ['raw SQL DELETE/INSERT artist_availability', 'db.begin'], '/artist', 'the free-parts-of-the-week grid (components/mobile/artist-home-view.tsx and artist-wizard-view.tsx)'),
      twin(sq(AW, 'saveAvailabilityAction'), sa(AW, 'saveAvailabilityAction')),
    ],
    entry: null,
    status: 'artist_availability rows for the person and org match the grid',
    risk: ['none'],
    confirm: { text: 'Save your free times? Guides will only invite you for dates that fit.', status: 'draft', wave: 6 },
    inputs: 'cells (weekday 0 to 6, part), notice days',
    drift: 'None: single copy.',
    open: 'The tables come from migrations-draft/artist_availability.sql; check whether it has been applied.',
    verified: V,
  },
  {
    id: 'elktours-experience-link-to-stop',
    area: 'elktours.wizards',
    label: 'Put an experience on a tour stop',
    does: "A guide (on their own tours) or the office puts a published experience on a tour stop, or clears it. The artist gets one invitation per upcoming run they are free for, timed to when the group reaches the stop. Changing or clearing cancels the old invitations.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa(CO, 'linkExperienceToStopAction'), ['artistFreeAt', 'stopArrivalTimes', 'raw SQL UPDATE tour_stops', 'raw SQL INSERT service_commissions'], '/manage/tours/{id}/collaborate', "the Change / Take off controls of the collaborate view (components/mobile/collaborate-view.tsx)", 'Needs the service_commissions invitation columns (invitationColumnsExist), otherwise "available after migration".'),
      twin(sq(CO, 'linkExperienceToStopAction'), sa(CO, 'linkExperienceToStopAction')),
    ],
    entry: null,
    status: 'tour_stops.experience_id is set and service_commissions rows with status proposed exist per free run',
    risk: ['others'],
    confirm: { text: 'Put “{title}” on {where} and invite its artist for each run they are free? They will be asked for every date.', status: 'draft', wave: 6 },
    inputs: 'stop id, experience id or null',
    drift: 'Ownership is enforced here (guides only on their own tour, lib/collaborate-actions.ts:44); tour-actions has no equivalent.',
    open: 'Good: guide ownership checked (author_id) and org filtered on stop and experience. Writes are not in a transaction (cancel old, set stop, insert invitations). The fee is stored as price_cents on the invitation; payment is a stub (see elktours-invitation-respond).',
    verified: V,
  },
  {
    id: 'elktours-artist-invite-for-departure',
    where: {"mode": "dock", "why": "Pick a departure and an artist."},
    area: 'elktours.wizards',
    label: 'Invite the artist for one run',
    does: "A guide (their own tour) or the office manually invites the stop's artist for one upcoming run, even if the artist is not marked free.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa(CO, 'inviteForDepartureAction'), ['raw SQL INSERT service_commissions'], '/manage/tours/{id}/collaborate', "the '+ Invite' button on a run (components/mobile/collaborate-view.tsx)"),
      twin(sq(CO, 'inviteForDepartureAction'), sa(CO, 'inviteForDepartureAction')),
    ],
    entry: null,
    status: 'a service_commissions row with status proposed exists for the experience and departure',
    risk: ['others'],
    confirm: { text: 'Invite the artist of “{title}” for {when}? They will see the invitation and can accept or decline.', status: 'draft', wave: 6 },
    inputs: 'stop id, departure id',
    drift: 'Shares its insert with linkExperienceToStopAction (same SELECT ... WHERE NOT EXISTS shape, copied).',
    canonical: 'one inviteArtist helper in lib/collaborate.ts',
    open: 'Guide ownership and org checked (lib/collaborate-actions.ts:120-121). No email or push is sent; the artist sees it on /artist/invitations.',
    verified: V,
  },
  {
    id: 'elktours-invitation-respond',
    where: {"mode": "dock", "why": "Pick an invitation, accept or decline."},
    area: 'elktours.wizards',
    label: 'Accept or decline an invitation',
    does: 'The artist answers an invitation addressed to them to take part in a tour run.',
    class: 'person',
    actors: ['owner', 'guide', 'member'],
    scope: 'person',
    hosts: [
      host(sa(CO, 'respondInvitationAction'), ['respondCommission'], '/artist/invitations', 'the Accept and Decline buttons (components/mobile/invitations-view.tsx)'),
      { key: sq(CM, 'respondCommission'), service: ['raw SQL UPDATE service_commissions'], note: 'inner writer; WHERE seller_user_id is the viewer and status is proposed (own invitation only)' },
    ],
    entry: null,
    status: 'service_commissions.status is accepted or declined for the invitation',
    risk: ['others'],
    confirm: { text: 'Answer the invitation for {title} on {when} with {state}? The guide will see your answer.', status: 'draft', wave: 6 },
    inputs: 'invitation id, accept or decline',
    drift: 'None: single copy.',
    open: 'Ownership enforced in SQL (seller_user_id = viewer, status proposed). The commission carries a fee (price_cents) but payment_status is pinned to stub by a CHECK, so no money moves yet; revisit the money flag when a payment model is chosen (spec question Q1). No email on answer.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [
  { key: sa(AW, 'inviteArtistAction'), why: 'dead: no caller found in the repo; would grant the member role by email, owner only' },
  { key: sq(CM, 'proposeCommission'), why: 'dead: no caller in the repo; service commissions are only created by the collaborate actions' },
  { key: sq(CM, 'setCommissionStatus'), why: 'dead: no caller in the repo; it also has no ownership or org check (its _byUserId argument is unused, lib/commissions.ts:108-117), so a caller would have to check the role first' },
];

const area: Area = { capabilities, ignored };
export default area;
