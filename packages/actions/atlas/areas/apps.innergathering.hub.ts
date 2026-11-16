import type { Area, Capability, Host, HostKey } from '../types';

// innergathering, the member hub: email suite, newsletter, documents, whiteboard, chat, the Nextcloud Deck pipeline and
// the standing-meeting hub routes (light, rota, attendance, record). 2026-11-16, round 2 (curator ig).
// Gates: getApiMember = role owner, guide or member; getApiEditor = owner or guide (lib/auth.ts). Every route scopes by
// siteConfig.orgId. Conventions: atlas/JOURNAL.md.

const APP = 'innergathering';
const SRC = 'apps/innergathering/src/';
const V =
  '2026-11-16 read app/api/hub/{email,documents,whiteboard,meeting}/**, app/api/{newsletter,chat,pipeline}/**, lib/{auth,chat-api,pipeline,pipeline-api}.ts, services meeting-rota.ts, callers in components/hub/email/use-email-connectors.ts and packages/{cms-ui,pipeline,chat,newsletter}';
const api = (p: string, m: string): HostKey => `api:${SRC}app/api/${p}/route.ts#${m}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string, c?: string): Host => ({
  key,
  service,
  address: { app: APP, path, how },
  note,
  ...(c ? { case: c } : {}),
});

const EMAIL_HOOK = 'components/hub/email/use-email-connectors.ts (EmailPopup.tsx, hub/email/[key]/edit/page.tsx)';
const PIPE = 'packages/pipeline/src/components';

const capabilities: Capability[] = [
  // ---- email suite ----
  {
    id: 'ig-email-template-reset',
    area: 'innergathering.email',
    label: 'Put an email back to the default wording',
    does: 'An owner or guide clears the organisation’s own wording for one system email, so it goes back to the network default.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [host(api('hub/email/[key]', 'DELETE'), ['@elkdonis/email#clearOrgTemplate'], '/hub/email/{key}/edit', `the Reset button of the email editor (${EMAIL_HOOK})`),
      {
        "key": "api:apps/ifac/src/app/api/hub/email/[key]/route.ts#DELETE",
        "service": [
          "(getApiEditor: owner or guide)",
          "@elkdonis/email#clearOrgTemplate"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/email/{key}/edit",
          "how": "Reset in the email surface (packages/cms-ui email/EmailSurface.tsx, TemplateWordsEditor.tsx; mounted at /manage/email and /hub/email/[key])"
        }
      },
    ],
    entry: null,
    status: 'no org template row for the key',
    risk: ['emails', 'irreversible'],
    confirm: {
      text: 'Put the “{name}” email back to the default wording? {org}’s own wording is deleted. This cannot be undone.',
      status: 'draft',
      wave: 6,
    },
    drift: "No twin row seen in the arts-collective hub area (it maps only the PUT).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (innergathering, ifac). Differences by app:\n- ifac (was ifac-email-template-reset): arts-collective save-email-template covers save only; reset is a separate DELETE here.",
    canonical: 'clearOrgTemplate behind the same shared kit route as save-email-template',
    verified: V,
    inputs: "key (path), series scope (query)",
  },
  {
    id: 'ig-email-template-test',
    area: 'innergathering.email',
    label: 'Send yourself a test of an email',
    does: 'An owner or guide sends one sample of a system email, in the organisation’s own wording, to their own account address.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'person',
    hosts: [host(api('hub/email/[key]/test', 'POST'), ['@elkdonis/email#renderSample', '@elkdonis/email#renderAdvancedEmail', '@elkdonis/email#sendEmail'], '/hub/email/{key}/edit', `the Send me a test button (${EMAIL_HOOK})`, 'Recipient is always editor.email; nothing is stored.'),
      {
        "key": "api:apps/ifac/src/app/api/hub/email/[key]/test/route.ts#POST",
        "service": [
          "(getApiEditor: owner or guide)",
          "@elkdonis/email#renderSample",
          "@elkdonis/email#renderAdvancedEmail",
          "@elkdonis/email#sendEmail"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/email/{key}/edit",
          "how": "Send test in the email surface (packages/cms-ui email/EmailSurface.tsx, TemplateWordsEditor.tsx; mounted at /manage/email and /hub/email/[key])"
        }
      },
    ],
    entry: null,
    status: 'unverifiable: an email leaves; a delivery log row (kind notification, category test-send) is the only trace',
    risk: ['emails'],
    confirm: {
      text: 'Send a test of the “{name}” email to {email}? Only you get it.',
      status: 'draft',
      wave: 6,
    },
    drift: "No twin row seen in the arts-collective hub area; no rate limit in this route.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (innergathering, ifac). Differences by app:\n- ifac (was ifac-email-template-test): No arts-collective row found for test send. Recipient is the editor own account email, not an input.",
    canonical: 'one shared kit route for the email suite',
    verified: V,
    inputs: "key, series scope",
  },

  // ---- newsletter ----

  // ---- documents, whiteboard, chat ----
  {
    id: 'ig-whiteboard-export',
    area: 'innergathering.hub',
    label: 'Save a whiteboard picture to the files',
    does: 'A member saves an export of the whiteboard (.png, .svg or .excalidraw, up to 25 MB) into the organisation’s Private/Whiteboards folder in Nextcloud.',
    class: 'person',
    actors: ['member', 'guide', 'owner'],
    scope: 'org',
    hosts: [host(api('hub/whiteboard/export', 'POST'), ['@elkdonis/services#uploadOrgFile'], '/hub/whiteboard', 'the Save to files button of the whiteboard surface (WhiteboardSurface.tsx)', 'File name is sanitised and time-stamped by uploadOrgFile; the type is decided by the extension.')],
    entry: null,
    status: 'a file exists under EAC_Network/inner_group/Private/Whiteboards and a media row',
    risk: ['none'],
    confirm: {
      text: 'Save this whiteboard picture to {org}’s private files? Members of {org} can open it there.',
      status: 'draft',
      wave: 6,
    },
    drift: 'Only innergathering has this route.',
    canonical: 'services uploadOrgFile (already shared)',
    open: 'The mime type is chosen from the file extension and the bytes are not inspected (hub/whiteboard/export/route.ts:46-51), unlike /api/upload.',
    verified: V,
  },

  // ---- pipeline (Nextcloud Deck) ----

  // ---- standing meeting hub routes ----
  {
    id: 'ig-meeting-light-set',
    area: 'innergathering.meeting',
    label: 'Set the light on a meeting',
    does: 'The week’s host, or an owner or guide, sets a meeting’s light to green, yellow or red with a note, for one occurrence.',
    class: 'person',
    actors: ['member', 'guide', 'owner'],
    scope: 'thread',
    hosts: [host(api('hub/meeting/light', 'POST'), ['@elkdonis/services#setMeetingLight', '@elkdonis/services#isOccurrenceHost'], '/hub', 'the light buttons on the standing-meeting face (packages/cms-ui/src/hub/StandingMeetingFace.tsx; app/hub/site-view.tsx)', 'Non-editors must be that occurrence’s host (isOccurrenceHost).', 'set'),
      {
        "key": "api:apps/ifac/src/app/api/hub/meeting/light/route.ts#POST",
        "service": [
          "(getHubViewer: owner, guide or member of ifac via hasOrgRole)",
          "(editor, or isOccurrenceHost for that occurrence)",
          "@elkdonis/services#setMeetingLight"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "light control on the meeting card (app/hub/cards-view.tsx)"
        },
        "note": "set branch",
        "case": "set"
      },
    ],
    entry: null,
    status: 'the meeting light row for the thread and occurrence shows the state',
    risk: ['public', 'others'],
    confirm: {
      text: 'Set the light for “{title}” to {state}? Members of {org} see it on the meeting card.',
      status: 'draft',
      wave: 6,
    },
    inputs: 'threadId, state, note, occurrence',
    drift: "Same route in ifac (not diffed; other agent).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (innergathering, ifac). Differences by app:\n- ifac (was ifac-meeting-light-set): Owner/guide may set any; a member only for an occurrence they host (isOccurrenceHost). Compare ig-meeting-record-save, which has no host gate.",
    canonical: 'services setMeetingLight / isOccurrenceHost behind one shared kit route',
    verified: V,
  },
  {
    id: 'ig-meeting-light-clear',
    area: 'innergathering.meeting',
    label: 'Clear the light on a meeting',
    does: 'An owner or guide removes a meeting’s set light, so it falls back to the computed one.',
    class: 'person',
    actors: ['guide', 'owner'],
    scope: 'thread',
    hosts: [host(api('hub/meeting/light', 'POST'), ['@elkdonis/services#clearMeetingLight'], '/hub', 'the clear control on the standing-meeting face (StandingMeetingFace.tsx)', 'Only canEdit may clear.', 'clear'),
      {
        "key": "api:apps/ifac/src/app/api/hub/meeting/light/route.ts#POST",
        "service": [
          "(getHubViewer then viewer.canEdit = owner or guide)",
          "@elkdonis/services#clearMeetingLight"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "clear on the light control (app/hub/cards-view.tsx)"
        },
        "note": "clear branch",
        "case": "clear"
      },
    ],
    entry: null,
    status: 'no set light for the thread',
    risk: [
      "others",
      "public"
    ],
    confirm: {
      text: 'Clear the light for “{title}”? Members of {org} see the computed light again.',
      status: 'draft',
      wave: 6,
    },
    drift: "Same route in ifac (not diffed).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (innergathering, ifac). Differences by app:\n- ifac (was ifac-meeting-light-clear): See ifac-meeting-light-set.",
    canonical: 'services clearMeetingLight behind one shared kit route',
    verified: V,
    inputs: "threadId, clear",
  },
  {
    id: 'ig-meeting-rota-assign',
    area: 'innergathering.meeting',
    label: 'Put someone on a meeting’s rota',
    does: 'A member puts themselves, or an owner or guide puts anyone, in a role (host by default, co-host and others) for one occurrence.',
    class: 'person',
    actors: ['member', 'guide', 'owner'],
    scope: 'thread',
    hosts: [host(api('hub/meeting/rota', 'POST'), ['@elkdonis/services#assignMeetingRole'], '/hub', 'the rota rows of the Plan ahead surface (packages/cms-ui/src/hub/PlanAheadSurface.tsx)', 'assignMeetingRole upserts (ON CONFLICT DO UPDATE on thread, occurrence, role).', 'assign'),
      {
        "key": "api:apps/ifac/src/app/api/hub/meeting/rota/route.ts#POST",
        "service": [
          "(getApiMember: owner, guide or member)",
          "(self-assign allowed; others need owner or guide)",
          "@elkdonis/services#assignMeetingRole"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "rota table in the plan-ahead surface (packages/cms-ui hub/PlanAheadSurface.tsx)"
        },
        "note": "branch body.userId set",
        "case": "assign"
      },
    ],
    entry: null,
    status: 'a meeting_hosts row for the occurrence and role holds the user',
    risk: ['others'],
    confirm: {
      text: 'Put {person} down as {role} for “{title}” on {when}? The organisers and members see the rota.',
      status: 'draft',
      wave: 6,
    },
    inputs: 'threadId, occurrenceAt, role, userId',
    drift: "Same route in ifac (not diffed).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (innergathering, ifac). Differences by app:\n- ifac (was ifac-meeting-host-assign): Only ifac and sunjay-style rota; no hidden-enneagram copy.",
    canonical: 'services assignMeetingRole behind one shared kit route',
    open: "SECURITY: a member who is not an organiser can only assign themselves, but the check is only \"userId is me\" (hub/meeting/rota/route.ts:134-140); it does not look at who already holds the role, and the service overwrites on conflict (services/meeting-rota.ts:244-253). So a member can take over another member’s host or co-host slot, and `role` is free text (any string). Being host also lets them set the meeting light.\nifac (ifac-meeting-host-assign): SECURITY: apps/ifac/src/app/api/hub/meeting/rota/route.ts:128-135 the role name is free text from the body and a plain member may assign themselves to any occurrence, including host, which then passes the isOccurrenceHost gate on the light route. Self-service may be intended, but the role is not allow-listed here.",
    verified: V,
  },
  {
    id: 'ig-meeting-rota-clear',
    area: 'innergathering.meeting',
    label: 'Take someone off a meeting’s rota',
    does: 'The holder of a role clears their own spot, or an owner or guide clears anyone’s, for one occurrence.',
    class: 'person',
    actors: ['member', 'guide', 'owner'],
    scope: 'thread',
    hosts: [host(api('hub/meeting/rota', 'POST'), ['@elkdonis/services#clearMeetingRole', '@elkdonis/services#getRoleHolder'], '/hub', 'the remove control on a rota row (PlanAheadSurface.tsx)', 'POST with no userId and no plan.', 'clear'),
      {
        "key": "api:apps/ifac/src/app/api/hub/meeting/rota/route.ts#POST",
        "service": [
          "(getApiMember: owner, guide or member)",
          "@elkdonis/services#clearMeetingRole",
          "@elkdonis/services#getRoleHolder"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "clear on the rota table (packages/cms-ui hub/PlanAheadSurface.tsx)"
        },
        "note": "branch with no userId",
        "case": "clear"
      },
    ],
    entry: null,
    status: 'no meeting_hosts row for the occurrence and role',
    risk: ['others'],
    confirm: {
      text: 'Take {person} off the {role} spot for “{title}” on {when}? The organisers and members see the rota change.',
      status: 'draft',
      wave: 6,
    },
    drift: "Same route in ifac (not diffed).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (innergathering, ifac). Differences by app:\n- ifac (was ifac-meeting-host-clear): See ifac-meeting-host-assign.",
    canonical: 'services clearMeetingRole behind one shared kit route',
    verified: V,
    inputs: "threadId, occurrenceAt, role",
  },
  {
    id: 'ig-meeting-plan-save',
    area: 'innergathering.meeting',
    label: 'Say what a week’s meeting covers',
    does: 'The week’s host or co-host, or an owner or guide, writes what one occurrence will cover.',
    class: 'person',
    actors: ['member', 'guide', 'owner'],
    scope: 'thread',
    hosts: [host(api('hub/meeting/rota', 'POST'), ['@elkdonis/services#setOccurrencePlan', '@elkdonis/services#getRoleHolder'], '/hub', 'the plan field of a rota row (PlanAheadSurface.tsx)', 'Handled first and returned from, so a body with `plan` never reaches the clear branch.', 'plan'),
      {
        "key": "api:apps/ifac/src/app/api/hub/meeting/rota/route.ts#POST",
        "service": [
          "(getApiMember: owner, guide or member)",
          "(editor, or that occurrence host/co-host via getRoleHolder)",
          "@elkdonis/services#setOccurrencePlan"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "plan field in the plan-ahead surface (packages/cms-ui hub/PlanAheadSurface.tsx)"
        },
        "note": "branch body.plan !== undefined",
        "case": "plan"
      },
    ],
    entry: null,
    status: 'the occurrence plan row holds the text',
    risk: [
      "others",
      "public"
    ],
    confirm: {
      text: 'Save what “{title}” covers on {when}? Members of {org} see it on the plan.',
      status: 'draft',
      wave: 6,
    },
    drift: "Same route in ifac (not diffed).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (innergathering, ifac). Differences by app:\n- ifac (was ifac-meeting-plan-set): Editor or that week's host or co-host.",
    canonical: 'services setOccurrencePlan behind one shared kit route',
    verified: V,
    inputs: "threadId, occurrenceAt, plan",
  },
  {
    id: 'ig-meeting-record-save',
    area: 'innergathering.meeting',
    label: 'Write up what happened at a meeting',
    does: 'A member saves the note and the list of who attended for one occurrence. Talk call logs are only a suggestion; the record is the person’s account.',
    class: 'person',
    actors: ['member', 'guide', 'owner'],
    scope: 'thread',
    hosts: [host(api('hub/meeting/record', 'POST'), ['@elkdonis/services#saveOccurrenceRecord'], '/hub', 'the record form of the Plan ahead surface (PlanAheadSurface.tsx)', 'Any member may write the record, by design (the host is often not an organiser).'),
      {
        "key": "api:apps/ifac/src/app/api/hub/meeting/record/route.ts#POST",
        "service": [
          "(getApiMember: owner, guide or member)",
          "(raw SELECT thread in org)",
          "@elkdonis/services#saveOccurrenceRecord"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "record panel in the plan-ahead surface (packages/cms-ui hub/PlanAheadSurface.tsx)"
        }
      },
    ],
    entry: null,
    status: 'an occurrence record row holds the note and attendance',
    risk: ['others'],
    confirm: {
      text: 'Save the record for “{title}” on {when}? Members of {org} can read the note and who came.',
      status: 'draft',
      wave: 6,
    },
    inputs: 'threadId, occurrenceAt, note, attended[]',
    drift: "Same route in ifac (not diffed).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (innergathering, ifac). Differences by app:\n- ifac (was ifac-meeting-record-save): Light and rota planning have host-or-editor rules; the record has none.",
    canonical: 'services saveOccurrenceRecord behind one shared kit route',
    open: "The attended array is passed to saveOccurrenceRecord as sent (hub/meeting/record/route.ts:74-80); user ids in it are not checked against org membership here; services may.\nifac (ifac-meeting-record-save): SECURITY: apps/ifac/src/app/api/hub/meeting/record/route.ts:74 (saveOccurrenceRecord call in POST) any member can write the attendance record (note and attended[] user ids, unvalidated) for any occurrence of any ifac meeting; rota POST (plan and clear branches) and light POST require host or editor.",
    verified: V,
  },
];

const ignored: Area['ignored'] = [
  {
    key: api('newsletter/[slug]', 'DELETE'),
    why: 'dead: no caller found (packages/newsletter editor.tsx has PUT and POST only; no list-page delete). Route is editor-only and deletes the newsletter row.',
  },
  {
    key: `sa:${SRC}app/hub/newsletter/page.tsx#createLetter/createLetter` as HostKey,
    why: 'not a write: only slugifies the title and redirects to the empty editor; nothing is stored until the editor saves',
  },
];

const area: Area = { capabilities, ignored };
export default area;
