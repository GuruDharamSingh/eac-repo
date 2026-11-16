import type { Area, Capability } from '../types';

const capabilities: Capability[] = [
  // ---------------- orgapps.people ----------------
  {
    id: 'profile-section-toggle',
    area: 'orgapps.people',
    label: 'Switch a section of my page on or off',
    does: "Turns an optional section (store, blog, feed) of the signed-in person's own page on or off (users.profile_sections).",
    class: 'person',
    actors: [
      "person",
      "member",
      "owner",
      "guide"
    ],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/sunjay/src/lib/account-actions.ts#setOwnProfileSectionAction',
        service: ['@elkdonis/db#db'],
        address: { app: 'sunjay', path: '/account', how: 'Store toggle on the account page' },
        note: 'raw UPDATE; only section "store" allowed',
      },
      {
        key: 'sql:apps/sunjay/src/lib/account-actions.ts#setOwnProfileSectionAction',
        service: ['@elkdonis/db#db'],
        address: { app: 'sunjay', path: '/account', how: 'sql twin' },
      },
      {
        key: 'sa:apps/amrit-canada/src/lib/account-actions.ts#setOwnProfileSectionAction',
        service: ['@elkdonis/db#db'],
        address: { app: 'amrit-canada', path: '/account', how: 'Store toggle on the account page' },
        note: 'raw UPDATE; only section "store" allowed',
      },
      {
        key: 'sql:apps/amrit-canada/src/lib/account-actions.ts#setOwnProfileSectionAction',
        service: ['@elkdonis/db#db'],
        address: { app: 'amrit-canada', path: '/account', how: 'sql twin' },
      },
      {
        key: 'sa:apps/elktours/src/lib/account-actions.ts#setOwnProfileSectionAction',
        service: ['@elkdonis/db#db'],
        address: { app: 'elktours', path: '/account', how: 'Store toggle on the account page' },
        note: 'raw UPDATE; only section "store" allowed',
      },
      {
        key: 'sql:apps/elktours/src/lib/account-actions.ts#setOwnProfileSectionAction',
        service: ['@elkdonis/db#db'],
        address: { app: 'elktours', path: '/account', how: 'sql twin' },
      },
      {
        key: 'sa:apps/ifac/src/lib/cms/payout-actions.ts#setProfileSectionAction',
        service: ['@elkdonis/db#db'],
        address: { app: 'ifac', path: '/center', how: 'profile pop-up sections tab' },
        note: 'allows elkdonisFeed, store, blog; lives in payout-actions.ts',
      },
      {
        key: 'sql:apps/ifac/src/lib/cms/payout-actions.ts#setProfileSectionAction',
        service: ['@elkdonis/db#db'],
        address: { app: 'ifac', path: '/center', how: 'sql twin' },
      },
      {
        "key": "sa:apps/arts-collective/src/lib/cms/payout-actions.ts#setProfileSectionAction",
        "address": {
          "app": "arts-collective",
          "path": "/learn",
          "surface": "profile:show",
          "anchor": "profile-section-toggle",
          "how": "The Writing / Store switches of the profile popup (LearnHost.tsx profile.setSection)."
        },
        "note": "Raw UPDATE users.profile_sections."
      },
      {
        "key": "sql:apps/arts-collective/src/lib/cms/payout-actions.ts#setProfileSectionAction",
        "note": "sql twin"
      },
      {
        "key": "sa:apps/innergathering/src/lib/cms/blog-actions.ts#setProfileSectionAction",
        "service": [
          "(getApiMember)",
          "(raw UPDATE users.profile_sections jsonb merge; allow-list blog, store, elkdonisFeed)"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub",
          "how": "Page sections panel in the profile surface"
        }
      },
      {
        "key": "sql:apps/innergathering/src/lib/cms/blog-actions.ts#setProfileSectionAction",
        "note": "sql twin of sa:apps/innergathering/src/lib/cms/blog-actions.ts#setProfileSectionAction"
      },
      {
        "key": "sa:apps/innergathering/src/lib/cms/blog-actions.ts#setStoreSectionAction",
        "service": [
          "(getApiMember)",
          "(raw UPDATE users.profile_sections store)"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub",
          "how": "Available work switch in the page sections panel"
        },
        "note": "a fixed-key twin of setProfileSectionAction"
      },
      {
        "key": "sql:apps/innergathering/src/lib/cms/blog-actions.ts#setStoreSectionAction",
        "note": "sql twin of sa:apps/innergathering/src/lib/cms/blog-actions.ts#setStoreSectionAction"
      },
      {
        "key": "sa:apps/artdirect/src/lib/profile-editor-actions.ts#setProfileSectionAction",
        "service": [
          "(getCurrentUser; canEditProfile on the profileUserId)",
          "(raw UPDATE users.profile_sections; allow-list store + dossier keys)"
        ],
        "address": {
          "app": "artdirect",
          "path": "/account",
          "how": "sections toggle in the profile editor (path inferred)"
        },
        "note": "acts on a profileUserId passed by the client: the person or a global admin"
      },
      {
        "key": "sql:apps/artdirect/src/lib/profile-editor-actions.ts#setProfileSectionAction",
        "note": "sql twin of sa:apps/artdirect/src/lib/profile-editor-actions.ts#setProfileSectionAction"
      },
      {
        "key": "api:apps/ifac/src/app/api/hub/profile-sections/route.ts#PATCH",
        "service": [
          "(getHubViewer: owner, guide or member of ifac via hasOrgRole)",
          "(raw UPDATE users SET profile_sections = ... WHERE id = viewer)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/profile",
          "how": "Page sections card (components/hub/PageSectionsCard.tsx, components/hub/site/PageSectionSwitches.tsx)"
        }
      },
      {
        "key": "sql:apps/ifac/src/app/api/hub/profile-sections/route.ts#PATCH",
        "note": "sql twin of api:apps/ifac/src/app/api/hub/profile-sections/route.ts#PATCH"
      },
      {
        "key": "sa:apps/artdirect/src/lib/dossier-editor-actions.ts#setProfileSectionAction",
        "service": [
          "(authorize: canEditProfile = the profile owner or a global admin)",
          "(KNOWN_PROFILE_SECTIONS allow-list)",
          "(raw UPDATE users SET profile_sections = profile_sections || {key: bool})"
        ],
        "address": {
          "app": "artdirect",
          "path": "/{slug}",
          "how": "section switches in the profile editor sidebar and drawer (components/oad/DossierSidebar.tsx, ProfileEditorPanel.tsx, PersonDrawer.tsx)"
        }
      },
      {
        "key": "sql:apps/artdirect/src/lib/dossier-editor-actions.ts#setProfileSectionAction",
        "note": "sql twin of sa:apps/artdirect/src/lib/dossier-editor-actions.ts#setProfileSectionAction"
      },
    ],
    entry: null,
    status: 'users.profile_sections[key] equals the chosen value',
    risk: ['public'],
    confirm: {
      text: 'Set the {name} section of your public page to {state}? Visitors see the change.',
      status: 'draft',
      wave: 3,
    },
    inputs: 'key, on',
    drift: "Same raw 'jsonb ||' UPDATE on users in sunjay/amrit-canada/elktours (byte-identical) and ifac. Self-only (the row is viewer.userId). Differences: allowed keys (store only vs elkdonisFeed/store/blog), ifac revalidates /artists/<slug> and /dealers/<slug> pages, the other three revalidate /account and /about/<slug>. No service owns this write; it is hand SQL in four apps.\nMerged 2026-11-16 (consolidation 2): 5 rows, 5 apps (sunjay, arts-collective, innergathering, ifac, artdirect). Differences by app:\n- arts-collective (was set-profile-section): Same switches as hub set-where-i-show (services setPresence, row x column) but written by raw SQL here.\n- innergathering (was profile-section-toggle-more): Same concept as profile-section-toggle in orgapps.people (sunjay, amrit-canada, elktours, ifac): a merged jsonb UPDATE with an allow-list. This file holds the copies that file did not claim: innergathering's generic and store-only versions (the store-only one is a narrower copy of the generic one in the same file), and artdirect's. innergathering revalidates /hub and /artists/<slug>; the store version only /hub.\n- ifac (was ifac-profile-sections-set): profile-blog-set / profile-section-toggle (artdirect). Here an allow-list of four keys, own row only (WHERE id = viewer.userId). Raw SQL, not services setProfileSection.\n- artdirect (was artdirect-profile-section-set): A second copy in artdirect: lib/profile-editor-actions.ts setProfileSectionAction (claimed by orgapps.content profile-section-toggle) does the same write from another editor. Also the same family as ifac-profile-sections-set.\nDirection (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.",
    canonical: 'a services setProfileSection(userId, key, on) that owns the SQL and the allowed-key list; one kit action.',
    verified: '2026-11-16 read/diffed {sunjay,amrit-canada,elktours,innergathering}/src/lib/account-actions.ts; ifac+innergathering src/lib/cms/org-people-actions.ts (md5 d9332b09 identical); ifac src/lib/cms/payout-actions.ts setProfileSectionAction',
    open: "arts-collective (set-profile-section): Is profile_sections the same data setPresence reads? If yes, this is a duplicate of set-where-i-show.",
  },
  {
    id: 'org-person-role-set',
    area: 'orgapps.people',
    label: "Change someone's role in the organisation",
    does: 'Sets a person in the org to viewer, member or guide.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/ifac/src/lib/cms/org-people-actions.ts#setOrgPersonRoleAction',
        service: ['@elkdonis/services#canManageOrgPeople', '@elkdonis/services#setOrgPersonRole'],
        address: { app: 'ifac', path: '/center', how: 'Your organisation table, role dropdown' },
      },
      {
        key: 'sa:apps/innergathering/src/lib/cms/org-people-actions.ts#setOrgPersonRoleAction',
        service: ['@elkdonis/services#canManageOrgPeople', '@elkdonis/services#setOrgPersonRole'],
        address: { app: 'innergathering', path: '/center', how: 'Your organisation table, role dropdown' },
      },
      {
        "key": "sa:apps/arts-collective/src/lib/cms/org-people-actions.ts#setOrgPersonRoleAction",
        "service": [
          "canManageOrgPeople",
          "setOrgPersonRole"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/hub/organization?org={org}",
          "anchor": "org-person-role-set",
          "how": "Settings > People & roles, or the People band \"Roles & removal\" (ConsoleSettings.tsx, ConsoleSurfaces.tsx PeopleSurface); also the Center journey on /learn."
        },
        "note": "Gate is canManageOrgPeople (owner or guide); setOrgPersonRole then enforces owner-only itself."
      },
      {
        "key": "api:apps/arts-collective/src/app/api/org/[slug]/members/[userId]/route.ts#PATCH",
        "service": [
          "setOrgRole"
        ],
        "note": "Owner only; can grant owner."
      },
      {
        "key": "sa:apps/arts-collective/src/app/sites/[slug]/hub/actions.ts#runTenantHubAction",
        "case": "org-person-role",
        "service": [
          "performHubAction"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/sites/{org}/hub",
          "anchor": "org-person-role-set",
          "how": "The role control on the People card of the organisation’s own site hub (packages/hub members Detail/PeopleTab, mounted in components/sites/hub/TenantHubCards.tsx)."
        },
        "note": "Tenant hub door, case org-person-role; the same service as the other host."
      },
    ],
    entry: "org-person-role",
    status: 'user_organizations role for the person equals the chosen role',
    risk: ['others'],
    confirm: { text: 'Make {person} a {role} of {org}? This changes what they can do there.', status: 'draft', wave: 3 },
    inputs: 'orgId, userId, role',
    drift: "Byte-identical in ifac and innergathering. Action gate: canManageOrgPeople (owner/guide); services setOrgPersonRole additionally decides who may change which role (the Center table asks canChangeOrgPeople first: owners change roles). So the action allows guides to call it, with services deciding. The 'owner' role cannot be set here.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (ifac, arts-collective). Differences by app:\n- arts-collective (was change-person-role): Three paths: setOrgPersonRoleAction (setOrgPersonRole, never owner), members route (setOrgRole, may set owner), and hub entry org-person-role (setOrgPersonRole through performHubAction). The route can grant owner; the others refuse.\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    canonical: 'services setOrgPersonRole (actor check inside services) via one kit action; also mounted in the hub Members card.',
    open: "Confirm services setOrgPersonRole enforces the owner-only rule itself, since the action gate admits guides.\narts-collective (change-person-role): Registry entry is appOnly (dock = go-there). Should the members route be retired? Is granting owner by route intended?",
    verified: '2026-11-16 read/diffed {sunjay,amrit-canada,elktours,innergathering}/src/lib/account-actions.ts; ifac+innergathering src/lib/cms/org-people-actions.ts (md5 d9332b09 identical); ifac src/lib/cms/payout-actions.ts setProfileSectionAction',
  },
  {
    id: 'org-person-listed-set',
    area: 'orgapps.people',
    label: 'List or unlist a person on the org page',
    does: "Switches whether a person is shown in the organisation's public people list; syncs Nextcloud as services requires.",
    class: 'person',
    actors: [
      "owner",
      "guide",
      "member"
    ],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/ifac/src/lib/cms/org-people-actions.ts#setOrgPersonListedAction',
        service: ['@elkdonis/services#canManageOrgPeople', '@elkdonis/services#setOrgPersonListed'],
        address: { app: 'ifac', path: '/center', how: 'Your organisation table, Listed switch' },
      },
      {
        key: 'sa:apps/innergathering/src/lib/cms/org-people-actions.ts#setOrgPersonListedAction',
        service: ['@elkdonis/services#canManageOrgPeople', '@elkdonis/services#setOrgPersonListed'],
        address: { app: 'innergathering', path: '/center', how: 'Your organisation table, Listed switch' },
      },
      {
        "key": "sa:apps/arts-collective/src/lib/cms/org-people-actions.ts#setOrgPersonListedAction",
        "service": [
          "canManageOrgPeople",
          "setOrgPersonListed"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/hub/organization?org={org}",
          "anchor": "org-person-listed-set",
          "how": "The listed switch in the People surface (ConsoleSurfaces.tsx PeopleSurface)."
        }
      },
      {
        "key": "sa:apps/arts-collective/src/app/sites/[slug]/hub/actions.ts#runTenantHubAction",
        "case": "org-person-listed",
        "service": [
          "performHubAction"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/sites/{org}/hub",
          "anchor": "org-person-listed-set",
          "how": "The listed switch on the People card of the organisation’s own site hub (members PeopleTab)."
        },
        "note": "Tenant hub door, case org-person-listed; the same service as the other host."
      },
    ],
    entry: "org-person-listed",
    status: 'user_organizations listing flag for the person equals the chosen value',
    risk: ['public', 'others'],
    confirm: {
      text: 'Set {person} to {state} on {org}’s public people list? Visitors can see who is listed.',
      status: 'draft',
      wave: 3,
    },
    inputs: 'orgId, userId, on',
    drift: "Byte-identical in the two apps; same gate as role-set.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (ifac, arts-collective). Differences by app:\n- arts-collective (was list-person-in-directory): no drift recorded\nDirection (Justin, 2026-11-16): the canonical is the hub / Channel path (hub surface pages, cards and pop-ups), not the /manage page shape. amrit-canada is the oldest site and is being left behind, so its copy is not a model; sunjay is moving from /manage pages to hub + Channel.",
    canonical: 'services setOrgPersonListed via the kit (and the hub Members card).',
    verified: '2026-11-16 read/diffed {sunjay,amrit-canada,elktours,innergathering}/src/lib/account-actions.ts; ifac+innergathering src/lib/cms/org-people-actions.ts (md5 d9332b09 identical); ifac src/lib/cms/payout-actions.ts setProfileSectionAction',
    open: "arts-collective (list-person-in-directory): The action gate is owner/guide, but the registry says anyone may unlist themselves. Does that path exist in the app?",
  },
];

const ignored: Area['ignored'] = [
  { key: 'sa:apps/ifac/src/lib/cms/org-people-actions.ts#listOrgPeopleAction', why: 'read: lists the org people' },
  { key: 'sa:apps/ifac/src/lib/cms/org-people-actions.ts#canChangeOrgPeopleAction', why: 'read: capability probe for the table' },
  { key: 'sa:apps/innergathering/src/lib/cms/org-people-actions.ts#listOrgPeopleAction', why: 'read: lists the org people' },
  { key: 'sa:apps/innergathering/src/lib/cms/org-people-actions.ts#canChangeOrgPeopleAction', why: 'read: capability probe for the table' },
];

export default { capabilities, ignored } satisfies Area;
