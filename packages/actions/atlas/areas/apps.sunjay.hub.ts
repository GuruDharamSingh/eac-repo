import type { Area, Capability } from '../types';

// sunjay hub: written by the round 2 curator, 2026-11-16 (generated from one shared definition for sunjay and amrit-canada, which
// copy most of their api routes). Conventions: atlas/JOURNAL.md. Ids carry the app prefix; a row that copies another app's family says so in `drift`.

const capabilities: Capability[] = [
  {
    "area": "sunjay.hub",
    "scope": "org",
    "risk": [
      "others",
      "public"
    ],
    "id": "sunjay-document-create",
    "updated": "2026-11-16",
    "label": "Start a shared document",
    "does": "A member creates a living document for the group in Nextcloud (named by date when no title is given); the share link is public and writable.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/hub/documents/route.ts#POST",
        "service": [
          "@elkdonis/services#createOrgDocument"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub",
          "how": "the documents face of the hub (components/hub/HubSurfaces.tsx via cms-ui hub connectors)"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/hub/documents/route.ts#POST",
        "service": [
          "@elkdonis/services#createOrgDocument"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub",
          "how": "the documents face of the hub (components/hub/HubSurfaces.tsx via cms-ui hub connectors)"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/hub/documents/route.ts#POST",
        "service": [
          "(getApiMember: owner, guide or member)",
          "@elkdonis/services#createOrgDocument"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "documents card in the hub (packages/cms-ui hub connectors)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/hub/documents/route.ts#POST",
        "service": [
          "(getHubViewer: owner, guide or member of ifac via hasOrgRole)",
          "@elkdonis/services#createOrgDocument"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/documents",
          "how": "new document button on the documents page (app/hub/documents/page.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/hub/documents/route.ts#POST",
        "service": [
          "@elkdonis/services#createOrgDocument"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/documents",
          "how": "the New document button (HubSurfaces.tsx documents surface; app/hub/documents/page.tsx; connectors in packages/cms-ui/src/hub/connectors.ts)"
        },
        "note": "authorName is the viewer’s email."
      },
      {
        "key": "api:apps/elktours/src/app/api/hub/documents/route.ts#POST",
        "service": [
          "@elkdonis/services#createOrgDocument"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub",
          "how": "the New document button of the documents face (cms-ui hub connectors, HubSurfaces.tsx)"
        }
      },
    ],
    "entry": null,
    "status": "a document row for the org exists (listOrgDocuments)",
    "confirm": {
      "text": "Start a shared document “{title}” for {org}? Anyone with its link can edit it, even if they leave the group.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Not in arts-collective. Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-document-create); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, innergathering, elktours). Differences by app:\n- amrit-canada (was amrit-document-create): Not in arts-collective. Same file in sunjay (apps.sunjay.*.ts: sunjay-document-create); byte-identical bar log prefixes.\n- hidden-enneagram (was he-document-create): ifac passes no author name. HE has no DELETE route.\n- ifac (was ifac-document-create): Same route family exists in hidden-enneagram (member gate, authorName from email, no delete route). ifac passes no authorName and adds DELETE (editor only).\n- innergathering (was ig-document-create): Same route in amrit-canada, elktours, hidden-enneagram, ifac and sunjay (not diffed; other agents).\n- elktours (was elktours-hub-document-create): None: single copy.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    "canonical": "services createOrgDocument (already shared); route is a thin mount",
    "open": "Gate is getApiMember (member or above; followers excluded), consistent with the route comment (the link is the permission). authorName is viewer.email, so the email goes into the document author field.\nhidden-enneagram (he-document-create): apps/hidden-enneagram/src/app/api/hub/documents/route.ts:49 authorName is the creator email (shown wherever the document author is listed; may expose member emails to other members).\nifac (ifac-document-create): Any member (role member, not only guide) can create; document is shared org-wide.\nelktours (elktours-hub-document-create): SECURITY: the route comment says it itself: the share link is a PUBLIC WRITABLE link, so anyone who has it can edit whether or not they are still in the group (app/api/hub/documents/route.ts:11-14). authorName is the member's email address (:49). Members-only gate is present on all three methods.",
    "verified": "2026-11-16 read app/api/hub/{documents,ideas,whiteboard}/route.ts, app/api/chat/*, lib/chat-api.ts, lib/auth.ts, app/api/forum/[action]/route.ts, lib/forum.ts, packages/forum-ui actions.ts, services forum-write.ts",
    "inputs": "title (optional), ideaId"
  },
  {
    "area": "sunjay.hub",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "sunjay-document-assign",
    "updated": "2026-11-16",
    "label": "Attach a document to an idea",
    "does": "A member links an existing document to an idea, or removes the link.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/hub/documents/route.ts#PATCH",
        "service": [
          "@elkdonis/services#assignOrgDocument"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/hub/documents/route.ts#PATCH",
        "service": [
          "@elkdonis/services#assignOrgDocument"
        ]
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/hub/documents/route.ts#PATCH",
        "service": [
          "(getApiMember: owner, guide or member)",
          "@elkdonis/services#assignOrgDocument"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "idea picker on a document row (packages/cms-ui hub)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/hub/documents/route.ts#PATCH",
        "service": [
          "(getHubViewer: owner, guide or member of ifac via hasOrgRole)",
          "@elkdonis/services#assignOrgDocument"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/documents",
          "how": "idea picker on a document row (app/hub/documents/page.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/hub/documents/route.ts#PATCH",
        "service": [
          "@elkdonis/services#assignOrgDocument"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/documents",
          "how": "the idea picker on a document row (HubSurfaces.tsx)"
        },
        "note": "Scoped by siteConfig.orgId in the service call."
      },
      {
        "key": "api:apps/elktours/src/app/api/hub/documents/route.ts#PATCH",
        "service": [
          "@elkdonis/services#assignOrgDocument"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub",
          "how": "the attach control on a document (cms-ui hub connectors, HubSurfaces.tsx)"
        }
      },
    ],
    "status": "the document row carries the idea id (assignOrgDocument returned true)",
    "drift": "Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-document-assign); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, innergathering, elktours). Differences by app:\n- amrit-canada (was amrit-document-assign): Same file in sunjay (apps.sunjay.*.ts: sunjay-document-assign); byte-identical bar log prefixes.\n- hidden-enneagram (was he-document-assign): Copy of ifac-document-assign.\n- ifac (was ifac-document-assign): Any member can re-assign any org document (no author check); delete is editor-only.\n- innergathering (was ig-document-assign): Same route in the other five org apps (not diffed).\n- elktours (was elktours-hub-document-assign): None: single copy.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    "canonical": "services assignOrgDocument",
    "open": "The route passes the org id, so the service scopes by org (not re-read).\nhidden-enneagram (he-document-assign): SECURITY: apps/hidden-enneagram/src/app/api/hub/documents/route.ts:62-80 any member can re-assign any document of the org (same as ifac).\nifac (ifac-document-assign): SECURITY: apps/ifac/src/app/api/hub/documents/route.ts:62-78 lets any member re-assign any document in the org; DELETE (line 93) needs owner or guide. Probably intended (shared board), but weaker than delete.\nelktours (elktours-hub-document-assign): Any member can move any document between ideas; org id is passed to the service (org scoping inside assignOrgDocument not read).",
    "verified": "2026-11-16 read app/api/hub/{documents,ideas,whiteboard}/route.ts, app/api/chat/*, lib/chat-api.ts, lib/auth.ts, app/api/forum/[action]/route.ts, lib/forum.ts, packages/forum-ui actions.ts, services forum-write.ts",
    "confirm": {
      "text": "Attach this document to the idea “{title}”? Everyone on the team will see the link.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "documentId, ideaId|null"
  },
  {
    "area": "sunjay.hub",
    "scope": "org",
    "risk": [
      "others",
      "public"
    ],
    "id": "sunjay-idea-submit",
    "label": "Suggest an idea",
    "does": "A member posts an idea to the organisation's ideas feed; it is published on submission and visible to members.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner",
      "person"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/hub/ideas/route.ts#POST",
        "service": [
          "@elkdonis/services#createOrgIdea"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub",
          "how": "the ideas face of the hub (components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/hub/ideas/route.ts#POST",
        "service": [
          "@elkdonis/services#createOrgIdea"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub",
          "how": "the ideas face of the hub (components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/hub/ideas/route.ts#POST",
        "service": [
          "@elkdonis/services#createOrgIdea"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub",
          "how": "the Suggest an idea box of the ideas face (cms-ui hub connectors, HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/hub/ideas/route.ts#POST",
        "service": [
          "(getHubViewer: owner, guide or member of ifac via hasOrgRole)",
          "@elkdonis/services#createOrgIdea"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "ideas card in the hub (packages/cms-ui hub connectors)"
        }
      },
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/suggest/route.ts#POST",
        "service": [
          "@elkdonis/services#createOrgIdea",
          "@elkdonis/services#ensureIdeasFeed"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/suggest",
          "how": "the suggest form (components/suggest-form.tsx) posting to /api/suggest"
        }
      },
    ],
    "entry": null,
    "status": "a threads row in the org's ideas feed by the person",
    "confirm": {
      "text": "Post your idea “{title}” to {org}? Members of {org} can read it straight away.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Not in arts-collective. Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-idea-submit); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 5 rows, 5 apps (sunjay, amrit-canada, elktours, ifac, fourthwayBookreaders). Differences by app:\n- amrit-canada (was amrit-idea-submit): Not in arts-collective. Same file in sunjay (apps.sunjay.*.ts: sunjay-idea-submit); byte-identical bar log prefixes.\n- elktours (was elktours-hub-idea-submit): The forum topic form can also create kind idea (forum-topic-start); two idea paths.\n- ifac (was ifac-idea-add): No hidden-enneagram copy found.\n- fourthwayBookreaders (was fourthway-book-suggest): Same service as sunjay-idea-submit / sunjay-idea-submit (createOrgIdea) but open to any signed-in person (the hub copies require a member).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    "canonical": "services createOrgIdea",
    "verified": "2026-11-16 read app/api/hub/{documents,ideas,whiteboard}/route.ts, app/api/chat/*, lib/chat-api.ts, lib/auth.ts, app/api/forum/[action]/route.ts, lib/forum.ts, packages/forum-ui actions.ts, services forum-write.ts",
    "open": "fourthwayBookreaders (fourthway-book-suggest): No rate limit; any signed-in account, not only followers, can file ideas (route.ts:20-22 requires only getViewer). The thread is published on submission (createOrgIdea).",
    "inputs": "title, body"
  },
  {
    "area": "sunjay.hub",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "sunjay-whiteboard-save",
    "updated": "2026-11-16",
    "label": "Draw on the group's whiteboard",
    "does": "A member saves the group's shared Excalidraw scene (one scene per organisation, last save wins).",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/hub/whiteboard/route.ts#PUT",
        "service": [
          "@elkdonis/services#saveWhiteboard"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/hub/whiteboard/route.ts#PUT",
        "service": [
          "@elkdonis/services#saveWhiteboard"
        ]
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/hub/whiteboard/route.ts#PUT",
        "service": [
          "(getApiMember: owner, guide or member)",
          "@elkdonis/services#saveWhiteboard"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "whiteboard card (packages/cms-ui whiteboard/WhiteboardSurface.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/hub/whiteboard/route.ts#PUT",
        "service": [
          "(getApiMember: owner, guide or member)",
          "@elkdonis/services#saveWhiteboard"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "whiteboard card (packages/cms-ui whiteboard/WhiteboardSurface.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/hub/whiteboard/route.ts#PUT",
        "service": [
          "@elkdonis/services#saveWhiteboard"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/whiteboard",
          "how": "autosave of the whiteboard surface (packages/cms-ui/src/whiteboard/WhiteboardSurface.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/hub/whiteboard/route.ts#PUT",
        "service": [
          "@elkdonis/services#saveWhiteboard"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/whiteboard",
          "how": "the whiteboard surface (packages/cms-ui whiteboard WhiteboardSurface.tsx)"
        }
      },
    ],
    "status": "the whiteboard row for the org holds the scene",
    "drift": "Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-whiteboard-save); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, innergathering, elktours). Differences by app:\n- amrit-canada (was amrit-whiteboard-save): Same file in sunjay (apps.sunjay.*.ts: sunjay-whiteboard-save); byte-identical bar log prefixes.\n- hidden-enneagram (was he-whiteboard-save): Copy of sunjay-whiteboard-save (18 diff lines, comments only).\n- ifac (was ifac-whiteboard-save): hidden-enneagram has the same route (same gate). Only checks that scene.elements is an array.\n- innergathering (was ig-whiteboard-save): Same route in amrit-canada, elktours, hidden-enneagram, ifac, sunjay (not diffed).\n- elktours (was elktours-hub-whiteboard-save): None: single copy.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    "canonical": "services saveWhiteboard",
    "open": "Any member can overwrite the whole scene (last save wins, no history), by design per the route comment.\nhidden-enneagram (he-whiteboard-save): SECURITY: whole-scene overwrite by any member, no size cap (apps/hidden-enneagram/src/app/api/hub/whiteboard/route.ts PUT handler), same as ifac.\nifac (ifac-whiteboard-save): SECURITY: apps/ifac/src/app/api/hub/whiteboard/route.ts:34-46 whole-scene overwrite by any member, no size cap or element validation beyond Array.isArray (last write wins, no history).\ninnergathering (ig-whiteboard-save): SECURITY (mild, by design): any member overwrites the whole shared scene, with no size cap on payload.scene or version check (hub/whiteboard/route.ts:36-40); last write wins.\nelktours (elktours-hub-whiteboard-save): Any member can overwrite (or empty) the shared scene with no versioning or conflict check, and the route checks only that scene.elements is an array: no size cap in the route (app/api/hub/whiteboard/route.ts:30). A scene is stored as JSON in the database.",
    "verified": "2026-11-16 read app/api/hub/{documents,ideas,whiteboard}/route.ts, app/api/chat/*, lib/chat-api.ts, lib/auth.ts, app/api/forum/[action]/route.ts, lib/forum.ts, packages/forum-ui actions.ts, services forum-write.ts",
    "confirm": {
      "text": "Save your changes to the shared {org} whiteboard? Everyone on the team sees them.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "scene { elements[] }"
  },
  {
    "area": "sunjay.hub",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "sunjay-chat-post",
    "updated": "2026-11-16",
    "label": "Post in the group chat",
    "does": "A member posts a message in the organisation's Nextcloud Talk room, under their profile name (never a name from the request).",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/chat/messages/route.ts#POST",
        "service": [
          "@elkdonis/services#postOrgChatMessage",
          "@elkdonis/services#getProfile"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/chat",
          "how": "the message box of the chat page (packages/chat ChatPage.tsx, route via lib/chat-api.ts createChatApi)"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/chat/messages/route.ts#POST",
        "service": [
          "@elkdonis/services#postOrgChatMessage",
          "@elkdonis/services#getProfile"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub/chat",
          "how": "the message box of the chat page (packages/chat ChatPage.tsx, route via lib/chat-api.ts createChatApi)"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/chat/messages/route.ts#POST",
        "service": [
          "(withMember via createChatApi: getApiMember)",
          "@elkdonis/services#getProfile",
          "@elkdonis/services#postOrgChatMessage"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "chat card (packages/chat ChatTranscript.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/chat/messages/route.ts#POST",
        "service": [
          "(withMember via createChatApi: getApiMember)",
          "@elkdonis/services#getProfile",
          "@elkdonis/services#postOrgChatMessage"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "chat card (packages/chat ChatTranscript.tsx, mounted in the hub)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/chat/messages/route.ts#POST",
        "service": [
          "@elkdonis/services#postOrgChatMessage",
          "@elkdonis/services#getProfile"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/chat",
          "how": "the message box of the chat page (packages/chat/src/components/ChatPage.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/chat/messages/route.ts#POST",
        "service": [
          "@elkdonis/services#postOrgChatMessage",
          "@elkdonis/services#getProfile"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/chat",
          "how": "the message box of the chat page (packages/chat ChatPage.tsx)"
        }
      },
    ],
    "entry": null,
    "status": "the Talk room has a message from the person (listOrgChatMessages)",
    "confirm": {
      "text": "Post this in the {org} chat? Everyone in the group can read it.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Not in arts-collective. Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-chat-post); byte-identical bar one comment.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, innergathering, elktours). Differences by app:\n- amrit-canada (was amrit-chat-post): Not in arts-collective. Same file in sunjay (apps.sunjay.*.ts: sunjay-chat-post); byte-identical bar one comment.\n- hidden-enneagram (was he-chat-post): Copy of sunjay-chat-post (identical logic).\n- ifac (was ifac-chat-post): hidden-enneagram copy is the same route over packages/chat createChatApi.\n- innergathering (was ig-chat-message-send): Same route in the other five org apps (not diffed).\n- elktours (was elktours-chat-message-post): Same chat package routes mounted in other org apps.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    "canonical": "packages/chat createChatApi (already shared)",
    "verified": "2026-11-16 read app/api/hub/{documents,ideas,whiteboard}/route.ts, app/api/chat/*, lib/chat-api.ts, lib/auth.ts, app/api/forum/[action]/route.ts, lib/forum.ts, packages/forum-ui actions.ts, services forum-write.ts",
    "open": "innergathering (ig-chat-message-send): The message length limit and rate limit live in services postOrgChatMessage; not read here.\nelktours (elktours-chat-message-post): No message length or rate limit in the route (limits, if any, are in postOrgChatMessage, not read). Posts are made in Talk under the service account with the member's name as author text.",
    "inputs": "message"
  },
  {
    "area": "sunjay.hub",
    "scope": "person",
    "risk": [
      "others"
    ],
    "id": "sunjay-chat-name-set",
    "updated": "2026-11-16",
    "label": "Choose my chat name",
    "does": "A member changes the display name they post under in the group chat (their own guest account only; no user id in the request).",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/chat/identity/route.ts#PUT",
        "service": [
          "@elkdonis/services#setOrgChatDisplayName"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/chat/identity/route.ts#PUT",
        "service": [
          "@elkdonis/services#setOrgChatDisplayName"
        ]
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/chat/identity/route.ts#PUT",
        "service": [
          "(withMember: getApiMember)",
          "@elkdonis/services#setOrgChatDisplayName"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "name field in the chat card (packages/chat ChatIdentity.tsx)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/chat/identity/route.ts#PUT",
        "service": [
          "(withMember: getApiMember)",
          "@elkdonis/services#setOrgChatDisplayName"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "name field in the chat card (packages/chat ChatIdentity.tsx)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/chat/identity/route.ts#PUT",
        "service": [
          "@elkdonis/services#setOrgChatDisplayName"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/chat",
          "how": "the name field of the chat page (packages/chat/src/components/ChatIdentity.tsx)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/chat/identity/route.ts#PUT",
        "service": [
          "@elkdonis/services#setOrgChatDisplayName"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub/chat",
          "how": "the name field of the chat page (packages/chat ChatIdentity.tsx)"
        }
      },
    ],
    "status": "getOrgChatIdentity returns the new name",
    "drift": "Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-chat-name-set); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 6 rows, 6 apps (sunjay, amrit-canada, hidden-enneagram, ifac, innergathering, elktours). Differences by app:\n- amrit-canada (was amrit-chat-name-set): Same file in sunjay (apps.sunjay.*.ts: sunjay-chat-name-set); byte-identical bar log prefixes.\n- hidden-enneagram (was he-chat-name-set): Copy of ifac-chat-name-set.\n- ifac (was ifac-chat-name-set): Same as hidden-enneagram (comments only differ).\n- innergathering (was ig-chat-name-set): Same route in amrit-canada, elktours, hidden-enneagram, ifac, sunjay (all built on createChatApi; not diffed).\n- elktours (was elktours-chat-name-set): Same chat package routes mounted in other org apps.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    "canonical": "packages/chat createChatApi",
    "verified": "2026-11-16 read app/api/hub/{documents,ideas,whiteboard}/route.ts, app/api/chat/*, lib/chat-api.ts, lib/auth.ts, app/api/forum/[action]/route.ts, lib/forum.ts, packages/forum-ui actions.ts, services forum-write.ts",
    "confirm": {
      "text": "Show as “{name}” in the {org} chat? Everyone in the room sees it.",
      "status": "draft",
      "wave": 6
    },
    "inputs": "displayName"
  },
  {
    "area": "sunjay.hub",
    "scope": "org",
    "risk": [
      "none"
    ],
    "id": "sunjay-chat-room-create",
    "label": "Create the group chat room",
    "does": "An owner or guide creates the organisation's Talk room on first use (idempotent).",
    "class": "internal",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/chat/provision/route.ts#POST",
        "service": [
          "@elkdonis/services#ensureOrgChatRoom"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/chat/provision/route.ts#POST",
        "service": [
          "@elkdonis/services#ensureOrgChatRoom"
        ]
      },
    ],
    "status": "the org has a Talk room token",
    "drift": "Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-chat-room-create); byte-identical bar log prefixes.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (sunjay, amrit-canada). Differences by app:\n- amrit-canada (was amrit-chat-room-create): Same file in sunjay (apps.sunjay.*.ts: sunjay-chat-room-create); byte-identical bar log prefixes.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "packages/chat createChatApi",
    "verified": "2026-11-16 read app/api/hub/{documents,ideas,whiteboard}/route.ts, app/api/chat/*, lib/chat-api.ts, lib/auth.ts, app/api/forum/[action]/route.ts, lib/forum.ts, packages/forum-ui actions.ts, services forum-write.ts"
  },
  {
    "area": "sunjay.hub",
    "scope": "thread",
    "risk": [
      "public",
      "irreversible"
    ],
    "id": "sunjay-forum-topic-remove",
    "label": "Take down my own forum topic",
    "does": "The author archives their own topic.",
    "class": "person",
    "actors": [
      "person"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "remove",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#removeThread"
        ],
        "address": {
          "app": "sunjay",
          "path": "/forum",
          "how": "the Remove control of the topic menu (packages/forum-ui thread.tsx)"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "remove",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#removeThread"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/forum",
          "how": "the Remove control of the topic menu (packages/forum-ui thread.tsx)"
        }
      },
    ],
    "entry": null,
    "status": "threads.status is 'archived' for the topic",
    "confirm": {
      "text": "Take down your topic “{title}”? It disappears for everyone. This cannot be undone from here.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-forum-topic-remove); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (sunjay, amrit-canada). Differences by app:\n- amrit-canada (was amrit-forum-topic-remove): Same file in sunjay (apps.sunjay.*.ts: sunjay-forum-topic-remove); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "services removeThread via handleForumAction",
    "verified": "2026-11-16 read app/api/hub/{documents,ideas,whiteboard}/route.ts, app/api/chat/*, lib/chat-api.ts, lib/auth.ts, app/api/forum/[action]/route.ts, lib/forum.ts, packages/forum-ui actions.ts, services forum-write.ts"
  },
  {
    "area": "sunjay.hub",
    "scope": "org",
    "risk": [
      "public"
    ],
    "id": "sunjay-forum-category-add",
    "label": "Add a forum category",
    "does": "A member of the organisation adds a category (forum) with a name, tagline and audience.",
    "class": "person",
    "actors": [
      "member",
      "guide",
      "owner"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "category",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createCategory"
        ],
        "address": {
          "app": "sunjay",
          "path": "/forum",
          "how": "the Add a category form (packages/forum-ui category.tsx)"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "category",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#createCategory"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/forum",
          "how": "the Add a category form (packages/forum-ui category.tsx)"
        }
      },
    ],
    "entry": null,
    "status": "org_feeds has a row for the org with the slug",
    "confirm": {
      "text": "Add the forum category “{name}” to {org}? It shows in the forum list straight away.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-forum-category-add); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (sunjay, amrit-canada). Differences by app:\n- amrit-canada (was amrit-forum-category-add): Same file in sunjay (apps.sunjay.*.ts: sunjay-forum-category-add); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "services createCategory via handleForumAction",
    "open": "SECURITY: createCategory gates on isOrgMember(viewer, input.orgId) where orgId comes from the form (forum-write.ts:735); any member can add a category, not only guides or owners. Whether isOrgMember counts a viewer (follower) role was not verified.",
    "verified": "2026-11-16 read app/api/hub/{documents,ideas,whiteboard}/route.ts, app/api/chat/*, lib/chat-api.ts, lib/auth.ts, app/api/forum/[action]/route.ts, lib/forum.ts, packages/forum-ui actions.ts, services forum-write.ts"
  },
  {
    "area": "sunjay.hub",
    "scope": "org",
    "risk": [
      "none"
    ],
    "id": "sunjay-forum-topic-propose",
    "label": "Propose a forum topic tag",
    "does": "An owner or guide proposes a topic tag (approved at once or queued for an admin).",
    "class": "internal",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "propose-topic",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#proposeTopic"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "propose-topic",
        "service": [
          "@elkdonis/forum-ui#handleForumAction",
          "@elkdonis/services#proposeTopic"
        ]
      },
    ],
    "status": "a forum topic tag row exists (approved or pending)",
    "drift": "Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-forum-topic-propose); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (sunjay, amrit-canada). Differences by app:\n- amrit-canada (was amrit-forum-topic-propose): Same file in sunjay (apps.sunjay.*.ts: sunjay-forum-topic-propose); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "services proposeTopic via handleForumAction",
    "verified": "2026-11-16 read app/api/hub/{documents,ideas,whiteboard}/route.ts, app/api/chat/*, lib/chat-api.ts, lib/auth.ts, app/api/forum/[action]/route.ts, lib/forum.ts, packages/forum-ui actions.ts, services forum-write.ts"
  },
  {
    "area": "sunjay.hub",
    "scope": "person",
    "risk": [
      "none"
    ],
    "id": "sunjay-forum-reader-state",
    "label": "Mark forum items read and set reading looks",
    "does": "Marks everything or the bell notifications read, and (for anyone, signed in or not) stores theme, size and layout in cookies.",
    "class": "internal",
    "actors": [
      "visitor",
      "person"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "read-all",
        "service": [
          "@elkdonis/forum-ui#handleForumAction"
        ]
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "notifications-read",
        "service": [
          "@elkdonis/forum-ui#handleForumAction"
        ]
      },
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "set-theme",
        "service": [
          "@elkdonis/forum-ui#handleForumAction"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "read-all",
        "service": [
          "@elkdonis/forum-ui#handleForumAction"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "notifications-read",
        "service": [
          "@elkdonis/forum-ui#handleForumAction"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "set-theme",
        "service": [
          "@elkdonis/forum-ui#handleForumAction"
        ]
      },
    ],
    "status": "unverifiable: read marks and cookies",
    "drift": "Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-forum-reader-state); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (sunjay, amrit-canada). Differences by app:\n- amrit-canada (was amrit-forum-reader-state): Same file in sunjay (apps.sunjay.*.ts: sunjay-forum-reader-state); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "handleForumAction",
    "verified": "2026-11-16 read app/api/hub/{documents,ideas,whiteboard}/route.ts, app/api/chat/*, lib/chat-api.ts, lib/auth.ts, app/api/forum/[action]/route.ts, lib/forum.ts, packages/forum-ui actions.ts, services forum-write.ts"
  },
  {
    "area": "sunjay.hub",
    "scope": "person",
    "risk": [
      "none"
    ],
    "id": "sunjay-forum-line-draw",
    "label": "Draw a line between two topics",
    "does": "A signed-in person draws or erases a personal link between two topics, shown on their own map.",
    "class": "internal",
    "actors": [
      "person"
    ],
    "hosts": [
      {
        "key": "api:apps/sunjay/src/app/api/forum/[action]/route.ts#POST",
        "case": "line",
        "service": [
          "@elkdonis/forum-ui#handleForumAction"
        ]
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/forum/[action]/route.ts#POST",
        "case": "line",
        "service": [
          "@elkdonis/forum-ui#handleForumAction"
        ]
      },
    ],
    "status": "a topic link row exists for the person",
    "drift": "Same file in amrit-canada (apps.amrit-canada.*.ts: sunjay-forum-line-draw); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (sunjay, amrit-canada). Differences by app:\n- amrit-canada (was amrit-forum-line-draw): Same file in sunjay (apps.sunjay.*.ts: sunjay-forum-line-draw); the route is a 7-line mount of handleForumAction. The Grand Forum at the network host uses the same package (Elkdonis forum is arts-collective.hub:post-to-elkdonis-forum, a different door).\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    "canonical": "handleForumAction",
    "verified": "2026-11-16 read app/api/hub/{documents,ideas,whiteboard}/route.ts, app/api/chat/*, lib/chat-api.ts, lib/auth.ts, app/api/forum/[action]/route.ts, lib/forum.ts, packages/forum-ui actions.ts, services forum-write.ts"
  },
  {
    "area": "sunjay.hub",
    "scope": "org",
    "risk": [
      "public"
    ],
    "id": "sunjay-site-section-save",
    "label": "Save a page's copy",
    "does": "An owner or guide fills in the copy slots of one of the site's fixed-layout pages from the Site Builder.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/sunjay/src/app/hub/actions.ts#runHubAction",
        "case": "site-section-save",
        "service": [
          "@elkdonis/actions/server#performHubAction"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/site",
          "how": "the Site Builder in /hub/site (components/hub/hub-card-host.tsx act -> runHubAction)"
        }
      }
    ],
    "entry": "site-section-save",
    "status": "org_site_sections has the saved fields for the page (hub entry status)",
    "confirm": {
      "text": "Save the words on the {page} page of {org}? Visitors see the new copy at once.",
      "status": "draft",
      "wave": 6
    },
    "drift": "thin wrapper over the hub registry door: one host, six entries (SITE_BUILDER_ACTIONS, app/hub/actions.ts:14). Same door as arts-collective runTenantHubAction in shape; arts-collective mounts different entries (org-person-*, arrivals, review) and not the Site Builder ones (arts-collective.hub:... open says site-page-create is not mounted there).",
    "canonical": "packages/actions performHubAction (the registry door)",
    "open": "performHubAction binds the org to siteConfig.orgId and requires owner or guide (resolveActionOrg siteOrgId), then performAction runs the entry with sunjay’s siteAdapter; the adapter’s own validation (slugs, sanitising) lives in lib/hub-site-adapter.ts, not re-read.",
    "verified": "2026-11-16 read app/hub/actions.ts, packages/actions/src/server/hub-door.ts, packages/actions/src/hub.ts, packages/hub site-builder model"
  },
  {
    "area": "sunjay.hub",
    "scope": "org",
    "risk": [
      "public"
    ],
    "id": "sunjay-site-page-create",
    "label": "Add a page",
    "does": "An owner or guide adds a new page built in the visual editor: blank, from a starter, a copy or a saved template.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/sunjay/src/app/hub/actions.ts#runHubAction",
        "case": "site-page-create",
        "service": [
          "@elkdonis/actions/server#performHubAction"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/site",
          "how": "the Add a page control of the Site Builder (/hub/site)"
        }
      }
    ],
    "entry": "site-page-create",
    "status": "a site page document exists at the new address",
    "confirm": {
      "text": "Add the page “{title}” to {org}’s site? It starts as a draft only you can see.",
      "status": "draft",
      "wave": 6
    },
    "drift": "thin wrapper over the hub registry door: one host, six entries (SITE_BUILDER_ACTIONS, app/hub/actions.ts:14). Same door as arts-collective runTenantHubAction in shape; arts-collective mounts different entries (org-person-*, arrivals, review) and not the Site Builder ones (arts-collective.hub:... open says site-page-create is not mounted there).",
    "canonical": "packages/actions performHubAction (the registry door)",
    "open": "performHubAction binds the org to siteConfig.orgId and requires owner or guide (resolveActionOrg siteOrgId), then performAction runs the entry with sunjay’s siteAdapter; the adapter’s own validation (slugs, sanitising) lives in lib/hub-site-adapter.ts, not re-read.",
    "verified": "2026-11-16 read app/hub/actions.ts, packages/actions/src/server/hub-door.ts, packages/actions/src/hub.ts, packages/hub site-builder model"
  },
  {
    "area": "sunjay.hub",
    "scope": "org",
    "risk": [
      "public"
    ],
    "id": "sunjay-site-page-meta-save",
    "label": "Save page notes and settings",
    "does": "An owner or guide saves the hub-only notes, title and link preview text of one page.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/sunjay/src/app/hub/actions.ts#runHubAction",
        "case": "site-page-meta-save",
        "service": [
          "@elkdonis/actions/server#performHubAction"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/site",
          "how": "the page settings of the Site Builder (/hub/site)"
        }
      }
    ],
    "entry": "site-page-meta-save",
    "status": "the page meta row holds the values (needs migration 256)",
    "confirm": {
      "text": "Save the notes and link preview for the {page} page of {org}?",
      "status": "draft",
      "wave": 6
    },
    "drift": "thin wrapper over the hub registry door: one host, six entries (SITE_BUILDER_ACTIONS, app/hub/actions.ts:14). Same door as arts-collective runTenantHubAction in shape; arts-collective mounts different entries (org-person-*, arrivals, review) and not the Site Builder ones (arts-collective.hub:... open says site-page-create is not mounted there).",
    "canonical": "packages/actions performHubAction (the registry door)",
    "open": "performHubAction binds the org to siteConfig.orgId and requires owner or guide (resolveActionOrg siteOrgId), then performAction runs the entry with sunjay’s siteAdapter; the adapter’s own validation (slugs, sanitising) lives in lib/hub-site-adapter.ts, not re-read.",
    "verified": "2026-11-16 read app/hub/actions.ts, packages/actions/src/server/hub-door.ts, packages/actions/src/hub.ts, packages/hub site-builder model"
  },
  {
    "area": "sunjay.hub",
    "scope": "org",
    "risk": [
      "none"
    ],
    "id": "sunjay-site-template-save",
    "label": "Save a page as a template",
    "does": "An owner or guide keeps a page's blocks, layout and words as a starting point for new pages.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/sunjay/src/app/hub/actions.ts#runHubAction",
        "case": "site-template-save",
        "service": [
          "@elkdonis/actions/server#performHubAction"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/site",
          "how": "the Save as template control of the Site Builder (/hub/site)"
        }
      }
    ],
    "entry": "site-template-save",
    "status": "a site template row exists (needs migration 257)",
    "confirm": {
      "text": "Save the {page} page as a template for new pages of {org}? Pages made from it get their own copy.",
      "status": "draft",
      "wave": 6
    },
    "drift": "thin wrapper over the hub registry door: one host, six entries (SITE_BUILDER_ACTIONS, app/hub/actions.ts:14). Same door as arts-collective runTenantHubAction in shape; arts-collective mounts different entries (org-person-*, arrivals, review) and not the Site Builder ones (arts-collective.hub:... open says site-page-create is not mounted there).",
    "canonical": "packages/actions performHubAction (the registry door)",
    "open": "performHubAction binds the org to siteConfig.orgId and requires owner or guide (resolveActionOrg siteOrgId), then performAction runs the entry with sunjay’s siteAdapter; the adapter’s own validation (slugs, sanitising) lives in lib/hub-site-adapter.ts, not re-read.",
    "verified": "2026-11-16 read app/hub/actions.ts, packages/actions/src/server/hub-door.ts, packages/actions/src/hub.ts, packages/hub site-builder model"
  },
  {
    "area": "sunjay.hub",
    "scope": "org",
    "risk": [
      "public"
    ],
    "id": "sunjay-site-identity-save",
    "label": "Save the identity card",
    "does": "An owner or guide saves the organisation's name, short line, place and kinds as the network shows them.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/sunjay/src/app/hub/actions.ts#runHubAction",
        "case": "site-identity-save",
        "service": [
          "@elkdonis/actions/server#performHubAction"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/site",
          "how": "the Identity card of the Site Builder (/hub/site)"
        }
      }
    ],
    "entry": "site-identity-save",
    "status": "the org identity row holds the values",
    "confirm": {
      "text": "Save {org}’s identity card? Its name, line and place update across the network.",
      "status": "draft",
      "wave": 6
    },
    "drift": "thin wrapper over the hub registry door: one host, six entries (SITE_BUILDER_ACTIONS, app/hub/actions.ts:14). Same door as arts-collective runTenantHubAction in shape; arts-collective mounts different entries (org-person-*, arrivals, review) and not the Site Builder ones (arts-collective.hub:... open says site-page-create is not mounted there).",
    "canonical": "packages/actions performHubAction (the registry door)",
    "open": "performHubAction binds the org to siteConfig.orgId and requires owner or guide (resolveActionOrg siteOrgId), then performAction runs the entry with sunjay’s siteAdapter; the adapter’s own validation (slugs, sanitising) lives in lib/hub-site-adapter.ts, not re-read.",
    "verified": "2026-11-16 read app/hub/actions.ts, packages/actions/src/server/hub-door.ts, packages/actions/src/hub.ts, packages/hub site-builder model"
  },
  {
    "area": "sunjay.hub",
    "scope": "org",
    "risk": [
      "public",
      "irreversible"
    ],
    "id": "sunjay-site-theme-exception-remove",
    "label": "Remove a page's colour exception",
    "does": "An owner or guide lets one page follow the site theme again by deleting that page’s colour exception (never the site default).",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/sunjay/src/app/hub/actions.ts#runHubAction",
        "case": "site-theme-exception-remove",
        "service": [
          "@elkdonis/actions/server#performHubAction"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub/site",
          "how": "the Theme exceptions list of the Site Builder (/hub/site)"
        }
      }
    ],
    "entry": "site-theme-exception-remove",
    "status": "no site_themes row for that page",
    "confirm": {
      "text": "Let the {page} page follow {org}’s site colours again? Its own colours are removed.",
      "status": "draft",
      "wave": 6
    },
    "drift": "thin wrapper over the hub registry door: one host, six entries (SITE_BUILDER_ACTIONS, app/hub/actions.ts:14). Same door as arts-collective runTenantHubAction in shape; arts-collective mounts different entries (org-person-*, arrivals, review) and not the Site Builder ones (arts-collective.hub:... open says site-page-create is not mounted there).",
    "canonical": "packages/actions performHubAction (the registry door)",
    "open": "performHubAction binds the org to siteConfig.orgId and requires owner or guide (resolveActionOrg siteOrgId), then performAction runs the entry with sunjay’s siteAdapter; the adapter’s own validation (slugs, sanitising) lives in lib/hub-site-adapter.ts, not re-read.",
    "verified": "2026-11-16 read app/hub/actions.ts, packages/actions/src/server/hub-door.ts, packages/actions/src/hub.ts, packages/hub site-builder model"
  },
  {
    "area": "sunjay.hub",
    "scope": "channel",
    "risk": [
      "none"
    ],
    "id": "sunjay-channel-slot-fill",
    "label": "Fill a routine slot",
    "does": "Places a draft post about a piece in one of a routine's slots.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/sunjay/src/lib/channel-door.ts#runChannelAction",
        "case": "channel-slot-fill",
        "service": [
          "@elkdonis/actions/server#performSiteChannelAction"
        ],
        "address": {
          "app": "sunjay",
          "path": "/channel",
          "how": "the Channel tabs of the site (components/hub/ChannelSurface.tsx and app/channel/page.tsx call runChannelAction)"
        }
      },
      {
        "key": "sa:apps/katie-the-potter/src/lib/channel-door.ts#runChannelAction",
        "case": "channel-slot-fill",
        "service": [
          "@elkdonis/actions/server#performSiteChannelAction"
        ],
        "address": {
          "app": "katie-the-potter",
          "path": "/channel",
          "how": "the Channel tabs of the site (app/channel/page.tsx calls runChannelAction)"
        }
      },
    ],
    "entry": "channel-slot-fill",
    "status": "channel-next",
    "confirm": {
      "text": "Put a draft post about “{title}” in the {where} slot on {when}? It stays a draft, so nothing is posted yet.",
      "status": "draft",
      "wave": 6
    },
    "drift": "this is the site door (performSiteChannelAction, org fixed to siteConfig.orgId, owners and guides only) and writes plans only, nothing is sent; one host serves six entries (SITE_DOOR_ALLOW).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (sunjay, katie-the-potter). Differences by app:\n- katie-the-potter (was katie-channel-slot-fill): one host serves six entries (SITE_DOOR_ALLOW).",
    "canonical": "packages/actions server/channel.ts fillSlot",
    "verified": "2026-11-16 read lib/channel-door.ts, packages/channel/src/site/view.ts, packages/actions/src/server/site-channel-door.ts"
  },
  {
    "area": "sunjay.hub",
    "scope": "channel",
    "risk": [
      "none"
    ],
    "id": "sunjay-channel-delivery-save",
    "label": "Plan a post",
    "does": "Saves a draft post for a piece on one outlet, with its text and when. It stays a plan.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/sunjay/src/lib/channel-door.ts#runChannelAction",
        "case": "channel-delivery-save",
        "service": [
          "@elkdonis/actions/server#performSiteChannelAction"
        ],
        "address": {
          "app": "sunjay",
          "path": "/channel",
          "how": "the Channel tabs of the site (components/hub/ChannelSurface.tsx and app/channel/page.tsx call runChannelAction)"
        }
      },
      {
        "key": "sa:apps/katie-the-potter/src/lib/channel-door.ts#runChannelAction",
        "case": "channel-delivery-save",
        "service": [
          "@elkdonis/actions/server#performSiteChannelAction"
        ],
        "address": {
          "app": "katie-the-potter",
          "path": "/channel",
          "how": "the Channel tabs of the site (app/channel/page.tsx calls runChannelAction)"
        }
      },
    ],
    "entry": "channel-delivery-save",
    "status": "channel-next",
    "confirm": {
      "text": "Save a {outlet} post about “{title}” for {when}? It stays a plan, so nothing is posted by this step.",
      "status": "draft",
      "wave": 6
    },
    "drift": "this is the site door (performSiteChannelAction, org fixed to siteConfig.orgId, owners and guides only) and writes plans only, nothing is sent; one host serves six entries (SITE_DOOR_ALLOW).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (sunjay, katie-the-potter). Differences by app:\n- katie-the-potter (was katie-channel-delivery-save): one host serves six entries (SITE_DOOR_ALLOW).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.\nRelated, not merged: plan-or-schedule-post (arts-collective.channel), which can set a post to scheduled (risk public); the site-door copies write plans only.",
    "canonical": "packages/actions server/channel.ts saveDeliveryDraft, with scheduling as a separate entry",
    "verified": "2026-11-16 read lib/channel-door.ts, packages/channel/src/site/view.ts, packages/actions/src/server/site-channel-door.ts"
  },
];

export default { capabilities, ignored: [] } satisfies Area;
