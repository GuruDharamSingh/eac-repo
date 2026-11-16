import type { Area, Capability, Host, HostKey } from '../types';

// apps/sophia: the course site (Sophia). One door, api/lms/[action], over packages/lms-ui handleLmsAction. Its 29
// actions are the SAME cases the arts-collective copy serves (arts-collective.learn.ts, one row per case there); here
// they are grouped into 5 rows with a `case` per host. 2026-11-16, round 3. Conventions: atlas/JOURNAL.md.
// Gate: the door only asks for a signed-in viewer (actions.ts: redirect to sign-in); every role rule is inside
// packages/lms (enrol, completeStep, createCourse, editOutline, saveTradition ...), which takes the viewer.
// apps/sophia viewer.ts: SOPHIA_DEV_VIEWER_ID impersonation is ignored when NODE_ENV is production (compose sets it).

const APP = 'sophia';
const DOOR = 'api:apps/sophia/src/app/api/lms/[action]/route.ts#POST' as HostKey;
const V = '2026-11-16 read apps/sophia/src/app/api/lms/[action]/route.ts, lib/{viewer,connectors}.ts, packages/lms-ui/src/actions.ts (cases begin..studio-sync-rsvps)';
const SVC = '@elkdonis/lms-ui#handleLmsAction';
const cs = (kase: string, service: string[], path: string, how: string, note?: string): Host => ({
  key: DOOR, case: kase, service: [SVC, ...service], address: { app: APP, path, how }, note,
});
const COPY = (ids: string) => `copy of arts-collective.learn:${ids}; differs: none in code (same lms-ui handler), different host app and connectors (sophia supplies its own uploadMedia, hrefs and taskElsewhere).`;

