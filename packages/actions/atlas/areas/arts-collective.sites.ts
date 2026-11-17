// Atlas area file (2026-11-16, agent C): what visitors and members do on org sites served by
// arts-collective (/sites/{slug} and the *.arts-collective.com subdomains), plus org membership and
// files routes and the Silex site editor. The lib action files for posts, threads, meetings, quotes,
// agreements and the cms are imported by the hub, studio and learn pages, so they are agent B's.
import type { Area, Capability } from '../types';

const capabilities: Capability[] = [
  // ---------------- sites.audience ----------------
  {
    id: 'rsvp-to-event',
    updated: '2026-11-16',
    area: 'sites.audience',
    label: 'RSVP to an event or join a workshop',
    does: 'A signed-in person says yes to a public event, or joins a free workshop (which also opens its materials folder in Nextcloud). Paid workshops are refused here (402).',
    class: 'person',
    actors: [
      "person",
      "member",
      "guide",
      "owner"
    ],
    scope: 'thread',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/threads/[id]/rsvp/route.ts#POST',
        address: {
          app: 'arts-collective',
          path: '/sites/{org}/{post}',
          anchor: 'rsvp-to-event',
          how: 'The RSVP panel and the Join workshop button (components/sites/RsvpPanel.tsx, components/sites/workshop/JoinWorkshopButton.tsx)',
        },
        service: ['checkRsvpEligibility', 'setRsvpStatus', 'countConfirmedRsvps', 'nextcloud#grantMaterialsAccess'],
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/threads/[id]/rsvp/route.ts#POST",
        "service": [
          "@elkdonis/services#checkRsvpEligibility",
          "@elkdonis/services#setRsvpStatus",
          "@elkdonis/email#sendRsvpConfirmation",
          "@elkdonis/email#sendRsvpNotification",
          "(raw UPDATE threads min_attendees_notified)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/{section}/{slug}",
          "how": "the RSVP button of components/rsvp-panel.tsx (member path)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/threads/[id]/rsvp/route.ts#POST",
        "service": [
          "@elkdonis/services#checkRsvpEligibility",
          "@elkdonis/services#setRsvpStatus",
          "@elkdonis/email#sendRsvpConfirmation",
          "@elkdonis/email#sendRsvpNotification",
          "raw SQL UPDATE threads (min_attendees_notified)"
        ],
        "address": {
          "app": "elktours",
          "path": "/{feed}/{slug}",
          "how": "the RSVP button on a gathering page (components/rsvp-panel.tsx)"
        },
        "note": "Member RSVP: also writes min_attendees_notified."
      },
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/threads/[id]/rsvp/route.ts#POST",
        "service": [
          "@elkdonis/services#checkRsvpEligibility",
          "@elkdonis/services#setRsvpStatus",
          "(raw INSERT user_organizations viewer)"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}",
          "how": "the Join button of components/rsvp-button.tsx"
        }
      },
      {
        "key": "api:apps/sunjay/src/app/api/threads/[id]/rsvp/route.ts#POST",
        "service": [
          "@elkdonis/services#checkRsvpEligibility",
          "@elkdonis/services#setRsvpStatus",
          "@elkdonis/email#sendRsvpConfirmation",
          "@elkdonis/email#sendRsvpNotification",
          "(raw UPDATE threads min_attendees_notified)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/{section}/{slug}",
          "how": "the RSVP button of components/rsvp-panel.tsx (member path)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/hub/rsvp/route.ts#POST",
        "service": [
          "(getHubViewer: owner, guide or member of ifac via hasOrgRole)",
          "(raw SELECT thread in org)",
          "@elkdonis/services#checkRsvpEligibility",
          "@elkdonis/services#setRsvpStatus",
          "@elkdonis/services#deleteRsvp"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "RSVP panel in the event card (components/hub/RsvpPanel.tsx)"
        }
      },
    ],
    entry: null,
    status: 'rsvps has a yes row for the person and the thread',
    risk: [
      "others",
      "emails"
    ],
    confirm: { text: 'Say yes to “{title}” on {when}? {org} will see your name on the list.', status: 'draft', wave: 2 },
    drift: "Merged 2026-11-16 (lane rsvp, step 1): the six member copies are now shims on rsvpRoutes in packages/services/src/rsvp-handler.ts (joinThreadRsvp under a thread-row lock, capacity with holds and verified guests, waitlist, paid branch). ifac hub/rsvp calls joinThreadRsvp directly. The per-app differences below describe the code before the merge; the sql twins are gone.\nSeven apps carry their own rsvp route (amrit-canada, arts-collective, elktours, fourthwayBookreaders, inner-gathering, innergathering, sunjay): 67 to 347 lines each. All call setRsvpStatus, but only arts-collective’s checks eligibility and syncs Nextcloud materials; the others have more rules (capacity, paid) inline.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (arts-collective, amrit-canada, elktours, fourthwayBookreaders, sunjay, ifac). Differences by app:\n- amrit-canada (was amrit-rsvp-join): differs as in sunjay-rsvp-join. Same file in sunjay (apps.sunjay.*.ts: rsvp-to-event); differs only in EMBLEM_URL (amrit hard-codes its khanda-gold.png, sunjay has none) and log prefixes.\n- elktours (was elktours-rsvp-join): this copy does not sync Nextcloud materials, adds the min-attendees notice, and the confirmation uses the Khanda emblem with an amritcanada.ca image fallback; the loadThread helper filters by org and status published.\n- fourthwayBookreaders (was fourthway-rsvp-join): org-scoped published-thread check (route.ts:21-27), no email, no workshop or Nextcloud sync, and joining a reading group inserts a viewer row with raw SQL (the other copies never change a role).\n- sunjay (was sunjay-rsvp-join): pure thread-of-this-org lookup (route.ts:39-55, status published), no workshop or Nextcloud materials sync, no paid refusal, sends confirmation and owner emails, one-shot min-attendees nudge. Any signed-in person may RSVP (no role needed); a non-affiliate does not become a follower. Email emblem: sunjay uses env SUNJAY_EMAIL_EMBLEM_URL (none by default) but still passes emblemAlt \"Khanda\" (route.ts:150). Same file in amrit-canada (apps.amrit-canada.*.ts: rsvp-to-event); differs only in EMBLEM_URL (amrit hard-codes https://amritcanada.ca/email/khanda-gold.png) and log prefixes.\n- ifac (was ifac-rsvp-set): no Nextcloud material sync.\nDirection (Justin, 2026-11-16): RSVP and booking should be straightened together; consider ONE logic for both (see rsvp-to-event, cancel-rsvp, ig-rsvp-join, ig-rsvp-cancel, sunjay-rsvp-guest and service-book-and-pay).\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.\nKept separate on purpose (a paid branch and a different risk): ig-rsvp-join and ig-rsvp-cancel (innergathering, paid places, workshop materials); the guest door is sunjay-rsvp-guest (visitor, no account).",
    canonical: 'Done in packages/services/src/rsvp-handler.ts (2026-11-16). Was: one shared handler in @elkdonis/services (rsvpHandlers, like connectionsHandlers) that each app mounts',
    open: "Copies merged into rsvp-handler.ts 2026-11-16; re-check the notes below against it.\nDo the paid-workshop rules in the other apps (money) belong in the shared handler? Money would make this a link, not a run.\namrit-canada (amrit-rsvp-join): Any signed-in person may RSVP with no isMember check. The count in the response and the owner email use status yes only. OK as designed for public gatherings; confirm for ORGANIZATION- or member-only threads: loadThread filters only status published, not visibility (route.ts:46-53), so a follower or non-member can RSVP to a thread whose audience is members only if they know its id.\nelktours (elktours-rsvp-join): Good: every query is org scoped (loadThread) and the role comes from the session. DRIFT BUG: emblemUrl default is amritcanada.ca with alt \"Khanda\" in an app about Paris tours.\nfourthwayBookreaders (fourthway-rsvp-join): SECURITY: joining a reading_group self-grants the viewer role with raw SQL (route.ts:47-54), and a viewer is an affiliate who may comment and start threads in every circle (getApiAffiliate); no approval step. Intentional per auth.ts, but it is a join-by-click like arts-collective /api/org/join.",
    verified: '2026-11-16 read api/org/*, api/threads/[id]/rsvp, api/silex/*, sites/[slug]/hub/actions.ts, lib/org.ts, FollowButton.tsx',
    inputs: "thread id, receive-email flag",
  },
  {
    id: 'cancel-rsvp',
    updated: '2026-11-16',
    area: 'sites.audience',
    label: 'Cancel an RSVP or leave a workshop',
    does: 'Removes the person’s RSVP and, for a workshop, revokes the materials access.',
    class: 'person',
    actors: ['person'],
    scope: 'thread',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/threads/[id]/rsvp/route.ts#DELETE',
        address: {
          app: 'arts-collective',
          path: '/sites/{org}/{post}',
          anchor: 'cancel-rsvp',
          how: 'The Cancel RSVP control (components/sites/RsvpPanel.tsx)',
        },
        service: ['deleteRsvp', 'isEnrolledInWorkshop', 'nextcloud#revokeMaterialsAccess'],
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/threads/[id]/rsvp/route.ts#DELETE",
        "service": [
          "@elkdonis/services#deleteRsvp"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/{section}/{slug}",
          "how": "the cancel control of components/rsvp-panel.tsx"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/threads/[id]/rsvp/route.ts#DELETE",
        "service": [
          "@elkdonis/services#deleteRsvp"
        ],
        "address": {
          "app": "elktours",
          "path": "/{feed}/{slug}",
          "how": "the Cancel RSVP control on a gathering page (components/rsvp-panel.tsx)"
        },
        "note": "Member RSVP delete."
      },
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/threads/[id]/rsvp/route.ts#DELETE",
        "service": [
          "@elkdonis/services#deleteRsvp"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/groups/{group}",
          "how": "the Leave button of components/rsvp-button.tsx"
        }
      },
      {
        "key": "api:apps/sunjay/src/app/api/threads/[id]/rsvp/route.ts#DELETE",
        "service": [
          "@elkdonis/services#deleteRsvp"
        ],
        "address": {
          "app": "sunjay",
          "path": "/{section}/{slug}",
          "how": "the cancel control of components/rsvp-panel.tsx"
        }
      },
    ],
    entry: null,
    status: 'rsvps has no yes row for the person and the thread',
    risk: ['others'],
    confirm: {
      text: 'Cancel your place at “{title}”? {org} will see you are no longer coming.',
      status: 'draft',
      wave: 2,
    },
    drift: "Merged 2026-11-16 (lane rsvp, step 1): the member DELETE shims call leaveThreadRsvp in packages/services/src/rsvp-handler.ts (waitlist promotion, refund recorded as due for a paid place). The per-app differences below describe the code before the merge.\nSame as rsvp-join.\nMerged 2026-11-16 (consolidation 2): 5 rows, 5 apps (arts-collective, amrit-canada, elktours, fourthwayBookreaders, sunjay). Differences by app:\n- amrit-canada (was amrit-rsvp-cancel): no workshop or Nextcloud materials revoke, sends no email. Same file in sunjay (apps.sunjay.*.ts: cancel-rsvp); byte-identical bar log prefixes.\n- elktours (was elktours-rsvp-cancel): same service deleteRsvp, org check via loadThread here.\n- fourthwayBookreaders (was fourthway-rsvp-cancel): no Nextcloud revoke; the viewer role is not removed.\n- sunjay (was sunjay-rsvp-cancel): no workshop or Nextcloud materials revoke, sends no email. Same file in amrit-canada (apps.amrit-canada.*.ts: cancel-rsvp); byte-identical bar log prefixes.\nDirection (Justin, 2026-11-16): RSVP and booking should be straightened together; consider ONE logic for both (see rsvp-to-event, cancel-rsvp, ig-rsvp-join, ig-rsvp-cancel, sunjay-rsvp-guest and service-book-and-pay).\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    canonical: 'Done in packages/services/src/rsvp-handler.ts (2026-11-16). Was: the shared rsvp handler',
    verified: '2026-11-16 read api/org/*, api/threads/[id]/rsvp, api/silex/*, sites/[slug]/hub/actions.ts, lib/org.ts, FollowButton.tsx',
    open: "Copies merged into rsvp-handler.ts 2026-11-16; re-check the notes below against it.\nfourthwayBookreaders (fourthway-rsvp-cancel): Leaving never removes the viewer role granted at join, so access to the circle space stays after leaving.",
    inputs: "thread id",
  },
  // ---------------- sites.silex ----------------
  {
    id: 'open-silex-editor',
    area: 'sites.silex',
    label: 'Open the Silex site editor',
    does: 'Mints a short-lived token for the Silex editor and makes sure the org’s Nextcloud folder exists.',
    class: 'internal',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/silex/token/route.ts#POST',
        service: ['silex-render#mintSilexToken', 'nextcloud#provisionOrgOnNextcloud'],
      },
      {
        key: 'sql:apps/arts-collective/src/app/api/silex/token/route.ts#POST',
        note: 'raw SQL twin of the host above',
      },
    ],
    status: 'unverifiable: a token',
    risk: ['none'],
    open: 'Legacy editor; still used for email making. The house editor (Puck/direct editing) is the editor for sites, so this is not a rail step for site editing (Justin, 2026-11-16).',
    verified: '2026-11-16 read api/org/*, api/threads/[id]/rsvp, api/silex/*, sites/[slug]/hub/actions.ts, lib/org.ts, FollowButton.tsx',
  },
  {
    id: 'save-silex-layout',
    area: 'sites.silex',
    label: 'Silex saves a layout',
    does: 'The Silex editor writes a site layout file to the org’s Nextcloud folder and records its path.',
    class: 'internal',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/silex/layout/route.ts#POST',
        service: ['nextcloud#ensureOrgFolderPath'],
      },
      {
        key: 'sql:apps/arts-collective/src/app/api/silex/layout/route.ts#POST',
        note: 'raw SQL twin of the host above',
      },
    ],
    status: 'unverifiable: a file on Nextcloud',
    risk: ['none'],
    open: 'Legacy editor; still used for email making. The house editor (Puck/direct editing) is the editor for sites, so this is not a rail step for site editing (Justin, 2026-11-16).',
    verified: '2026-11-16 read api/org/*, api/threads/[id]/rsvp, api/silex/*, sites/[slug]/hub/actions.ts, lib/org.ts, FollowButton.tsx',
  },
  {
    id: 'publish-silex-site',
    area: 'sites.silex',
    label: 'Publish a Silex site',
    does: 'An owner publishes sanitised HTML (2 MB cap) as the org’s Silex site.',
    class: 'internal',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/silex/publish/route.ts#POST',
        service: ['utils#sanitizeSilexHtml', 'nextcloud#createFolder'],
      },
      {
        key: 'sql:apps/arts-collective/src/app/api/silex/publish/route.ts#POST',
        note: 'raw SQL twin of the host above',
      },
    ],
    status: 'organizations has a published Silex entry path for the org',
    risk: ['public'],
    drift: 'Two ways to publish an org site: Silex (this) and the Puck/direct-edit home (lib/puck, agent B). Different storage, different serving. Silex is not used in current site development.',
    canonical: 'the Puck/direct-edit home, if Silex is retired',
    open: 'Legacy editor; still used for email making. The house editor (Puck/direct editing) is the editor for sites, so this is not a rail step for site editing (Justin, 2026-11-16).',
    verified: '2026-11-16 read api/org/*, api/threads/[id]/rsvp, api/silex/*, sites/[slug]/hub/actions.ts, lib/org.ts, FollowButton.tsx',
  },
];

const ignored: Area['ignored'] = [
  { key: 'sa:apps/arts-collective/src/lib/dictionary-actions.ts#defineTermAction', why: 'no importer found 2026-11-16 (apps and packages searched): likely dead in arts-collective' },
  { key: 'sa:apps/arts-collective/src/lib/dictionary-actions.ts#lookupTermAction', why: 'no importer found 2026-11-16 (apps and packages searched): likely dead in arts-collective' },
];

export default { capabilities, ignored } satisfies Area;
