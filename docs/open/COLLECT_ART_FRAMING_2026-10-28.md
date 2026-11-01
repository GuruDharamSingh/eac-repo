# Collect Art: framing the site and its organisations (2026-10-28)

Discussion with the developer on how market.arts-collective.com presents the
IFAC series, the site, the platform and the not-for-profit. Mostly no-code; a
few data and copy changes were made and are listed below.

## Developer's words (verbatim excerpts)

> Art-auction is temp name of the site, this is IFAC's first series on
> Art-Auction site which is part of the Arts-collective Platform... this
> Platform operates on behalf of the Elkdonis Arts Collective Not-For-Profit.

> Working through how to present this copy, and distinctions of Site,
> Presenter (IFAC), Platform, and Platform NFP standing..

> its Presenting a Collection of pieces with proceeds going either to a marked
> charity, the Not-For-Profit, or the IFAC Gallery (besides the artist them
> selves , if they havent fully marked the proceeds for donation)

> this first auction is a special effort to branch beyond a sphere of art
> enthusiasts who have invigorated market sales through-out the 80's and
> beyond... these pieces are coming from prior grass roots effort that
> fortified artists with 'objective art' style influence.

> now with the help of arts-collective.com IFAC is brininger greater public to
> bare on its embedded community of dealers and artists.

> It's a not-for-profit, not a charity. IFAC is a gallery for profit.

> I believe that we're going to use the PayPal donation schema, and I'm going
> to set up PayPal.

> market is the org. It's fine. Its display name should be Collect Art. And we
> can change the name of the website, as it appears, Art Auction, to Collect Art.

## Agreed framing

- Auction (event): International Fine Art Collectors presents. IFAC is a
  for-profit gallery.
- Site and platform (venue): Collect Art, the marketplace of the Arts Collective
  platform (arts-collective.com). Org `market`.
- Standing: the platform is operated on behalf of the Elkdonis Arts Collective,
  a not-for-profit corporation (not a registered charity, so no tax receipts).
- Where the money goes: the artist's share; a piece may be marked for a
  charity, the Elkdonis Arts Collective or the IFAC Gallery; on unmarked pieces
  the buyer chooses where the site share goes.

## Direction (2026-10-28, later): not built

Status: direction from the developer, not implemented. No UI changes are to be
made until confirmed.

Developer's words (verbatim excerpts):

> arts-collective is the front for elkdonis arts collective the nfp. in the
> about part of the site we can mention elkdonis, as a philosophy, and
> introduce elkdonis arts collective as who is behind / standing for arts
> collective platform ACP.

> arts-collective platform should have its own organization too, and thats
> what the host of the auction should be.

> Inner group is the organization part of elkdonis-arts.org. [...] We should
> make a new organization, like you said, Arts Collective. And it can be
> stewarded by inner group, if that is indeed the right prominently used group
> throughout the platform.

> Still don't just clearly mark out that this is some of the direction I'm
> going with rather than doing this. You can do the org edits, but don't change
> the UI yet.

Roles:

- Elkdonis: the philosophy (About page only).
- Elkdonis Arts Collective (org `inner_group`, elkdonis-arts.org): the
  not-for-profit corporation; stands behind ACP. Not a charity.
- Arts Collective Platform, "ACP" (arts-collective.com): the public front of
  the not-for-profit; hosts the auction.
- Collect Art (org `market`, market.arts-collective.com): the marketplace site
  on ACP.
- International Fine Art Collectors (org `ifac`): for-profit gallery; presents
  the series.

Planned implementation (agreed in outline, items 1-5; 6 "decent"):

1. A platform org for ACP, stewarded by `inner_group` (`organizations.steward_org_id`).
   See "Org audit" below before creating one.
2. `auction_series.host_org_id` → the ACP org; `getAuctionHosts`
   (`apps/art-auction/src/lib/auction-hosts.ts`) reads presenter/host from the
   series instead of hard-coding `ifac`/`inner_group`.
3. Front-page splash: "IFAC presents" / "Arts Collective hosts"; EAC not shown.
4. About page: IFAC entry, ACP entry, "Who stands behind Arts Collective"
   (EAC, not-for-profit; Elkdonis as philosophy), "Where the money goes".
