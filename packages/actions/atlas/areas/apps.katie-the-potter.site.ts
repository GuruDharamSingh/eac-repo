import type { Area, Capability } from '../types';

// katie-the-potter site: round 2 curator, 2026-11-16. Conventions: atlas/JOURNAL.md. Generated from a structured definition.

const capabilities: Capability[] = [
  {
    "area": "katie.site",
    "scope": "org",
    "risk": [
      "public",
      "money"
    ],
    "id": "katie-piece-save",
    "label": "Save a piece",
    "does": "The store owner (or a team member who is an editor of the site) creates or edits a piece (title, description, kind, size, weight, price in CAD, USD, EUR or GBP, quantity, up to 12 library pictures) and optionally puts it on sale in the same step.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/katie-the-potter/src/lib/manage-actions.ts#savePieceAction",
        "service": [
          "@elkdonis/commerce/server#createArtwork",
          "updateArtwork",
          "setArtworkMedia",
          "publishArtwork",
          "(lib/manage.ts guardStore)"
        ],
        "address": {
          "app": "katie-the-potter",
          "path": "/manage/pieces/{id}",
          "how": "the Save and Save and put on sale buttons of components/manage/piece-form.tsx"
        }
      }
    ],
    "entry": null,
    "status": "artwork has a row in the site's store with the title and status draft or available",
    "confirm": {
      "text": "Save “{title}” at {price}? If you put it on sale, visitors can buy it from the site. Payments happen on the checkout or Stripe page, not here.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Same data as art-auction.studio artwork-draft-save / artwork-update / artwork-publish (and orgapps.artwork:artwork-draft-save for the Channel quick form), one form here instead of three actions. Differs: input is a plain object (not FormData), price 0 to 1,000,000 (0 = on request), quantity 1 to 999, images library-only (/api/media/EAC_Network/ and no \"..\"), size and weight demanded when shipping is on, a piece that is reserved or sold is frozen. katie is the one-artist seller console; its pieces are the marketplace store of the site owner.",
    "canonical": "@elkdonis/commerce/server#createArtwork / updateArtwork / publishArtwork behind one shared kit action (art-auction, katie and artdirect all call these)",
    "open": "Gate is guardStore: signed-in editor of the site AND store owner or store team member AND store active (lib/manage.ts), stricter than art-auction and the org apps. The price is set by the seller (major units, rounded); no buyer path trusts it, checkout re-prices from the stored artwork. descriptionHtml is sanitised in commerce createArtwork and updateArtwork (server/index.ts:1048, 1127), though the action only length-caps it.",
    "verified": "2026-11-16 read lib/manage-actions.ts, lib/manage.ts guardStore, components/manage/{piece-form,piece-row-actions}.tsx, packages/commerce server/index.ts createArtwork and updateArtwork, app/api/media/upload/route.ts, lib/site-store.ts, app/api/auth/*, app/api/pulse/route.ts, lib/channel-door.ts"
  },
  {
    "area": "katie.site",
    "scope": "org",
    "risk": [
      "public",
      "money"
    ],
    "id": "katie-piece-shown-as-set",
    "label": "Switch how a piece is shown",
    "does": "The store owner or team puts a piece on sale, shows it as a picture only (portfolio), or hides it; a sold or reserved piece cannot be switched.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/katie-the-potter/src/lib/manage-actions.ts#setShownAsAction",
        "service": [
          "@elkdonis/commerce/server#publishArtwork",
          "archiveArtwork",
          "(raw UPDATE artwork metadata site)"
        ],
        "address": {
          "app": "katie-the-potter",
          "path": "/manage/pieces",
          "how": "the Shown as menu of components/manage/piece-row-actions.tsx"
        }
      },
      {
        "key": "sql:apps/katie-the-potter/src/lib/manage-actions.ts#setShownAsAction",
        "note": "sql twin of sa:apps/katie-the-potter/src/lib/manage-actions.ts#setShownAsAction"
      }
    ],
    "entry": null,
    "status": "artwork.status is available (sale) or archived with metadata.site portfolio or no flag",
    "confirm": {
      "text": "Show “{title}” as {state}? If it is on sale, visitors can buy it. Payments happen on the checkout or Stripe page, not here.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Overlaps orgapps.artwork:artwork-display-set and art-auction.studio artwork-archive / artwork-publish; one switch over listing status plus a metadata flag here. katie is the one-artist seller console; its pieces are the marketplace store of the site owner.",
    "canonical": "@elkdonis/commerce/server#publishArtwork / archiveArtwork behind one shared kit action; move the metadata.site flag into a real column",
    "open": "The metadata.site portfolio flag is a convention shared with danamccool (action comment), written by raw SQL after the commerce call in a separate statement: a failure between them leaves a piece archived but unflagged.",
    "verified": "2026-11-16 read lib/manage-actions.ts, lib/manage.ts guardStore, components/manage/{piece-form,piece-row-actions}.tsx, packages/commerce server/index.ts createArtwork and updateArtwork, app/api/media/upload/route.ts, lib/site-store.ts, app/api/auth/*, app/api/pulse/route.ts, lib/channel-door.ts"
  },
  {
    "area": "katie.site",
    "scope": "org",
    "risk": [
      "public"
    ],
    "id": "katie-samples-retire",
    "label": "Retire all sample pieces",
    "does": "The store's owner archives every draft or available piece flagged metadata.sample = true in one go; pieces with an order behind them are left alone.",
    "class": "person",
    "actors": [
      "owner"
    ],
    "hosts": [
      {
        "key": "sa:apps/katie-the-potter/src/lib/manage-actions.ts#retireSamplesAction",
        "service": [
          "(raw UPDATE artwork status archived)"
        ],
        "address": {
          "app": "katie-the-potter",
          "path": "/manage/pieces",
          "how": "the Retire all samples button of components/manage/piece-row-actions.tsx"
        }
      },
      {
        "key": "sql:apps/katie-the-potter/src/lib/manage-actions.ts#retireSamplesAction",
        "note": "sql twin of sa:apps/katie-the-potter/src/lib/manage-actions.ts#retireSamplesAction"
      }
    ],
    "entry": null,
    "status": "no artwork of the store is draft or available with metadata sample true",
    "confirm": {
      "text": "Retire every sample piece in {org}’s shop? They disappear from the site and the shop. Your own pieces stay.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Katie-only (session doc open item 4: retire samples before real buyers). Writes artwork.status directly with raw SQL instead of commerce archiveArtwork, so no commerce audit or listing hooks run.",
    "canonical": "@elkdonis/commerce/server#archiveArtwork per piece",
    "open": "SECURITY (weak): the raw UPDATE sets status = archived without going through archiveArtwork (commerce audit and side effects skipped), scoped to store_id and metadata.sample. The owner-only check is store.ownerUserId === viewer.userId (manage-actions.ts:244), stricter than the rest.",
    "verified": "2026-11-16 read lib/manage-actions.ts, lib/manage.ts guardStore, components/manage/{piece-form,piece-row-actions}.tsx, packages/commerce server/index.ts createArtwork and updateArtwork, app/api/media/upload/route.ts, lib/site-store.ts, app/api/auth/*, app/api/pulse/route.ts, lib/channel-door.ts"
  },
  {
    "area": "katie.site",
    "scope": "org",
    "risk": [
      "none"
    ],
    "id": "katie-store-pin",
    "label": "Pin the site's store",
    "does": "Writes site_config shop:store, the site's pinned marketplace store, when no pin exists yet (derived from the first owner who has a store) or when a caller passes replace.",
    "class": "system",
    "actors": [
      "system"
    ],
    "hosts": [
      {
        "key": "sql:apps/katie-the-potter/src/lib/site-store.ts#pinStore",
        "service": [
          "(raw INSERT site_config)"
        ]
      }
    ],
    "status": "site_config has shop:store for the org",
    "drift": "Katie-only. The write happens as a side effect of a page read (getPinnedStore seeds the pin, site-store.ts:98-103); redeemClaim also writes the same key inside its transaction.",
    "canonical": "a one-time seed migration, with the pin changed only by an explicit owner action",
    "open": "A GET path writes (the seed); concurrent first requests race, handled by ON CONFLICT DO NOTHING. Nothing calls pinStore with replace (grep).",
    "verified": "2026-11-16 read lib/manage-actions.ts, lib/manage.ts guardStore, components/manage/{piece-form,piece-row-actions}.tsx, packages/commerce server/index.ts createArtwork and updateArtwork, app/api/media/upload/route.ts, lib/site-store.ts, app/api/auth/*, app/api/pulse/route.ts, lib/channel-door.ts"
  },
];

export default { capabilities, ignored: [] } satisfies Area;
