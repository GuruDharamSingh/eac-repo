# Center journeys (2026-10-18)

State of the `/center` redesign after two passes on 2026-10-18: the page is the
person's nexus on an org site, its top-right section is three journeys, and the
auction onboarding (publish work → open a store → connect Stripe) runs from it.
Deployed on ifac and innergathering. Mock-ups (developer-approved look):
https://claude.ai/artifact/FGVA7UCtiKKCGYSBQeBBVa (boards E–H are the current design).

## Current state (verified 2026-10-18 by signed-in headless render on ifacgroup.com)

- Page: no site header/footer on IFAC (`apps/ifac/src/app/center/page.tsx`, `main.hub.eac-center-page`);
  heading carries "← Back to IFAC". innergathering's header still comes from its root layout.
- Card: `ProfileFlipCard` bare (no SurfaceCard frame), dark plate with pills (payouts state, org role,
  "ArtDirect · listed"); four doors under it (public page, account, forum; files/studio when the host passes them).
  Account on IFAC goes to `<network>/account` through the SSO hop (`accountHref` input of `buildOrgSiteCenterLinks`).
- Journeys (`packages/cms-ui/src/center/JourneyTabs.tsx`, section id `journeys`; `you` is kept as an id and draws nothing):
  - Selling art: tiles (published/sold/drafts), step 1 opens the `artwork` surface, step 2 "Open your store"
    (`publishStoreForAuction`: creates via `applyForStore`, activates, `commission_rate = 5`), step 3 country +
    Connect Stripe through `connectors.profile.page.startPayouts`. Fees quoted from the store row.
  - Your organisation (owners/guides): Details = the identity form first (`connectors.profile` with org target,
    image via `uploadAvatar`); People = `connectors.orgPeople` (role select viewer/member/guide, "listed" switch,
    new sign-ups flagged, arrival source). Rail links to `/manage`.
  - Profile: Details form, Where you show (presence matrix; tab appears only where the host serves
    `/api/center/presence` — innergathering yes, IFAC no), Links.
- Artwork surface (`surfaces/ArtworkSurface.tsx`, `?surface=artwork`): queue in the dark left rail; "Add another"
  saves the current piece as a draft first; "Publish all" publishes the queue. Writes through host actions
  (`lib/cms/artwork-actions.ts` in ifac and innergathering → commerce `createArtwork`/`updateArtwork`/`publishArtwork`).
  Verified: store opened at 5%, two drafts created and updated; publish refused without a photo (commerce rule), message shown.
- Shared people service: `packages/services/src/org-people.ts` (`listOrgPeople`, `setOrgPersonRole`,
  `setOrgPersonListed`, `canManageOrgPeople`). Rules: no self-change, no owner change, assignable viewer|member|guide,
  listing an untagged roster row tags it `artist`, role change requests a Nextcloud sync.
- Data: migration 207 sets `store.commission_rate` default 5.00; `openOrgStore` writes 0; existing rows updated
  2026-10-18 (4 person stores → 5.00, 2 org stores → 0). Developer's model: the 5% is the platform's standing cut;
  an org's cut on its artists is a separate agreement layer.

## Take three (2026-10-18, evening; deployed on ifac + innergathering)

- Journeys are a headed row of cards (`JourneyRow`, `cms-ui/center/JourneyTabs.tsx`; prev/next arrows, scrolls
  sideways); each card opens a centered dialog `journey:<auction|org|profile|site>[:<orgId>]`
  (`surfaces/JourneySurface.tsx`, panels in `surfaces/journey-panels.tsx`). The inline tabs are gone; `?journey=` opens a dialog.
- New journey `site` ("Start an organisation"): name + address with a live availability check, then creates the org
  in place. The creation logic moved to `packages/services/src/org-create.ts` (`createOrganizationForUser`,
  `checkSubdomain`); arts-collective's `POST /api/org/create` now calls it (**arts-collective not rebuilt**: the live
  route is still the old inline copy until it is).