5. Split bios: portal/mutual-aid text (subdomains, email, checkout, micro-grants)
   on the ACP profile; not-for-profit purpose and philosophy on the EAC profile.
6. Footer line: "Collect Art is part of Arts Collective, operated on behalf of
   the Elkdonis Arts Collective, a not-for-profit."

Open: public use of "ACP"; whether the ACP org appears in network org lists;
checkout support label (EAC or Arts Collective); Elkdonis philosophy text
(developer to supply).

## Org audit (2026-10-28, verified by grep and query)

- `inner_group`: Elkdonis Arts Collective, elkdonis-arts.org (innergathering
  app), tier partner, owns the existing org store and the checkout payee. 40
  source files reference it.
- `elkdonis`: not unused. It acts as the network/platform org today:
  `WIKI_ORG` (`packages/services/src/wiki.ts:37`, 4 `wiki_page` threads);
  network-default `site_config` (`NETWORK_CONFIG_ORG` in
  `packages/services/src/center.ts:134`, `center-layout.ts:75` and four apps'
  `api/center/layout`; keys include `email:identity`, `about_document`,
  `featured_events`, `image_spaces`); innergathering landing config
  (`apps/innergathering/src/config/site.ts:20`); network posts shown on IFAC
  (`apps/ifac/src/components/elkdonis-feed.tsx:17`, 6 `post` threads);
  arts-collective hub Elkdonis tab and roster (`apps/arts-collective/src/lib/elkdonis-hub.ts:24`,
  `lib/network.ts`); forum topic choices (`packages/forum-ui/src/connectors.ts:698`);
  ArtDirect membership (`apps/artdirect/src/lib/oad.ts:612`). Already has
  `steward_org_id = inner_group`; 11 members; profile bio "Central admin hub
  for the collective"; name "Elkdonis Arts Collective" (duplicates `inner_group`).
- `network`: a scope value (forum, quotes, analytics), not an `organizations` row.
- No org row exists for arts-collective.com under any other name.

Decided 2026-10-28 (developer: "ok rename it"): `elkdonis` is the ACP org.
The id and slug stay `elkdonis`, which is hard-coded in ~20 places. No new org.

Applied 2026-10-28 in one transaction (verified by query):
- `organizations.name` for `elkdonis`: "Elkdonis Arts Collective" → "Arts Collective".
  `steward_org_id` was already `inner_group`.
- `elkdonis` profile (`users`, slug `elkdonis`): display name "Arts Collective";
  bio set to the portal / mutual-aid text (item 5).
- `inner_group` profile bio: reduced to the not-for-profit purpose plus "It
  stands behind the Arts Collective platform". Philosophy text still to come.
- `auction_series` `ifac-fall-auction`: `host_org_id` `inner_group` → `elkdonis`.
  The host org grants no edit rights (`seriesDeskClause`,
  `packages/commerce/src/server/access.ts:19`); it shows in the admin series
  org list and the desk's artist suggestions (`series-social.ts:203`, `:480`).

