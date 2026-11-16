import type { Area, Capability } from '../types';

const capabilities: Capability[] = [
  // ---------------- orgapps.journeys ----------------
  {
    id: 'auction-store-publish',
    area: 'orgapps.journeys',
    label: 'Open my store on the marketplace',
    does: "One-click step of the Center's auction journey: publishes the signed-in person's store on the art marketplace.",
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/ifac/src/lib/cms/journey-actions.ts#publishStoreAction',
        service: ['@elkdonis/commerce/server#publishStoreForAuction', '@elkdonis/db#db (display_name read)'],
        address: { app: 'ifac', path: '/center', how: 'auction journey card, Open store step' },
      },
      {
        key: 'sa:apps/innergathering/src/lib/cms/journey-actions.ts#publishStoreAction',
        service: ['@elkdonis/commerce/server#publishStoreForAuction', '@elkdonis/db#db (display_name read)'],
        address: { app: 'innergathering', path: '/center', how: 'auction journey card, Open store step' },
      },
      {
        "key": "sa:apps/arts-collective/src/lib/cms/journey-actions.ts#publishStoreAction",
        "service": [
          "runAction(store)",
          "publishStoreForAuction"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/learn",
          "surface": "journey:auction",
          "anchor": "auction-store-publish",
          "how": "The Open store step of the sell-your-art journey popup (components/learn/LearnHost.tsx journey.publishStore)."
        }
      },
    ],
    entry: "store",
    status: 'getStoreForUser(userId) returns an active store',
    risk: ['public', 'money'],
    confirm: {
      text: 'Open your own store on the marketplace? Your published artworks can then be sold there. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    drift: "Byte-identical code; only the doc comment differs. Gate: any signed-in person (a store is a fact about the person, like being payable), no org role. The display_name is read with a raw SELECT inside the action.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (ifac, arts-collective). Differences by app:\n- arts-collective (was open-your-store): Org stores open through openOrgStore (hub open-org-store); a person's through publishStoreForAuction.",
    canonical: 'commerce publishStoreForAuction with displayName resolved inside commerce; one shared kit action.',
    verified: '2026-11-16 read/diffed ifac and innergathering src/lib/cms/journey-actions.ts (comment-only diff)',
  },
  {
    id: 'org-site-create',
    area: 'orgapps.journeys',
    label: 'Start an organisation site',
    does: 'Creates a new organisation with a subdomain for the signed-in person (the Center "site" journey).',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/ifac/src/lib/cms/journey-actions.ts#createSiteAction',
        service: ['@elkdonis/services#createOrganizationForUser'],
        address: { app: 'ifac', path: '/center', how: 'site journey card, Create site' },
      },
      {
        key: 'sa:apps/innergathering/src/lib/cms/journey-actions.ts#createSiteAction',
        service: ['@elkdonis/services#createOrganizationForUser'],
        address: { app: 'innergathering', path: '/center', how: 'site journey card, Create site' },
      },
      {
        "key": "api:apps/arts-collective/src/app/api/org/create/route.ts#POST",
        "service": [
          "createOrganizationForUser"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/hub/organization",
          "anchor": "org-site-create",
          "how": "The tier cards (components/hub/JoinTiers.tsx) show SetupForm (app/signup/setup/setup-form.tsx); its Create button posts here."
        }
      },
      {
        "key": "sa:apps/arts-collective/src/lib/cms/journey-actions.ts#createSiteAction",
        "service": [
          "runAction(org)"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/learn",
          "surface": "journey:site",
          "anchor": "org-site-create",
          "how": "The Create site step of the site journey popup under /learn (components/learn/LearnHost.tsx journey.site.create)."
        },
        "note": "Goes through the registry runner `org`, which calls the same service as the route."
      },
    ],
    entry: "org",
    status: 'an organizations row with the subdomain exists and the person is its owner',
    risk: ['public'],
    confirm: { text: 'Create {org} at {where}? You will be its owner.', status: 'draft', wave: 3 },
    inputs: 'title, subdomain',
    drift: "Byte-identical code in both apps; any signed-in person. Arts-collective has its own org creation path (other agents) and likely a registry entry (org publish / onboarding): check for an existing entry id.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (ifac, arts-collective). Differences by app:\n- arts-collective (was create-organisation): Registry runner `org` calls the same service as this route (same path, good).",
    canonical: 'services createOrganizationForUser through the existing registry door, so the dock runs one path.',
    open: "Likely already covered by an onboarding registry entry; Agent B or main session to give the entry id.\narts-collective (create-organisation): Tier paid plans: does a non-free tier charge here? I saw no Stripe call in the route.",
    verified: '2026-11-16 read/diffed ifac and innergathering src/lib/cms/journey-actions.ts (comment-only diff)',
  },
];

const ignored: Area['ignored'] = [
  { key: 'sa:apps/ifac/src/lib/cms/journey-actions.ts#loadJourneyAction', why: 'read: where the person stands' },
  { key: 'sa:apps/ifac/src/lib/cms/journey-actions.ts#checkSiteAction', why: 'read: subdomain availability check' },
  { key: 'sa:apps/innergathering/src/lib/cms/journey-actions.ts#loadJourneyAction', why: 'read: where the person stands' },
  { key: 'sa:apps/innergathering/src/lib/cms/journey-actions.ts#checkSiteAction', why: 'read: subdomain availability check' },
];

export default { capabilities, ignored } satisfies Area;
