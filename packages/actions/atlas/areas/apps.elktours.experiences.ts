import type { Area, Capability, Host, HostKey } from '../types';

// elktours Experiences (artist offerings as threads of kind 'experience'): editor forms, status, people, page layout,
// the public inquiry, and the /studio layout publishers. Artist wizard and invitations are in apps.elktours.wizards.ts.
// 2026-11-16, round 2 curator (elktours). Spec: docs/open/ELKTOURS_EXPERIENCES_SPEC_2026-11-02.md.

const APP = 'elktours';
const SRC = 'apps/elktours/src/';
const EX = 'lib/experience-actions.ts';
const ST = 'app/studio/actions.ts';
const V = '2026-11-16 read lib/experience-actions.ts, app/studio/actions.ts, lib/experience-layout.ts, lib/auth.ts, components/manage/experience-form.tsx and components/experiences/* (imports)';
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });
const twin = (key: HostKey, of: HostKey): Host => ({ key, service: ['raw SQL'], note: `twin of ${of}` });

const capabilities: Capability[] = [
  {
    id: 'elktours-experience-save',
    area: 'elktours.experiences',
    label: 'Save an experience',
    does: 'Creates or edits an experience (title, description, summary, cover, place, price, format, highlights, linked service, draft or published, public or members only) from the office form.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa(EX, 'saveExperienceAction'), ['@elkdonis/services#ensureUniqueThreadSlug', '@elkdonis/utils#sanitizeRichText', 'raw SQL INSERT/UPDATE threads'], '/manage/experiences/{id}', 'the Save button of the experience form (components/manage/experience-form.tsx; audience switch in components/experiences/experience-audience.tsx)'),
      twin(sq(EX, 'saveExperienceAction'), sa(EX, 'saveExperienceAction')),
    ],
    entry: null,
    status: "a threads row of kind experience for the org with the given title exists (status draft or published)",
    risk: ['public'],
    confirm: { text: 'Save the experience “{title}”? If it is published, visitors can see it and send inquiries.', status: 'draft', wave: 6 },
    inputs: 'title, body, excerpt, cover url, location, format, price, currency, duration, highlights, lat/lng, service thread, place, status, visibility',
    drift: 'Different from the tour save (tour-actions saveTourAction) and the artist draft save (elktours-experience-draft-save): three writers of the same thread kind with different fields.',
    canonical: 'one experience writer in services with an artist and an office entry',
    open: [
      'SECURITY: serviceThreadId is checked only as kind service, published, PUBLIC on ANY org (lib/experience-actions.ts:68-72, no org_id filter); an editor can link another org\'s public service. Low impact, but it is a cross-org reference.',
      'The editor path bypasses the artist review: an editor can set status published on any experience directly (:87), including ones an artist has sent for review.',
      'coverImageUrl allows any https URL (:64).',
    ].join(' '),
    verified: V,
  },
  {
    id: 'elktours-experience-status-set',
    area: 'elktours.experiences',
    label: 'Publish, hide or archive an experience',
    does: 'Moves an experience between draft, published and archived. Publishing sets the first published time.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa(EX, 'setExperienceStatusAction'), ['raw SQL UPDATE threads'], '/manage/experiences', 'the Archive / Restore as draft row actions (components/experiences/experience-row-actions.tsx) and the audience switch (experience-audience.tsx)'),
      twin(sq(EX, 'setExperienceStatusAction'), sa(EX, 'setExperienceStatusAction')),
    ],
    entry: null,
    status: 'threads.status for the id equals the requested status',
    risk: ['public'],
    confirm: { text: 'Change the experience to {state}? Published experiences are visible to visitors.', status: 'draft', wave: 6 },
    inputs: 'experience id, status',
    drift: 'Same verb as setTourStatusAction (lib/tour-actions.ts:123), a separate copy.',
    open: 'SECURITY: any guide can publish or archive any experience, including ones pending the office decision (lib/experience-actions.ts:136-148); the office-only publish gate in elktours-experience-decide is bypassed by this path.',
    verified: V,
  },
  {
    id: 'elktours-experience-people-set',
    area: 'elktours.experiences',
    label: "Set an experience's artists and hosts",
    does: 'Replaces the linked artists and hosts of an experience, in order (up to 20). People come from this org\'s members or artists.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa(EX, 'setExperiencePeopleAction'), ['raw SQL DELETE/INSERT experience_people', 'db.begin'], '/manage/experiences/{id}', "the 'Artists and hosts' picker of the experience form (components/manage/experience-form.tsx)"),
      twin(sq(EX, 'setExperiencePeopleAction'), sa(EX, 'setExperiencePeopleAction')),
    ],
    entry: null,
    status: 'experience_people rows for the thread match the list in order',
    risk: ['others'],
    confirm: { text: 'Set the artists and hosts of “{title}” to {name}? Hosts get the visitor inquiries by email.', status: 'draft', wave: 6 },
    inputs: 'experience id, list of (user id, role artist or host)',
    drift: 'None: single copy.',
    open: 'SECURITY: the user ids are checked only to exist in users (lib/experience-actions.ts:161), not to be members of this org; any user id in the network can be made host, and a host receives inquiry emails with visitor details (sendExperienceInquiryAction :246-253). Linked artists can edit the experience page layout (saveExperiencePageAction :190).',
    verified: V,
  },
  {
    id: 'elktours-experience-default-layout-publish',
    area: 'elktours.experiences',
    label: 'Publish the default experience page layout',
    does: 'Saves the site-wide default layout for experience pages (site_config puck:experience-detail), or removes it.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa(ST, 'publishExperienceDefaultLayoutAction'), ['readExperienceLayout', 'saveExperienceLayout'], '/studio/experience-detail', 'the Publish button of the default layout studio (components/studio/layout-studio.tsx)'),
      { key: sq('lib/experience-layout.ts', 'saveExperienceLayout'), service: ['raw SQL INSERT/DELETE site_config'], note: 'inner writer; editor-checked by the caller' },
    ],
    entry: null,
    status: "site_config row key puck:experience-detail exists with the layout for the org",
    risk: ['public'],
    confirm: { text: 'Publish this as the default layout for every experience page on {org}? Visitors see it at once.', status: 'draft', wave: 6 },
    inputs: 'Puck data',
    drift: 'Same shape as publishTourLayoutAction (tours file); both write site_config puck:<slug> but through different writers (one through page-builder savePage, one direct SQL).',
    canonical: '@elkdonis/page-builder/server#savePage',
    open: 'Any guide can replace the site-wide experience layout (getApiEditor). A removal path exists in saveExperienceLayout(null) but no caller passes null. The layout studio shows "Work in progress — layout edits may not be kept" (components/studio/layout-studio.tsx).',
    verified: V,
  },
  {
    id: 'elktours-experience-inquiry-send',
    area: 'elktours.experiences',
    label: 'Ask about an experience',
    does: "A visitor (no sign-in) sends a message about a published experience: name, email, message, party size, preferred date. It is emailed to the org owners, the experience's hosts and a fallback address (up to 6); replies go to the visitor.",
    class: 'person',
    actors: ['visitor'],
    scope: 'org',
    hosts: [
      host(sa(EX, 'sendExperienceInquiryAction'), ['@elkdonis/email#sendContactNotification'], '/experiences/{slug}', "the inquiry form on the experience page (components/experiences/experience-inquiry.tsx)"),
    ],
    entry: null,
    status: 'an email was sent to the owners and hosts (no row is stored; sendContactNotification logs it)',
    risk: ['emails'],
    confirm: { text: 'Send your question about “{title}” to {org}? They will reply to {email}.', status: 'draft', wave: 6 },
    inputs: 'experience id, name, email, message, party size, preferred date',
    drift: 'Elktours also has /api/inquiry (tour services inquiry) which stores a row instead of sending mail; two inquiry paths.',
    canonical: 'one inquiry handler that stores a contact row and then notifies',
    open: 'SECURITY: fully public with no rate limit, no captcha and no per-address limit (lib/experience-actions.ts:237-275). Each call can email up to 6 addresses (owners, hosts, fallback) with a visitor-chosen sender name and 4000-character message. The only gate is that the experience is published and PUBLIC. Spam and harassment vector against owners and hosts. Nothing is stored, so there is no inbox record.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [
  { key: sa(EX, 'listServiceOptionsAction'), why: 'read exposed as a server action' },
  { key: sa(EX, 'pickExperienceAction'), why: 'read: returns a stop draft from an experience; no caller found' },
  { key: sa(EX, 'searchPeopleAction'), why: 'read exposed as a server action' },
];

const area: Area = { capabilities, ignored };
export default area;
