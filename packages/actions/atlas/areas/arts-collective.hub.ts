// Curated capabilities: arts-collective hub (app/hub/**, the network center routes, the org console and
// the lib actions they call). 2026-11-16, agent B. Conventions: see atlas/JOURNAL.md.
import type { Area, Capability } from '../types';

const capabilities: Capability[] = [
  // ---------------- hub.profile ----------------
  {
    id: 'edit-my-profile',
    updated: '2026-11-16',
    area: 'hub.profile',
    label: 'Edit my profile',
    does: 'Change the name, line, bio, place, links, page address and comment colour that the network shows for a person.',
    class: 'person',
    actors: [
      "person",
      "owner",
      "guide",
      "member"
    ],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/center/profile/route.ts#PATCH',
        service: ['updateProfile', 'saveProfileDetails'],
        address: {
          app: 'arts-collective',
          path: '/hub/network',
          surface: 'profile',
          anchor: 'edit-my-profile',
          how: 'The profile card on the Network tab opens the profile popup; its Save button (cms-ui surface profile, served by api/center/profile).',
        },
        note: 'With ?org= the same route edits an organisation identity (canEditOrgIdentity); see save-org-identity.',
      },
      {
        "key": "sa:apps/sunjay/src/lib/account-actions.ts#updateOwnProfileAction",
        "service": [
          "@elkdonis/services#updateProfile",
          "@elkdonis/services#ensureUniqueUserSlug"
        ],
        "address": {
          "app": "sunjay",
          "path": "/account",
          "how": "profile form on the account page"
        }
      },
      {
        "key": "sa:apps/amrit-canada/src/lib/account-actions.ts#updateOwnProfileAction",
        "service": [
          "@elkdonis/services#updateProfile",
          "@elkdonis/services#ensureUniqueUserSlug"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/account",
          "how": "profile form on the account page"
        }
      },
      {
        "key": "sa:apps/elktours/src/lib/account-actions.ts#updateOwnProfileAction",
        "service": [
          "@elkdonis/services#updateProfile",
          "@elkdonis/services#ensureUniqueUserSlug"
        ],
        "address": {
          "app": "elktours",
          "path": "/account",
          "how": "profile form on the account page"
        }
      },
      {
        "key": "sa:apps/innergathering/src/lib/account-actions.ts#updateOwnProfileAction",
        "service": [
          "@elkdonis/services#updateProfile",
          "@elkdonis/services#ensureUniqueUserSlug"
        ],
        "address": {
          "app": "innergathering",
          "path": "/account",
          "how": "profile form on the account page"
        }
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/center/profile/route.ts#PATCH",
        "service": [
          "@elkdonis/services#updateProfile",
          "@elkdonis/services#canEditOrgIdentity"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/center",
          "surface": "profile",
          "how": "the profile card on /center opens the profile popup; its Save button (cms-ui surface profile) PATCHes /api/center/profile"
        }
      },
      {
        "key": "sa:apps/elastrocal/src/app/hub/profile/actions.ts#saveProfileAction",
        "service": [
          "@elkdonis/services#updateProfile",
          "@elkdonis/services#upsertOrgProfile"
        ],
        "address": {
          "app": "elastrocal",
          "path": "/hub/profile",
          "how": "the Save button of the profile form (app/hub/profile/page.tsx)"
        },
        "note": "Gate: requireOrgMember (any role in the elastrocal org, viewer included); input checked by a zod schema (name 1-120, bio 5000, etc.)."
      },
      {
        "key": "api:apps/elktours/src/app/api/center/profile/route.ts#PATCH",
        "service": [
          "@elkdonis/services#updateProfile",
          "@elkdonis/services#canEditOrgIdentity"
        ],
        "address": {
          "app": "elktours",
          "path": "/center",
          "how": "the profile card edit form (the Center profile surface, cms-ui)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/center/profile/route.ts#PATCH",
        "service": [
          "(getViewer; org target only when org is ifac and canEditOrgIdentity)",
          "@elkdonis/services#updateProfile"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "profile surface (components/hub/HubSurfaces.tsx; packages/cms-ui surface)"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/center/profile/route.ts#PATCH",
        "service": [
          "(getViewer; org target when canEditOrgIdentity)",
          "@elkdonis/services#updateProfile"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "profile surface (packages/cms-ui surface)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/center/profile/route.ts#PATCH",
        "service": [
          "@elkdonis/services#saveProfileDetails",
          "@elkdonis/services#updateProfile",
          "@elkdonis/services#canEditOrgIdentity"
        ],
        "address": {
          "app": "innergathering",
          "path": "/center",
          "how": "the Save button of the profile surface (SurfaceProfile in packages/cms-ui, wired by packages/cms-ui/src/hub/connectors.ts)"
        },
        "note": "Person target: always the viewer’s own row. Org target: organizations.profile_user_id row, gated by canEditOrgIdentity (any organisation named in ?org, not only this site’s)."
      },
      {
        "key": "api:apps/sunjay/src/app/api/center/profile/route.ts#PATCH",
        "service": [
          "@elkdonis/services#updateProfile",
          "@elkdonis/services#canEditOrgIdentity"
        ],
        "address": {
          "app": "sunjay",
          "path": "/center",
          "surface": "profile",
          "how": "the profile card on /center opens the profile popup; its Save button (cms-ui surface profile) PATCHes /api/center/profile"
        }
      },
    ],
    entry: 'profile',
    status: 'profile',
    risk: ['public'],
    confirm: {
      text: 'Save your profile changes? Your name, line and bio update on your public page and in the directory.',
      status: 'draft',
      wave: 1,
    },
    inputs: 'displayName, headline, bio, pronouns, place, links, page address',
    drift: "The registry runner `profile` calls updateProfile for name/headline/bio only; this route also saves details (slug, colour, links). One service path, two callers.\nMerged 2026-11-16 (consolidation 2): 9 rows, 8 apps (arts-collective, sunjay, amrit-canada, elastrocal, elktours, ifac, hidden-enneagram, innergathering). Differences by app:\n- sunjay (was profile-update-own): Four byte-identical copies (differ only in the console.error prefix). Self-only by construction. photoUrl is trimmed but not validated as a URL or as one of our media paths (any string is stored as avatarUrl). ifac and arts-collective have separate profile editors (ifac lib/profile-editor-actions.ts is not mapped here).\n- amrit-canada (was amrit-profile-edit): no saveProfileDetails (page address, comment colour, details), the ?org= target is only this site's org, and the identity page link goes through ARTDIRECT_URL. Both accept any http(s) avatarUrl. Same file in sunjay (apps.sunjay.*.ts: edit-my-profile); byte-identical bar log prefixes.\n- elastrocal (was elastrocal-profile-save): the org listing half is the same upsertOrgProfile call as orgapps.cms:guide-profile-save; differs: one action writes both halves, and any membership may publish the listing (the others require owner or guide).\n- elktours (was elktours-center-profile-save): this is the 125-line copy without the target-identity extras of arts-collective, ifac and innergathering; avatarUrl is validated (/api/media/ or http(s)) here, which edit-my-profile lacks.\n- ifac (was ifac-profile-edit): avatarUrl must be /api/media/ or http(s); links must be http(s) (12 max); no slug change.\n- hidden-enneagram (was he-profile-edit): the write is still gated by canEditOrgIdentity(viewer, org), so another org owner can edit their own org identity through this site.\n- innergathering (was ig-profile-save): only the session helper (getViewer vs getCurrentUser) and an unconditional dynamic import of the db; the validation body is the same (name required, 12 links with http(s) only, avatarUrl must be /api/media/ or http(s)).\n- sunjay (was sunjay-profile-edit): no saveProfileDetails (page address, comment colour, details), the ?org= target is only this site's org, and the identity page link goes through ARTDIRECT_URL. Both accept any http(s) avatarUrl. Same file in amrit-canada (apps.amrit-canada.*.ts: edit-my-profile); byte-identical bar log prefixes.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.\nDirection (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.\nDirection (Justin, 2026-11-16): avatars and uploads should become one upload path (shared validateUploadBuffer route with a per-purpose policy), not one route per app and purpose.",
    canonical: 'services updateProfile + ensureUniqueUserSlug behind one shared kit action; add URL/media-path validation for photoUrl.',
    open: "Registry entry covers three fields; the popup covers many more. Should the dock only ever do the three?\nsunjay (profile-update-own): photoUrl is stored unvalidated: should it be limited to our media paths like the banner action does?\namrit-canada (amrit-profile-edit): SECURITY: avatarUrl is accepted as any http(s) URL or an /api/media/ path (route.ts:104), not library-only: the person (or org) can point their public photo at an external host (tracking pixel, hotlinked image). Same weakness as the arts-collective copy (agent D noted profile photoUrl stored unvalidated).\nelastrocal (elastrocal-profile-save): SECURITY (judgement): elastrocal signup makes every new account a `viewer` of the org (api/auth/signup/route.ts:14-16), and requireOrgMember accepts any role (lib/auth.ts:87-92, isMember = role !== null), so ANY new account can open /hub/profile and publish itself to the organisation people page (isPublic defaults true, page.tsx:47) with a 5000-character bio and no review. The code comment says this is intended (\"the org is the guide’s own\"). sortOrder is forced to 1 for every listing (actions.ts:46). The shared-account mapping (lib/auth.ts:44-47) makes the second owner’s login act as the first user, so edits there land on the merged account.\nelktours (elktours-center-profile-save): The ?org= id is accepted without being limited to this site's org (the comment says only this org can be edited here, the code resolves any org through organizations.profile_user_id, app/api/center/profile/route.ts:22-31); canEditOrgIdentity(viewer, org) decides. avatarUrl allows any http(s) address.\nhidden-enneagram (he-profile-edit): apps/hidden-enneagram/src/app/api/center/profile/route.ts:22-26 contradicts its own comment (no org pin). Not an escalation.\ninnergathering (ig-profile-save): SECURITY: avatarUrl accepts any http(s) URL and is stored as given (center/profile/route.ts:141-143), the same weakness as the other copies (katie alone restricts to library paths). Not new.",
    verified: '2026-11-16 read app/api/center/profile/route.ts, packages/actions run.ts',
  },
  {
    id: 'upload-profile-photo',
    area: 'hub.profile',
    label: 'Upload a photo to my storage',
    does: "Stores an image in the person's own Images folder and returns its address for the profile photo.",
    class: "person",
    actors: [
      "person",
      "member",
      "guide",
      "owner"
    ],
    scope: 'person',
    hosts: [
      { key: 'api:apps/arts-collective/src/app/api/center/avatar/route.ts#POST', service: ['uploadUserFile'] },
      {
        "key": "api:apps/amrit-canada/src/app/api/center/avatar/route.ts#POST",
        "service": [
          "@elkdonis/services#uploadUserFile",
          "@elkdonis/services#getStorageSlug"
        ]
      },
      {
        "key": "api:apps/elktours/src/app/api/center/avatar/route.ts#POST",
        "service": [
          "@elkdonis/services#getStorageSlug",
          "@elkdonis/services#uploadUserFile"
        ],
        "address": {
          "app": "elktours",
          "path": "/center",
          "how": "the photo button of the profile card (the Center profile surface, cms-ui)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/center/avatar/route.ts#POST",
        "service": [
          "@elkdonis/services#uploadUserFile",
          "@elkdonis/services#getStorageSlug"
        ],
        "address": {
          "app": "innergathering",
          "path": "/center",
          "how": "the photo picker in the profile surface (packages/cms-ui/src/hub/connectors.ts)"
        },
        "note": "Image mime type is taken from the browser (file.type); there is no magic-byte check here, unlike /api/upload."
      },
      {
        "key": "api:apps/sunjay/src/app/api/center/avatar/route.ts#POST",
        "service": [
          "@elkdonis/services#uploadUserFile",
          "@elkdonis/services#getStorageSlug"
        ]
      },
      {
        "key": "api:apps/ifac/src/app/api/center/avatar/route.ts#POST",
        "service": [
          "(getViewer: any signed-in person)",
          "@elkdonis/services#getStorageSlug",
          "@elkdonis/services#uploadUserFile"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "photo picker in the profile surface (components/hub/HubSurfaces.tsx)"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/center/avatar/route.ts#POST",
        "service": [
          "(getViewer: any signed-in person)",
          "@elkdonis/services#getStorageSlug",
          "@elkdonis/services#uploadUserFile"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "photo picker in the profile surface (packages/cms-ui surface)"
        }
      },
    ],
    risk: ['none'],
    open: "A step inside edit-my-profile, not its own rail step.\namrit-canada (amrit-profile-photo-upload): SECURITY: avatar/route.ts:20-21 trusts file.type from the client (image/svg+xml passes startsWith image/). The sibling /api/upload runs validateUploadBuffer to refuse SVG; this route does not. The file lands in the person’s own tree and is served by the proxy; whether the proxy sets a safe content type was not checked.\nelktours (elktours-center-avatar-upload): SECURITY: the MIME check is the client-supplied File.type only (app/api/center/avatar/route.ts:25); an SVG (image/svg+xml passes startsWith image/) or a mislabelled file is stored in the person's tree and served from /api/media. /api/upload and /api/upload/forum run validateUploadBuffer on the bytes for exactly this reason; this route does not. Any signed-in account (not only members) can write up to 8 MB per call with no rate limit.\ninnergathering (ig-profile-photo-upload): SECURITY: file.type.startsWith(\"image/\") is the only type test (center/avatar/route.ts:25), so an SVG or a renamed file with an image mime type is accepted into the person’s own folder and served by the media proxy. /api/upload runs validateUploadBuffer; this route does not. Same in the arts-collective copy.\nifac (ifac-profile-photo-upload): SECURITY: apps/ifac/src/app/api/center/avatar/route.ts:25-31 only checks the browser-declared MIME and size before uploadUserFile; services user-storage.ts:105 does not sniff bytes. An SVG labelled image/svg+xml would be stored and served from /api/media (does the media route force a download for SVG? not read). Same in hidden-enneagram and the arts-collective copy.\nhidden-enneagram (he-profile-photo-upload): SECURITY: apps/hidden-enneagram/src/app/api/center/avatar/route.ts:25-31 only the browser-declared MIME is checked before uploadUserFile (no validateUploadBuffer); same gap as ifac.",
    verified: '2026-11-16 read app/api/center/avatar/route.ts',
    drift: "Merged 2026-11-16 (consolidation 2): 7 rows, 7 apps (arts-collective, amrit-canada, elktours, innergathering, sunjay, ifac, hidden-enneagram). Differences by app:\n- amrit-canada (was amrit-profile-photo-upload): byte-identical logic (checks only that the browser-declared type starts with image/: no byte sniffing, so an svg passes; same in the arts-collective copy). Same file in sunjay (apps.sunjay.*.ts: upload-profile-photo); byte-identical bar log prefixes.\n- elktours (was elktours-center-avatar-upload): same service uploadUserFile; this copy checks file.type.startsWith(\"image/\") (client MIME string) with no byte sniff.\n- innergathering (was ig-profile-photo-upload): session helper only.\n- sunjay (was sunjay-profile-photo-upload): byte-identical logic (checks only that the browser-declared type starts with image/: no byte sniffing, so an svg passes; same in the arts-collective copy). Same file in amrit-canada (apps.amrit-canada.*.ts: upload-profile-photo); byte-identical bar log prefixes.\n- ifac (was ifac-profile-photo-upload): no validateUploadBuffer, unlike ifac api/upload.\n- hidden-enneagram (was he-profile-photo-upload): Copy of upload-profile-photo (4 diff lines) and arts-collective upload-profile-photo. Client MIME only.\nDirection (Justin, 2026-11-16): avatars and uploads should become one upload path (shared validateUploadBuffer route with a per-purpose policy), not one route per app and purpose.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    confirm: {
      "text": "Upload {file} as your profile photo? It shows on your page once you save.",
      "status": "draft",
      "wave": 6
    },
    status: "a file exists under the person's own Images folder with the returned url",
    inputs: "image file",
  },
  {
    id: 'set-where-i-show',
    area: 'hub.profile',
    label: 'Choose where I show',
    does: 'Turn a row (profile, writing, store, services...) on or off for a column (directory, own page, market, an org site).',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/center/presence/route.ts#POST',
        service: ['setPresence'],
        address: {
          app: 'arts-collective',
          path: '/hub/network',
          surface: 'profile:show',
          anchor: 'set-where-i-show',
          how: 'The "Where you show" grid in the profile popup (tab Show); each tick box posts to api/center/presence.',
        },
      },
      {
        "key": "api:apps/innergathering/src/app/api/center/presence/route.ts#POST",
        "service": [
          "@elkdonis/services#setPresence"
        ],
        "address": {
          "app": "innergathering",
          "path": "/center",
          "how": "a switch in the \"Where you show\" section (packages/cms-ui/src/hub/connectors.ts, HubSurfaces.tsx)"
        }
      },
    ],
    entry: null,
    status: 'listing',
    risk: ['public'],
    confirm: {
      text: 'Set your {name} on {where} to {state}? People who visit {where} see the change.',
      status: 'draft',
      wave: 2,
    },
    inputs: 'row, column, on',
    drift: "Registry entry `listing` calls setPresence(row you, column directory) only: a special case of this.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (arts-collective, innergathering). Differences by app:\n- innergathering (was ig-presence-set): session helper only (8 diff lines).",
    canonical: 'services setPresence',
    open: '`listing` is the directory column of this; should it be a parameter of one entry? Status shown is the `listing` check, which only covers the directory.',
    verified: '2026-11-16 read app/api/center/presence/route.ts, run.ts listing runner',
  },
  {
    id: 'post-to-a-site',
    area: 'hub.profile',
    label: 'Post to a site from anywhere',
    does: "Write a short post and send it to the person's blog or to one feed of an organisation they belong to.",
    class: 'person',
    actors: ['person', 'member', 'guide', 'owner'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/center/post/route.ts#POST',
        service: ['createPostAnywhere'],
        address: {
          app: 'arts-collective',
          path: '/hub/network',
          anchor: 'post-to-a-site',
          how: '"Post to..." in the Network tab (cms-ui hub connector postTo, NetworkCenterHost.tsx).',
        },
      },
      {
        "key": "api:apps/innergathering/src/app/api/center/post/route.ts#POST",
        "service": [
          "@elkdonis/services#createPostAnywhere",
          "@elkdonis/services#listOrgHomes"
        ],
        "address": {
          "app": "innergathering",
          "path": "/center",
          "how": "the \"Post to…\" form on the center (packages/cms-ui/src/hub/connectors.ts)"
        },
        "note": "The route also runs a raw SELECT for the blog and feed names after the write; it writes nothing itself."
      },
    ],
    entry: null,
    status: 'A thread authored by the person exists, newest first (threads.author_id, status published)',
    risk: ['public'],
    confirm: { text: 'Post “{title}” to {where}? It goes live there straight away.', status: 'draft', wave: 2 },
    inputs: 'target, title, text',
    drift: "Third publishing path: registry org-publish (draft via createThread), createThreadAction (raw SQL), and createPostAnywhere here.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (arts-collective, innergathering). Differences by app:\n- innergathering (was ig-post-create): blog is homed in this site’s org (blogOrgId = inner_group) instead of PERSONAL_ORG_ID (ArtDirect); blog link is a relative /artists/<slug>/writing/<piece>, other-org link is built from the org’s own domain; a post to this org links to /forum/t/<id>/<slug> here.",
    canonical: 'services createThread (createPostAnywhere should call it)',
    open: "createPostAnywhere's targets check is the permission; I did not read it. Does posting to an org feed need the org role the others use (owner/guide)?",
    verified: '2026-11-16 read app/api/center/post/route.ts',
  },
  {
    id: 'choose-sites-for-post',
    area: 'hub.profile',
    label: 'Show a post on other sites',
    does: "Pick which organisations' sites also list one of the person's published posts.",
    class: 'person',
    actors: [
      "person",
      "owner",
      "guide"
    ],
    scope: 'thread',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/center/listings/route.ts#POST',
        service: ['setThreadListings'],
        address: {
          app: 'arts-collective',
          path: '/hub/network',
          anchor: 'choose-sites-for-post',
          how: 'The "Where you show" / Show on panel in the profile popup (listings connector in NetworkCenterHost.tsx).',
        },
      },
      {
        key: 'sa:apps/arts-collective/src/lib/studio-actions.ts#setStudioListing',
        service: ['setThreadListings'],
        address: {
          app: 'arts-collective',
          path: '/studio',
          anchor: 'choose-sites-for-post',
          how: 'The Show on... list in the Studio writing editor (packages/studio WritingEditor.tsx).',
        },
        note: 'The Studio copy; same service, gate canEditProfile.',
      },
      {
        "key": "sa:apps/ifac/src/lib/writing-actions.ts#setPieceListingAction",
        "service": [
          "@elkdonis/services#setThreadListings"
        ],
        "address": {
          "app": "ifac",
          "path": "/artists/{slug}/writing",
          "how": "listing picker on the desk"
        }
      },
      {
        "key": "sa:apps/artdirect/src/lib/writing-actions.ts#setPieceListingAction",
        "service": [
          "@elkdonis/services#setThreadListings"
        ],
        "address": {
          "app": "artdirect",
          "path": "/{slug}/writing",
          "how": "listing picker (components/oad)"
        }
      },
      {
        "key": "sa:apps/innergathering/src/lib/writing-actions.ts#setPieceListingAction",
        "service": [
          "@elkdonis/services#setThreadListings",
          "@elkdonis/services#getProfile"
        ],
        "address": {
          "app": "innergathering",
          "path": "/artists/{slug}/writing",
          "how": "listing picker"
        }
      },
      {
        "key": "sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#setPublishListing",
        "service": [
          "(local helper)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/publish",
          "how": "Publish studio listing"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/center/listings/route.ts#POST",
        "service": [
          "@elkdonis/services#setThreadListings"
        ],
        "address": {
          "app": "innergathering",
          "path": "/center",
          "how": "the \"Show on\" picker of the person page (packages/cms-ui/src/hub/connectors.ts, HubSurfaces.tsx)"
        }
      },
    ],
    entry: 'show-on',
    status: 'show-on',
    risk: ['public'],
    confirm: {
      text: 'Show “{title}” on {where}? Visitors to those sites can read it, and some sites check posts first.',
      status: 'draft',
      wave: 1,
    },
    inputs: 'threadId, orgIds',
    drift: "Org side of the same thing: hub entries listing-approve / listing-decline (reviewListing).\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (arts-collective, ifac, innergathering). Differences by app:\n- ifac (was writing-piece-listing): Same services call; per-app revalidatePath only. HE gated getApiEditor, the others author check.\n- innergathering (was ig-post-listing-set): session helper only.",
    canonical: 'services setThreadListings behind the shared desk action.',
    open: 'Registry `show-on` is status only (no runner). Add a runner?',
    verified: '2026-11-16 read app/api/center/listings/route.ts, status.ts show-on',
  },
  {
    id: 'connect-social-account',
    area: 'hub.profile',
    label: 'Connect or adjust a social account',
    does: 'Add an Instagram, Facebook, Threads or YouTube connection, check it, add a page, or set which channel an organisation posts under.',
    class: 'person',
    actors: [
      "person",
      "owner",
      "guide",
      "member"
    ],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/center/connections/route.ts#POST',
        service: ['createConnection'],
        address: {
          app: 'arts-collective',
          path: '/hub/network',
          surface: 'profile:connections',
          anchor: 'connect-social-account',
          how: 'Connections tab of the profile popup (ConnectionsBand on the Organization tab for orgs). Backed by services connectionsHandlers.',
        },
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/center/connections/route.ts#POST",
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
        "key": "api:apps/fourthwayBookreaders/src/app/api/center/connections/route.ts#POST",
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
        "key": "api:apps/sunjay/src/app/api/center/connections/route.ts#POST",
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
        "key": "api:apps/innergathering/src/app/api/center/connections/route.ts#POST",
        "service": [
          "@elkdonis/services#connectionsHandlers"
        ],
        "address": {
          "app": "innergathering",
          "path": "/center",
          "how": "the Connections tab of \"View profile\" (packages/cms-ui/src/surface/ConnectionsPanel.tsx; HubSurfaces.tsx)"
        },
        "note": "Self only: every query is scoped to the acting user inside services/connections.ts."
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/center/connections/route.ts#POST",
        "service": [
          "(who = getViewer userId)",
          "@elkdonis/services#centerRoutes"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "connections card (packages/services centerRoutes.connections)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/center/connections/route.ts#POST",
        "service": [
          "(who = getViewer userId)",
          "@elkdonis/services#centerRoutes"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "connections card (packages/services centerRoutes.connections mounted at app/api/center/connections)"
        }
      },
    ],
    entry: 'channel-connect',
    status: 'channel-connect',
    risk: ['public'],
    confirm: { text: 'Connect {account}? Posts you choose to send can then go out under it.', status: 'draft', wave: 1 },
    inputs: 'provider, token or consent',
    open: 'The consent flow itself is api/connections/start + callback (GET, not hosts). Is "connect" really a confirm card, or always a go-there step?',
    verified: '2026-11-16 read app/api/center/connections/route.ts, services connections.ts connectionsHandlers',
    drift: "Merged 2026-11-16 (consolidation 2): 7 rows, 7 apps (arts-collective, amrit-canada, fourthwayBookreaders, sunjay, innergathering, hidden-enneagram, ifac). Differences by app:\n- amrit-canada (was amrit-social-connect): Same mount of connectionsHandlers as arts-collective.hub:connect-social-account, no real drift: the route is 14 lines in every app. Same file in sunjay (apps.sunjay.*.ts: connect-social-account); byte-identical bar log prefixes.\n- fourthwayBookreaders (was fourthway-social-connect): Same 14-line mount of connectionsHandlers as connect-social-account and the arts-collective rows; no real drift (here it serves YouTube for the Akhand Path).\n- sunjay (was sunjay-social-connect): Same mount of connectionsHandlers as arts-collective.hub:connect-social-account, no real drift: the route is 14 lines in every app. Same file in amrit-canada (apps.amrit-canada.*.ts: connect-social-account); byte-identical bar log prefixes.\n- innergathering (was ig-connection-add): session helper (getViewer) and comment text; the route is the same 15-line mount of connectionsHandlers.\n- hidden-enneagram (was he-social-connect): Identical to connect-social-account (diffed). Copy of arts-collective connect-social-account.\n- ifac (was ifac-social-connect): no real drift.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
  },
  {
    id: 'edit-social-account',
    area: 'hub.profile',
    label: 'Edit a connected social account',
    does: 'Changes a connection’s label or its client id and secret.',
    class: 'person',
    actors: [
      "person",
      "owner",
      "guide",
      "member"
    ],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/center/connections/route.ts#PATCH',
        case: 'update',
        service: ['updateConnection'],
        address: {
          app: 'arts-collective',
          path: '/hub/network',
          anchor: 'edit-social-account',
          how: 'The edit control on a connection row. Connections tab of the profile popup (ConnectionsBand on the Organization tab for orgs). Backed by services connectionsHandlers.',
          surface: 'profile:connections',
        },
        note: 'PATCH case update: chosen by the body field (none of the others).',
      },
      {
        "key": "api:apps/innergathering/src/app/api/center/connections/route.ts#PATCH",
        "service": [
          "@elkdonis/services#connectionsHandlers"
        ],
        "address": {
          "app": "innergathering",
          "path": "/center",
          "how": "the Connections tab of \"View profile\" (ConnectionsPanel.tsx)"
        },
        "note": "One handler, four verbs in arts-collective (edit, check, add-facebook-page, set-org-posting-channel); not split with `case` here because the verb switch lives in services/center-routes.ts, which was not read."
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/center/connections/route.ts#PATCH",
        "service": [
          "(who = getViewer userId)",
          "@elkdonis/services#centerRoutes"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "connections card (packages/services centerRoutes.connections)"
        },
        "note": "shared PATCH switches on action: update, check, add-page, channel"
      },
      {
        "key": "api:apps/ifac/src/app/api/center/connections/route.ts#PATCH",
        "service": [
          "(who = getViewer userId)",
          "@elkdonis/services#centerRoutes"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "connections card (packages/services centerRoutes.connections)"
        },
        "note": "the shared PATCH switches on action: update, check, add-page, channel"
      },
    ],
    status: 'the connection row holds the new values',
    risk: [
      "public"
    ],
    confirm: {
      text: 'Save your changes to {account}? Posts keep going out under it with the new details.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read services connections.ts connectionsHandlers',
    drift: "Merged 2026-11-16 (consolidation 2): 4 rows, 4 apps (arts-collective, innergathering, hidden-enneagram, ifac). Differences by app:\n- innergathering (was ig-connection-change): copy of arts-collective.hub.ts:edit-social-account / check-social-account / add-facebook-page / set-org-posting-channel (4 rows by `case` there).\n- hidden-enneagram (was he-social-edit): Identical to ifac-social-edit.\n- ifac (was ifac-social-edit): one row here because the mount is the same handler.",
    open: "innergathering (ig-connection-change): Split by `case` like arts-collective once the connectionsHandlers PATCH verbs are read.",
    inputs: "id, action, fields",
  },
  {
    id: 'check-social-account',
    area: 'hub.profile',
    label: 'Check a connected social account',
    does: 'Asks the platform whether the stored connection still works and records the result.',
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/center/connections/route.ts#PATCH',
        case: 'check',
        service: ['checkConnection'],
        address: {
          app: 'arts-collective',
          path: '/hub/network',
          anchor: 'check-social-account',
          how: 'The Check control on a connection row. Connections tab of the profile popup (ConnectionsBand on the Organization tab for orgs). Backed by services connectionsHandlers.',
          surface: 'profile:connections',
        },
        note: 'PATCH case check: chosen by the body field (check: true).',
      },
    ],
    status: 'the connection row has a fresh check result',
    risk: ['none'],
    confirm: { text: 'Check {account}? We ask the platform whether it still works.', status: 'draft', wave: 2 },
    verified: '2026-11-16 read services connections.ts connectionsHandlers',
  },
  {
    id: 'add-facebook-page',
    area: 'hub.profile',
    label: 'Add a Facebook page to a connection',
    does: 'Adds one of the person’s Facebook pages to a Meta connection so posts can go to it.',
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/center/connections/route.ts#PATCH',
        case: 'add-page',
        service: ['addMetaPage'],
        address: {
          app: 'arts-collective',
          path: '/hub/network',
          anchor: 'add-facebook-page',
          how: 'The add-page control on a Meta connection row. Connections tab of the profile popup (ConnectionsBand on the Organization tab for orgs). Backed by services connectionsHandlers.',
          surface: 'profile:connections',
        },
        note: 'PATCH case add-page: chosen by the body field (addPage).',
      },
    ],
    status: 'the connection lists the page',
    risk: ['public'],
    confirm: {
      text: 'Add the page {where} to {account}? Posts you choose can then go out on that page.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read services connections.ts connectionsHandlers',
  },
  {
    id: 'set-org-posting-channel',
    area: 'hub.profile',
    label: 'Choose which account an organisation posts under',
    does: 'Sets the connection and channel an organisation’s posts go out under.',
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/center/connections/route.ts#PATCH',
        case: 'channel',
        service: ['setConnectionChannel'],
        address: {
          app: 'arts-collective',
          path: '/hub/network',
          anchor: 'set-org-posting-channel',
          how: 'The channel picker in the ConnectionsBand on the Organization tab. Connections tab of the profile popup (ConnectionsBand on the Organization tab for orgs). Backed by services connectionsHandlers.',
          surface: 'profile:connections',
        },
        note: 'PATCH case channel: chosen by the body field (channel).',
      },
    ],
    status: 'the organisation’s channel points at the chosen connection',
    risk: ['public'],
    confirm: { text: 'Post for {org} under {account}? Its posts go out there from now on.', status: 'draft', wave: 2 },
    verified: '2026-11-16 read services connections.ts connectionsHandlers',
  },
  {
    id: 'disconnect-social-account',
    area: 'hub.profile',
    label: 'Disconnect a social account',
    does: 'Removes a stored connection, so nothing more can be posted through it.',
    class: 'person',
    actors: [
      "person",
      "member",
      "guide",
      "owner"
    ],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/center/connections/route.ts#DELETE',
        service: ['deleteConnection'],
        address: {
          app: 'arts-collective',
          path: '/hub/network',
          surface: 'profile:connections',
          anchor: 'disconnect-social-account',
          how: 'The remove control on a connection row in the Connections tab (services connectionsHandlers).',
        },
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/center/connections/route.ts#DELETE",
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
        "key": "api:apps/fourthwayBookreaders/src/app/api/center/connections/route.ts#DELETE",
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
        "key": "api:apps/sunjay/src/app/api/center/connections/route.ts#DELETE",
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
        "key": "api:apps/innergathering/src/app/api/center/connections/route.ts#DELETE",
        "service": [
          "@elkdonis/services#connectionsHandlers"
        ],
        "address": {
          "app": "innergathering",
          "path": "/center",
          "how": "the Disconnect button in the Connections tab (ConnectionsPanel.tsx)"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/center/connections/route.ts#DELETE",
        "service": [
          "(who = getViewer userId)",
          "@elkdonis/services#centerRoutes"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub",
          "how": "connections card (packages/services centerRoutes.connections)"
        }
      },
      {
        "key": "api:apps/ifac/src/app/api/center/connections/route.ts#DELETE",
        "service": [
          "(who = getViewer userId)",
          "@elkdonis/services#centerRoutes"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub",
          "how": "connections card (packages/services centerRoutes.connections)"
        }
      },
    ],
    entry: null,
    status: 'No connection row for the provider (listConnections)',
    risk: ['irreversible'],
    confirm: {
      text: 'Disconnect {account}? Scheduled posts to it stop until you connect it again.',
      status: 'draft',
      wave: 2,
    },
    open: 'Does disconnecting cancel scheduled deliveries, or do they fail later?',
    verified: '2026-11-16 read services connections.ts connectionsHandlers',
    drift: "Merged 2026-11-16 (consolidation 2): 7 rows, 7 apps (arts-collective, amrit-canada, fourthwayBookreaders, sunjay, innergathering, hidden-enneagram, ifac). Differences by app:\n- amrit-canada (was amrit-social-disconnect): Same mount of connectionsHandlers as arts-collective.hub:disconnect-social-account, no real drift: the route is 14 lines in every app. Same file in sunjay (apps.sunjay.*.ts: disconnect-social-account); byte-identical bar log prefixes.\n- fourthwayBookreaders (was fourthway-social-disconnect): Same 14-line mount of connectionsHandlers as connect-social-account and the arts-collective rows; no real drift (here it serves YouTube for the Akhand Path).\n- sunjay (was sunjay-social-disconnect): Same mount of connectionsHandlers as arts-collective.hub:disconnect-social-account, no real drift: the route is 14 lines in every app. Same file in amrit-canada (apps.amrit-canada.*.ts: disconnect-social-account); byte-identical bar log prefixes.\n- innergathering (was ig-connection-remove): same mount.\n- hidden-enneagram (was he-social-disconnect): Identical to ifac-social-disconnect.\n- ifac (was ifac-social-disconnect): Copy of arts-collective disconnect-social-account.\namrit-canada is the oldest site and much of it is being left behind: do not let its shape become the canonical.",
    inputs: "id",
  },
  {
    id: 'create-pen-name',
    area: 'hub.profile',
    label: 'Create a pen name',
    does: 'Make a second public name the person can write and post under.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/hub/identities/route.ts#POST',
        service: ['createPseudonym'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization',
          surface: 'identities',
          anchor: 'create-pen-name',
          how: 'The identities popup (surface identities), opened from ConsoleFaces.tsx; limit MAX_PSEUDONYMS.',
        },
      },
    ],
    entry: null,
    status: 'A pseudonym identity exists for the person (listActingIdentities)',
    risk: ['public'],
    confirm: { text: 'Create the pen name “{name}”? It gets its own public page at {where}.', status: 'draft', wave: 2 },
    inputs: 'displayName, slug, label',
    verified: '2026-11-16 read app/api/hub/identities/route.ts',
  },
  {
    id: 'retire-pen-name',
    area: 'hub.profile',
    label: 'Retire a pen name',
    does: 'Hides a pen name: its page and byline.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/hub/identities/route.ts#PATCH',
        case: 'retire',
        service: ['retirePseudonym'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization',
          anchor: 'retire-pen-name',
          how: 'The retire control beside each name in the identities popup.',
          surface: 'identities',
        },
        note: 'PATCH case retire: body retired is true.',
      },
    ],
    entry: null,
    status: 'pseudonym retired_at is set',
    risk: ['public'],
    confirm: {
      text: 'Retire the pen name “{name}”? Its page and byline are hidden. You can bring it back later.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read app/api/hub/identities/route.ts',
  },
  {
    id: 'restore-pen-name',
    area: 'hub.profile',
    label: 'Bring back a pen name',
    does: 'Restores a pen name that was retired.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/hub/identities/route.ts#PATCH',
        case: 'restore',
        service: ['restorePseudonym'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization',
          anchor: 'restore-pen-name',
          how: 'The restore control beside a retired name in the identities popup.',
          surface: 'identities',
        },
        note: 'PATCH case restore: body retired is not true.',
      },
    ],
    entry: null,
    status: 'pseudonym retired_at is null',
    risk: ['public'],
    confirm: { text: 'Bring back the pen name “{name}”? Its page and byline show again.', status: 'draft', wave: 2 },
    verified: '2026-11-16 read app/api/hub/identities/route.ts',
  },
  // ---------------- hub.org ----------------
  {
    id: 'join-organisation',
    area: 'hub.org',
    label: 'Join an organisation',
    does: 'Adds the signed-in person to an organisation as a viewer.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/join/route.ts#POST',
        service: [],
        address: {
          app: 'arts-collective',
          path: '/login?mode=signup',
          anchor: 'join-organisation',
          how: 'The join call made by components/login-form.tsx during sign-up (no standalone button found).',
        },
        note: 'Raw INSERT into user_organizations; no service call.',
      },
      {
        key: 'sql:apps/arts-collective/src/app/api/org/join/route.ts#POST',
        note: 'sql twin of the POST above',
      },
    ],
    entry: null,
    status: 'user_organizations row exists for the person and org',
    risk: ['none'],
    confirm: { text: 'Join {org}? You are added as a follower and can see what it shares.', status: 'draft', wave: 2 },
    inputs: 'slug',
    drift: 'Raw SQL in the route; the role writer elsewhere is services setOrgRole.',
    canonical: 'services setOrgRole(userId, orgId, "viewer") behind a joinOrg service',
    open: 'No visible button on the hub; callers are login-form.tsx, pureland.ts and email-suite.ts. Is it person-facing at all, or only part of sign-up? (I kept it person.) Security finding 3 (docs/open/mcp-foundations/ATLAS_SECURITY_2026-11-16.md): any signed-in person can join any org by slug with no approval.',
    verified: '2026-11-16 read app/api/org/join/route.ts',
  },
  {
    id: 'confirm-org-address',
    area: 'hub.org',
    label: "Confirm an organisation's address",
    does: "A network admin approves an organisation's subdomain so its site goes live.",
    class: 'admin',
    actors: ['admin'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/admin/orgs/[slug]/confirm/route.ts#POST',
        service: [],
        address: {
          app: 'arts-collective',
          path: '/hub/admin',
          how: 'The Confirm button (components/hub/ConfirmOrgButton.tsx) beside an unconfirmed org on the admin page.',
        },
      },
      { key: 'sql:apps/arts-collective/src/app/api/admin/orgs/[slug]/confirm/route.ts#POST', note: 'sql twin' },
    ],
    entry: 'org-site',
    status: 'organizations.subdomain_confirmed is true',
    risk: ['public'],
    verified: '2026-11-16 read app/api/admin/orgs/[slug]/confirm/route.ts',
  },
  {
    id: 'follow-organisation',
    updated: '2026-11-16',
    area: 'hub.org',
    label: 'Follow an organisation',
    does: 'Signed-in person follows an organisation to see its news.',
    class: 'person',
    actors: ['person'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/[slug]/follow/route.ts#POST',
        service: ['followOrg'],
        address: {
          app: 'arts-collective',
          path: '/sites/{org}',
          anchor: 'follow-organisation',
          how: "The Follow button on an organisation's site.",
        },
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/center/follow/route.ts#POST",
        "service": [
          "@elkdonis/services#followOrg"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/center",
          "how": "the Follow button on /center (cms-ui center host-links followEndpoint /api/center/follow)"
        }
      },
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/center/follow/route.ts#POST",
        "service": [
          "@elkdonis/services#followOrg"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/center",
          "how": "the Follow button on /center (cms-ui followEndpoint)"
        }
      },
      {
        "key": "api:apps/sunjay/src/app/api/center/follow/route.ts#POST",
        "service": [
          "@elkdonis/services#followOrg"
        ],
        "address": {
          "app": "sunjay",
          "path": "/center",
          "how": "the Follow button on /center (cms-ui center host-links followEndpoint /api/center/follow)"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/center/follow/route.ts#POST",
        "service": [
          "(getViewer; no-op if the person already has a role)",
          "@elkdonis/services#followOrg"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/",
          "how": "Follow button in the site chrome (center surface)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/center/follow/route.ts#POST",
        "service": [
          "@elkdonis/services#followOrg"
        ],
        "address": {
          "app": "innergathering",
          "path": "/center",
          "how": "the Follow button on the center (packages/cms-ui/src/center/host-links.ts names the route)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/center/follow/route.ts#POST",
        "service": [
          "@elkdonis/services#followOrg"
        ],
        "address": {
          "app": "elktours",
          "path": "/center",
          "how": "the Follow button (cms-ui center FollowButton; also reviews-section.tsx and places/visitor-suggest.tsx call it before posting)"
        }
      },
      {
        "key": "api:apps/elktours/src/app/api/center/follow/route.ts#DELETE",
        "service": [
          "@elkdonis/services#unfollowOrg"
        ],
        "address": {
          "app": "elktours",
          "path": "/center",
          "how": "the Following button on the Center (cms-ui center FollowButton)"
        }
      },
    ],
    entry: null,
    status: 'org follow row exists (followOrg / getOrgFollowerCount)',
    risk: ['none'],
    confirm: { text: 'Follow {org}? You will see what it publishes.', status: 'draft', wave: 2 },
    open: "Which component renders the Follow button was not traced (route only); `how` is approximate.\namrit-canada (amrit-follow-org): SECURITY: Security #2 chain. One POST here (route.ts:15-21) turns any signed-in person into a viewer row, and lib/writing-room-actions.ts:43 plus app/write/page.tsx:20 treat any viewer (isAffiliate) as allowed to publish writing under the org. Every other member-only surface of this app (hub documents, ideas, whiteboard, chat, pipeline) uses getApiMember = member or above and refuses a viewer; the writing room is the outlier that contradicts the viewer-is-a-follower rule in lib/auth.ts:27-31.\nfourthwayBookreaders (fourthway-follow-org): A follower row gives circle access here (getApiAffiliate): one tap on /api/center/follow is enough to join the circle discussion. Intended (owner 2026-09-26).\nelktours (elktours-center-follow): Good: POST returns early if the person already has any role; DELETE refuses members.",
    verified: '2026-11-16 read app/api/org/[slug]/follow/route.ts',
    drift: "Merged 2026-11-16 (consolidation 2): 7 rows, 7 apps (arts-collective, amrit-canada, fourthwayBookreaders, sunjay, hidden-enneagram, innergathering, elktours). Differences by app:\n- amrit-canada (was amrit-follow-org): Different route from arts-collective.hub:follow-organisation (network host takes the org slug in the path; this one is bound to the site's org). Same file in sunjay (apps.sunjay.*.ts: follow-organisation); byte-identical bar log prefixes.\n- fourthwayBookreaders (was fourthway-follow-org): Byte-identical to follow-organisation and follow-organisation (diff of the files).\n- sunjay (was sunjay-follow-org): Different route from arts-collective.hub:follow-organisation (network host takes the org slug in the path; this one is bound to the site's org). Same file in amrit-canada (apps.amrit-canada.*.ts: follow-organisation); byte-identical bar log prefixes.\n- hidden-enneagram (was he-site-follow): this one always targets the site's own org and returns early for anyone who already has a role.\n- innergathering (was ig-org-follow): same capability as arts-collective.hub.ts:follow-organisation (api/org/[slug]/follow); differs: this route is single-org (siteConfig.orgId, no slug) and returns the role.\n- elktours (was elktours-center-follow): Single copy here; other org apps carry their own follow control (not claimed by this curator).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    inputs: "(none)",
  },
  {
    id: 'unfollow-organisation',
    updated: '2026-11-16',
    area: 'hub.org',
    label: 'Stop following an organisation',
    does: "Removes the person's follow of an organisation.",
    class: 'person',
    actors: ['person'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/[slug]/follow/route.ts#DELETE',
        service: ['unfollowOrg'],
        address: {
          app: 'arts-collective',
          path: '/sites/{org}',
          anchor: 'unfollow-organisation',
          how: "The Following button on an organisation's site.",
        },
      },
      {
        "key": "api:apps/amrit-canada/src/app/api/center/follow/route.ts#DELETE",
        "service": [
          "@elkdonis/services#unfollowOrg"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/center",
          "how": "the Following button on /center"
        }
      },
      {
        "key": "api:apps/fourthwayBookreaders/src/app/api/center/follow/route.ts#DELETE",
        "service": [
          "@elkdonis/services#unfollowOrg"
        ],
        "address": {
          "app": "fourthwayBookreaders",
          "path": "/center",
          "how": "the Following button on /center"
        }
      },
      {
        "key": "api:apps/sunjay/src/app/api/center/follow/route.ts#DELETE",
        "service": [
          "@elkdonis/services#unfollowOrg"
        ],
        "address": {
          "app": "sunjay",
          "path": "/center",
          "how": "the Following button on /center"
        }
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/center/follow/route.ts#DELETE",
        "service": [
          "(getViewer; refuses members: leave from the hub)",
          "@elkdonis/services#unfollowOrg"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/",
          "how": "Following button in the site chrome (center surface)"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/center/follow/route.ts#DELETE",
        "service": [
          "@elkdonis/services#unfollowOrg"
        ],
        "address": {
          "app": "innergathering",
          "path": "/center",
          "how": "the Following button on the center (host-links.ts names the route)"
        }
      },
    ],
    entry: null,
    status: 'no follow row for the person and org',
    risk: ['none'],
    confirm: { text: 'Stop following {org}? You will no longer see what it publishes.', status: 'draft', wave: 2 },
    verified: '2026-11-16 read app/api/org/[slug]/follow/route.ts',
    drift: "Merged 2026-11-16 (consolidation 2): 6 rows, 6 apps (arts-collective, amrit-canada, fourthwayBookreaders, sunjay, hidden-enneagram, innergathering). Differences by app:\n- amrit-canada (was amrit-unfollow-org): Different route from arts-collective.hub:unfollow-organisation. Same file in sunjay (apps.sunjay.*.ts: unfollow-organisation); byte-identical bar log prefixes.\n- fourthwayBookreaders (was fourthway-unfollow-org): Byte-identical to sunjay-unfollow-org.\n- sunjay (was sunjay-unfollow-org): Different route from arts-collective.hub:unfollow-organisation. Same file in amrit-canada (apps.amrit-canada.*.ts: unfollow-organisation); byte-identical bar log prefixes.\n- hidden-enneagram (was he-site-unfollow): Copy of arts-collective unfollow-organisation.\n- innergathering (was ig-org-unfollow): same capability as arts-collective.hub.ts:unfollow-organisation; differs: single-org route with the viewer-only guard written in the route.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    inputs: "(none)",
  },
  {
    id: 'send-org-contact-message',
    area: 'hub.org',
    label: 'Send a contact form message to an organisation',
    does: "A visitor's contact form on a designed site is delivered to the organisation.",
    class: "person",
    actors: ['visitor'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/[slug]/contact/route.ts#POST',
        service: ['handleOrgContact'],
      },
      {
        "key": "api:apps/elkdonis-arts-collective/src/app/api/contact/route.ts#POST",
        "service": [
          "(raw INSERT contacts)",
          "@elkdonis/email#sendContactNotification"
        ],
        "address": {
          "app": "elkdonis-arts-collective",
          "path": "/",
          "how": "the Contact form (components/ContactForm.tsx) and the footer sign-up box (components/Footer.tsx)"
        },
        "note": "Public; email format check only."
      },
      {
        "key": "sql:apps/elkdonis-arts-collective/src/app/api/contact/route.ts#POST",
        "note": "sql twin of api:apps/elkdonis-arts-collective/src/app/api/contact/route.ts#POST"
      },
      {
        "key": "api:apps/hidden-enneagram/src/app/api/org/[slug]/contact/route.ts#POST",
        "service": [
          "(no auth)",
          "(delegates to lib/contact handleContact)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/contact",
          "how": "contact form (components/contact/contact-form.tsx)"
        }
      },
      {
        "key": "sql:apps/hidden-enneagram/src/lib/contact.ts#handleContact",
        "service": [
          "(raw INSERT INTO contacts; sendContactNotification to the owner)"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/contact",
          "how": "same form"
        },
        "note": "the sql write inside handleContact"
      },
      {
        "key": "api:apps/danamccool/src/app/api/contact/route.ts#POST",
        "service": [
          "(no auth)",
          "(honeypot field company)",
          "(redis rate limit, 6 per hour per IP, fails open)",
          "(raw INSERT INTO contacts for danamccool)"
        ],
        "address": {
          "app": "danamccool",
          "path": "/contact",
          "how": "contact form on the site (public page)"
        }
      },
      {
        "key": "sql:apps/danamccool/src/app/api/contact/route.ts#POST",
        "note": "sql twin of api:apps/danamccool/src/app/api/contact/route.ts#POST"
      },
      {
        "key": "api:apps/innergathering/src/app/api/contact/route.ts#POST",
        "service": [
          "(raw SQL INSERT into contacts)",
          "@elkdonis/email#sendContactNotification"
        ],
        "address": {
          "app": "innergathering",
          "path": "/",
          "how": "the contact form of the landing page and footer (components/site-footer.tsx; packages/blocks/src/blocks/contact-form.client.tsx)"
        }
      },
      {
        "key": "sql:apps/innergathering/src/app/api/contact/route.ts#POST",
        "service": [
          "(raw SQL in the same function)"
        ],
        "note": "sql twin of api:apps/innergathering/src/app/api/contact/route.ts#POST"
      },
    ],
    risk: ['emails'],
    open: "Visitor-facing form on Silex-designed sites, not a rail step.\nelkdonis-arts-collective (eac-site-contact-send): SECURITY: contact/route.ts:5-61 is public with no rate limit, no honeypot and unbounded name and message; each post emails EAC_OWNER_EMAIL (default info@elkdonis-arts.org), so it is a free spam and mail-flood route. The visitor-typed name and email go into the notification (escaping is in sendContactNotification, not read).\nhidden-enneagram (he-org-contact-send): SECURITY: apps/hidden-enneagram/src/lib/contact.ts:50 (orgBySlug from the URL slug) unauthenticated; the org comes from the URL slug, so anyone can POST here to write a contacts row for, and trigger an owner email at, any organisation; no honeypot, rate limit or length cap; a failed insert is swallowed and still returns 201 (lines 88 and 107).\ndanamccool (dana-contact-send): SECURITY: apps/danamccool/src/app/api/contact/route.ts:41-50 and 82 the rate-limit key uses the first x-forwarded-for hop (client-controlled if the proxy appends rather than replaces) and fails open when redis is down; both weaken the limit, neither is a write beyond this org's own contacts table.\ninnergathering (ig-contact-send): SECURITY (mild): public route, no rate limit, captcha or length cap on name or message (contact/route.ts:12-24); each call writes a row and sends one email to the notify address. Only the notify address receives mail, so it is a flood risk rather than a relay.",
    verified: '2026-11-16 read app/api/org/[slug]/contact/route.ts',
    drift: "Merged 2026-11-16 (consolidation 2): 5 rows, 5 apps (arts-collective, elkdonis-arts-collective, hidden-enneagram, danamccool, innergathering). Differences by app:\n- elkdonis-arts-collective (was eac-site-contact-send): org fixed to elkdonis, no honeypot, no rate limit, no length caps (apps/danamccool has all three). The shared handler is packages/silex-render handleOrgContact.\n- hidden-enneagram (was he-org-contact-send): the danamccool contact route pins its org, has a honeypot and a redis rate limit.\n- danamccool (was dana-contact-send): Better than the other copies: pinned to this site org, honeypot, per-IP rate limit, max lengths, email format check. Copy of arts-collective send-org-contact-message and hidden-enneagram send-org-contact-message (which serves any slug, no limits and sends the owner an email); this one notifies nobody.\n- innergathering (was ig-contact-send): Related to arts-collective.hub.ts:send-org-contact-message (api/org/[slug]/contact); differs: single org, raw SQL insert, no spam control seen in either. danamccool, elkdonis-arts-collective and inner-gathering have a contact route too (not diffed).\nRelated: pkg-silex-render-org-contact backs the eac-site host.",
    confirm: {
      "text": "Send your message to the Elkdonis collective? They get it by email and can write back to {email}.",
      "status": "draft",
      "wave": 6
    },
    status: "a contacts row for org elkdonis with source landing-page exists",
    inputs: "name, email, message",
  },
  {
    id: 'save-org-identity',
    area: 'hub.org',
    label: "Save the organisation's identity",
    does: "Change an organisation's name, line, bio, photo and place as the network shows them.",
    class: 'person',
    actors: ['owner', 'guide', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/org-identity-actions.ts#saveOrgIdentityAction',
        service: ['canEditOrgIdentity', 'updateProfile'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          anchor: 'save-org-identity',
          how: 'Settings (SettingsButton.tsx) > Identity section, the Save button in components/hub/OrgIdentityPanel.tsx.',
        },
        note: 'Also writes organizations.name with raw SQL.',
      },
      {
        key: 'sql:apps/arts-collective/src/lib/org-identity-actions.ts#saveOrgIdentityAction',
        note: 'sql twin',
      },
    ],
    entry: 'org-details',
    status: 'org-details',
    risk: ['public'],
    confirm: {
      text: 'Save {org}’s identity? Its name, line and bio change on the network and on its site.',
      status: 'draft',
      wave: 1,
    },
    inputs: 'displayName, headline, bio, avatarUrl, city, region, country',
    drift: 'Four writers of the same row: this action; api/center/profile PATCH ?org=; registry org-details (headline/bio only); hub entry site-identity-save (name, line, place, kinds). All call updateProfile + canEditOrgIdentity.',
    canonical: 'one identity-save service wrapping canEditOrgIdentity + updateProfile + the organizations.name sync',
    open: 'Registry org-details covers 2 of 7 fields; extend it or add a second entry?',
    verified: '2026-11-16 read lib/org-identity-actions.ts, run.ts, sb-runners.ts',
  },
  {
    id: 'remove-person-from-org',
    area: 'hub.org',
    label: 'Remove someone from the organisation',
    does: 'Takes a person out of an organisation. Their account stays.',
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/[slug]/members/[userId]/route.ts#DELETE',
        service: ['removeOrgMember'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          anchor: 'remove-person-from-org',
          how: 'People surface "Roles & removal" (ConsoleSurfaces.tsx PeopleSurface); control not traced to the exact button.',
        },
      },
      {
        key: 'sa:apps/arts-collective/src/app/sites/[slug]/hub/actions.ts#runTenantHubAction',
        case: 'org-person-remove',
        service: ['performHubAction'],
        address: {
          app: 'arts-collective',
          path: '/sites/{org}/hub',
          anchor: 'remove-person-from-org',
          how: 'The remove control on the People card of the organisation’s own site hub (members PeopleTab).',
        },
        note: 'Tenant hub door, case org-person-remove; the same service as the other host.',
      },
    ],
    entry: 'org-person-remove',
    status: 'no user_organizations row for the person and org',
    risk: ['irreversible', 'others'],
    confirm: {
      text: 'Remove {person} from {org}? They lose access to its members area, but their account stays.',
      status: 'draft',
      wave: 1,
    },
    drift: 'Route uses removeOrgMember; hub entry org-person-remove uses removeOrgPerson (also unlists and queues a storage sync).',
    canonical: 'services removeOrgPerson',
    open: 'Does the route also unlist and revoke shared-storage access? The entry says it does; the route does not.',
    verified: '2026-11-16 read api/org/[slug]/members, hub-runners.ts',
  },
  {
    id: 'answer-listing-request',
    area: 'hub.org',
    label: 'Answer a request to be listed',
    does: "An owner or guide approves or declines a member who asked to be shown again on the organisation's people list.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/hub/(tabs)/organization/listing-actions.ts#decideListingRequestAction',
        service: ['decideListingRequest'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          anchor: 'answer-listing-request',
          how: 'Approve / Decline in ListingRequestsPanel.tsx (cms-ui center ListingRequests) on the Organization tab.',
        },
      },
    ],
    entry: null,
    status: 'org_listing_requests row is no longer pending',
    risk: ['others', 'public'],
    confirm: {
      text: 'Answer {person}’s request to be listed on {org}? If you approve, they show on its public people list.',
      status: 'draft',
      wave: 2,
    },
    open: 'Different from hub entries listing-approve/decline (posts from other sites). Name clash worth fixing.',
    verified: '2026-11-16 read listing-actions.ts, services presence.ts decideListingRequest',
  },
  {
    id: 'welcome-arrival',
    area: 'hub.org',
    label: 'Welcome someone who arrived from another site',
    does: 'Gives a signed-in arrival from another network site a role here (owners pick viewer, member or guide; guides welcome as viewer). They join unlisted and a storage sync is queued.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/sites/[slug]/hub/actions.ts#runTenantHubAction',
        case: 'org-arrival-welcome',
        service: ['performHubAction'],
        address: {
          app: 'arts-collective',
          path: '/sites/{org}/hub',
          anchor: 'welcome-arrival',
          how: 'The Welcome control on the Arrivals tab of the Members card (members ArrivalsTab).',
        },
        note: 'Tenant hub door, case org-arrival-welcome.',
      },
    ],
    entry: 'org-arrival-welcome',
    status: 'the arrival is off the arrivals queue and the person has a role in the organisation',
    risk: ['others'],
    confirm: {
      text: 'Welcome {person} to {org} as {role}? They join unlisted and can do what that role allows.',
      status: 'draft',
      wave: 1,
    },
    drift: 'Appears only through the tenant hub door; no other app-level host.',
    canonical: 'services welcomeOrgArrival',
    verified: '2026-11-16 read app/sites/[slug]/hub/actions.ts, packages/actions hub.ts, hub-runners.ts, review-runners.ts',
  },
  {
    id: 'dismiss-arrival',
    area: 'hub.org',
    label: 'Dismiss someone who arrived from another site',
    does: 'Takes an arrival off the arrivals queue without giving a role (owners and guides).',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/sites/[slug]/hub/actions.ts#runTenantHubAction',
        case: 'org-arrival-dismiss',
        service: ['performHubAction'],
        address: {
          app: 'arts-collective',
          path: '/sites/{org}/hub',
          anchor: 'dismiss-arrival',
          how: 'The Dismiss control on the Arrivals tab of the Members card (members ArrivalsTab).',
        },
        note: 'Tenant hub door, case org-arrival-dismiss.',
      },
    ],
    entry: 'org-arrival-dismiss',
    status: 'the arrival is no longer on the arrivals queue',
    risk: ['none'],
    confirm: {
      text: 'Dismiss {person} from the arrivals list of {org}? They get no role here.',
      status: 'draft',
      wave: 1,
    },
    canonical: 'services dismissOrgArrival',
    open: 'Needs migration 258 in production.',
    verified: '2026-11-16 read app/sites/[slug]/hub/actions.ts, packages/actions hub.ts, hub-runners.ts, review-runners.ts',
  },
  {
    id: 'approve-post-from-other-site',
    area: 'hub.org',
    label: 'Show a post from another site',
    does: 'Lets a post from another network site that asked to show here appear on this site too (owners and guides).',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/sites/[slug]/hub/actions.ts#runTenantHubAction',
        case: 'listing-approve',
        service: ['performHubAction'],
        address: {
          app: 'arts-collective',
          path: '/sites/{org}/hub',
          anchor: 'approve-post-from-other-site',
          how: 'Approve on a request in the Review queue card (packages/hub review ReviewQueue).',
        },
        note: 'Tenant hub door, case listing-approve.',
      },
    ],
    entry: 'listing-approve',
    status: 'the post’s listing for this organisation is approved',
    risk: ['public'],
    confirm: {
      text: 'Show “{title}” from another site on {org}’s site? Visitors to {org} can then read it.',
      status: 'draft',
      wave: 1,
    },
    drift: 'Org side of choose-sites-for-post (the poster’s side). Not the same as answer-listing-request (people list).',
    canonical: 'services reviewListing',
    verified: '2026-11-16 read app/sites/[slug]/hub/actions.ts, packages/actions hub.ts, hub-runners.ts, review-runners.ts',
  },
  {
    id: 'decline-post-from-other-site',
    area: 'hub.org',
    label: 'Turn down a post from another site',
    does: 'Keeps a post from another network site off this site. Asking again puts it back in the queue.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/sites/[slug]/hub/actions.ts#runTenantHubAction',
        case: 'listing-decline',
        service: ['performHubAction'],
        address: {
          app: 'arts-collective',
          path: '/sites/{org}/hub',
          anchor: 'decline-post-from-other-site',
          how: 'Decline on a request in the Review queue card (review ReviewQueue).',
        },
        note: 'Tenant hub door, case listing-decline.',
      },
    ],
    entry: 'listing-decline',
    status: 'the post’s listing for this organisation is declined',
    risk: ['none'],
    confirm: { text: 'Keep “{title}” off {org}’s site? Its author can ask again.', status: 'draft', wave: 1 },
    canonical: 'services reviewListing',
    verified: '2026-11-16 read app/sites/[slug]/hub/actions.ts, packages/actions hub.ts, hub-runners.ts, review-runners.ts',
  },
  {
    id: 'decide-submission',
    area: 'hub.org',
    label: 'Decide a member’s submission',
    does: 'Lets a member’s post or store panel through, or turns it down (owners and guides).',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/sites/[slug]/hub/actions.ts#runTenantHubAction',
        case: 'submission-review',
        service: ['performHubAction'],
        address: {
          app: 'arts-collective',
          path: '/sites/{org}/hub',
          anchor: 'decide-submission',
          how: 'Approve or Decline on a submission in the Review queue card (review ReviewQueue).',
        },
        note: 'Tenant hub door, case submission-review.',
      },
    ],
    entry: 'submission-review',
    status: 'the submission is no longer waiting for review',
    risk: ['public'],
    confirm: {
      text: 'Mark “{title}” as {state} on {org}’s site? If it is approved, visitors to {org} can see it.',
      status: 'draft',
      wave: 1,
    },
    canonical: 'services reviewThread / reviewUserPage',
    verified: '2026-11-16 read app/sites/[slug]/hub/actions.ts, packages/actions hub.ts, hub-runners.ts, review-runners.ts',
  },
  {
    id: 'switch-submission-review',
    area: 'hub.org',
    label: 'Hold members’ submissions for a look',
    does: 'Sets whether members’ posts wait for a look first, and whether members’ store panels are hosted.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/sites/[slug]/hub/actions.ts#runTenantHubAction',
        case: 'review-switch',
        service: ['performHubAction'],
        address: {
          app: 'arts-collective',
          path: '/sites/{org}/hub',
          anchor: 'switch-submission-review',
          how: 'The review switches in the Review queue card (review card).',
        },
        note: 'Tenant hub door, case review-switch.',
      },
    ],
    entry: 'review-switch',
    status: 'organizations.member_posts_review / member_store_panels hold the chosen value',
    risk: ['public'],
    confirm: {
      text: 'Turn the check on members’ {what} {state} for {org}? While it is on, their {what} wait for your look before showing.',
      status: 'draft',
      wave: 1,
    },
    canonical: 'services setOrgReview / setOrgStorePanels',
    verified: '2026-11-16 read app/sites/[slug]/hub/actions.ts, packages/actions hub.ts, hub-runners.ts, review-runners.ts',
  },
  // ---------------- hub.content ----------------
  {
    id: 'create-content',
    area: 'hub.content',
    label: 'Create a post, event, meeting or workshop',
    does: "Make a new piece of content on an organisation's site, as a draft or published at once.",
    class: 'person',
    actors: [
      "owner",
      "guide",
      "member"
    ],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/cms/actions.ts#createThreadAction',
        service: ['ensureUniqueThreadSlug', 'resolveActor', 'replaceWorkshopSessions'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          surface: 'compose',
          anchor: 'create-content',
          how: 'Create button on the Organization tab (components/cms/create-content-dialog.tsx, org-compose.tsx); surface compose:{kind}.',
        },
        note: 'Raw INSERT INTO threads; may create a Nextcloud Talk room.',
      },
      { key: 'sql:apps/arts-collective/src/lib/cms/actions.ts#createThreadAction', note: 'sql twin' },
      {
        "key": "sa:apps/sunjay/src/lib/forms/post-actions.ts#sitePostSaveAction",
        "service": [
          "@elkdonis/services#savePostContent",
          "@elkdonis/site-forms/server#siteOrg"
        ],
        "address": {
          "app": "sunjay",
          "path": "/hub?surface=compose:article",
          "how": "compose:article pop-up Save / Publish"
        }
      },
      {
        "key": "sa:apps/amrit-canada/src/lib/forms/meeting-actions.ts#sitePostSaveAction",
        "service": [
          "@elkdonis/services#savePostContent",
          "@elkdonis/site-forms/server#siteOrg"
        ],
        "address": {
          "app": "amrit-canada",
          "path": "/hub?surface=compose:article",
          "how": "compose:article pop-up"
        },
        "note": "lives in meeting-actions.ts, not a post file"
      },
      {
        "key": "sa:apps/elktours/src/lib/forms/meeting-actions.ts#sitePostSaveAction",
        "service": [
          "@elkdonis/services#savePostContent",
          "@elkdonis/site-forms/server#siteOrg"
        ],
        "address": {
          "app": "elktours",
          "path": "/hub?surface=compose:article",
          "how": "compose:article pop-up"
        }
      },
      {
        "key": "sa:apps/ifac/src/lib/forms/meeting-actions.ts#sitePostSaveAction",
        "service": [
          "@elkdonis/services#savePostContent",
          "@elkdonis/site-forms/server#siteOrg"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/compose",
          "how": "compose:article pop-up / /hub/compose page"
        },
        "note": "passes membersMayPost:true"
      },
      {
        "key": "sa:apps/innergathering/src/lib/forms/meeting-actions.ts#sitePostSaveAction",
        "service": [
          "@elkdonis/services#savePostContent",
          "@elkdonis/site-forms/server#siteOrg"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub?surface=compose:article",
          "how": "compose:article pop-up"
        }
      },
      {
        "key": "sa:apps/hidden-enneagram/src/lib/forms/actions.ts#sitePostSaveAction",
        "service": [
          "(getViewer: any signed-in person; rule inside services)",
          "@elkdonis/services#savePostContent",
          "@elkdonis/site-forms/server#siteOrg"
        ],
        "address": {
          "app": "hidden-enneagram",
          "path": "/hub?surface=compose:post",
          "how": "Save and Publish in lib/forms/site.tsx (the site compose pop-ups, packages/studio-forms)"
        }
      },
    ],
    entry: 'org-publish',
    status: 'org-publish',
    risk: ['public'],
    confirm: {
      text: 'Create the {kind} “{title}” on {org}’s site? If you publish it now, visitors can see it at once.',
      status: 'draft',
      wave: 1,
    },
    inputs: 'kind, title, body, status, visibility, schedule',
    drift: "Registry org-publish saves a draft through services createThread; this action inserts raw SQL and can publish at once; center/post goes through createPostAnywhere.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (arts-collective, sunjay, hidden-enneagram). Differences by app:\n- sunjay (was post-save): Five copies, two shapes. amrit-canada and elktours are identical logic. sunjay's file is separate (post-actions.ts) and its context action requires viewer.canEdit with the message 'Only an owner or guide of this site can post here'. ifac is the odd one: ANY member (not only owner/guide) may post (membersMayPost:true, owner's call 2026-09-19), canSetVisibility only for editors, href via threadHref, revalidates /hub,/,/forum. innergathering adds workshop in the same file and starts members-only. In all five the action-layer gate for SAVE is 'signed in' only; services savePostContent enforces owner/guide (or members when membersMayPost) with 'Only an owner or guide of this organisation can post here'.\n- hidden-enneagram (was he-post-save): hidden-enneagram has its own lib/forms/actions.ts holding post and service forms in one file. Action layer needs only a session (no canEdit); who may post is decided in services savePostContent.\nDirection (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.",
    canonical: 'services savePostContent via one shared org-site kit action; membersMayPost and href/revalidate supplied from the per-site config.',
    open: "Registry entry only saves a draft with plain text; the app does far more.\nsunjay (post-save): Confirm services savePostContent is the sole gate (site-post-content.ts ~line 269): the action itself lets any signed-in user reach it in 4 of 5 copies. Should ifac keep members posting, or move to owner/guide like the others?",
    verified: '2026-11-16 read lib/cms/actions.ts, run.ts',
  },
  {
    id: 'publish-draft-post',
    area: 'hub.content',
    label: 'Publish a draft',
    does: "Puts a draft post live on the organisation's site.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'thread',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/cms/draft-actions.ts#publishDraftAction',
        service: ['ensureUniqueThreadSlug'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          anchor: 'publish-draft-post',
          how: 'The Publish button on a draft in the Unfinished band (components/hub/console/ConsoleSurfaces.tsx DraftsSurface).',
        },
      },
      { key: 'sql:apps/arts-collective/src/lib/cms/draft-actions.ts#publishDraftAction', note: 'sql twin' },
    ],
    entry: 'thread-publish',
    status: 'thread-publish',
    risk: ['public'],
    confirm: { text: 'Publish “{title}” on {org}’s site? Visitors will see it.', status: 'draft', wave: 1 },
    drift: 'Registry thread-publish: services updatePost(status published). This: raw UPDATE. Draft-only both.',
    canonical: 'services updatePost',
    verified: '2026-11-16 read lib/cms/draft-actions.ts, run.ts',
  },
  {
    id: 'lead-site-with-post',
    area: 'hub.content',
    label: 'Lead the site with a post',
    does: "Pins or unpins a published public post so it leads the organisation's site (one at a time).",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'thread',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/cms/actions.ts#togglePinAction',
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          surface: 'thread:{id}',
          anchor: 'lead-site-with-post',
          how: '"Lead the site with this" in the post popup (OrgConsoleHost.tsx threadActions; components/cms/pin-toggle.tsx).',
        },
      },
      { key: 'sql:apps/arts-collective/src/lib/cms/actions.ts#togglePinAction', note: 'sql twin' },
    ],
    entry: 'thread-pin',
    status: 'thread-pin',
    risk: ['public'],
    confirm: {
      text: 'Change whether “{title}” leads {org}’s site? A leading post replaces whatever leads now.',
      status: 'draft',
      wave: 1,
    },
    drift: 'Registry thread-pin runs its own raw transaction; togglePinAction runs another. The action toggles blindly and does not require published+public; the registry runner does.',
    canonical: 'registry thread-pin rules in one service',
    verified: '2026-11-16 read lib/cms/actions.ts, run.ts',
  },
  {
    id: 'edit-workshop-live',
    area: 'hub.content',
    label: 'Edit a workshop field in place',
    does: 'Change one field (or the page look) of an existing workshop from the live editor.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'thread',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/cms/actions.ts#updateWorkshopFieldByTraitAction',
        service: ['fieldRegistry'],
        address: {
          app: 'arts-collective',
          path: '/sites/{org}/{post}',
          anchor: 'edit-workshop-live',
          how: 'Inline editing in components/WorkshopLiveEditor.tsx.',
        },
      },
      {
        key: 'sa:apps/arts-collective/src/lib/cms/actions.ts#updateWorkshopFieldAction',
        note: 'The by-trait action calls this one.',
      },
      { key: 'sql:apps/arts-collective/src/lib/cms/actions.ts#updateWorkshopFieldAction', note: 'sql twin' },
      {
        key: 'sa:apps/arts-collective/src/lib/cms/actions.ts#updateWorkshopThemeAction',
        note: 'Page colour overrides from the same editor.',
      },
      { key: 'sql:apps/arts-collective/src/lib/cms/actions.ts#updateWorkshopThemeAction', note: 'sql twin' },
    ],
    entry: null,
    status: 'unverifiable: one field of many; no single done state',
    risk: ['public'],
    confirm: {
      text: 'Change “{name}” on the workshop “{title}”? Visitors see the change at once.',
      status: 'draft',
      wave: 2,
    },
    open: 'Probably never a rail step. Reclassify internal?',
    verified: '2026-11-16 read lib/cms/actions.ts',
  },
  {
    id: 'publish-org-landing-page',
    area: 'hub.content',
    label: 'Publish the designed landing page',
    does: "Saves the page designed in the visual editor as the organisation's home page.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/puck/actions.ts#saveOrgHomeAction',
        service: ['canEditOrgSite'],
        address: {
          app: 'arts-collective',
          path: '/hub/sites/{org}/design',
          anchor: 'publish-org-landing-page',
          how: 'The Publish button of the page editor (components/studio/OrgPageEditor.tsx).',
        },
      },
    ],
    entry: null,
    status: 'org_home row exists for the org (puck store hasOrgHome)',
    risk: ['public'],
    confirm: {
      text: 'Publish this page as {org}’s home page? It replaces what visitors see at the site’s address.',
      status: 'draft',
      wave: 2,
    },
    open: 'Hub entry site-page-create is a different thing (extra pages) and is not mounted on arts-collective.',
    verified: '2026-11-16 read lib/puck/actions.ts',
  },
  {
    id: 'remove-org-landing-page',
    area: 'hub.content',
    label: 'Remove the designed landing page',
    does: 'Deletes the designed home page; the site goes back to its lead post or the default page.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/puck/actions.ts#removeOrgHomeAction',
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          anchor: 'remove-org-landing-page',
          how: 'The remove control under Settings > Site & address "Landing page" (ConsoleSettings.tsx).',
        },
      },
      {
        key: 'sql:apps/arts-collective/src/lib/puck/store.ts#deleteOrgHome',
        note: 'The raw DELETE this action reaches',
      },
    ],
    entry: null,
    status: 'no org_home row for the org',
    risk: ['irreversible', 'public'],
    confirm: {
      text: 'Remove {org}’s designed home page? Visitors see the default page instead. This cannot be undone.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read lib/puck/actions.ts',
  },
  {
    id: 'save-feed-card-design',
    area: 'hub.content',
    label: 'Save the feed card design',
    does: "Saves how an organisation's posts look as cards on its feed.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/cards/actions.ts#saveCardsAction',
        address: {
          app: 'arts-collective',
          path: '/hub/sites/{org}/cards',
          anchor: 'save-feed-card-design',
          how: 'The Save control of components/cards/CardsEditor.tsx.',
        },
      },
      { key: 'sql:apps/arts-collective/src/lib/cards/store.ts#saveCards', note: 'raw SQL under the action' },
    ],
    entry: null,
    status: 'cards row saved for the org',
    risk: ['public'],
    confirm: {
      text: 'Save the card design for {org}’s feed? Visitors see the new look straight away.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read lib/cards/actions.ts',
  },
  {
    id: 'save-classifieds-page',
    area: 'hub.content',
    label: 'Save the classifieds page',
    does: "Saves the layout and wording of an organisation's classifieds page.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/classifieds/actions.ts#saveClassifiedsAction',
        address: {
          app: 'arts-collective',
          path: '/hub/sites/{org}/classifieds',
          anchor: 'save-classifieds-page',
          how: 'The Save control of components/classifieds/ClassifiedsEditor.tsx.',
        },
      },
      {
        key: 'sql:apps/arts-collective/src/lib/classifieds/store.ts#saveClassifieds',
        note: 'raw SQL under the action',
      },
    ],
    entry: null,
    status: 'classifieds row saved for the org',
    risk: ['public'],
    confirm: { text: 'Save the classifieds page for {org}? Visitors see it straight away.', status: 'draft', wave: 2 },
    drift: 'Same shape as save-feed-card-design (twin editors, twin stores).',
    verified: '2026-11-16 read lib/classifieds/actions.ts',
  },
  // ---------------- hub.email ----------------
  {
    id: 'save-org-email-identity',
    area: 'hub.email',
    label: "Save the organisation's sending name and reply address",
    does: 'Sets the name mail is sent under, the reply-to, and whether replies come into the org inbox.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/[slug]/email/identity/route.ts#PATCH',
        service: ['saveOrgEmailIdentity'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          surface: 'custom:email',
          anchor: 'save-org-email-identity',
          how: 'The email popup (console tile; EmailSurface from cms-ui/email, Look tab).',
        },
      },
      {
        "key": "api:apps/ifac/src/app/api/hub/email/identity/route.ts#PATCH",
        "service": [
          "(getApiEditor: owner or guide)",
          "@elkdonis/email#saveOrgEmailIdentity",
          "@elkdonis/email#inboundAddressFor",
          "@elkdonis/email#inboundEnabled"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/email",
          "how": "Sender settings in the email surface (packages/cms-ui email/EmailSurface.tsx, TemplateWordsEditor.tsx; mounted at /manage/email and /hub/email/[key])"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/hub/email/identity/route.ts#PATCH",
        "service": [
          "@elkdonis/email#saveOrgEmailIdentity",
          "@elkdonis/email#inboundAddressFor"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/email",
          "how": "the identity form of the email suite (components/hub/email/use-email-connectors.ts (EmailPopup.tsx, hub/email/[key]/edit/page.tsx))"
        }
      },
    ],
    entry: 'org-email',
    status: 'org-email',
    risk: ['emails'],
    confirm: {
      text: 'Send {org}’s mail under the name “{name}”, with replies to {email}? Everyone who gets mail from {org} sees this.',
      status: 'draft',
      wave: 1,
    },
    drift: "Registry org-email runner calls saveOrgEmailIdentity (same service, fromEmail left out).\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (arts-collective, ifac, innergathering). Differences by app:\n- ifac (was ifac-email-identity-save): save-org-email-identity (entry org-email, canonical saveOrgEmailIdentity).\n- innergathering (was ig-email-identity-save): single-org route (siteConfig.orgId), gate getApiEditor instead of guardOrgEmailWrite(slug).\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    canonical: 'saveOrgEmailIdentity',
    open: "The custom email surface has no URL (custom surfaces serialise to null); path only.\nifac (ifac-email-identity-save): SECURITY: apps/ifac/src/app/api/hub/email/identity/route.ts:33-52 replyTo and ownerEmails are passed to saveOrgEmailIdentity as typed (any address); validation, if any, lives in the email package (not read).",
    verified: '2026-11-16 read api/org/[slug]/email/identity, run.ts',
    inputs: "fromName, replyTo, ownerEmails, palette, inboundReplies",
  },
  {
    id: 'save-email-template',
    area: 'hub.email',
    label: 'Save an email template',
    does: "Changes the wording of one of the organisation's standard emails.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/[slug]/email/template/[key]/route.ts#PUT',
        service: ['saveOrgTemplate'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          surface: 'custom:email',
          anchor: 'save-email-template',
          how: 'Letters / templates tab of the email popup (EmailSurface).',
        },
      },
      {
        "key": "api:apps/ifac/src/app/api/hub/email/[key]/route.ts#PUT",
        "service": [
          "(getApiEditor: owner or guide)",
          "@elkdonis/email#saveOrgTemplate",
          "(lib/series-letters-store saveSeriesLetter when the call is series-scoped)",
          "@elkdonis/utils#sanitizeRichText (bodyHtml and copyHtml only)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/email/{key}/edit",
          "how": "Save in the email surface (packages/cms-ui email/EmailSurface.tsx, TemplateWordsEditor.tsx; mounted at /manage/email and /hub/email/[key])"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/hub/email/[key]/route.ts#PUT",
        "service": [
          "@elkdonis/email#saveOrgTemplate",
          "@elkdonis/utils#sanitizeRichText"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/email/{key}/edit",
          "how": "the Save button of the email editor (components/hub/email/use-email-connectors.ts (EmailPopup.tsx, hub/email/[key]/edit/page.tsx))"
        }
      },
    ],
    entry: null,
    status: 'org template row for the key',
    risk: ['emails'],
    confirm: {
      text: 'Save the new wording of the “{name}” email? Everyone who gets it from {org} sees the new wording.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read api/org/[slug]/email/template/[key]/route.ts',
    drift: "Merged 2026-11-16 (consolidation 2): 3 rows, 3 apps (arts-collective, ifac, innergathering). Differences by app:\n- ifac (was ifac-email-template-save): save-email-template (api/org/[slug]/email/template/[key]); ifac adds series-scoped letters and a designed (project + html) variant.\n- innergathering (was ig-email-template-save): single-org route and getApiEditor gate; same body handling.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    open: "ifac (ifac-email-template-save): SECURITY: apps/ifac/src/app/api/hub/email/[key]/route.ts:76-77 body.html and body.project are saved as given (no sanitizeRichText, no size cap) while bodyHtml and copyHtml are sanitised and capped. The html is the Silex-style designed email (legacy editor; email making), editors only, sent to subscribers; compare the arts-collective copy.\ninnergathering (ig-email-template-save): SECURITY (mild, editor-only): `body.html` and `body.project` are stored as given, with no sanitiseRichText (hub/email/[key]/route.ts:66-67); html is the org’s own laid-out letter and is what gets sent. Only owner/guide can write it; the rich-text fields are sanitised.",
    inputs: "key (path), series scope (query), bodyText, bodyHtml, copySlot/copyText/copyHtml, project, html",
  },
  {
    id: 'add-email-contacts',
    area: 'hub.email',
    label: "Add people to the organisation's mailing list",
    does: "Adds email addresses to the org's contacts.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/[slug]/email/addresses/route.ts#POST',
        service: ['addAddresses'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          surface: 'custom:email',
          anchor: 'add-email-contacts',
          how: 'People tab of the email popup (EmailSurface).',
        },
      },
      {
        "key": "api:apps/ifac/src/app/api/hub/email/addresses/route.ts#POST",
        "service": [
          "(getApiEditor: owner or guide)",
          "@elkdonis/email#addAddresses"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/email",
          "how": "Add addresses in the email surface (packages/cms-ui email/EmailSurface.tsx, TemplateWordsEditor.tsx; mounted at /manage/email and /hub/email/[key])"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/hub/email/addresses/route.ts#POST",
        "service": [
          "@elkdonis/email#addAddresses"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/email",
          "how": "the Add addresses box of the audience tab (components/hub/email/use-email-connectors.ts (EmailPopup.tsx, hub/email/[key]/edit/page.tsx))"
        }
      },
    ],
    entry: null,
    status: 'contact rows exist for the addresses',
    risk: ['emails', 'others'],
    confirm: {
      text: 'Add {count} addresses to {org}’s mailing list? They may get its emails.',
      status: 'draft',
      wave: 2,
    },
    open: 'Does adding send a welcome or consent mail? Not traced.',
    verified: '2026-11-16 read api/org/[slug]/email/addresses/route.ts',
    drift: "Merged 2026-11-16 (consolidation 2): 3 rows, 3 apps (arts-collective, ifac, innergathering). Differences by app:\n- ifac (was ifac-email-contacts-add): add-email-contacts.\n- innergathering (was ig-email-contacts-add): single-org route, getApiEditor gate.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    inputs: "text, tags",
  },
  {
    id: 'edit-email-contact',
    area: 'hub.email',
    label: 'Edit a mailing-list contact',
    does: 'Edits a contact’s name, tags or notes.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/[slug]/email/addresses/route.ts#PATCH',
        case: 'edit',
        service: ['updateContact'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          anchor: 'edit-email-contact',
          how: 'The row controls in the People tab of the email popup.',
          surface: 'custom:email',
        },
        note: 'PATCH case edit: body has the contact id.',
      },
      {
        "key": "api:apps/ifac/src/app/api/hub/email/addresses/route.ts#PATCH",
        "service": [
          "(getApiEditor: owner or guide)",
          "@elkdonis/email#updateContact"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/email",
          "how": "Edit a row in the email surface (packages/cms-ui email/EmailSurface.tsx, TemplateWordsEditor.tsx; mounted at /manage/email and /hub/email/[key])"
        },
        "note": "body.id branch",
        "case": "edit"
      },
      {
        "key": "api:apps/innergathering/src/app/api/hub/email/addresses/route.ts#PATCH",
        "service": [
          "@elkdonis/email#updateContact"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/email",
          "how": "the edit row of the audience tab (components/hub/email/use-email-connectors.ts (EmailPopup.tsx, hub/email/[key]/edit/page.tsx))"
        },
        "note": "The same PATCH also serves \"stop email to an address\" (body.suppressEmail).",
        "case": "edit"
      },
    ],
    entry: null,
    status: 'the contact row holds the new values',
    risk: ['others'],
    confirm: {
      text: 'Save your changes to {person} on {org}’s mailing list? Only {org}’s team sees them.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read api/org/[slug]/email/addresses/route.ts',
    drift: "Merged 2026-11-16 (consolidation 2): 3 rows, 3 apps (arts-collective, ifac, innergathering). Differences by app:\n- ifac (was ifac-email-contact-edit): Same as arts-collective edit-email-contact.\n- innergathering (was ig-email-contacts-edit): single-org route.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    inputs: "id, name, tags, notes",
  },
  {
    id: 'stop-email-to-address',
    area: 'hub.email',
    label: 'Stop all email to an address',
    does: 'Suppresses an address so no more mail from the organisation goes to it.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/[slug]/email/addresses/route.ts#PATCH',
        case: 'suppress',
        service: ['suppressAddress'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          anchor: 'stop-email-to-address',
          how: 'The stop-mail control on a row in the People tab of the email popup.',
          surface: 'custom:email',
        },
        note: 'PATCH case suppress: body has suppressEmail.',
      },
      {
        "key": "api:apps/ifac/src/app/api/hub/email/addresses/route.ts#PATCH",
        "service": [
          "(getApiEditor: owner or guide)",
          "@elkdonis/email#suppressAddress"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/email",
          "how": "Stop mailing in the email surface (packages/cms-ui email/EmailSurface.tsx, TemplateWordsEditor.tsx; mounted at /manage/email and /hub/email/[key])"
        },
        "note": "body.suppressEmail branch",
        "case": "suppress"
      },
      {
        "key": "api:apps/innergathering/src/app/api/hub/email/addresses/route.ts#PATCH",
        "service": [
          "@elkdonis/email#suppressAddress"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/email",
          "how": "the Stop emailing button (components/hub/email/use-email-connectors.ts (EmailPopup.tsx, hub/email/[key]/edit/page.tsx))"
        },
        "case": "suppress"
      },
    ],
    entry: null,
    status: 'a suppression record exists for the address',
    risk: ['emails', 'others'],
    confirm: {
      text: 'Stop all email from {org} to {email}? They stay off the list until someone adds them again.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read api/org/[slug]/email/addresses/route.ts',
    drift: "Merged 2026-11-16 (consolidation 2): 3 rows, 3 apps (arts-collective, ifac, innergathering). Differences by app:\n- ifac (was ifac-email-address-stop): Same as arts-collective stop-email-to-address.\n- innergathering (was ig-email-contacts-suppress): single-org route.",
    inputs: "suppressEmail",
  },
  {
    id: 'remove-email-contact',
    area: 'hub.email',
    label: 'Remove a contact from the mailing list',
    does: "Deletes a contact from the organisation's list.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/[slug]/email/addresses/route.ts#DELETE',
        service: ['removeContact'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          surface: 'custom:email',
          anchor: 'remove-email-contact',
          how: 'The remove control on a contact row (EmailSurface).',
        },
      },
      {
        "key": "api:apps/ifac/src/app/api/hub/email/addresses/route.ts#DELETE",
        "service": [
          "(getApiEditor: owner or guide)",
          "@elkdonis/email#removeContact"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/email",
          "how": "Remove a row in the email surface (packages/cms-ui email/EmailSurface.tsx, TemplateWordsEditor.tsx; mounted at /manage/email and /hub/email/[key])"
        }
      },
      {
        "key": "api:apps/innergathering/src/app/api/hub/email/addresses/route.ts#DELETE",
        "service": [
          "@elkdonis/email#removeContact"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/email",
          "how": "the Remove button of the audience tab (components/hub/email/use-email-connectors.ts (EmailPopup.tsx, hub/email/[key]/edit/page.tsx))"
        }
      },
    ],
    entry: null,
    status: 'no contact row for the address',
    risk: ['irreversible', 'others'],
    confirm: {
      text: 'Remove {person} from {org}’s mailing list? Their history with the list is deleted. This cannot be undone.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read api/org/[slug]/email/addresses/route.ts',
    drift: "Merged 2026-11-16 (consolidation 2): 3 rows, 3 apps (arts-collective, ifac, innergathering). Differences by app:\n- ifac (was ifac-email-contact-remove): Same as arts-collective remove-email-contact.\n- innergathering (was ig-email-contacts-remove): single-org route.",
    inputs: "id (query)",
  },
  {
    id: 'mark-inbox-message',
    area: 'hub.email',
    label: 'Mark an inbox message read or archived',
    does: 'Sets the state of an incoming reply (unread, read, archived).',
    class: 'internal',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/[slug]/email/messages/[id]/route.ts#PATCH',
        case: 'state',
        service: ['setInboxState'],
        note: 'PATCH case state.',
      },
      {
        "key": "api:apps/ifac/src/app/api/hub/email/messages/[id]/route.ts#PATCH",
        "service": [
          "(getApiEditor: owner or guide)",
          "@elkdonis/email#setInboxState"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/email",
          "how": "inbox list in the email surface (packages/cms-ui email/EmailSurface.tsx, TemplateWordsEditor.tsx; mounted at /manage/email and /hub/email/[key])"
        },
        "note": "body.state",
        "case": "state"
      },
      {
        "key": "api:apps/innergathering/src/app/api/hub/email/messages/[id]/route.ts#PATCH",
        "service": [
          "@elkdonis/email#setInboxState"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/email",
          "how": "the state buttons of the inbox tab (components/hub/email/use-email-connectors.ts (EmailPopup.tsx, hub/email/[key]/edit/page.tsx))"
        },
        "case": "state"
      },
    ],
    status: 'unverifiable: inbox housekeeping',
    risk: ['none'],
    verified: '2026-11-16 read api/org/[slug]/email/messages/[id]/route.ts',
    drift: "Merged 2026-11-16 (consolidation 2): 3 rows, 3 apps (arts-collective, ifac, innergathering). Differences by app:\n- ifac (was ifac-inbox-message-mark): Same as arts-collective mark-inbox-message.\n- innergathering (was ig-inbox-state-set): single-org route.",
  },
  {
    id: 'reclassify-inbox-message',
    area: 'hub.email',
    label: 'Correct how an inbox message was classified',
    does: 'Changes the class the filter gave a message (reply, enquiry, auto, bounce, spam).',
    class: 'internal',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/[slug]/email/messages/[id]/route.ts#PATCH',
        case: 'classification',
        service: ['reclassifyInbox'],
        note: 'PATCH case classification.',
      },
      {
        "key": "api:apps/ifac/src/app/api/hub/email/messages/[id]/route.ts#PATCH",
        "service": [
          "(getApiEditor: owner or guide)",
          "@elkdonis/email#reclassifyInbox"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/email",
          "how": "inbox list in the email surface (packages/cms-ui email/EmailSurface.tsx, TemplateWordsEditor.tsx; mounted at /manage/email and /hub/email/[key])"
        },
        "note": "body.classification",
        "case": "classification"
      },
      {
        "key": "api:apps/innergathering/src/app/api/hub/email/messages/[id]/route.ts#PATCH",
        "service": [
          "@elkdonis/email#reclassifyInbox"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub/email",
          "how": "the classification menu of the inbox tab (components/hub/email/use-email-connectors.ts (EmailPopup.tsx, hub/email/[key]/edit/page.tsx))"
        },
        "case": "classification"
      },
    ],
    status: 'unverifiable: inbox housekeeping',
    risk: ['none'],
    verified: '2026-11-16 read api/org/[slug]/email/messages/[id]/route.ts',
    drift: "Merged 2026-11-16 (consolidation 2): 3 rows, 3 apps (arts-collective, ifac, innergathering). Differences by app:\n- ifac (was ifac-inbox-message-reclassify): Same as arts-collective reclassify-inbox-message.\n- innergathering (was ig-inbox-message-classify): single-org route.",
  },
  // ---------------- hub.files ----------------
  {
    id: 'upload-org-file',
    area: 'hub.files',
    label: "Upload a file to the organisation's folder",
    does: "Adds a file to the organisation's shared storage.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/[slug]/files/route.ts#POST',
        service: ['uploadOrgFile'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          anchor: 'upload-org-file',
          how: 'Files card (cms-ui/files FilesCard) in the console.',
        },
      },
    ],
    entry: null,
    status: 'unverifiable: a file listing has no fixed done state',
    risk: ['others'],
    confirm: {
      text: 'Add “{file}” to {org}’s shared files? Everyone with access to the folder can open it.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read api/org/[slug]/files/route.ts',
  },
  {
    id: 'delete-org-file',
    area: 'hub.files',
    label: "Delete a file from the organisation's folder",
    does: "Removes a file from the organisation's shared storage.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/org/[slug]/files/route.ts#DELETE',
        service: ['deleteOrgFile'],
        address: {
          app: 'arts-collective',
          path: '/hub/organization?org={org}',
          anchor: 'delete-org-file',
          how: 'The delete control in the Files card.',
        },
      },
    ],
    entry: null,
    status: 'file no longer listed',
    risk: ['irreversible', 'others'],
    confirm: { text: 'Delete “{file}” from {org}’s shared files? This cannot be undone.', status: 'draft', wave: 2 },
    verified: '2026-11-16 read api/org/[slug]/files/route.ts',
  },
  // ---------------- hub.elkdonis ----------------
  {
    id: 'post-to-elkdonis-forum',
    area: 'hub.elkdonis',
    label: 'Post feedback, an announcement or a suggestion to the collective',
    does: 'Posts a topic into one of the three Elkdonis Arts Collective feeds.',
    class: 'person',
    actors: ['person', 'owner'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/hub/(tabs)/arts-collective/actions.ts#postToElkdonis',
        service: ['createTopic'],
        address: {
          app: 'arts-collective',
          path: '/hub/arts-collective',
          anchor: 'post-to-elkdonis-forum',
          how: 'The three composers on the Arts Collective tab (components/hub/elkdonis/ComposeForm.tsx): "Post feedback", "Announce", "Suggest it".',
        },
        note: "createTopic applies the feed's post_role; announcements need a steward.",
      },
    ],
    entry: null,
    status: 'A forum topic by the person exists in the chosen feed',
    risk: ['public'],
    confirm: { text: 'Post “{title}” to the collective’s {where}? Members can read it.', status: 'draft', wave: 2 },
    inputs: 'feed, title, text, link',
    open: 'Announcements are steward-only; should the dock hide it for others?',
    verified: '2026-11-16 read app/hub/(tabs)/arts-collective/actions.ts',
  },
  // ---------------- hub.store ----------------
  {
    id: 'open-org-store',
    area: 'hub.store',
    label: "Open the organisation's store",
    does: 'Opens a store on the marketplace owned by the organisation.',
    class: 'person',
    actors: ['owner', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/hub/store/actions.ts#openStoreAction',
        service: ['openOrgStore'],
        address: {
          app: 'arts-collective',
          path: '/hub/store',
          anchor: 'open-org-store',
          how: 'The Open a store button on /hub/store (app/hub/store/store-panels.tsx).',
        },
      },
    ],
    entry: null,
    status: 'getStoreForOrg returns a store for the org',
    risk: ['public', 'money'],
    confirm: {
      text: 'Open a store for {org} on the marketplace? Visitors can then see its work. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    drift: 'Person store: runner `store` (publishStoreForAuction); org store: openOrgStore. Same capability as orgapps.money:ifac-store-open (that row maps the org-site apps; different hosts).',
    canonical: 'commerce openOrgStore via a shared hub Business card action when other orgs get stores.',
    open: "Registry `store` opens a person's store (different service publishStoreForAuction). `money` set because it enables selling: the dock must link, not run. Agreed?",
    verified: '2026-11-16 read app/hub/store/actions.ts, run.ts',
  },
  {
    id: 'add-store-team-member',
    area: 'hub.store',
    label: 'Add someone to the store team',
    does: "Gives a person (by email) a role on the organisation's store.",
    class: 'person',
    actors: ['owner', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/hub/store/actions.ts#addMemberAction',
        service: ['addStoreMemberByEmail'],
        address: {
          app: 'arts-collective',
          path: '/hub/store',
          anchor: 'add-store-team-member',
          how: 'The team panel in app/hub/store/store-panels.tsx.',
        },
      },
    ],
    entry: null,
    status: 'store member row exists for the email',
    risk: ['others'],
    confirm: {
      text: 'Add {person} to {org}’s store team as {role}? They can manage the store.',
      status: 'draft',
      wave: 2,
    },
    drift: 'Same capability as orgapps.money:ifac-store-team (that row maps the org-site apps; different hosts).',
    canonical: 'commerce addStoreMemberByEmail / removeStoreMember with canManageStoreTeam inside both.',
    open: 'Does addStoreMemberByEmail send a mail? Not traced.',
    verified: '2026-11-16 read app/hub/store/actions.ts',
  },
  {
    id: 'remove-store-team-member',
    area: 'hub.store',
    label: 'Remove someone from the store team',
    does: "Takes a person off the organisation's store team.",
    class: 'person',
    actors: ['owner', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/hub/store/actions.ts#removeMemberAction',
        service: ['canManageStoreTeam', 'removeStoreMember'],
        address: {
          app: 'arts-collective',
          path: '/hub/store',
          anchor: 'remove-store-team-member',
          how: 'The remove control in the team panel.',
        },
      },
    ],
    entry: null,
    status: 'no store member row for the person',
    risk: ['others', 'irreversible'],
    confirm: {
      text: 'Remove {person} from {org}’s store team? They lose access to manage it.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read app/hub/store/actions.ts',
  },
  {
    id: 'add-charity-beneficiary',
    area: 'hub.store',
    label: 'Suggest a charity to receive a share of sales',
    does: "Adds a charity as a possible beneficiary of the organisation's sales.",
    class: 'person',
    actors: ['owner', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/hub/store/actions.ts#addCharityAction',
        service: ['addCharityPayee'],
        address: {
          app: 'arts-collective',
          path: '/hub/store',
          anchor: 'add-charity-beneficiary',
          how: 'The beneficiaries panel in store-panels.tsx.',
        },
      },
    ],
    entry: null,
    status: 'payee row exists for the org',
    risk: ['money'],
    confirm: {
      text: 'Add {name} as a possible beneficiary of {org}’s sales? It stays a suggestion until approved. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    drift: 'Same capability as orgapps.money:ifac-store-payees (that row maps the org-site apps; different hosts).',
    canonical: 'commerce payee functions via the shared hub Business card.',
    open: 'Money: link only. Treated as a go-there step.',
    verified: '2026-11-16 read app/hub/store/actions.ts',
  },
  {
    id: 'approve-beneficiary',
    area: 'hub.store',
    label: 'Approve a beneficiary',
    does: 'Marks a suggested charity active so it can receive a share of sales.',
    class: 'person',
    actors: ['owner', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/hub/store/actions.ts#approvePayeeAction',
        service: ['approvePayee'],
        address: {
          app: 'arts-collective',
          path: '/hub/store',
          anchor: 'approve-beneficiary',
          how: 'The approve control in the beneficiaries panel.',
        },
      },
    ],
    entry: null,
    status: 'payee status is active',
    risk: ['money'],
    confirm: {
      text: 'Approve {name} to receive a share of {org}’s sales? Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    verified: '2026-11-16 read app/hub/store/actions.ts',
  },
  {
    id: 'add-org-beneficiary',
    area: 'hub.store',
    label: 'Add a beneficiary to the organisation’s store',
    does: 'Adds an approved beneficiary so a share of the store’s sales goes to them.',
    class: 'person',
    actors: ['owner', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/hub/store/actions.ts#addOrgBeneficiaryAction',
        service: ['addOrgBeneficiary'],
        address: {
          app: 'arts-collective',
          path: '/hub/store',
          anchor: 'set-org-beneficiary',
          how: 'The add control in the beneficiaries panel.',
        },
      },
    ],
    entry: null,
    status: 'the store lists the beneficiary',
    risk: ['money'],
    confirm: {
      text: 'Add {name} as a beneficiary of {org}’s store? A share of its sales goes to them from now on. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    verified: '2026-11-16 read app/hub/store/actions.ts',
  },
  {
    id: 'remove-org-beneficiary',
    area: 'hub.store',
    label: 'Remove a beneficiary from the organisation’s store',
    does: 'Removes a beneficiary so sales no longer go to them.',
    class: 'person',
    actors: ['owner', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/hub/store/actions.ts#removeBeneficiaryAction',
        service: ['removeOrgBeneficiary'],
        address: {
          app: 'arts-collective',
          path: '/hub/store',
          anchor: 'remove-org-beneficiary',
          how: 'The remove control in the beneficiaries panel (app/hub/store/store-panels.tsx).',
        },
      },
    ],
    entry: null,
    status: 'the store no longer lists the beneficiary',
    risk: ['money'],
    confirm: {
      text: 'Remove {name} as a beneficiary of {org}’s store? Its sales stop going to them from now on. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    verified: '2026-11-16 read app/hub/store/actions.ts',
  },
  // ---------------- hub.bookings ----------------
  {
    id: 'confirm-booking-time',
    area: 'hub.bookings',
    label: 'Confirm a time for a booking',
    does: "The seller picks one of the buyer's suggested times and confirms the booking.",
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/hub/bookings/actions.ts#confirmBookingTime',
        service: ['sellerConfirmTime'],
        address: {
          app: 'arts-collective',
          path: '/hub/bookings',
          anchor: 'confirm-booking-time',
          how: 'The time buttons on a "Choose a time" booking in app/hub/bookings/page.tsx.',
        },
      },
    ],
    entry: null,
    status: 'service_bookings.status is confirmed',
    risk: ['emails', 'others'],
    confirm: {
      text: 'Confirm {when} for {person}’s booking of “{title}”? They get an email.',
      status: 'draft',
      wave: 2,
    },
    drift: 'Buyer side of the same booking: arts-collective.network:confirm-booking-time-as-buyer (the buyer’s confirm takes payment; the seller’s does not).',
    canonical: 'commerce/server booking functions, with one action file per host',
    verified: '2026-11-16 read app/hub/bookings/actions.ts',
  },
  {
    id: 'propose-booking-times',
    area: 'hub.bookings',
    label: 'Suggest other times for a booking',
    does: 'The seller sends the buyer new times with a message.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/hub/bookings/actions.ts#proposeBookingTimes',
        service: ['sellerProposeTimes'],
        address: {
          app: 'arts-collective',
          path: '/hub/bookings',
          anchor: 'propose-booking-times',
          how: 'The suggest-times form on a booking row in app/hub/bookings/page.tsx.',
        },
      },
    ],
    entry: null,
    status: 'service_bookings.status is awaiting_buyer',
    risk: ['emails', 'others'],
    confirm: {
      text: 'Suggest these times to {person}: {when}? They get an email and can pick one.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read app/hub/bookings/actions.ts',
  },
  {
    id: 'cancel-booking',
    area: 'hub.bookings',
    label: 'Cancel a booking',
    does: 'The seller cancels a booking and tells the buyer; any refund is handled by email.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/app/hub/bookings/actions.ts#cancelBooking',
        service: ['sellerCancelBooking'],
        address: {
          app: 'arts-collective',
          path: '/hub/bookings',
          anchor: 'cancel-booking',
          how: 'The cancel control on a booking row in app/hub/bookings/page.tsx.',
        },
      },
    ],
    entry: null,
    status: 'service_bookings.status is cancelled',
    risk: ['emails', 'irreversible', 'money'],
    confirm: {
      text: 'Cancel {person}’s booking of “{title}”? They get an email, and any refund is arranged by reply. This cannot be undone. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    open: 'Refund is manual by email; I marked money so the dock links rather than runs. Confirm.',
    verified: '2026-11-16 read app/hub/bookings/actions.ts, commerce service-bookings.ts',
  },
  // ---------------- hub.agreements ----------------
  {
    id: 'draft-agreement',
    area: 'hub.agreements',
    label: 'Draft a revenue-share agreement',
    does: 'An owner writes a new agreement (or a new version) with a share percentage.',
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/agreement-actions.ts#createAgreementAction',
        service: ['draftAgreement'],
        address: {
          app: 'arts-collective',
          path: '/hub/agreements',
          anchor: 'draft-agreement',
          how: '"New agreement" in components/hub/AgreementsManager.tsx.',
        },
      },
    ],
    entry: null,
    status: 'agreement draft exists for the key',
    risk: ['money'],
    confirm: {
      text: 'Save a draft agreement “{title}” that takes {share}% of sales? Nothing is in force until you publish it. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    verified: '2026-11-16 read lib/agreement-actions.ts',
  },
  {
    id: 'edit-agreement-draft',
    area: 'hub.agreements',
    label: 'Edit a draft agreement',
    does: 'Changes the title, text or share of a draft.',
    class: 'internal',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/agreement-actions.ts#updateAgreementAction',
        service: ['updateDraftAgreement'],
      },
    ],
    risk: ['money'],
    verified: '2026-11-16 read lib/agreement-actions.ts',
  },
  {
    id: 'publish-agreement',
    area: 'hub.agreements',
    label: 'Publish an agreement',
    does: 'Puts a drafted agreement in force so members can accept it.',
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/agreement-actions.ts#publishAgreementAction',
        service: ['publishAgreement'],
        address: {
          app: 'arts-collective',
          path: '/hub/agreements',
          anchor: 'publish-agreement',
          how: 'The Publish button on a draft in AgreementsManager.tsx.',
        },
      },
    ],
    entry: null,
    status: 'agreement status published',
    risk: ['money', 'public', 'others'],
    confirm: {
      text: 'Publish “{title}”? Members are asked to accept it, and {share}% of their sales goes to {org}. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    verified: '2026-11-16 read lib/agreement-actions.ts',
  },
  {
    id: 'retire-agreement',
    area: 'hub.agreements',
    label: 'Retire an agreement',
    does: 'Ends a published agreement for new acceptances.',
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/agreement-actions.ts#retireAgreementAction',
        service: ['retireAgreement'],
        address: {
          app: 'arts-collective',
          path: '/hub/agreements',
          anchor: 'retire-agreement',
          how: 'The Retire button on a published agreement in AgreementsManager.tsx.',
        },
      },
    ],
    entry: null,
    status: 'agreement status retired',
    risk: ['money', 'irreversible', 'others'],
    confirm: {
      text: 'Retire “{title}”? No one new can accept it, and existing acceptances are kept. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    open: 'Does retiring change what existing members pay? Not traced.',
    verified: '2026-11-16 read lib/agreement-actions.ts',
  },
  {
    id: 'accept-agreement',
    area: 'hub.agreements',
    label: 'Accept an agreement',
    does: "A member agrees for themselves to an organisation's revenue-share terms.",
    class: 'person',
    actors: ['member'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/agreement-actions.ts#acceptAgreementAction',
        service: ['acceptAgreement'],
        address: {
          app: 'arts-collective',
          path: '/hub/agreements',
          anchor: 'accept-agreement',
          how: 'The Accept button at the end of AgreementsManager.tsx.',
        },
      },
    ],
    entry: null,
    status: 'acceptance row for the person and agreement',
    risk: ['money'],
    confirm: {
      text: 'Accept “{title}”? {share}% of your sales through {org} will be shared with it. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    verified: '2026-11-16 read lib/agreement-actions.ts',
  },
  {
    id: 'revoke-agreement-acceptance',
    area: 'hub.agreements',
    label: 'Withdraw my acceptance of an agreement',
    does: 'A member withdraws their acceptance.',
    class: 'person',
    actors: ['member'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/agreement-actions.ts#revokeAgreementAction',
        service: ['revokeAcceptance'],
        address: {
          app: 'arts-collective',
          path: '/hub/agreements',
          anchor: 'revoke-agreement-acceptance',
          how: 'The Revoke button in AgreementsManager.tsx.',
        },
      },
    ],
    entry: null,
    status: 'no acceptance row',
    risk: ['money'],
    confirm: {
      text: 'Withdraw your acceptance of “{title}”? The terms stop applying to you from now on. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    open: 'Effect on sales already made is not traced.',
    verified: '2026-11-16 read lib/agreement-actions.ts',
  },
  // ---------------- hub.quotes ----------------
  {
    id: 'add-quote',
    area: 'hub.quotes',
    label: 'Add a quote',
    does: "An owner or guide (or an admin for the collective's own lines) adds a published line to the quote desk.",
    class: 'person',
    actors: ['owner', 'guide', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/quote-actions.ts#addQuoteAction',
        service: ['submitQuote'],
        address: {
          app: 'arts-collective',
          path: '/hub/quotes',
          anchor: 'add-quote',
          how: 'The add form in components/hub/QuotesManager.tsx.',
        },
      },
    ],
    entry: null,
    status: 'quote row exists',
    risk: ['public'],
    confirm: {
      text: 'Add this quote to {org}’s quotes? It shows on {org}’s public page straight away.',
      status: 'draft',
      wave: 2,
    },
    verified: '2026-11-16 read lib/quote-actions.ts',
  },
  {
    id: 'show-or-hide-quote',
    area: 'hub.quotes',
    label: 'Show or hide a quote',
    does: 'Sets a quote to published or hidden.',
    class: 'person',
    actors: ['owner', 'guide', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/quote-actions.ts#setQuoteStatusAction',
        service: ['setQuoteStatus'],
        address: {
          app: 'arts-collective',
          path: '/hub/quotes',
          anchor: 'show-or-hide-quote',
          how: 'Show / Hide buttons on a quote in QuotesManager.tsx.',
        },
      },
    ],
    entry: null,
    status: 'quote status as chosen',
    risk: ['public'],
    confirm: { text: 'Set this quote to {state} on {org}’s public page?', status: 'draft', wave: 2 },
    verified: '2026-11-16 read lib/quote-actions.ts',
  },
  {
    id: 'weight-quote',
    area: 'hub.quotes',
    label: 'Make a quote show more often',
    does: 'Adds weight to a published quote so it is chosen more often.',
    class: 'internal',
    actors: ['owner', 'guide', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/quote-actions.ts#setQuoteWeightAction',
        service: ['setQuoteStatus'],
      },
    ],
    risk: ['none'],
    verified: '2026-11-16 read lib/quote-actions.ts',
  },
  {
    id: 'delete-quote',
    area: 'hub.quotes',
    label: 'Delete a quote',
    does: 'Removes a quote from the desk.',
    class: 'person',
    actors: ['owner', 'guide', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/quote-actions.ts#deleteQuoteAction',
        service: ['deleteQuote'],
        address: {
          app: 'arts-collective',
          path: '/hub/quotes',
          anchor: 'delete-quote',
          how: 'The delete button on a quote in QuotesManager.tsx.',
        },
      },
    ],
    entry: null,
    status: 'quote row gone',
    risk: ['irreversible', 'public'],
    confirm: { text: 'Delete this quote? This cannot be undone.', status: 'draft', wave: 2 },
    verified: '2026-11-16 read lib/quote-actions.ts',
  },
  // ---------------- hub.admin ----------------
  {
    id: 'release-held-funds',
    area: 'hub.admin',
    label: 'Release held funds',
    does: 'A network admin releases a held ledger entry so the money becomes payable.',
    class: 'admin',
    actors: ['admin'],
    scope: 'other',
    hosts: [
      {
        key: 'sa:apps/arts-collective/src/lib/ledger-actions.ts#releaseHoldAction',
        service: ['releaseHold'],
        address: {
          app: 'arts-collective',
          path: '/hub/admin/ledger',
          how: 'The release button in components/hub/HeldFundsTable.tsx.',
        },
      },
    ],
    status: 'ledger entry released_at set',
    risk: ['money', 'irreversible'],
    verified: '2026-11-16 read lib/ledger-actions.ts',
  },
  {
    id: 'review-vetting-response',
    area: 'hub.admin',
    label: 'Review a vetting submission',
    does: 'An admin marks a submission reviewed or returns it with a note.',
    class: 'admin',
    actors: ['admin'],
    scope: 'other',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/admin/vetting/[responseId]/route.ts#POST',
        service: ['reviewResponse'],
        address: { app: 'arts-collective', path: '/hub/admin/vetting', how: 'The review controls on the vetting page.' },
      },
    ],
    status: 'response outcome set',
    risk: ['others'],
    open: 'Does returning notify the person? Not traced. Page control name not traced.',
    verified: '2026-11-16 read app/api/admin/vetting/[responseId]/route.ts',
  },
  {
    id: 'add-associated-org',
    area: 'hub.admin',
    label: 'Add an associated organisation to the directory',
    does: "An admin adds an organisation with a role and bio to the network's associated list.",
    class: 'admin',
    actors: ['admin'],
    scope: 'other',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/hub/admin/associated-orgs/route.ts#POST',
        service: ['createAssociatedOrg'],
        address: {
          app: 'arts-collective',
          path: '/hub/admin/directory',
          how: 'Create in components/hub/AssociatedOrgManager.tsx.',
        },
      },
    ],
    status: 'associated row exists',
    risk: ['public'],
    verified: '2026-11-16 read app/api/hub/admin/associated-orgs/route.ts',
  },
  {
    id: 'edit-associated-org',
    area: 'hub.admin',
    label: 'Edit an associated organisation',
    does: 'An admin edits an entry in the associated list (moves it to another org if the org changed).',
    class: 'admin',
    actors: ['admin'],
    scope: 'other',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/hub/admin/associated-orgs/route.ts#PATCH',
        service: ['updateAssociatedOrg', 'deleteAssociatedOrg'],
        address: {
          app: 'arts-collective',
          path: '/hub/admin/directory',
          how: 'Save changes in AssociatedOrgManager.tsx.',
        },
      },
    ],
    status: 'associated row updated',
    risk: ['public'],
    verified: '2026-11-16 read app/api/hub/admin/associated-orgs/route.ts',
  },
  {
    id: 'remove-associated-org',
    area: 'hub.admin',
    label: 'Remove an associated organisation',
    does: 'An admin deletes an entry from the associated list.',
    class: 'admin',
    actors: ['admin'],
    scope: 'other',
    hosts: [
      {
        key: 'api:apps/arts-collective/src/app/api/hub/admin/associated-orgs/route.ts#DELETE',
        service: ['deleteAssociatedOrg'],
        address: { app: 'arts-collective', path: '/hub/admin/directory', how: 'Remove in AssociatedOrgManager.tsx.' },
      },
    ],
    status: 'associated row gone',
    risk: ['irreversible', 'public'],
    verified: '2026-11-16 read app/api/hub/admin/associated-orgs/route.ts',
  },
];