- Layout: left column 300px on desktop (card ~17% smaller); "The site" preview moved to the left column above
  "Go to another site" (was "Where you are"); Latest switches between the org and the network (`FeedSwitch`; the
  network list is `data.network`); the org card names its owners (`CenterOrg.owners`).
- Selling art for a follower (viewer role): commerce's `canClaimStore` refuses viewers, so step 2 explains the rule and
  offers "Start an organisation" (an owner may open a store). Not bypassed.

## Take four (2026-10-18, night; deployed on ifac + innergathering)

- Row look (developer's direction): a blue field, the heading "Create with the Arts Collective" and four gradient cards
  (orange "Sell your art", purple "Manage your arts collective" with the org's name as its one small line, blue "Begin
  a collective" / "Begin another collective", teal "Manage your directory listing"), ~360px tall, titles in Brothers
  (`@font-face` in center.css reads `/fonts/BrothersTypeface-Regular.otf`; copied into `apps/ifac/public/fonts/`; a host
  without the file falls back to Venture/system). Progress bars kept; no body text on the cards.
- Dialog: `dialog.eac-surface:has(.eac-journey-dialog)` is 1352px wide (30% over the first 1040) and now centred (the
  earlier width sat on the panel and overflowed the 940px dialog by ~50px); header is one slim line (no glyph).
- The ArtDirect journey ("Manage your directory listing") now has Details · Offer & get paid · Where you show (where served) ·
  Links. Offer & get paid holds: services on your page (list, add, edit, publish/take down; `connectors.services` →
  `lib/cms/own-service-actions.ts` → `saveOffering`, homed in `oad`, author-only), "Sell your art on your page" (opens a
  person's store when `canClaimStore`, then the page's `store` switch; otherwise points to the selling-art / start-an-org
  journeys), and Stripe Connect (`connectors.profile.page.startPayouts`). Rail steps: your profile, what you offer, get paid.
  The auction journey stays separate (the series' onboarding).
- Verified signed in on ifacgroup.com (member and guide accounts): row, dialog width/header, Offer tab, a draft $60
  service saved and listed. Not exercised: publishing a service, Stripe return, the store switch with an active store.

## Take five (2026-10-18, late; deployed on ifac + innergathering)

Developer's model: **each journey is one of the central sites**, so there are three, in this order: Sell your art on
the market (market.arts-collective.com, orange) · Your listing in the artist directory (directory.arts-collective.com,
teal; services, art on your page, Stripe) · Create a collective (arts-collective.com, blue; carries a "Currently in
development" note at the top, the form behind it still works). Cards have centred titles in Basteleur, the site
name and a one-line hint; a progress bar only where the page knows the state (the auction). Fonts: only the word
"Journeys" is Brothers; everything else Basteleur (copied into `apps/ifac/public/fonts/`). Heading sits on one line with
the arrows.

Managing an organisation is **not** a journey: for owners and guides the org section of the page is now Details +
People in place (`center/OrgManage.tsx` → `OrgPanel`), replacing the org card; everyone else (and any host without
the profile connector) keeps the card with its owners line. `journey:org:<orgId>` still exists as a dialog (the
"Set up X" button after creating a collective opens it).

## Take six (2026-10-19, early; deployed on ifac + innergathering)

- `/center`: the card is 330px wide (300 → 330, +10% on the diagonal), the plate pills are gone, hover-flip is back
  (the listener keyed on the `.eac-face` wrapper removed in take two; it now falls back to the card itself). Its back
  opens the profile journey, not the old popup (`ProfileCardAction.journey`).
- Every profile door goes to Center: ProfileFace (cards layout, both doors; Edit → `/center?journey=profile`),
  HubPortrait, the IFAC drawer and Cards 2's profile card, the Page layout's flip card (front button and back).
  `?journey=profile|auction|site` opens that dialog on load.
- **Correction, same day:** the default IFAC hub layout is **Cards 2** (`HubCardsBody`, `app/hub/views.ts`
  `DEFAULT_HUB_VIEW`), and the order below is applied there: row 1 Publish · My profile · Series; row 2 Calendar ·
  Manage the site (editors) · Whiteboard · General chat; row 3 Files · Forum; Working together = Collaborative document ·
  Pipeline · Group research (Suggested ideas and its read removed). The meeting banner stays above the rows. "Cards"
  (classic) and "Page" remain one press away and are remembered per browser. The classic arrangement described next
  was a misreading of the request; it is still in `hub/page.tsx` and is not the default.
- IFAC hub, classic cards layout (`apps/ifac/src/app/hub/page.tsx`): row 1 Publish · My profile · Series; row 2 Calendar ·
  Manage the site (editors) · Whiteboard · General chat (a card now: last message, opens `/hub/chat`; the full-width
  transcript is gone); row 3 Files · Forum; then Working together (documents, board, group research; Suggested ideas left
  out, its read still runs); then "Also here" (the standing meeting and the auction card, which the list did not place)
  and the How-things-work link. The default layout was already cards; a browser that pressed Page or Cards 2 keeps that
  cookie until Cards is chosen.

## Facts from the org-creation survey (2026-10-18)

- A new organisation is `subdomain_confirmed = false`: an admin confirms it from arts-collective `/hub/admin`
  (`POST /api/admin/orgs/[slug]/confirm`); the public sees "being set up" on `/` and `/offering` meanwhile.
- `<slug>.arts-collective.com` needs a proxy host and certificate added by an operator
  (`scripts/add-proxy-host.sh <host> 3007`, `docs/reference/ops.md` "Launch an org site on a subdomain"); nothing creates them.
  `orgDoorUrl` therefore never links to subdomains; the journey says the address answers once the operator has added it.
- The wizard (`/wizard`) does not create orgs: it is "gain your space" for artists (`gainSpace`, `oad` membership).
- No purpose/description is collected at creation; step 2 of the site journey ("Say what it is for") is the org journey's Details form.
- Candidate journeys with existing server paths: publish a service with checkout (`upsertServiceOffering`,
  `saveOffering`; needs payout), start writing in Studio (`startStudioPiece` → `saveStudioPiece`), claim an ArtDirect page
  (`claimDossier` → `requestClaim`; a steward approves), connect YouTube (`createConnection` → `beginConnectionAuth`),
  join/follow an org (`/api/org/join`). Not built.

## Open

1. Settlement: `resolveSettlement` still reads `store.commission_rate` as the whole cut. Platform 5% + org agreement
   share is not implemented.
2. IFAC's `/manage/people` and innergathering's `/manage/people` still use their own code; migrate both to `org-people.ts`.
3. The artwork queue is per sitting: earlier drafts are not listed in the rail (they count in the Drafts tile).
   A "your drafts" list in the rail, and a series/"for the auction" flag once the series table exists.
4. Studio has no artwork kind; the short form is the Center's. A full artwork editor in Studio is still art-auction's `/studio`.
5. Presence ("Where you show") route missing on IFAC (`/api/center/presence`, `/api/center/listings`).
6. innergathering `/center` still shows the site header (root layout); needs a route group to drop it.
6a. The `site` journey's create path was not exercised end to end on live data (it writes an organisation and a
    Nextcloud folder); the availability check and form were. Steps 2-3 of that journey are text until the org exists.
6b. Profile journey on IFAC has no "Where you show" tab (no `/api/center/presence`), and its step 3 reads done as soon as a slug exists.
7. "Your public page" → ArtDirect sign-in: config checked (handoff secret, URLs, accept route) but not reproduced through the edge.
8. Journey connectors wired on ifac and innergathering only; amrit, sunjay, arts-collective sites, fourthway show the
   tabs with links but no store/artwork actions.
9. Services `check-types` fails on `packages/utils/src/sanitize*.ts` (DOM lib) independent of this work.
