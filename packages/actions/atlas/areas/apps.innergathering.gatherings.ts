import type { Area, Capability, Host, HostKey } from '../types';

// innergathering, gatherings and the public door: RSVP (guest and member), recurring-cycle marks, reminder emails,
// workshop save and materials, landing contact form and "work question", data deletion, the media upload, art pieces and
// the video pipeline. 2026-11-16, round 2 (curator ig). Copies of arts-collective / orgapps rows carry `drift` and the same
// `canonical`. Conventions: atlas/JOURNAL.md.

const APP = 'innergathering';
const SRC = 'apps/innergathering/src/';
const V =
  '2026-11-16 read app/api/{rsvp,threads/[id]/{rsvp,cycle,trigger-email},contact,data/delete,work-question,upload,workshops/[id]/materials}/route.ts, lib/cms/{workshop,art-piece,video}-actions.ts, lib/auth.ts, services thread-rsvp.ts, email index.ts; callers in components/{rsvp-panel,workshop-materials,site-footer}.tsx, components/manage/*, components/landing/*';
const api = (p: string, m: string): HostKey => `api:${SRC}app/api/${p}/route.ts#${m}` as HostKey;
const sq = (p: string, m: string): HostKey => `sql:${SRC}app/api/${p}/route.ts#${m}` as HostKey;
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({
  key,
  service,
  address: { app: APP, path, how },
  note,
});
const twin = (key: HostKey, of: string): Host => ({ key, service: ['(raw SQL in the same function)'], note: `sql twin of ${of}` });

