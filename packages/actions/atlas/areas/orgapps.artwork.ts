import type { Area, Capability } from '../types';

const capabilities: Capability[] = [
  // ---------------- orgapps.artwork ----------------
  {
    id: 'artwork-draft-save',
    area: 'orgapps.artwork',
    label: 'Save an artwork',
    does: "Creates or updates an artwork (title, picture, size, price) in the person's marketplace store as a draft; katie's form can publish in the same save.",
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
        key: 'sa:apps/ifac/src/lib/cms/artwork-actions.ts#saveArtworkDraftAction',
        service: ['@elkdonis/commerce/server#createArtwork', '@elkdonis/commerce/server#updateArtwork'],
        address: { app: 'ifac', path: '/center', how: 'artwork journey card, Save piece' },
      },
      {
        key: 'sa:apps/innergathering/src/lib/cms/artwork-actions.ts#saveArtworkDraftAction',
        service: ['@elkdonis/commerce/server#createArtwork', '@elkdonis/commerce/server#updateArtwork'],
        address: { app: 'innergathering', path: '/center', how: 'artwork journey card, Save piece' },
      },
      {
        key: 'sa:apps/katie-the-potter/src/lib/channel-artwork-actions.ts#channelArtworkSaveAction',
        service: [
          '@elkdonis/commerce/server#createArtwork',
          '@elkdonis/commerce/server#updateArtwork',
          '@elkdonis/commerce/server#publishArtwork',
          '@elkdonis/commerce/server#setArtworkMedia',
        ],
        address: {
          app: 'katie-the-potter',
          path: '/manage/pieces',
          how: 'shared artwork form (channel) in the console',
        },
        note: 'also publishes when intent is published; raw SQL',
      },
      {
        key: 'sql:apps/katie-the-potter/src/lib/channel-artwork-actions.ts#channelArtworkSaveAction',
        service: ['@elkdonis/db#db'],
        address: { app: 'katie-the-potter', path: '/manage/pieces', how: 'sql twin' },
      },
      {
        "key": "sa:apps/arts-collective/src/lib/artwork-form-actions.ts#saveArtworkFormAction",
        "service": [
          "createArtwork",
          "publishArtwork",
          "setArtworkAvailability",
          "setArtworkMedia"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/studio/make",
          "anchor": "artwork-draft-save",
          "how": "The Artwork form in the Studio create canvas (StudioApp.tsx; canEdit only with a store)."
        }
      },
      {
        "key": "sa:apps/arts-collective/src/lib/cms/artwork-actions.ts#saveArtworkDraftAction",
        "service": [
          "createArtwork",
          "updateArtwork"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/learn",
          "surface": "artwork",
          "anchor": "artwork-draft-save",
          "how": "The artwork draft form of the sell-your-art journey popup (components/learn/LearnHost.tsx artwork.saveDraft)."
        },
        "note": "The /learn copy: draft only, one image, no availability."
      },
      {
        "key": "sa:apps/innergathering/src/lib/cms/art-piece-actions.ts#createArtPieceAction",
        "service": [
          "@elkdonis/commerce/server#createArtwork"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub",
          "how": "the art piece form of the publish gate (components/hub/publish-gates.tsx)"
        },
        "note": "Gate: getApiMember. The store comes from the person (createArtwork errors without one)."
      },
      {
        "key": "sa:apps/art-auction/src/app/studio/actions.ts#createArtworkAction",
        "service": [
          "@elkdonis/commerce/server#createArtwork"
        ],
        "address": {
          "app": "art-auction",
          "path": "/studio/artworks/new",
          "how": "the Save button of the artwork form (app/studio/_components/artwork-form.tsx)"
        }
      },
      {
        "key": "sa:apps/ifac/src/lib/cms/art-piece-actions.ts#createArtPieceAction",
        "service": [
          "(getHubViewer: owner, guide or member of ifac via hasOrgRole)",
          "@elkdonis/commerce/server#createArtwork",
          "@elkdonis/commerce/server#publishArtwork",
          "@elkdonis/commerce/server#canActForStore (org store)"
        ],
        "address": {
          "app": "ifac",
          "path": "/hub/compose",
          "how": "compose:art-piece pop-up (components/hub/art-piece-composer.tsx, HubSurfaces.tsx)"
        }
      },
    ],
    entry: "artwork",
    status: 'an artwork row for the store exists with the title (status draft, or available when published)',
    risk: ['money', 'public'],
    confirm: {
      text: 'Save “{title}” at {price} in {where}? It stays private until you put it on sale. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    inputs: 'title, image, medium, year, size, kind, price, description',
    drift: "ifac and innergathering are identical (log prefix only; they differ on the marketplace URL used by publish). Gate: any signed-in person (commerce checks for a store). Price is major-units string x100, CAD only, one image, no URL validation of imageUrl (stored as given). katie-the-potter is a different, stricter implementation: guardStore (store membership), CAD/USD/EUR/GBP, up to 12 images required to be under /api/media/EAC_Network/ with no '..', edition and stock rules, shipping size-and-weight rule before sale, raw SQL via db. Same commerce createArtwork/updateArtwork underneath. sunjay and others do not have artwork actions.\nMerged 2026-11-16 (consolidation 2): 5 rows, 4 apps (ifac, arts-collective, innergathering, art-auction). Differences by app:\n- arts-collective (was save-artwork): Also lib/cms/artwork-actions.ts (saveArtworkDraftAction, publishArtworksAction) in the /learn journey: createArtwork/updateArtwork vs createArtwork/publishArtwork here.\n- innergathering (was ig-art-piece-create): price major units to minor on the server (Math.round(x*100), min 0), imageUrl stored as given, no currency choice, no publish step here.\n- art-auction (was artwork-create): Single copy in the app.\n- ifac (was ifac-art-piece-create): Studio forms (packages/studio) save artwork through arts-collective artwork-draft-save, which ignores the org and has editions, credit and auction; this ifac composer is one picture, publishes on save, and has the org-store switch. See docs/open/IFAC_STUDIO_STORES_AND_KIT_2026-11-12.md.\nRelated: artwork-journey-publish (publish step) and ifac-store-open.",
    canonical: "commerce createArtwork/updateArtwork/setArtworkMedia with katie's validation (image path rule, currency list, bounds) moved into commerce; one kit action built on guardStore.",
    open: "ifac/innergathering accept any imageUrl string and CAD only; katie enforces library-only images. Should the stricter rules apply everywhere?\narts-collective (save-artwork): Priced and for sale: link only. Which of the two forms does the dock point to?\ninnergathering (ig-art-piece-create): SECURITY (mild, same as the other copies): imageUrl and descriptionHtml are passed to createArtwork as typed (lib/cms/art-piece-actions.ts:84-107); whether createArtwork sanitises descriptionHtml was not read. The price is the artist’s own listing price, not a payment amount, so no client-trusted charge. Is there an entry for \"artwork\" that this should be?\nart-auction (artwork-create): price is sent in major units and converted on the server. Credit and beneficiary ids come from the client and are validated inside createArtwork (not re-read). The credit picker calls searchPeopleAction, which returns the NAME AND EMAIL of up to 8 people matching any substring, from the whole network, to any signed-in person with an active store seat (privacy: it is a user-directory read with emails).\nifac (ifac-art-piece-create): SECURITY: apps/ifac/src/lib/cms/art-piece-actions.ts:99-136 descriptionHtml (client HTML) and imageUrl (any URL) are passed to createArtwork unvalidated here; whether commerce sanitises them was not read. Price is the maker's own (fine). The canListArtPieceAction check (line 66) is a read.",
    verified: '2026-11-16 read/diffed ifac+innergathering cms/artwork-actions.ts (diff), danamccool/artwork-actions.ts, katie-the-potter/channel-artwork-actions.ts (first 150 lines)',
  },
  {
    id: 'artwork-journey-publish',
    area: 'orgapps.artwork',
    label: 'Put artworks on sale',
    does: "Publishes up to 50 of the person's artworks on the marketplace and returns their links.",
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/ifac/src/lib/cms/artwork-actions.ts#publishArtworksAction',
        service: ['@elkdonis/commerce/server#publishArtwork', '@elkdonis/commerce/links#marketplaceLinks'],
        address: { app: 'ifac', path: '/center', how: 'artwork journey card, Publish' },
      },
      {
        key: 'sa:apps/innergathering/src/lib/cms/artwork-actions.ts#publishArtworksAction',
        service: ['@elkdonis/commerce/server#publishArtwork', '@elkdonis/commerce/links#marketplaceLinks'],
        address: { app: 'innergathering', path: '/center', how: 'artwork journey card, Publish' },
      },
      {
        "key": "sa:apps/arts-collective/src/lib/cms/artwork-actions.ts#publishArtworksAction",
        "service": [
          "publishArtwork"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/learn",
          "surface": "artwork",
          "anchor": "artwork-journey-publish",
          "how": "The Publish button of the artwork step in the sell-your-art journey popup (components/learn/LearnHost.tsx artwork.publish)."
        }
      },
    ],
    entry: "artwork",
    status: "the artworks' status is available (listed)",
    risk: ['money', 'public'],
    confirm: {
      text: 'Put {count} artworks on sale on the marketplace? Visitors can buy them. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    inputs: 'ids[]',
    drift: "Same code; ifac reads the marketplace URL from siteConfig.marketplaceUrl with from 'ifac', innergathering reads process.env.NEXT_PUBLIC_ART_AUCTION_URL with a localhost:3009 fallback and from 'inner_group'. Loops publishArtwork per id with no ownership check in the action (commerce publishArtwork(id, actorUserId) is expected to check).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (ifac, arts-collective). Differences by app:\n- arts-collective (was publish-artworks): Studio saveArtworkFormAction publishes one artwork through the same publishArtwork.",
    canonical: 'commerce publishArtwork (ownership inside) via one kit action; marketplace URL from siteConfig.',
    open: 'innergathering localhost fallback for the marketplace URL: confirm the env is set in production. Confirm commerce publishArtwork checks that the actor owns each id.',
    verified: '2026-11-16 read/diffed ifac+innergathering cms/artwork-actions.ts (diff), danamccool/artwork-actions.ts, katie-the-potter/channel-artwork-actions.ts (first 150 lines)',
  },
  {
    id: 'artwork-display-set',
    area: 'orgapps.artwork',
    label: 'Change how an artwork is shown on the site',
    does: "Sets an artwork as for sale, portfolio-only or hidden on the artist's own site, and may confirm its title.",
    class: 'person',
    actors: ['owner'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/danamccool/src/lib/artwork-actions.ts#changeArtwork',
        service: ['@elkdonis/db#db'],
        address: { app: 'danamccool', path: '/manage/artworks', how: 'artwork row mode buttons' },
        note: 'raw UPDATE on artwork',
      },
      {
        key: 'sql:apps/danamccool/src/lib/artwork-actions.ts#changeArtwork',
        service: ['@elkdonis/db#db'],
        address: { app: 'danamccool', path: '/manage/artworks', how: 'sql twin' },
      },
      {
        key: 'sa:apps/danamccool/src/lib/artwork-actions.ts#updateArtwork',
        service: ['(wrapper over changeArtwork)'],
        address: { app: 'danamccool', path: '/manage/artworks', how: 'form action wrapper' },
      },
    ],
    entry: null,
    status: 'artwork.status and metadata.site match the chosen mode (available | archived+portfolio | archived)',
    risk: ['public', 'money'],
    confirm: {
      text: 'Show “{title}” as {state} on {org}’s site? Visitors see the change straight away. Payments happen on the checkout or Stripe page, not here.',
      status: 'draft',
      wave: 1,
    },
    inputs: 'id, mode, title',
    drift: "danamccool only, raw SQL in the app instead of commerce. Auth: viewer is the site owner's user id or role owner; every UPDATE is also scoped to artist_user_id so a forged id matches nothing. Leaves SOLD and RESERVED pieces alone. Not through commerce publishArtwork/unlist, so the marketplace's own side effects (if any) do not run: it writes 'available' and 'archived' directly, matching the marketplace studio's own unlist.",
    canonical: 'a commerce setArtworkListing(id, mode) that owns these status transitions; danamccool calls it.',
    verified: '2026-11-16 read/diffed ifac+innergathering cms/artwork-actions.ts (diff), danamccool/artwork-actions.ts, katie-the-potter/channel-artwork-actions.ts (first 150 lines)',
  },
];

const ignored: Area['ignored'] = [
  { key: 'sa:apps/ifac/src/lib/cms/artwork-actions.ts#checkStoreAction', why: 'read: does the person have an active store' },
  { key: 'sa:apps/innergathering/src/lib/cms/artwork-actions.ts#checkStoreAction', why: 'read: does the person have an active store' },
  { key: 'sa:apps/katie-the-potter/src/lib/channel-artwork-actions.ts#channelArtworkContextAction', why: 'read: form context' },
  { key: 'sa:apps/katie-the-potter/src/lib/channel-artwork-actions.ts#channelArtworkLoadAction', why: 'read: loads an artwork for the form' },
];

export default { capabilities, ignored } satisfies Area;
