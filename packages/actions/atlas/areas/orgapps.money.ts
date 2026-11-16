import type { Area, Capability } from '../types';

const capabilities: Capability[] = [
  // ---------------- orgapps.money ----------------
  {
    id: 'payout-setup-save',
    area: 'orgapps.money',
    label: 'Save where I get paid (country and payout method)',
    does: "Saves the signed-in person's country and payout rail (Interac e-Transfer, Stripe or manual) and, for e-Transfer, the email to send to. A payout identity belongs to the person, not the site.",
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/sunjay/src/lib/payout-actions.ts#savePayoutSetupAction',
        service: [
          '@elkdonis/commerce/server#setPayoutIdentity',
          '@elkdonis/commerce/payout-rails#canEtransfer',
          '@elkdonis/commerce/payout-rails#normaliseCountry',
        ],
        address: { app: 'sunjay', path: '/manage', how: 'PayoutSetup form' },
      },
      {
        key: 'sa:apps/elktours/src/lib/payout-actions.ts#savePayoutSetupAction',
        service: [
          '@elkdonis/commerce/server#setPayoutIdentity',
          '@elkdonis/commerce/payout-rails#canEtransfer',
          '@elkdonis/commerce/payout-rails#normaliseCountry',
        ],
        address: { app: 'elktours', path: '/manage/tours', how: 'PayoutSetup form' },
      },
      {
        key: 'sa:apps/katie-the-potter/src/lib/payout-actions.ts#savePayoutSetupAction',
        service: [
          '@elkdonis/commerce/server#setPayoutIdentity',
          '@elkdonis/commerce/payout-rails#canEtransfer',
          '@elkdonis/commerce/payout-rails#normaliseCountry',
        ],
        address: { app: 'katie-the-potter', path: '/manage/payouts', how: 'PayoutSetup form' },
        note: 'also regex-validates the e-Transfer email',
      },
      {
        "key": "sa:apps/art-auction/src/app/studio/actions.ts#savePayoutSetupAction",
        "service": [
          "@elkdonis/commerce/payout-rails#canEtransfer",
          "@elkdonis/commerce/payout-rails#normaliseCountry",
          "@elkdonis/commerce/server#setPayoutIdentity"
        ],
        "address": {
          "app": "art-auction",
          "path": "/studio/payouts",
          "how": "the Save button of the payout panel (app/studio/_components/payout-panel.tsx)"
        }
      },
    ],
    entry: null,
    status: 'users.country / payout_method / payout_email for the person match (getPayoutIdentity)',
    risk: ['money'],
    confirm: {
      text: 'Save your payout details? Payments from {org} will go to {where}. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    inputs: 'country, rail, payoutEmail',
    drift: "sunjay and elktours are identical except revalidatePath (/manage vs /manage/tours). Gate in both: getViewer (any signed-in person; unauthenticated redirects to login). katie-the-potter is trimmed: gate is getApiEditor (owner/guide only, so a signed-in non-editor cannot save their own payout identity there), revalidates /manage layout, and validates the e-Transfer email with a regex (sunjay/elktours only check non-empty). All three throw on bad input rather than returning {ok:false}. ifac has no setup action (it uses a popup that only starts Stripe).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (sunjay, art-auction). Differences by app:\n- art-auction (was market-payout-setup-save): Same payout idea as payout-setup-save (orgapps.money: sunjay, katie, elktours and ifac copies). This copy re-checks country against rail on the server; setPayoutIdentity is the shared service.",
    canonical: "commerce setPayoutIdentity with the country/rail/email validation (including the email regex) moved into commerce, behind one kit action gated on 'signed-in person'.",
    open: "katie's e-Transfer email regex is stricter than sunjay/elktours (their copies accept any non-empty string): fix at canonical. katie's gate differs (editor) from the person-level gate elsewhere.\nart-auction (market-payout-setup-save): The payout email is not format-validated here (katie validates its e-Transfer email); the rail rule is. Changing the payout email redirects where future proceeds go, with no confirmation email to the old address.",
    verified: '2026-11-16 read/diffed {sunjay,elktours,katie-the-potter,ifac}/lib/payout-actions.ts; ifac+innergathering cms/own-service-actions.ts; ifac cms/store-actions.ts, lib/manage-auth.ts, lib/data.ts canManageIfac',
  },
  {
    id: 'payout-stripe-start',
    area: 'orgapps.money',
    label: 'Connect Stripe to get paid',
    does: 'Begins or resumes Stripe Express onboarding for the signed-in person and sends the browser to Stripe.',
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
        key: 'sa:apps/sunjay/src/lib/payout-actions.ts#startPayoutsAction',
        service: ['@elkdonis/checkout/stripe#startPayoutsFor'],
        address: { app: 'sunjay', path: '/manage', how: 'Payouts tab of the profile pop-up' },
      },
      {
        key: 'sa:apps/sunjay/src/lib/payout-actions.ts#startStripeOnboardingAction',
        service: ['@elkdonis/checkout/stripe#startPayoutsFor'],
        address: { app: 'sunjay', path: '/manage', how: 'Connect Stripe button after saving setup' },
      },
      {
        key: 'sa:apps/elktours/src/lib/payout-actions.ts#startPayoutsAction',
        service: ['@elkdonis/checkout/stripe#startPayoutsFor'],
        address: { app: 'elktours', path: '/manage/tours', how: 'Payouts tab of the profile pop-up' },
      },
      {
        key: 'sa:apps/elktours/src/lib/payout-actions.ts#startStripeOnboardingAction',
        service: ['@elkdonis/checkout/stripe#startPayoutsFor'],
        address: { app: 'elktours', path: '/manage/tours', how: 'Connect Stripe button' },
      },
      {
        key: 'sa:apps/katie-the-potter/src/lib/payout-actions.ts#startStripeOnboardingAction',
        service: ['@elkdonis/checkout/stripe#startPayoutsFor'],
        address: { app: 'katie-the-potter', path: '/manage/payouts', how: 'Connect Stripe button' },
      },
      {
        key: 'sa:apps/ifac/src/lib/cms/payout-actions.ts#startPayoutsAction',
        service: ['@elkdonis/checkout/stripe#startPayoutsFor'],
        address: { app: 'ifac', path: '/center', how: 'Payouts tab (first tab of the Center)' },
        note: 'origin from env NEXT_PUBLIC_APP_URL with a localhost:3008 fallback',
      },
      {
        "key": "sa:apps/arts-collective/src/lib/cms/payout-actions.ts#startPayoutsAction",
        "service": [
          "startPayoutsFor"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/learn",
          "surface": "profile:payouts",
          "anchor": "payout-stripe-start",
          "how": "The Set up payouts button on the Payouts tab of the profile popup (LearnHost.tsx profile.startPayouts); it returns a Stripe link."
        }
      },
      {
        "key": "sa:apps/innergathering/src/lib/cms/blog-actions.ts#startPayoutsAction",
        "service": [
          "(getViewer: any signed-in person)",
          "@elkdonis/checkout/stripe#startPayoutsFor"
        ],
        "address": {
          "app": "innergathering",
          "path": "/center",
          "how": "Payouts tab of the profile pop-up (first tab of the Center)"
        },
        "note": "origin from NEXT_PUBLIC_APP_URL with a http://localhost:3015 fallback"
      },
      {
        "key": "sa:apps/art-auction/src/app/studio/actions.ts#startStripeOnboardingAction",
        "service": [
          "@elkdonis/checkout/stripe#startStripeOnboarding",
          "@elkdonis/checkout/stripe#isCardPaymentAvailable"
        ],
        "address": {
          "app": "art-auction",
          "path": "/studio/payouts",
          "how": "the Set up card payouts button (app/studio/_components/payout-panel.tsx)"
        }
      },
    ],
    entry: "payouts",
    status: 'users.stripe_account_id set, and stripe_onboarded_at set once Stripe says payable',
    risk: ['money'],
    confirm: {
      text: 'Set up payouts at Stripe for {email}? You choose the country there, and it cannot be changed without disconnecting. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    inputs: 'country?',
    drift: "All call checkout startPayoutsFor. sunjay/elktours: viewer from getViewer, origin via publicOriginFrom(headers) and return /api/payouts/return. katie: getApiEditor gate (editor only), origin from lib/origin siteOrigin. ifac: origin read from NEXT_PUBLIC_APP_URL or a hard-coded http://localhost:3008 fallback (would send Stripe a localhost return URL if the env were unset on production), return path /center?payouts=done. Two start actions per app on sunjay/elktours (popup and /manage button).\nMerged 2026-11-16 (consolidation 2): 4 rows, 4 apps (sunjay, arts-collective, innergathering, art-auction). Differences by app:\n- arts-collective (was start-payouts): no drift recorded\n- innergathering (was payout-stripe-start-center): Same call as payout-stripe-start in orgapps.money (checkout startPayoutsFor); that file has the sunjay, elktours, katie and ifac copies, this innergathering one sits in blog-actions.ts and was missed. Same localhost fallback as ifac (localhost:3015 here).\n- art-auction (was market-payout-stripe-start): Same as payout-stripe-start (orgapps.money).",
    canonical: 'checkout startPayoutsFor, with origin resolved by publicOriginFrom in every host; one kit action.',
    open: "ifac origin fallback to localhost: confirm NEXT_PUBLIC_APP_URL is set in the production ifac container.\narts-collective (start-payouts): Money: the dock links, never runs. The wording is for the go-there card.\ninnergathering (payout-stripe-start-center): innergathering origin falls back to http://localhost:3015 when NEXT_PUBLIC_APP_URL is unset: confirm it is set in production.",
    verified: '2026-11-16 read/diffed {sunjay,elktours,katie-the-potter,ifac}/lib/payout-actions.ts; ifac+innergathering cms/own-service-actions.ts; ifac cms/store-actions.ts, lib/manage-auth.ts, lib/data.ts canManageIfac',
  },
  {
    id: 'payout-disconnect',
    area: 'orgapps.money',
    label: 'Disconnect my payout account',
    does: "Disconnects the person's Stripe account and forgets the country, the only way out of an account created under the wrong country.",
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
        key: 'sa:apps/sunjay/src/lib/payout-actions.ts#disconnectPayoutsAction',
        service: ['@elkdonis/checkout/stripe#disconnectPayoutsFor'],
        address: { app: 'sunjay', path: '/manage', how: 'Disconnect in the Payouts tab' },
      },
      {
        key: 'sa:apps/elktours/src/lib/payout-actions.ts#disconnectPayoutsAction',
        service: ['@elkdonis/checkout/stripe#disconnectPayoutsFor'],
        address: { app: 'elktours', path: '/manage/tours', how: 'Disconnect in the Payouts tab' },
      },
      {
        key: 'sa:apps/katie-the-potter/src/lib/payout-actions.ts#disconnectPayoutsAction',
        service: ['@elkdonis/checkout/stripe#disconnectPayoutsFor'],
        address: { app: 'katie-the-potter', path: '/manage/payouts', how: 'Disconnect button' },
      },
      {
        key: 'sa:apps/ifac/src/lib/cms/payout-actions.ts#disconnectPayoutsAction',
        service: ['@elkdonis/checkout/stripe#disconnectPayoutsFor'],
        address: { app: 'ifac', path: '/center', how: 'Disconnect in the Payouts tab' },
        note: 'no revalidatePath',
      },
      {
        "key": "sa:apps/arts-collective/src/lib/cms/payout-actions.ts#disconnectPayoutsAction",
        "service": [
          "disconnectPayoutsFor"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/learn",
          "surface": "profile:payouts",
          "anchor": "payout-disconnect",
          "how": "The disconnect control on the Payouts tab (LearnHost.tsx profile.disconnectPayouts)."
        }
      },
      {
        "key": "sa:apps/innergathering/src/lib/cms/blog-actions.ts#disconnectPayoutsAction",
        "service": [
          "(getViewer: any signed-in person)",
          "@elkdonis/checkout/stripe#disconnectPayoutsFor"
        ],
        "address": {
          "app": "innergathering",
          "path": "/center",
          "how": "Disconnect in the Payouts tab"
        }
      },
      {
        "key": "sa:apps/art-auction/src/app/studio/actions.ts#disconnectStripeAction",
        "service": [
          "@elkdonis/checkout/stripe#disconnectStripeAccount"
        ],
        "address": {
          "app": "art-auction",
          "path": "/studio/payouts",
          "how": "the Disconnect button (app/studio/_components/payout-panel.tsx)"
        }
      },
    ],
    entry: null,
    status: 'users.stripe_account_id is null',
    risk: ['money', 'irreversible'],
    confirm: {
      text: 'Disconnect your payout account? You need to set it up again before you can be paid. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    drift: "Same call. Gate: sunjay/elktours/ifac any signed-in person; katie getApiEditor. Revalidate differs: sunjay /manage, elktours /manage/tours, katie /manage layout, ifac none.\nMerged 2026-11-16 (consolidation 2): 4 rows, 4 apps (sunjay, arts-collective, innergathering, art-auction). Differences by app:\n- arts-collective (was disconnect-payouts): no drift recorded\n- innergathering (was payout-disconnect-center): Same as payout-disconnect in orgapps.money (sunjay, elktours, katie, ifac); innergathering copy missed there. No revalidatePath.\n- art-auction (was market-payout-disconnect): Same as payout-disconnect (orgapps.money).",
    canonical: 'checkout disconnectPayoutsFor via one kit action.',
    verified: '2026-11-16 read/diffed {sunjay,elktours,katie-the-potter,ifac}/lib/payout-actions.ts; ifac+innergathering cms/own-service-actions.ts; ifac cms/store-actions.ts, lib/manage-auth.ts, lib/data.ts canManageIfac',
    open: "arts-collective (disconnect-payouts): What happens to a balance owed at disconnect time? Not traced.\nart-auction (market-payout-disconnect): No check for unpaid card orders or balances held for the account at the moment of disconnect.",
  },
  {
    id: 'own-service-save',
    area: 'orgapps.money',
    label: 'Save one of my services',
    does: 'Creates or updates a service the signed-in person offers (title, price in CAD, format), published to the network when set to published.',
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
        key: 'sa:apps/ifac/src/lib/cms/own-service-actions.ts#saveOwnServiceAction',
        service: ['@elkdonis/services#saveOffering'],
        address: { app: 'ifac', path: '/center', how: 'My services tab, Save' },
      },
      {
        key: 'sa:apps/innergathering/src/lib/cms/own-service-actions.ts#saveOwnServiceAction',
        service: ['@elkdonis/services#saveOffering'],
        address: { app: 'innergathering', path: '/center', how: 'My services tab, Save' },
      },
      {
        "key": "sa:apps/arts-collective/src/lib/cms/own-service-actions.ts#saveOwnServiceAction",
        "service": [
          "saveOffering"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/learn",
          "surface": "me:offer",
          "anchor": "own-service-save",
          "how": "The Offer form in the me popup (components/learn/LearnHost.tsx services.save)."
        }
      },
      {
        "key": "sa:apps/artdirect/src/lib/offering-actions.ts#saveOfferingAction",
        "service": [
          "(getCurrentUser: any signed-in person)",
          "@elkdonis/services#saveOffering",
          "@elkdonis/services#serviceInputFromAnswers"
        ],
        "address": {
          "app": "artdirect",
          "path": "/{slug}",
          "how": "Save and Publish in the manage space (components/oad/ManageSpace.tsx)"
        }
      },
    ],
    entry: "service",
    status: 'an offering of kind service by this person exists with the title and status published',
    risk: ['public', 'money'],
    confirm: {
      text: 'Save your service “{title}” at {price}? If it is published, visitors can see it. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    inputs: 'title, shortDescription, price, format, status',
    drift: "Byte-identical (differ only in log prefix). Any signed-in person, no org role; hard-codes CAD, visibility PUBLIC, shareToNetwork true. Price is validated in the action (number >= 0, blank = free); the body HTML is built by string replace, not sanitised here (services is expected to). sunjay has a different wrapper under lib/puck/service-actions.ts (not mapped here).\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (ifac, arts-collective, artdirect). Differences by app:\n- arts-collective (was save-my-service): Org offerings go through service-form-actions (upsertServiceOffering); personal ones here (saveOffering).\n- artdirect (was artdirect-offering-save): own-service-save / orgapps.money own-service-save, here through services saveOffering for meetings and services and shareToNetwork defaulting to true.",
    canonical: 'services saveOffering via one kit action; currency from site config.',
    verified: '2026-11-16 read/diffed {sunjay,elktours,katie-the-potter,ifac}/lib/payout-actions.ts; ifac+innergathering cms/own-service-actions.ts; ifac cms/store-actions.ts, lib/manage-auth.ts, lib/data.ts canManageIfac',
    open: "arts-collective (save-my-service): Priced and bookable: money flag means link only.\nartdirect (artdirect-offering-save): price and currency come from the form (num(a.price), str(a.currency)); whether saveOffering validates the currency against an allow-list was not read (he-service-save and the ifac own-service rows do, per orgapps.money notes).",
  },
  {
    id: 'own-service-status',
    area: 'orgapps.money',
    label: 'Publish or unpublish one of my services',
    does: "Switches one of the person's own services between draft and published.",
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
        key: 'sa:apps/ifac/src/lib/cms/own-service-actions.ts#setOwnServiceStatusAction',
        service: ['@elkdonis/services#setOfferingStatus'],
        address: { app: 'ifac', path: '/center', how: 'My services tab, Publish switch' },
      },
      {
        key: 'sa:apps/innergathering/src/lib/cms/own-service-actions.ts#setOwnServiceStatusAction',
        service: ['@elkdonis/services#setOfferingStatus'],
        address: { app: 'innergathering', path: '/center', how: 'My services tab, Publish switch' },
      },
      {
        "key": "sa:apps/arts-collective/src/lib/cms/own-service-actions.ts#setOwnServiceStatusAction",
        "service": [
          "setOfferingStatus"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/learn",
          "surface": "me:offer",
          "anchor": "own-service-status",
          "how": "The publish / unpublish switch on a service row in the me popup (LearnHost.tsx services.setStatus)."
        }
      },
      {
        "key": "sa:apps/artdirect/src/lib/offering-actions.ts#setOfferingStatusAction",
        "service": [
          "(getCurrentUser: any signed-in person)",
          "@elkdonis/services#setOfferingStatus (owner check inside services)"
        ],
        "address": {
          "app": "artdirect",
          "path": "/{slug}",
          "how": "publish toggle in the manage space (components/oad/ManageSpace.tsx)"
        }
      },
    ],
    entry: "service",
    status: 'the offering status equals the chosen value',
    risk: ['public'],
    confirm: {
      text: 'Set your service “{title}” to {state}? Visitors see it only while it is published.',
      status: 'draft',
      wave: 3,
    },
    drift: "Byte-identical; ownership is checked inside services setOfferingStatus(viewer.userId, id) since the action takes only an id.\nMerged 2026-11-16 (consolidation 2): 3 rows, 3 apps (ifac, arts-collective, artdirect). Differences by app:\n- arts-collective (was set-my-service-status): no drift recorded\n- artdirect (was artdirect-offering-status-set): Same as arts-collective own-service-status / orgapps.money own-service-status.",
    canonical: 'services setOfferingStatus via the kit.',
    verified: '2026-11-16 read/diffed {sunjay,elktours,katie-the-potter,ifac}/lib/payout-actions.ts; ifac+innergathering cms/own-service-actions.ts; ifac cms/store-actions.ts, lib/manage-auth.ts, lib/data.ts canManageIfac',
    inputs: "threadId, status",
  },
  {
    id: 'ifac-store-open',
    area: 'orgapps.money',
    label: "Open the organisation's store",
    does: "Opens the organisation's store on the marketplace org.",
    class: 'admin',
    actors: ['owner', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/ifac/src/lib/cms/store-actions.ts#openIfacStoreAction',
        service: ['@elkdonis/commerce/server#openOrgStore'],
        address: { app: 'ifac', path: '/manage/store', how: 'Open store button (store admin page)' },
      },
    ],
    status: 'getStoreForOrg(ifac, marketplace) returns a store',
    risk: ['money', 'public'],
    drift: 'IFAC only. Gate is getIfacManager = canManageIfac (ownerEmails allowlist, global admin, or owner/guide row; ifac now has 2 owners and 4 guides), the same broad gate as the ifac questionnaire. Same capability as arts-collective.hub:open-org-store (the arts-collective hosts); both rows share this canonical path.',
    canonical: 'commerce openOrgStore via a shared hub Business card action when other orgs get stores.',
    open: 'Security finding 4 (docs/open/mcp-foundations/ATLAS_SECURITY_2026-11-16.md): the gate is canManageIfac, which admits allowlisted emails and global admins; the store writes themselves are checked again in commerce.',
    verified: '2026-11-16 read/diffed {sunjay,elktours,katie-the-potter,ifac}/lib/payout-actions.ts; ifac+innergathering cms/own-service-actions.ts; ifac cms/store-actions.ts, lib/manage-auth.ts, lib/data.ts canManageIfac',
  },
  {
    id: 'ifac-store-team',
    area: 'orgapps.money',
    label: "Change the store's team",
    does: 'Adds a team member by email or removes one from the organisation store.',
    class: 'admin',
    actors: ['owner', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/ifac/src/lib/cms/store-actions.ts#addIfacStoreMemberAction',
        service: ['@elkdonis/commerce/server#addStoreMemberByEmail', '@elkdonis/commerce/queries#getStoreForOrg'],
        address: { app: 'ifac', path: '/manage/store', how: 'Add member (store admin page)' },
      },
      {
        key: 'sa:apps/ifac/src/lib/cms/store-actions.ts#removeIfacStoreMemberAction',
        service: [
          '@elkdonis/commerce/server#canManageStoreTeam',
          '@elkdonis/commerce/server#removeStoreMember',
          '@elkdonis/commerce/queries#getStoreForOrg',
        ],
        address: { app: 'ifac', path: '/manage/store', how: 'Remove member (store admin page)' },
      },
    ],
    status: 'store_member rows match',
    risk: ['others', 'money'],
    drift: 'Within the file, removal re-checks canManageStoreTeam(viewer, store.id) before removing, but addIfacStoreMemberAction only checks the ifac-manager gate and relies on commerce addStoreMemberByEmail (actorUserId) to check; the two are not symmetrical. Same capability as arts-collective.hub:add-store-team-member (the arts-collective hosts); both rows share this canonical path.',
    canonical: 'commerce addStoreMemberByEmail / removeStoreMember with canManageStoreTeam inside both.',
    open: 'Does commerce addStoreMemberByEmail check canManageStoreTeam for actorUserId? The action does not. Add-path may be weaker than remove-path. Security finding 4 (docs/open/mcp-foundations/ATLAS_SECURITY_2026-11-16.md): the gate is canManageIfac, which admits allowlisted emails and global admins; the store writes themselves are checked again in commerce.',
    verified: '2026-11-16 read/diffed {sunjay,elktours,katie-the-potter,ifac}/lib/payout-actions.ts; ifac+innergathering cms/own-service-actions.ts; ifac cms/store-actions.ts, lib/manage-auth.ts, lib/data.ts canManageIfac',
  },
  {
    id: 'ifac-store-payees',
    area: 'orgapps.money',
    label: "Manage the store's charity and beneficiary payees",
    does: 'Adds a charity payee, adds or removes an org beneficiary, and approves a payee for the organisation store.',
    class: 'admin',
    actors: ['owner', 'admin'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/ifac/src/lib/cms/store-actions.ts#addIfacCharityAction',
        service: ['@elkdonis/commerce/server#addCharityPayee'],
        address: { app: 'ifac', path: '/manage/store', how: 'Add charity (store admin page)' },
      },
      {
        key: 'sa:apps/ifac/src/lib/cms/store-actions.ts#addIfacOrgBeneficiaryAction',
        service: ['@elkdonis/commerce/server#addOrgBeneficiary'],
        address: { app: 'ifac', path: '/manage/store', how: 'Add beneficiary (store admin page)' },
      },
      {
        key: 'sa:apps/ifac/src/lib/cms/store-actions.ts#removeIfacBeneficiaryAction',
        service: ['@elkdonis/commerce/server#removeOrgBeneficiary'],
        address: { app: 'ifac', path: '/manage/store', how: 'Remove beneficiary (store admin page)' },
      },
      {
        key: 'sa:apps/ifac/src/lib/cms/store-actions.ts#approveIfacPayeeAction',
        service: ['@elkdonis/commerce/server#approvePayee'],
        address: { app: 'ifac', path: '/manage/store', how: 'Approve payee (store admin page)' },
      },
    ],
    status: 'store payee rows match; payee approved flag set',
    risk: ['money', 'irreversible'],
    drift: 'IFAC only; all four go through getIfacManager then a commerce function that takes actorUserId and is expected to authorise. Same capability as arts-collective.hub:add-charity-beneficiary (the arts-collective hosts); both rows share this canonical path.',
    canonical: 'commerce payee functions via the shared hub Business card.',
    open: 'Security finding 4 (docs/open/mcp-foundations/ATLAS_SECURITY_2026-11-16.md): the gate is canManageIfac, which admits allowlisted emails and global admins; the store writes themselves are checked again in commerce.',
    verified: '2026-11-16 read/diffed {sunjay,elktours,katie-the-potter,ifac}/lib/payout-actions.ts; ifac+innergathering cms/own-service-actions.ts; ifac cms/store-actions.ts, lib/manage-auth.ts, lib/data.ts canManageIfac',
  },
];

const ignored: Area['ignored'] = [
  { key: 'sa:apps/sunjay/src/lib/payout-actions.ts#loadProfilePageAction', why: 'read: what the Payouts tab shows' },
  { key: 'sa:apps/elktours/src/lib/payout-actions.ts#loadProfilePageAction', why: 'read: what the Payouts tab shows' },
  { key: 'sa:apps/ifac/src/lib/cms/payout-actions.ts#loadProfilePageAction', why: 'read: sections and payouts state (raw SELECT)' },
  { key: 'sa:apps/sunjay/src/lib/payout-actions.ts#setProfileSectionAction', why: 'dead stub: always returns an error ("no page sections here"), required by the popup connector type' },
  { key: 'sa:apps/elktours/src/lib/payout-actions.ts#setProfileSectionAction', why: 'dead stub: always returns an error' },
  { key: 'sa:apps/ifac/src/lib/cms/own-service-actions.ts#listOwnServicesAction', why: 'read: lists own services' },
  { key: 'sa:apps/innergathering/src/lib/cms/own-service-actions.ts#listOwnServicesAction', why: 'read: lists own services' },
];

export default { capabilities, ignored } satisfies Area;