Not changed: `organizations.description` for `elkdonis` (still "Central admin
hub for the collective"); `createSeries` defaults `hostOrgId` to `inner_group`
(`packages/commerce/src/server/series.ts:81`); `getAuctionHosts` hard-coded
`inner_group` as host; 2026-10-28 (later) changed in source to `elkdonis`, still
hard-coded rather than read from the series (item 2). art-auction runs in
production mode, so the host card changes only after a rebuild. The rename is visible wherever the `elkdonis` org name
renders (arts-collective hub tab and roster, IFAC network feed, forum topic
choices) on each app's next request; not checked page by page.

## Visible rename of `elkdonis` → Arts Collective (2026-10-28)

Developer chose the visible rename, not an id change ("just do visible"). The
id stays `elkdonis` (code constants, foreign keys).

Database, applied and verified by query:
- `organizations.slug` and the profile `users.slug`: `elkdonis` → `arts-collective`;
  description set to the platform line. `user_slug_redirects` row `elkdonis` →
  profile, so directory.arts-collective.com/elkdonis 308s to /arts-collective
  (verified with curl; the new page renders "Arts Collective").

Source, not deployed (each app shows it after its next rebuild):
- arts-collective: hub tab route `app/hub/(tabs)/elkdonis` → `(tabs)/arts-collective`,
  permanent redirect from /hub/elkdonis in `next.config.ts`; tab label, hub
  headings, "Arts Collective Account", landing "Participate in Arts Collective",
  vetting kicker, community page join/nav text, signup interest label; slug
  comparisons in `hub/(tabs)/network/page.tsx`, `hub/(tabs)/organization/page.tsx`,
  `lib/network.ts`; forum link `/o/arts-collective`. Component folder
  `components/hub/elkdonis/` and identifiers (`postToElkdonis`, `ELKDONIS_*`) unchanged.
  `tsc` clean except the stale `.next/types/validator.ts` entry for the old route
  (regenerated by the build).
- "Elkdonis network" → "Arts Collective network" in login/account copy of
  danamccool, elktours, elastrocal, amrit-canada, pigeonshoot, sunjay,
  fourthwayBookreaders, innergathering, ifac default content, admin home, and
  `cms-ui` ArrivalNotice. ArtDirect "an Arts Collective commons", hub link.
- IFAC: "Latest from Arts Collective", "Arts Collective blog feed".
- admin Nextcloud org label; art-auction series help names "Elkdonis Arts
  Collective" as the commission option; `packages/db` seed.

Deliberately unchanged: "The Elkdonis Path"/"Elkdonis Course" (philosophy);
Nextcloud "Sign in with Elkdonis" and sociallogin provider `elkdonis`, Nextcloud
uids `elkdonis-<id>` (renaming breaks Nextcloud sign-in); "Elkdonis Arts
Collective" where it means the not-for-profit; Elkdonis Tours; "Elkdonis Admin"
title; Stripe onboarding text; newsletter category key; "About Elkdonis" block
on the community page; ArtistProfileWizard "partnerships with Elkdonis".

Until rebuilt: arts-collective still links to /hub/elkdonis (route exists in
the old build) and compares the old slug (the network org's site link and
"site live" flag on /hub/network and /hub/organization). Forum `/o/elkdonis`
no longer resolves; forum is stopped.

## Changes made 2026-10-28

- `users` profile of org `inner_group` (slug `inner-gathering`): display name
  "InnerGathering" → "Elkdonis Arts Collective"; bio replaced with the
  not-for-profit / Arts Collective description. Live on every site reading the
  org profile. Verified by query.
- `users` profile of org `market` (slug `market-org`): display name
  "The Collective Market" → "Collect Art". Verified by query.
- `apps/art-auction/src/config/site.ts`: site name "Art-Auction" → "Collect Art";
  description rewritten to the framing above.
- `apps/art-auction/src/app/page.tsx`: removed "the money goes to the artist,
  not to a middleman".
- Code changes are source only: art-auction is not rebuilt, so the live site
  still shows the old name and masthead sentence.

## Open items

- Rebuild art-auction (`docs/reference/ops.md`; the tree holds other sessions'
  uncommitted work).
- Not renamed: `organizations.name` for `market` and the checkout `payee` row
  ("The Collective Market"); the `inner_group` org's own `organizations.name` is
  already "Elkdonis Arts Collective".
- Front-page splash and About page still label Elkdonis "Hosts the auction";
  change to the platform / operated-for roles above.
- About page copy: history paragraph (1980s collector market, grassroots
  objective-art effort) to come from the developer. IFAC's own about page to be
  checked for its wording.
- IFAC Gallery as a recipient separate from IFAC: undecided. No charity payees
  exist yet; `org_beneficiaries` is empty.
- PayPal donations: developer is setting up PayPal; plan phase G
  (`docs/open/ART_AUCTION_PLAN_2026-10-18.md`).

## About page built (2026-10-28, late; deployed 22:08)

- `apps/art-auction/src/app/about/` (`page.tsx`, `about-editor.tsx`, `about.css`, `actions.ts`) on the series
  template (dark; `SrsNav`, series fonts), after the "About A: names as headers" board
  (https://claude.ai/artifact/4BRndE7RCsQHX7joYW4MjV): each section is a header with the burgundy rule, the
  text beside an optional media piece (IFAC: its site banner `Site/img-banner.jpg`). Board B (cards) was
  considered and set aside by the developer.
- Content is Collect Art's own words, not the orgs' profile bios: `site_config` (`market`, key `about_page`),
  `lib/about-content.ts` (`DEFAULT_ABOUT` until first saved; `cleanAbout` sanitises). Owners of `market` and
  network admins edit in place ("Edit page": per-section kicker, header, rich text, media upload via
  `/api/about/media` or an address, link; add, remove, reorder; the intro line). `{{commission}}` in a
  section's text becomes the marketplace rate. A section with no text and no media is hidden from visitors
  (the "Elkdonis" section until its copy arrives); editors still see it.
- `SiteChrome` hides the market header/footer on `/about`. The footer carries item 6.
- Verified: type check; dev-preview renders anonymous and as a throwaway `market` owner (edit bar, controls;
  account removed); live /about renders through the edge after the 22:08 rebuild. Not tried: saving, uploads.
- Landing intro options (five dark boards, IFAC presents / Arts Collective hosts): https://claude.ai/artifact/WS42RxEnjidTqmhqKbumJ5.
  The live landing page is unchanged.

## Landing hero built (2026-10-28, late evening; deployed 22:55 and 23:0x)

- Intro 10 (https://claude.ai/artifact/WS42RxEnjidTqmhqKbumJ5): the top of `/` is a rotating black band
  (`components/home-hero.tsx` + `.css`, data in `lib/home-hero.ts`). Slide 1: the published featured series
  (`getFeaturedSeries`) with one of its pictured open lots, chosen at random per page load; the image is the link
  to the lot. Later slides: featured artists with their newest pictured work. Arrows flank the image on every
  slide and slide the whole band; dots show the position.
- Featured artists: `site_config` (`market`, `home_hero`, `featuredStoreIds`), set in Admin → Pages ("Home page
  hero", owners of `market` and admins). None set: the artists with the newest work fill the slot (up to two).
- The old splash and series card remain as the fallback when there is no published series and no artist with
  pictured work. The IFAC series is still a draft, so the series slide is absent until it is published.
- Verified: type check; dev-preview render and one arrow click (artist slides only; images blank in the preview
  because that container cannot reach Nextcloud). The ProductGrid hydration mismatch on `/` predates this work.
- 2026-10-28 23:00: a published series is public at once (`phaseOf` in `packages/commerce/src/queries/series.ts`
  no longer returns `draft` before `announce_at`; `getFeaturedSeries` no longer filters on it): the IFAC series was
  published with announce_at three days ahead and so was missing from the home page and 404ing for visitors.
  `announce_at` is still shown on the page. Series workspace → Features (`manage/features`) edits the same
  featured-artist list as Admin → Pages; `saveHeroAction` also accepts an editor of the series named by slug.

## Welcome band and loft built (2026-10-29; deployed 10:21)

- The top of `/` is now, in order: the welcome band, the rotating hero, the loft; everything from the featured
  work down is unchanged (`apps/art-auction/src/app/page.tsx`).
- Welcome band (`components/home-welcome.tsx`, Welcome 4 on the intro canvas): one serif paragraph and a
  "Read more about the site" link to `/about`. Copy in `site_config` (`market`, key `home_welcome`;
  `lib/home-sections.ts`, `DEFAULT_WELCOME` until first saved). Owners of `market` and admins see "Edit welcome"
  on the band (heading, sub-line, letter, link label and address).
- Loft (`components/home-loft.tsx`, `home-loft-scene.tsx`): a frosted CSS still of the long wall with the two hung
  works and a dashed free spot, and a "View the virtual scene" button. The 3D loft (`venueFor("loft")`, 7 MB
  model) loads only after the click. The free spot is a drawn placeholder piece (`EMPTY_ID`) on wall `S1`; its
  panel is the picker (every pictured work on the market except the hung two). The visitor's pick is kept in
  `localStorage` (`collect-art:home-loft-pick`) and shows in the still too.
- The two hung works: `site_config` key `home_loft` (`hungIds`), set in Admin → Pages ("Home page loft");
  none set: the two newest pictured works.
- Verified: type check; dev-preview screenshots of the band, hero, still, open scene, picker and a pick; live `/`
  through the edge after the 10:21 rebuild has the band (the agreed copy), hero and loft markup. Not tried:
  saving the welcome text, saving the loft choice (both write live settings).