const ignored: Area['ignored'] = [
  { key: 'sa:apps/arts-collective/src/lib/cms/org-people-actions.ts#listOrgPeopleAction', why: 'A read exposed as a server action.' },
  { key: 'sa:apps/arts-collective/src/lib/cms/org-people-actions.ts#canChangeOrgPeopleAction', why: 'A permission check exposed as a server action (read).' },
  { key: 'sa:apps/arts-collective/src/lib/cms/actions.ts#upsertWorkshopPageAction', why: 'Dead code: no caller outside lib/cms/actions.ts; saveWorkshopAction writes the sidecar itself.' },
  { key: 'sql:apps/arts-collective/src/lib/cms/actions.ts#upsertWorkshopPageAction', why: 'twin of sa:upsertWorkshopPageAction (dead code)' },
  { key: 'sa:apps/arts-collective/src/lib/cms/publish-actions.ts#publishArticleAction', why: 'Dead code: only mentioned in a comment in draft-actions.ts; no caller.' },
  { key: 'sa:apps/arts-collective/src/lib/cms/publish-actions.ts#getArticleArtifactAction', why: 'Dead code and a read.' },
  { key: 'sa:apps/arts-collective/src/lib/cms/document-actions.ts#attachDocumentAction', why: 'Dead code: no caller found in the app.' },
  { key: 'sa:apps/arts-collective/src/lib/cms/document-actions.ts#syncDocumentAction', why: 'Dead code: no caller found in the app.' },
];

export default { capabilities, ignored } satisfies Area;
