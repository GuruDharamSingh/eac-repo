import type { Area, Capability, Host, HostKey } from '../types';

// hidden-enneagram member hub: documents, whiteboard, chat, pipeline board, forum door, meeting attendance,
// following, quotes, center layout and portfolio, org provisioning. Round 2 (2026-11-16).
// Most routes are copies of the ifac ones (see apps.ifac.hub.ts), so ids pair with ifac-*.

const V =
  '2026-11-16 read apps/hidden-enneagram/src/app/api/{hub/documents,hub/whiteboard,chat/*,pipeline/*,forum,center/{attendance,follow,layout,portfolio,quotes},org/provision}/route.ts, lib/auth.ts, packages/services site-portfolio.ts; diffed against apps/ifac copies';
const A = 'hidden-enneagram';
const AREA = 'he.hub';
const k = (kind: 'sa' | 'api' | 'sql', p: string, s: string) => `${kind}:apps/hidden-enneagram/src/${p}#${s}` as HostKey;
const api = (p: string, m: string) => k('api', `app/api/${p}/route.ts`, m);
const h = (key: HostKey, path: string, how: string, service: string[], note?: string, caseId?: string): Host => ({
  key,
  service,
  address: { app: A, path, how },
  ...(note ? { note } : {}),
  ...(caseId ? { case: caseId } : {}),
});
const cf = (text: string) => ({ text, status: 'draft' as const, wave: 6 });
const mk = (c: Omit<Capability, 'verified' | 'area'>): Capability => ({ area: AREA, verified: V, ...c });

const API_MEMBER = '(getApiMember: owner, guide or member)';
const API_EDITOR = '(getApiEditor: owner or guide)';

// ---- pipeline (identical in ifac) ----
const PIPE = (p: string, m: string) => api(`pipeline/${p}`, m);
const pipeDrift =
  'Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.';
const pipeCanon = 'packages/pipeline createPipelineApi routes mounted once (already the shape); remove the per-app route files in favour of one catch-all mount.';
const pipeCard = (
  id: string,
  label: string,
  does: string,
  hosts: Host[],
  actors: Capability['actors'],
  risk: Capability['risk'],
  text: string,
  inputs: string,
  extra: Partial<Capability> = {},
) =>
  mk({
    id,
    label,
    does,
    class: 'person',
    actors,
    scope: 'org',
    hosts,
    entry: null,
    status: "the card exists with the saved value on the org's Nextcloud Deck board (org-deck read)",
    risk,
    confirm: cf(text),
    inputs,
    drift: pipeDrift,
    canonical: pipeCanon,
    ...extra,
  });
const PIPE_HOW = 'the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)';
const MEM = ['(withMember: getApiMember = owner, guide or member)'];
const EDT = ['(withEditor: getApiEditor = owner or guide)'];