const capabilities: Capability[] = [
  // ---- RSVP ----
  {
    id: 'ig-rsvp-join',
    area: 'innergathering.gatherings',
    label: 'Join a gathering',
    does: 'A signed-in person RSVPs yes to a published gathering. A free one records the RSVP at once, shares the workshop materials if it is a workshop, and emails the person and the author. A priced one creates an order and returns a Stripe checkout address instead; the place is granted when the payment lands.',
    class: 'person',
    actors: ['person'],
    scope: 'thread',
    hosts: [
      host(api('threads/[id]/rsvp', 'POST'), ['@elkdonis/services#setRsvpStatus', '@elkdonis/services#checkRsvpEligibility', '@elkdonis/commerce/server#createThreadOrder', '@elkdonis/checkout/stripe#startStripeCheckout', '@elkdonis/email#sendRsvpConfirmation'], '/{section}/{slug}', 'the Join / Book button of the gathering page (components/rsvp-panel.tsx)', 'Any signed-in person may join (getViewer, no role check). Money rows link only: the checkout page takes the payment.'),
      twin(sq('threads/[id]/rsvp', 'POST'), 'api:apps/innergathering/src/app/api/threads/[id]/rsvp/route.ts#POST'),
    ],
    entry: null,
    status: 'a thread_rsvps row with status yes for the person exists (for a priced one: the order is paid)',
    risk: ['money', 'emails', 'others'],
    confirm: {
      text: 'Join “{title}”? {org} sees you are coming and you get a confirmation email. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 6,
    },
    inputs: 'thread id, receiveEmailNotice, amountMinor (sliding scale only)',
    drift:
      'copy of arts-collective.sites.ts:rsvp-to-event; differs: this one is 287 lines against 149. Extras here: a paid branch (createThreadOrder + startStripeCheckout), workshop materials sharing (shareWorkshopMaterials), a min-attendees nudge to the author, and every query filtered by org_id and status published. arts-collective checks eligibility and syncs Nextcloud materials.',
    canonical: 'one shared handler in @elkdonis/services (rsvpHandlers, like connectionsHandlers) that each app mounts',
    open:
      'Amount: only passed to createThreadOrder when the workshop has a sliding scale (floor > 0); commerce re-validates it (not re-read here). SECURITY (mild): the api/hub/meeting/attendance door sets the same RSVP rows without the paid branch (see he-attendance-set). The origin for the Stripe return URL comes from lib/public-origin (forwarded headers), not read here.',
    verified: V,
  },
  {
    id: 'ig-rsvp-cancel',
    area: 'innergathering.gatherings',
    label: 'Cancel your RSVP',
    does: 'A signed-in person removes their RSVP row for a published gathering; for a workshop it also withdraws their share of the materials.',
    class: 'person',
    actors: ['person'],
    scope: 'thread',
    hosts: [
      host(api('threads/[id]/rsvp', 'DELETE'), ['@elkdonis/services#deleteRsvp'], '/{section}/{slug}', 'the Cancel button of the gathering page (components/rsvp-panel.tsx)', 'No refund step: a paid place is simply dropped.'),
    ],
    entry: null,
    status: 'no thread_rsvps row for the person and thread',
    risk: ['others', 'money'],
    confirm: {
      text: 'Cancel your place at “{title}”? {org} will see you are no longer coming. Refunds are not made here.',
      status: 'draft',
      wave: 6,
    },
    drift: 'copy of arts-collective.sites.ts:cancel-rsvp; differs: org_id and published filter, and workshop-materials unshare.',
    canonical: 'the shared rsvp handler',
    open: 'SECURITY (mild): cancelling a paid place deletes the RSVP and does not touch the order or refund (threads/[id]/rsvp/route.ts:273-287); a person who cancelled and rejoins is sent to checkout again. Confirm whether refunds are meant to be manual.',
    verified: V,
  },

  // ---- workshops ----
  {
    id: 'ig-workshop-material-add',
    area: 'innergathering.gatherings',
    label: 'Add a file to a workshop’s materials',
    does: 'An owner or guide uploads a file (up to 50 MB; magic bytes checked) to a workshop of this organisation. People who joined the workshop can open it.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'thread',
    hosts: [
      host(api('workshops/[id]/materials', 'POST'), ['@elkdonis/services#uploadWorkshopMaterial', '@elkdonis/utils#validateUploadBuffer'], '/{section}/{slug}', 'the Materials list of a workshop page (components/workshop-materials.tsx:45)'),
    ],
    entry: null,
    status: 'a file under the workshop’s materials folder (listWorkshopMaterials)',
    risk: ['others'],
    confirm: {
      text: 'Add “{file}” to the materials of “{title}”? People who joined the workshop can open it.',
      status: 'draft',
      wave: 6,
    },
    drift: 'Not in arts-collective; only innergathering (and inner-gathering, legacy) have this route.',
    canonical: 'services uploadWorkshopMaterial (already shared)',
    verified: V,
  },
  {
    id: 'ig-workshop-material-remove',
    area: 'innergathering.gatherings',
    label: 'Remove a file from a workshop’s materials',
    does: 'An owner or guide deletes one file, by name, from a workshop’s materials.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'thread',
    hosts: [
      host(api('workshops/[id]/materials', 'DELETE'), ['@elkdonis/services#deleteWorkshopMaterial'], '/{section}/{slug}', 'the remove control of the Materials list (components/workshop-materials.tsx:65)', 'The workshop must be of this org and kind workshop; the file name comes from ?name=.'),
    ],
    entry: null,
    status: 'no such file in the workshop’s materials',
    risk: ['irreversible'],
    confirm: {
      text: 'Remove “{file}” from the materials of “{title}”? This cannot be undone.',
      status: 'draft',
      wave: 6,
    },
    drift: 'Only innergathering.',
    canonical: 'services deleteWorkshopMaterial (already shared)',
    open: 'The file name from ?name= is passed to the service as given; whether deleteWorkshopMaterial rejects "../" is in services/workshop-materials, not read here.',
    verified: V,
  },

  // ---- public forms ----
  {
    id: 'ig-question-answer',
    area: 'innergathering.gatherings',
    label: 'Answer the question of the week',
    does: 'A visitor or a signed-in person answers the active work question on the landing page. A signed-in person’s display name comes from their profile; a visitor may give a name.',
    class: 'person',
    actors: ['visitor', 'person'],
    scope: 'org',
    hosts: [
      host(api('work-question', 'POST'), ['(raw SQL INSERT into work_question_responses)', '@elkdonis/services#getProfile'], '/', 'the answer box of the landing page (components/landing/WorkQuestion.tsx, GuestAnswer.tsx)'),
      twin(sq('work-question', 'POST'), 'api:apps/innergathering/src/app/api/work-question/route.ts#POST'),
    ],
    entry: null,
    status: 'a work_question_responses row for the question exists',
    risk: ['public'],
    confirm: {
      text: 'Send your answer to the question of the week? {org}’s team can read it.',
      status: 'draft',
      wave: 6,
    },
    inputs: 'questionId, response (4000), displayName (visitor)',
    drift: 'Same route in inner-gathering (legacy) and admin (not diffed).',
    canonical: 'a services function saveWorkQuestionResponse behind one shared kit route',
    open: 'SECURITY (mild): no rate limit; the question must belong to this org and be active (work-question/route.ts:25-28), so there is no cross-org write. Whether answers are shown publicly is not read here (risk set to public as a precaution).',
    verified: V,
  },

  // ---- media, art pieces, video ----
  {
    id: 'ig-video-pipeline-save',
    area: 'innergathering.video',
    label: 'Set up an automatic video pipeline',
    does: 'An owner or guide creates a video pipeline for the organisation, or changes its settings or switches it on or off. A pipeline turns recordings into reviewable video jobs.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('lib/cms/video-actions.ts', 'createVideoPipelineAction'), ['@elkdonis/services#createVideoPipeline'], '/manage/video', 'the New pipeline control (components/manage/video-pipelines.tsx)'),
      host(sa('lib/cms/video-actions.ts', 'updateVideoPipelineAction'), ['@elkdonis/services#updateVideoPipeline'], '/manage/video', 'the settings and on/off switch of a pipeline (video-pipelines.tsx)'),
    ],
    entry: null,
    status: 'a video pipeline row for the org holds the settings and enabled flag',
    risk: ['none'],
    confirm: {
      text: 'Save the video pipeline “{name}”? It starts making videos for review when it is on.',
      status: 'draft',
      wave: 6,
    },
    drift: 'Not the arts-collective video-project family (that is per-person video projects); this is the org video pipeline in services/video-pipeline.ts. Same actions in other apps not checked.',
    canonical: 'services createVideoPipeline / updateVideoPipeline behind one shared kit action',
    open: 'The pipeline settings (VideoPipelineSettings) pass through as a Partial from the client with no validation in the action (lib/cms/video-actions.ts:44-49); the service may validate.',
    verified: V,
  },
  {
    id: 'ig-video-job-review',
    area: 'innergathering.video',
    label: 'Review, retry or approve a video',
    does: 'An owner or guide edits a rendered video’s title, description and edit points (and may re-render it), runs a finished or failed job again, or approves a rendered video.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('lib/cms/video-actions.ts', 'saveVideoJobAction'), ['@elkdonis/services#updateVideoJobReview', '@elkdonis/services#requeueVideoJob'], '/manage/video', 'the review form of a video job (components/manage/video-pipelines.tsx)'),
      host(sa('lib/cms/video-actions.ts', 'retryVideoJobAction'), ['@elkdonis/services#requeueVideoJob'], '/manage/video', 'the Run again button of a job (video-pipelines.tsx)'),
      host(sa('lib/cms/video-actions.ts', 'approveVideoJobAction'), ['@elkdonis/services#approveVideoJob'], '/manage/video', 'the Approve button of a rendered job (video-pipelines.tsx)', 'approveVideoJob only moves status ready to approved (services/video-pipeline.ts:624-630), scoped by org.'),
    ],
    entry: null,
    status: 'the video_jobs row for the id shows the new status or review fields',
    risk: ['public'],
    confirm: {
      text: 'Approve “{title}”? It goes on to be published. This cannot be undone here.',
      status: 'draft',
      wave: 6,
    },
    drift: 'Not a copy of arts-collective video-projects (different family).',
    canonical: 'services video-pipeline functions behind one shared kit action',
    open: 'What happens after approval (publishing) is in the video worker, not traced. Risk public is set as a precaution.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [
  {
    key: sa('lib/cms/art-piece-actions.ts', 'canListArtPieceAction'),
    why: 'read exposed as a server action: reports whether the person has an active store, writes nothing',
  },
];

const area: Area = { capabilities, ignored };
export default area;
