import type { Area, Capability } from '../types';

// katie-the-potter claim: round 2 curator, 2026-11-16. Conventions: atlas/JOURNAL.md. Generated from a structured definition.

const capabilities: Capability[] = [
  {
    "area": "katie.claim",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "katie-claim-link-create",
    "label": "Create the hand-over link",
    "does": "An owner of the site (or a network admin) creates a one-time link, valid 7 days, that makes whoever opens it the new owner of the site and its store; any earlier unused link is revoked. The URL is shown once and never stored.",
    "class": "person",
    "actors": [
      "owner",
      "admin"
    ],
    "hosts": [
      {
        "key": "sa:apps/katie-the-potter/src/lib/claim-actions.ts#createClaimLinkAction",
        "service": [
          "lib/manage-claim.ts#createClaimToken"
        ],
        "address": {
          "app": "katie-the-potter",
          "path": "/manage/people",
          "how": "the Create link button of components/manage/hand-over.tsx"
        }
      },
      {
        "key": "sql:apps/katie-the-potter/src/lib/manage-claim.ts#createClaimToken",
        "note": "sql twin of sa:apps/katie-the-potter/src/lib/claim-actions.ts#createClaimLinkAction"
      }
    ],
    "entry": null,
    "status": "org_claim_tokens has an unused, unrevoked, unexpired row for the org (activeClaimLink)",
    "confirm": {
      "text": "Create a hand-over link for {org}? Whoever opens it while signed in becomes the owner of the site and its shop. It is shown once and works for 7 days.",
      "status": "draft",
      "wave": 6
    },
    "drift": "No other app has a claim link (elktours business_claims is a different mechanism; the session doc item 9 says extraction to @elkdonis/services/claim-links is on hold).",
    "canonical": "extract lib/manage-claim.ts to @elkdonis/services/claim-links (session doc open item 9) with per-app hooks",
    "open": "SECURITY: createClaimToken (manage-claim.ts:46) does no authorisation itself (the file header says the caller must); only claim-actions.ts mayHandOver (claim-actions.ts:17-22) checks owner, or global isAdmin. Admitting the global admin is deliberate in the code comment but is the admin reach sunjay lib/auth.ts says stays exclusive to apps/admin; confirm for katie. The raw token is returned to the browser once (claim-actions.ts:32), correct; only a sha256 hash is stored.",
    "verified": "2026-11-16 read docs/sessions/2026-11-07_katie-the-potter.md, lib/claim-actions.ts, lib/manage-claim.ts, components/manage/hand-over.tsx, components/claim-confirm.tsx, app/claim/[token]"
  },
  {
    "area": "katie.claim",
    "scope": "org",
    "risk": [
      "others"
    ],
    "id": "katie-claim-link-revoke",
    "label": "Cancel the hand-over link",
    "does": "An owner (or network admin) revokes every unused hand-over link.",
    "class": "person",
    "actors": [
      "owner",
      "admin"
    ],
    "hosts": [
      {
        "key": "sa:apps/katie-the-potter/src/lib/claim-actions.ts#revokeClaimLinksAction",
        "service": [
          "lib/manage-claim.ts#revokeClaimTokens"
        ],
        "address": {
          "app": "katie-the-potter",
          "path": "/manage/people",
          "how": "the Cancel link button of components/manage/hand-over.tsx"
        }
      },
      {
        "key": "sql:apps/katie-the-potter/src/lib/manage-claim.ts#revokeClaimTokens",
        "note": "sql twin of sa:apps/katie-the-potter/src/lib/claim-actions.ts#revokeClaimLinksAction"
      }
    ],
    "entry": null,
    "status": "no unused, unrevoked org_claim_tokens row for the org",
    "confirm": {
      "text": "Cancel the hand-over link for {org}? It stops working at once.",
      "status": "draft",
      "wave": 6
    },
    "drift": "No other app has a claim link (elktours business_claims is a different mechanism; the session doc item 9 says extraction to @elkdonis/services/claim-links is on hold).",
    "canonical": "extract lib/manage-claim.ts to @elkdonis/services/claim-links (session doc open item 9) with per-app hooks",
    "verified": "2026-11-16 read docs/sessions/2026-11-07_katie-the-potter.md, lib/claim-actions.ts, lib/manage-claim.ts, components/manage/hand-over.tsx, components/claim-confirm.tsx, app/claim/[token]"
  },
  {
    "area": "katie.claim",
    "scope": "org",
    "risk": [
      "others",
      "irreversible",
      "money"
    ],
    "id": "katie-claim-redeem",
    "label": "Take over the site with a hand-over link",
    "does": "A signed-in person who holds a valid link becomes owner of the site's organisation, the site's pinned store on Collect Art moves to them (members, the pieces' maker credit), and the previous owner is left as a follower. All in one transaction; then their picture folder is set up.",
    "class": "person",
    "actors": [
      "person"
    ],
    "hosts": [
      {
        "key": "sa:apps/katie-the-potter/src/lib/claim-actions.ts#redeemClaimAction",
        "service": [
          "lib/manage-claim.ts#redeemClaim",
          "lib/site-store.ts#ensurePictureFolder"
        ],
        "address": {
          "app": "katie-the-potter",
          "path": "/claim/{token}",
          "how": "the confirm button of components/claim-confirm.tsx on app/claim/[token]"
        }
      },
      {
        "key": "sql:apps/katie-the-potter/src/lib/manage-claim.ts#redeemClaim",
        "note": "sql twin of sa:apps/katie-the-potter/src/lib/claim-actions.ts#redeemClaimAction"
      }
    ],
    "entry": null,
    "status": "org_claim_tokens has consumed_at; the person has an owner row in user_organizations for the org; store.owner_user_id is the person",
    "confirm": {
      "text": "Take over {org}? You become the owner of the site and its shop, and the current owner becomes a follower. This cannot be undone. Payments happen on the checkout or Stripe page, not here.",
      "status": "draft",
      "wave": 6
    },
    "drift": "No other app has a claim link (elktours business_claims is a different mechanism; the session doc item 9 says extraction to @elkdonis/services/claim-links is on hold).",
    "canonical": "extract lib/manage-claim.ts to @elkdonis/services/claim-links (session doc open item 9) with per-app hooks",
    "open": "SECURITY (design note): the token is the only authorisation (manage-claim.ts:137-140: no email match, no second factor). It is 32 random bytes, stored as sha256, one-time (SELECT ... FOR UPDATE, then consumed_at), 7-day expiry, all in one transaction: good. The risk is a leaked link: whoever signs in first owns the org, store and the pieces' maker credit (artist_user_id), and the previous owner drops to viewer. The marketplace store, and so payout rights, moves with it; payee and Stripe records are not touched here. No rate limit on redeemClaimAction (256-bit token, so guessing is not feasible). The marketplace org defaults to 'market' (redeemClaim marketOrgId).",
    "verified": "2026-11-16 read docs/sessions/2026-11-07_katie-the-potter.md, lib/claim-actions.ts, lib/manage-claim.ts, components/manage/hand-over.tsx, components/claim-confirm.tsx, app/claim/[token]"
  },
  {
    "area": "katie.claim",
    "scope": "org",
    "risk": [
      "none"
    ],
    "id": "katie-picture-folder-finish",
    "label": "Finish setting up the picture folder",
    "does": "An owner or guide runs the folder setup again for the artist (the site store's owner): creates the Nextcloud picture folder and the collective membership a store needs. Idempotent.",
    "class": "person",
    "actors": [
      "owner",
      "guide"
    ],
    "hosts": [
      {
        "key": "sa:apps/katie-the-potter/src/lib/claim-actions.ts#finishPictureFolderAction",
        "service": [
          "lib/site-store.ts#ensurePictureFolder (gainSpace)"
        ],
        "address": {
          "app": "katie-the-potter",
          "path": "/manage",
          "how": "the 'Finish setting up your picture folder' button (components/picture-folder-button.tsx, notice in components/picture-folder-notice.tsx)"
        }
      }
    ],
    "entry": null,
    "status": "getStorageSlug(artist) returns a slug and the folder exists",
    "confirm": {
      "text": "Finish setting up the picture folder for {org}? This is safe to repeat.",
      "status": "draft",
      "wave": 6
    },
    "drift": "Calls the same gainSpace as arts-collective.learn:take-your-space, but for the store owner rather than the viewer.",
    "canonical": "services gainSpace via one shared kit action",
    "open": "Acts for the artist, not the viewer: any editor (guide included) can trigger the artist folder setup (claim-actions.ts:73-81). Harmless (idempotent).",
    "verified": "2026-11-16 read docs/sessions/2026-11-07_katie-the-potter.md, lib/claim-actions.ts, lib/manage-claim.ts, components/manage/hand-over.tsx, components/claim-confirm.tsx, app/claim/[token]"
  }
];

export default { capabilities, ignored: [] } satisfies Area;