const capabilities: Capability[] = [
  {
    id: 'sophia-course-learn',
    area: 'sophia.courses',
    label: 'Take a course',
    does: 'A signed-in learner joins a course group, marks a step done, saves or deletes a reflection or a private note to the guide, or steps out of the course.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      cs('begin', ['lms#enrol'], '/{course}', 'the Begin or Join button on a course page (packages/lms-ui pages.tsx)'),
      cs('complete', ['lms#completeStep'], '/{course}/{step}', 'the Mark done button of a step (packages/lms-ui steps)'),
      cs('respond', ['lms#saveResponse', 'lms#completeStep'], '/{course}/{step}', 'the reflection box under a step (Save, or Save and complete)'),
      cs('delete-response', ['lms#deleteResponse'], '/journal', 'the Delete link on a reflection in the journal'),
      cs('withdraw', ['lms#withdraw'], '/{course}', 'the Step out of this course link'),
    ],
    entry: null,
    status: 'an lms enrolment, step completion or response row reflects the action for the person',
    risk: ['others'],
    confirm: { text: 'Do this in “{title}”? Your guide can see your progress and anything you write for them.', status: 'draft', wave: 6 },
    inputs: 'course, run, enrolment, step, body, kind, visibility, response',
    drift: COPY('begin-course, complete-step, respond-to-step, delete-response, withdraw-from-course'),
    canonical: 'packages/lms-ui handleLmsAction (already shared)',
    open: 'Role and ownership checks are in packages/lms (viewer passed in); not re-read here. Reflections can be shared with the group or the guide (visibility field).',
    verified: V,
  },
  {
    id: 'sophia-course-guide',
    area: 'sophia.courses',
    label: 'Guide a course group',
    does: 'A guide answers a learner’s reflection, sets a step aside for someone, opens forum conversations for the course, moves the group to the latest course version, or adds another guide to the group.',
    class: 'person',
    actors: ['guide', 'owner'],
    scope: 'org',
    hosts: [
      cs('acknowledge', ['lms#acknowledge'], '/journal', 'the Answer button on a learner reflection in To answer (journal)'),
      cs('waive', ['lms#waiveStep'], '/studio/{course}', 'the Set aside control on a learner row of the run page'),
      cs('open-discussions', ['lms#openRunDiscussions'], '/studio/{course}', 'the Open conversations button on the run page'),
      cs('adopt', ['lms#adoptLatestVersion'], '/studio/{course}', 'the Move to latest version button on the run page'),
      cs('studio-add-guide', ['lms#addRunGuideByEmail'], '/studio/{course}', 'the Add a guide box on the run page'),
    ],
    entry: null,
    status: 'the response acknowledgement, waiver, discussion link, run version or run guide row reflects the action',
    risk: ['others'],
    confirm: { text: 'Do this for the {course} group? The learners and the other guides will see it.', status: 'draft', wave: 6 },
    inputs: 'response, enrolment, step, run, email',
    drift: COPY('acknowledge-response, waive-step, open-course-discussions, adopt-latest-version, add-run-guide'),
    canonical: 'packages/lms-ui handleLmsAction (already shared)',
    open: 'Whether each guard checks the guide is a guide OF THAT run (not any guide) lives in packages/lms; not re-read in this round.',
    verified: V,
  },
  {
    id: 'sophia-course-author',
    area: 'sophia.studio',
    label: 'Author and run a course',
    does: 'A course owner or guide starts a course, saves its details, publishes a version, opens a group, saves the group’s settings, changes how a workshop is listed, brings workshop RSVPs into a group, or chooses which side (realm) a course shows on.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      cs('studio-create-course', ['lms#createCourse'], '/studio', 'the Start a course form (studio home)'),
      cs('studio-save-course', ['lms#updateCourse'], '/studio/{course}', 'the course details form (title, address, summary, visibility)'),
      cs('studio-publish', ['lms#publishCourse'], '/studio/{course}', 'the Publish button of the course page'),
      cs('studio-create-run', ['lms#createRun'], '/studio/{course}', 'the Open a group form'),
      cs('studio-save-run', ['lms#updateRun'], '/studio/{course}', 'the group settings form'),
      cs('studio-workshop-listing', ['lms#setWorkshopListing'], '/studio/workshops', 'the listing controls of /studio/workshops'),
      cs('studio-sync-rsvps', ['lms#syncWorkshopEnrolments'], '/studio/workshops', 'the Bring in RSVPs button'),
      cs('studio-realm', ['lms#setRealm'], '/studio/{course}', 'the side picker on a course or event'),
    ],
    entry: null,
    status: 'the course, version, run or listing row reflects the action',
    risk: ['public', 'others'],
    confirm: { text: 'Save this change to “{title}”? Learners in the course will see it once it is published.', status: 'draft', wave: 6 },
    inputs: 'org, course, title, slug, summary, description, visibility, run settings, realm',
    drift: COPY('create-course, save-course, publish-course, create-course-run, save-course-run, set-workshop-listing, sync-run-rsvps, set-realm'),
    canonical: 'packages/lms-ui handleLmsAction (already shared)',
    open: 'studio-create-course takes the org from the form (actions.ts:167-169); createCourse is where the viewer’s role in that org is checked (not re-read). studio-workshop-listing is the newer twin of apps/admin admin-workshop-promote.',
    verified: V,
  },
  {
    id: 'sophia-course-authoring-internal',
    area: 'sophia.studio',
    label: 'Edit a course outline, step or pool',
    does: 'The step-level edits behind the studio: outline changes (add, move, remove modules and steps, unlock rules), a step’s working copy, a media upload into a step, and the course’s reusable pool (add, edit or archive, use in a step).',
    class: 'internal',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      cs('studio-outline', ['lms#editOutline'], '/studio/{course}', 'the outline editor of the course page'),
      cs('studio-save-step', ['lms#upsertStepDraft'], '/studio/{course}/{step}', 'the Save of the step editor (EditorIsland)'),
      cs('studio-upload', ['connectors.uploadMedia', 'lms#upsertStepDraft'], '/studio/{course}/{step}', 'the media button of the step editor'),
      cs('pool-add', ['lms#addToPool'], '/studio/{course}/pool', 'the Add to the pool form'),
      cs('pool-edit', ['lms#updatePoolItem'], '/studio/{course}/pool', 'the Edit and Archive controls of a pool item'),
      cs('pool-use', ['lms#usePoolItem'], '/studio/{course}/pool', 'the Use in a step control of a pool item'),
    ],
    status: 'the outline, step content or pool row reflects the action',
    risk: ['none'],
    inputs: 'course, op, step, module, rule, body, file, pool item',
    drift: COPY('edit-course-outline, save-course-step, upload-course-media, add-to-course-pool, edit-course-pool-item, use-course-pool-item'),
    canonical: 'packages/lms-ui handleLmsAction (already shared)',
    open: 'sophia connectors.uploadMedia (connectors.ts:~75-100) sniffs bytes with validateUploadBuffer, refuses SVG and caps size per kind (video 500 MB): good, stronger than the blog upload.',
    verified: V,
  },
  {
    id: 'sophia-registry-admin',
    area: 'sophia.studio',
    label: 'Curate traditions and listed guides',
    does: 'An admin or hub curator adds, edits or removes a tradition, and adds, edits (bio, photo, realm, traditions, listed or not) or removes a guide on the public guides page.',
    class: 'admin',
    actors: ['admin', 'owner'],
    scope: 'other',
    hosts: [
      cs('studio-tradition-save', ['lms#saveTradition'], '/studio/traditions', 'the tradition form'),
      cs('studio-tradition-delete', ['lms#deleteTradition'], '/studio/traditions', 'the Remove link on a tradition'),
      cs('studio-guide-add', ['lms#addGuideByEmail'], '/studio/guides', 'the Add a guide by email box'),
      cs('studio-guide-save', ['lms#saveGuide'], '/studio/guides', 'the guide profile form'),
      cs('studio-guide-remove', ['lms#removeGuide'], '/studio/guides', 'the Take off the list link'),
    ],
    status: 'the tradition or guide row reflects the action',
    risk: ['public', 'others'],
    inputs: 'tradition id, name, description, email, user, bio, photo, realm, listed, traditions',
    drift: COPY('save-tradition, delete-tradition, add-listed-guide, save-listed-guide, remove-listed-guide'),
    canonical: 'packages/lms-ui handleLmsAction (already shared)',
    open: 'SECURITY (check, not read): the gate for these five (canCurateHub in packages/lms) was not re-read here. studio-guide-save takes `photo` as a free URL string (actions.ts:318-322) that is shown on the public guides page, with no check here.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
