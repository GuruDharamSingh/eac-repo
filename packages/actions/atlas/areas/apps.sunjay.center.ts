import type { Area, Capability } from '../types';

// sunjay center: written by the round 2 curator, 2026-11-16 (generated from one shared definition for sunjay and amrit-canada, which
// copy most of their api routes). Conventions: atlas/JOURNAL.md. Ids carry the app prefix; a row that copies another app's family says so in `drift`.

const capabilities: Capability[] = [
  {
    "area": "sunjay.center",
    "scope": "person",
    "risk": [
      "none"
    ],
    "id": "sunjay-login",
    "label": "Sign in",
    "does": "Signs an existing network account in and, as a side effect, makes it a follower (viewer row) of Para Theater if it has no role here yet.",
    "class": "internal",
    "actors": [
      "visitor"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/auth/login/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#createLoginHandler (joinOrgs viewer)"
        ]
      },
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/auth/login/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleLogin"
        ]
      },
      {
        "key": "api:apps/katie-the-potter/src/app/api/auth/login/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#createLoginHandler (joinOrgs viewer)"
        ]
      },
      {
        "key": "api:apps/admin/src/app/api/auth/login/route.ts#POST",
        "service": [
          "@elkdonis/auth-server#handleLogin",
          "(raw UPDATE contacts)"
        ],
        "address": {
          "app": "admin",
          "path": "/login",
          "how": "the Sign in form of components/login-form.tsx (signInWithPassword of @elkdonis/auth-client posts /api/auth/login)"
        },
        "note": "Public; the check is GoTrue’s password check. Signing in grants no admin right."
      },
      {
        "key": "sql:apps/admin/src/app/api/auth/login/route.ts#POST",
        "note": "sql twin of api:apps/admin/src/app/api/auth/login/route.ts#POST"
      },
    ],
    "status": "unverifiable: a session cookie",
    "drift": "differs from amrit-canada: amrit-canada re-exports the bare handleLogin (not a host, no join), so signing in there never creates a follower row; here every sign-in does. No arts-collective copy mapped.\nMerged 2026-11-16 (consolidation 2): 4 rows, 4 apps (sunjay, fourthwayBookreaders, katie-the-potter, admin). Differences by app:\n- fourthwayBookreaders (was fourthway-login): Thin wrapper over handleLogin, like amrit-canada (a re-export there); sunjay-login adds a viewer join.\n- katie-the-potter (was katie-login): Same as sunjay-login (createLoginHandler with a viewer join); amrit-canada and fourthway do not join on sign-in.\n- admin (was admin-login): adds the contacts backfill that no other site has.",
    "canonical": "auth-server login handler (shared); decide whether sign-in should ever join an org (signup already does)",
    "open": "Is auto-follow on every sign-in intended? The comment says the series join link and materials go to anyone with a role. A visitor who signs in to read becomes a follower and so an affiliate (ORGANIZATION-visibility threads).\nadmin (admin-login): No rate limit here or in handleLogin (GoTrue may have its own). The response returns the whole GoTrue session (access and refresh token) in JSON as well as the cookies. The backfill (:25-30) links contacts by the typed email AFTER a successful password login, which is safe.",
    "verified": "2026-11-16 read app/api/auth/{login,signup}/route.ts, lib/auth.ts, components/login-form.tsx, packages/auth-server handlers"
  },
  {
    "area": "sunjay.center",
    "scope": "person",
    "risk": [
      "public"
    ],
    "id": "sunjay-social-account-manage",
    "label": "Edit or check a connected account",
    "does": "Renames a connected account, checks it still works, or adds a Facebook Page to it.",
    "class": "person",
    "actors": [
      "person"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/center/connections/route.ts#PATCH",
        "case": "update",
        "service": [
          "@elkdonis/services#centerRoutes (connections)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/center",
          "surface": "profile:connections",
          "how": "the Connections tab of the profile popup on /center"
        }
      },
      {
        "key": "api:apps/sunjay/src/app/api/center/connections/route.ts#PATCH",
        "case": "check",
        "service": [
          "@elkdonis/services#centerRoutes (connections)"
        ],
        "note": "check a connection"
      },
      {
        "key": "api:apps/sunjay/src/app/api/center/connections/route.ts#PATCH",
        "case": "add-page",
        "service": [
          "@elkdonis/services#centerRoutes (connections)"
        ],
        "note": "add a Facebook Page"
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/center/connections/route.ts#PATCH",
        "case": "update",
        "service": [
          "@elkdonis/services#centerRoutes (connections)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/center",
          "surface": "profile:connections",
          "how": "the Connections tab of the profile popup on /center"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/center/connections/route.ts#PATCH",
        "case": "check",
        "service": [
          "@elkdonis/services#centerRoutes (connections)"
        ],
        "note": "check a connection"
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/center/connections/route.ts#PATCH",
        "case": "add-page",
        "service": [
          "@elkdonis/services#centerRoutes (connections)"
        ],
        "note": "add a Facebook Page"
      },
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/center/connections/route.ts#PATCH",
        "case": "update",
        "service": [
          "@elkdonis/services#connectionsHandlers"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/akhand-path",
          "surface": "profile:connections",
          "how": "the connections list of the Admin details dialog (components/paath/admin-details.tsx) and the profile popup"
        }
      },
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/center/connections/route.ts#PATCH",
        "case": "check",
        "service": [
          "@elkdonis/services#connectionsHandlers"
        ]
      },
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/center/connections/route.ts#PATCH",
        "case": "add-page",
        "service": [
          "@elkdonis/services#connectionsHandlers"
        ]
      },
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/center/connections/route.ts#PATCH",
        "case": "channel",
        "service": [
          "@elkdonis/services#connectionsHandlers"
        ]
      },
    ],
    "entry": null,
    "status": "a row in social connections for the person with the new state (the connections GET)",
    "drift": "Same mount of connectionsHandlers as arts-collective.hub:edit-social-account, no real drift: the route is 14 lines in every app. Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-social-account-manage); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (sunjay, amrit-canada, fourthwayBookreaders). Differences by app:\n- amrit-canada (was amrit-social-account-manage): Same mount of connectionsHandlers as arts-collective.hub:edit-social-account, no real drift: the route is 14 lines in every app. Same file in sunjay (apps.sunjay.*.ts: sunjay-social-account-manage); byte-identical bar log prefixes.\n- fourthwayBookreaders (was fourthway-social-account-manage): Same 14-line mount of connectionsHandlers as connect-social-account and the arts-collective rows; no real drift (here it serves YouTube for the Akhand Path).\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "services connectionsHandlers (already shared)",
    "verified": "2026-11-16 read app/api/center/connections/route.ts (a 14-line mount of services centerRoutes().connections), copies of arts-collective connection rows",
    "confirm": {
      "text": "Save your changes to the {account} connection?",
      "status": "draft",
      "wave": 6
    }
  },
  {
    "area": "sunjay.center",
    "scope": "person",
    "risk": [
      "public"
    ],
    "id": "sunjay-org-channel-set",
    "label": "Set the organisation's posting channel",
    "does": "Chooses which connected account posts for the organisation.",
    "class": "person",
    "actors": [
      "person"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/center/connections/route.ts#PATCH",
        "case": "channel",
        "service": [
          "@elkdonis/services#centerRoutes (connections)"
        ],
        "address": {
          "app": "sunjay",
          "path": "/center",
          "surface": "profile:connections",
          "how": "the Connections tab of the profile popup on /center"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/center/connections/route.ts#PATCH",
        "case": "channel",
        "service": [
          "@elkdonis/services#centerRoutes (connections)"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/center",
          "surface": "profile:connections",
          "how": "the Connections tab of the profile popup on /center"
        }
      },
    ],
    "entry": "channel-org-channel",
    "status": "a row in social connections for the person with the new state (the connections GET)",
    "drift": "Same mount of connectionsHandlers as arts-collective.hub:set-org-posting-channel, no real drift: the route is 14 lines in every app. Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-org-channel-set); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (sunjay, amrit-canada). Differences by app:\n- amrit-canada (was amrit-org-channel-set): Same mount of connectionsHandlers as arts-collective.hub:set-org-posting-channel, no real drift: the route is 14 lines in every app. Same file in sunjay (apps.sunjay.*.ts: sunjay-org-channel-set); byte-identical bar log prefixes.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "services connectionsHandlers (already shared)",
    "verified": "2026-11-16 read app/api/center/connections/route.ts (a 14-line mount of services centerRoutes().connections), copies of arts-collective connection rows",
    "confirm": {
      "text": "Post for {org} from {account}? Posts sent for {org} will appear on that account.",
      "status": "draft",
      "wave": 6
    }
  },
  {
    "area": "sunjay.center",
    "scope": "org",
    "risk": [
      "public"
    ],
    "id": "sunjay-center-layout-save",
    "label": "Arrange the organisation's Center page",
    "does": "Saves which sections Para Theater's /center page shows, in what order. An owner, guide or global admin saves for a named org; the network default (org elkdonis) is admin only.",
    "class": "person",
    "actors": [
      "owner",
      "guide",
      "admin"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/center/layout/route.ts#PATCH",
        "service": [
          "@elkdonis/services#saveCenterLayout",
          "@elkdonis/services#canEditOrgIdentity",
          "@elkdonis/auth-server#isAdmin"
        ],
        "address": {
          "app": "sunjay",
          "path": "/center",
          "how": "the arrange mode of /center (packages/cms-ui hub connectors call /api/center/layout)"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/center/layout/route.ts#PATCH",
        "service": [
          "@elkdonis/services#saveCenterLayout",
          "@elkdonis/services#canEditOrgIdentity",
          "@elkdonis/auth-server#isAdmin"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/center",
          "how": "the arrange mode of /center (packages/cms-ui hub connectors call /api/center/layout)"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/center/layout/route.ts#PATCH",
        "service": [
          "(getViewer; allowed: global admin, or canEditOrgIdentity for the org in ?org=; the network config org needs admin)",
          "@elkdonis/services#saveCenterLayout"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "layout editor in the center surface (packages/cms-ui surface)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/center/layout/route.ts#PATCH",
        "service": [
          "@elkdonis/services#canEditOrgIdentity",
          "@elkdonis/services#saveCenterLayout",
          "@elkdonis/auth-server#isAdmin"
        ],
        "address": {
          "app": "elktours",
          "path": "/center",
          "how": "the Arrange button of the Center (cms-ui center ArrangeButton, centerLayout connector)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/center/layout/route.ts#PATCH",
        "service": [
          "@elkdonis/services#saveCenterLayout",
          "@elkdonis/services#canEditOrgIdentity",
          "@elkdonis/auth-server#isAdmin"
        ],
        "address": {
          "app": "innergathering",
          "path": "/center",
          "how": "the arranging surface of the center (SurfaceCenterLayout in packages/cms-ui, wired by packages/cms-ui/src/hub/connectors.ts)"
        },
        "note": "Org comes from ?org= (default this site’s org); gate is isAdmin or canEditOrgIdentity for that org; org \"elkdonis\" is the network default and admin only."
      },
    ],
    "entry": null,
    "status": "organizations center layout row for the org holds the new order (resolveCenterLayout)",
    "confirm": {
      "text": "Save the new arrangement of {org}’s Center page? Followers see it as soon as it is saved.",
      "status": "draft",
      "wave": 6
    },
    "drift": "No arts-collective copy mapped. Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-center-layout-save); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 5 rows, 5 apps (sunjay, amrit-canada, hidden-enneagram, elktours, innergathering). Differences by app:\n- amrit-canada (was amrit-center-layout-save): No arts-collective copy mapped. Same file in sunjay (apps.sunjay.*.ts: sunjay-center-layout-save); byte-identical bar log prefixes.\n- hidden-enneagram (was he-center-layout-save): No ifac copy found. org comes from the query string (default the site org), so an owner of ANOTHER org can edit that org layout through this site (gate is per target org, not per site).\n- elktours (was elktours-center-layout-save): Same route is mounted in the other org apps.\n- innergathering (was ig-center-layout-save): Same route exists in amrit-canada, elktours, hidden-enneagram and sunjay (not in arts-collective); those copies are curated by other agents and not diffed here.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    "canonical": "services saveCenterLayout behind one shared route (already a service); keep per-app auth only",
    "open": "SECURITY: route.ts:76 lets a global admin (isAdmin) write any org, via ?org=<id>, from this site. lib/auth.ts:8-10 says the global users.is_admin flag stays exclusive to apps/admin and is never referenced here, so this route contradicts that header. Non-admins are checked by canEditOrgIdentity(viewer, orgId) for the org named in the query, so an owner or guide of another org can also save that org's layout through this site (not limited to sunjay); intended for the shared arranging surface, but worth confirming.\namrit-canada (amrit-center-layout-save): SECURITY: route.ts:76 lets a global admin (isAdmin) write any org, via ?org=<id>, from this site. lib/auth.ts:8-10 says the global users.is_admin flag stays exclusive to apps/admin and is never referenced here, so this route contradicts that header. Non-admins are checked by canEditOrgIdentity(viewer, orgId) for the org named in the query, so an owner or guide of another org can also save that org's layout through this site (not limited to amrit-canada); intended for the shared arranging surface, but worth confirming.\nhidden-enneagram (he-center-layout-save): apps/hidden-enneagram/src/app/api/center/layout/route.ts:50 and 73-78 the target org is the ?org= param, not pinned to siteConfig.orgId (the profile route in the same app has a comment saying only this site org, without the check). Gate is canEditOrgIdentity(viewer, org), so only that org owner or guide, or a global admin, passes: not an escalation.\nelktours (elktours-center-layout-save): The org id comes from the ?org= query; the check is canEditOrgIdentity(viewer, org) or global isAdmin, so an owner of ANY org can save that org's layout through the elktours site (correct, but this site is not limited to its own org). This route imports isAdmin although lib/auth.ts says elktours never references the global admin flag. saveCenterLayout validates and drops unknown sections.",
    "verified": "2026-11-16 read app/api/center/layout/route.ts, lib/auth.ts header comment, packages/cms-ui hub connectors",
    "inputs": "org (query), layout"
  },
  {
    "area": "sunjay.center",
    "scope": "org",
    "risk": [
      "public"
    ],
    "id": "sunjay-quote-submit",
    "label": "Add a line to the Center quote band",
    "does": "A signed-in person adds a quote to Para Theater's rotating band; it is pending until an owner or guide publishes it (their own goes up directly).",
    "class": "person",
    "actors": [
      "person",
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/center/quotes/route.ts#POST",
        "service": [
          "@elkdonis/services#submitQuote"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/center/quotes/route.ts#POST",
        "service": [
          "@elkdonis/services#submitQuote"
        ]
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/center/quotes/route.ts#POST",
        "service": [
          "(getViewer: any signed-in person; owner or guide publish directly)",
          "@elkdonis/services#submitQuote"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "Add a line in the quotes card (center surface)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/center/quotes/route.ts#POST",
        "service": [
          "@elkdonis/services#submitQuote"
        ],
        "address": {
          "app": "elktours",
          "path": "/center",
          "how": "the add-a-line box of the quote band (cms-ui center)"
        }
      },
    ],
    "status": "quotes has a row for the org (pending or published)",
    "drift": "Related to arts-collective.hub:add-quote (the desk action for owners). This is the person-submit route. Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-quote-submit); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 4 rows, 4 apps (sunjay, amrit-canada, hidden-enneagram, elktours). Differences by app:\n- amrit-canada (was amrit-quote-submit): Related to arts-collective.hub:add-quote (the desk action for owners). This is the person-submit route. Same file in sunjay (apps.sunjay.*.ts: sunjay-quote-submit); byte-identical bar log prefixes.\n- hidden-enneagram (was he-quote-add): that one is an owner/guide action, this route lets any signed-in person submit (pending).\n- elktours (was elktours-center-quote-submit): Copy of the quotes route in the other org apps (arts-collective quote-actions is a server action, not this route).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.\nRelated, not merged: add-quote (arts-collective.hub), an owner/guide action; the routes here let any signed-in person submit a pending line.",
    "canonical": "services submitQuote",
    "open": "No caller was found in this app, cms-ui or services for POST /api/center/quotes (grep), so it may be dead; kept as internal because the route is live. Any signed-in person, not only a follower, can file a pending line (no isAffiliate check), and each call writes a row with no rate limit.\nhidden-enneagram (he-quote-add): SECURITY: apps/hidden-enneagram/src/app/api/center/quotes/route.ts:32-43 any signed-in person (not only followers or members) can file a pending quote for the site; body length is bounded (QUOTE_MAX_BODY x 2 here) and there is no rate limit.\nelktours (elktours-center-quote-submit): Open to any signed-in account, not only followers, with no rate limit (app/api/center/quotes/route.ts:32-37); length is checked in services QUOTE_MAX_BODY. Pending until reviewed, so exposure is a queue-fill nuisance.",
    "verified": "2026-11-16 read app/api/center/quotes/route.ts, grep for callers",
    "confirm": {
      "text": "Add this line to the {org} quotes? Visitors see it once it is published.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "body, attribution, source"
  },
];

export default { capabilities, ignored: [] } satisfies Area;