const capabilities: Capability[] = [
  mk({
    id: 'he-chat-provision',
    label: 'Set up the team chat room',
    does: "Creates the organisation's chat room in Nextcloud Talk if it does not exist.",
    class: 'internal',
    actors: ['guide', 'owner'],
    scope: 'org',
    hosts: [h(api('chat/provision', 'POST'), '/hub', 'Set up chat button (packages/chat ProvisionChat.tsx)', ['(withEditor: getApiEditor)', '@elkdonis/services#ensureOrgChatRoom']),
      {
        "key": "api:apps/ifac/src/app/api/chat/provision/route.ts#POST",
        "service": [
          "(withEditor: getApiEditor)",
          "@elkdonis/services#ensureOrgChatRoom"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "Set up chat button (packages/chat ProvisionChat.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/chat/provision/route.ts#POST",
        "service": [
          "@elkdonis/services#ensureOrgChatRoom"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/chat",
          "how": "the set-up prompt of the chat page (ChatPage.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/chat/provision/route.ts#POST",
        "service": [
          "@elkdonis/services#ensureOrgChatRoom"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/chat",
          "how": "the Set up chat button shown before the room exists (packages/chat ProvisionChat.tsx)"
        }
      },
    ],
    status: 'ensureOrgChatRoom(hidden-enneagram) returns a room token',
    risk: ['none'],
    drift: "Copy of ifac-chat-provision.\nMerged 2026-11-16 (consolidation 2): 4 rows, 4 apps (hidden-enneagram, ifac, innergathering, elktours). Differences by app:\n- ifac (was ifac-chat-provision): Same as hidden-enneagram.\n- innergathering (was ig-chat-room-provision): Same route in the other five org apps.\n- elktours (was elktours-chat-provision): Same chat package routes mounted in other org apps.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    canonical: 'packages/chat createChatApi.',
    inputs: "none",
  }),
  mk({
    id: 'he-forum-act',
    label: 'Forum actions (door)',
    does: 'One POST route that fronts every forum action (reply, topic, vote, watch, moderate, wiki and others) and redirects back with a notice.',
    class: 'internal',
    actors: ['person', 'member', 'guide', 'owner'],
    scope: 'org',
    hosts: [h(api('forum/[action]', 'POST'), '/forum', 'forum pages (packages/forum-ui connectors)', ['@elkdonis/forum-ui#handleForumAction (21 action names)']),
      {
        "key": "api:apps/ifac/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction (21 action names; connectors from lib/forum.ts)"
        ],
        "address": {
          "app": "ifac",
          "path": "/forum",
          "how": "forum pages and cards (packages/forum-ui connectors, lib/forum.ts)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/forum/[action]/route.ts#POST",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "lib/forum#getForumConnectors"
        ],
        "address": {
          "app": "innergathering",
          "path": "/forum",
          "how": "the buttons of the forum pages (packages/forum-ui/src/thread.tsx, shell.tsx, wiki-pages.tsx, and the hub connectors in packages/cms-ui/src/hub/connectors.ts)"
        },
        "note": "A dispatcher: one host, about 20 actions switched on in packages/forum-ui/src/actions.ts. Not split with `case` because each action’s gate lives in the package and in the connectors this app supplies (lib/forum.ts), which were not read."
      },
    ],
    status: 'the forum row for the action exists (per action)',
    risk: ['public', 'others'],
    drift: "Identical to ifac-forum-act.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (hidden-enneagram, ifac, innergathering). Differences by app:\n- ifac (was ifac-forum-act): Same route in hidden-enneagram (identical). The unclaimed `forum` package app hosts are mapped by whoever maps the forum.\n- innergathering (was ig-forum-act): Mounted the same way in amrit-canada, elktours, hidden-enneagram, ifac and sunjay (not diffed). inner-gathering (legacy) had its own forum routes.",
    canonical: 'packages/forum-ui handleForumAction (already shared).',
    open: "Door only; split with Host.case when the forum is mapped.\nifac (ifac-forum-act): Door only. 21 actions behind one host: reply, topic, vote, heart, watch, bookmark, read-all, propose-topic, moderate, notifications-read, review-topic, set-theme, category, wiki-talk, wiki-define, wiki-create, wiki-update, wiki-archive, wiki-revert, line, remove. Split with Host.case when the forum is mapped; per-action gates live in forum-ui/services, not read here.\ninnergathering (ig-forum-act): Split into `case` rows (reply, topic, vote, moderate, wiki-*) once lib/forum.ts connectors and the per-action gates are read; they are real person actions (post a topic, reply) and candidates for rail steps.",
  }),
  mk({
    id: 'he-attendance-set',
    updated: '2026-11-16',
    label: 'Say how you will come to a meeting',
    does: "Records the person's answer for a meeting (a flavour of yes, maybe or no) or clears it; checks RSVPs are open and not full.",
    class: 'person',
    actors: ['member', 'guide', 'owner'],
    scope: 'thread',
    hosts: [h(api('center/attendance', 'POST'), '/hub', 'attendance buttons on the meeting card (packages/cms-ui hub cards)', [API_MEMBER, '(raw SELECT thread in org)', '@elkdonis/services#setMeetingAttendance', '@elkdonis/services#clearMeetingAttendance', '@elkdonis/services#checkRsvpEligibility']),
      {
        "key": "api:apps/ifac/src/app/api/hub/meeting/attendance/route.ts#POST",
        "service": [
          "(getHubViewer: owner, guide or member of ifac via hasOrgRole)",
          "(raw SELECT thread in org)",
          "@elkdonis/services#setMeetingAttendance",
          "@elkdonis/services#clearMeetingAttendance",
          "@elkdonis/services#checkRsvpEligibility"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "attendance buttons on the meeting card (app/hub/cards-view.tsx, app/hub/site-view.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/hub/meeting/attendance/route.ts#POST",
        "service": [
          "@elkdonis/services#setMeetingAttendance",
          "@elkdonis/services#clearMeetingAttendance",
          "@elkdonis/services#checkRsvpEligibility"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub",
          "how": "the RSVP buttons of the standing-meeting face (StandingMeetingFace.tsx; app/hub/cards-view.tsx)"
        },
        "note": "A toggle on one host: answer or clear (body.clear)."
      },
      {
        "key": "api:apps/sunjay/src/app/api/center/attendance/route.ts#POST",
        "service": [
          "@elkdonis/services#setMeetingAttendance",
          "@elkdonis/services#clearMeetingAttendance",
          "@elkdonis/services#checkRsvpEligibility"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub",
          "how": "the meeting banner of the hub's page layout (app/hub/site-view.tsx:150, attendance endpoint /api/center/attendance)"
        }
      },
    ],
    entry: null,
    status: 'getMeetingAttendance(thread, person) returns the flavour',
    risk: [
      "others"
    ],
    confirm: cf('Tell the host you are “{state}” for “{title}”?'),
    inputs: 'threadId, flavour, clear',
    drift: "2026-11-16 (lane rsvp, step 1): the ifac and innergathering attendance routes now call checkAttendanceSeat in packages/services/src/rsvp-handler.ts for the price refusal and the capacity count (holds and verified guests); each keeps its own write.\nCopy of he-attendance-set (ifac api/hub/meeting/attendance) minus promiseNext and minus the series guard: a series thread id is accepted here, where ifac answers 409 for a series.\nMerged 2026-11-16 (consolidation 2): 4 rows, 4 apps (hidden-enneagram, ifac, innergathering, sunjay). Differences by app:\n- ifac (was ifac-attendance-set): hidden-enneagram center/attendance is the same handler without the series guard and promiseNext (he-attendance-set).\n- innergathering (was ig-meeting-attendance-set): Same route in ifac (not diffed). A second door to the same thread_rsvps rows as ig-rsvp-join (api/threads/[id]/rsvp): this one has no payment branch and no published-status filter; checkRsvpEligibility (services/thread-rsvp.ts:29-60) tests only enabled, deadline and capacity.\n- sunjay (was sunjay-meeting-attendance): No amrit-canada copy. Same shape as ifac /api/hub/meeting/attendance (route comment). Thread must belong to the org (route.ts:50-54): good.",
    canonical: 'Done in packages/services/src/rsvp-handler.ts (2026-11-16). Was: services setMeetingAttendance behind one shared attendance route.',
    open: "Copies merged into rsvp-handler.ts 2026-11-16; re-check the notes below against it.\napps/hidden-enneagram/src/app/api/center/attendance/route.ts:47-48 no series check (ifac has one): an attendance row can be written against a series parent thread.\ninnergathering (ig-meeting-attendance-set): SECURITY: this route sets a \"yes\" for any thread of the org with is_rsvp_enabled, drafts included, and never reads the price (hub/meeting/attendance/route.ts:50-97; setMeetingAttendance upserts thread_rsvps, services/standing-meeting.ts:118-137), while the paid door api/threads/[id]/rsvp:140-181 sends a priced thread to Stripe first. A member (role member/guide/owner, not a follower) who posts a priced workshop’s threadId here is recorded as attending without paying, and workshop materials open on an RSVP (media-authz). Needs a direct call; the standing-meeting face probably does not offer priced threads. Not tested.\nsunjay (sunjay-meeting-attendance): Capacity and deadline only bind a new yes (route.ts:88-102), by design. A yes via this route does not send the confirmation or owner emails that /api/threads/[id]/rsvp does.",
  }),
  mk({
    id: 'he-org-provision',
    label: "Set up the organisation's calendar and chat",
    does: "Creates the organisation's Nextcloud calendar and chat room if missing, shares the calendar, and projects events into it.",
    class: 'internal',
    actors: ['guide', 'owner'],
    scope: 'org',
    hosts: [h(api('org/provision', 'POST'), '/manage', 'provision control in the manage console', [API_EDITOR, '@elkdonis/services#ensureOrgCalendar', '@elkdonis/services#syncOrgCalendarShares', '@elkdonis/services#syncOrgCalendarEvents', '@elkdonis/services#ensureOrgChatRoom'])],
    status: 'ensureOrgCalendar(hidden-enneagram) returns a URI and ensureOrgChatRoom a token',
    risk: ['none'],
    drift: 'No ifac copy found. Returns raw error messages (err.message) from the Nextcloud calls to the caller.',
    canonical: 'one shared org provision route (services ensureOrgCalendar and ensureOrgChatRoom).',
    open: 'No component calls this route (grep of components and app found none): possibly run by hand or a script. Nextcloud error text is returned to the editor (apps/hidden-enneagram/src/app/api/org/provision/route.ts:40-54).',
  }),
  mk({
    id: 'he-pipeline-provision',
    label: 'Set up the board',
    does: "Creates the organisation's Nextcloud Deck board if it does not exist.",
    class: 'internal',
    actors: ['guide', 'owner'],
    scope: 'org',
    hosts: [h(PIPE('provision', 'POST'), '/hub', 'Set up board button (packages/pipeline ProvisionBoard.tsx)', EDT),
      {
        "key": "api:apps/ifac/src/app/api/pipeline/provision/route.ts#POST",
        "service": [
          "(withEditor: getApiEditor = owner or guide)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "Set up board button (packages/pipeline ProvisionBoard.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/pipeline/provision/route.ts#POST",
        "service": [
          "@/lib/pipeline#provisionPipelineBoard"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/pipeline",
          "how": "the Set up board button before the board exists (packages/pipeline ProvisionBoard.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/pipeline/provision/route.ts#POST",
        "service": [
          "lib/pipeline#provisionPipelineBoard"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/pipeline",
          "how": "the Set up button (packages/pipeline/src/components/ProvisionBoard.tsx)"
        }
      },
    ],
    status: 'getPipelineBoard(hidden-enneagram) returns a board',
    risk: ['none'],
    drift: "Byte-identical to the ifac route (ifac-pipeline-* rows) (diffed all 16 files, identical bar the org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\nMerged 2026-11-16 (consolidation 2): 4 rows, 4 apps (hidden-enneagram, ifac, elktours, innergathering). Differences by app:\n- ifac (was ifac-pipeline-provision): Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.\n- elktours (was elktours-pipeline-board-provision): Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.\n- innergathering (was ig-pipeline-board-provision): Same pipeline routes in amrit-canada, elktours, hidden-enneagram, ifac, sunjay; the shared package @elkdonis/pipeline/routes holds the auth wrappers and the OrgDeckScopeError to 404 mapping (lib/pipeline-api.ts says ~55 lines were duplicated in two apps).",
    canonical: pipeCanon,
    inputs: "none",
  }),
];

export default { capabilities, ignored: [] } satisfies Area;
