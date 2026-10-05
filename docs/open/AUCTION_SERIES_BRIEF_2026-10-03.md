# Auction series: campaign wing for art-auction (brief, 2026-10-03)

Design brief for a seasonal "auction series" wing on art-auction
(market.arts-collective.com, org `market`): weekly features, themed artwork
and article pages, a team desk that assigns content and blocks publication
until it is approved, and a per-artwork discussion stored in the forum. The
first series is the IFAC Art Auction, presented by International Fine Art
Collectors and hosted by Elkdonis Arts Collective. Status 2026-10-03: design
only; nothing in this brief is built except the landing splash and `/about`.

## Decisions (developer, 2026-10-03)

1. Weekly feature content lives in a campaign table, not in threads.
2. A feature slot can be blocked from publication and assigned to a person,
   who is notified to fill in the rest of it.
3. Public presentation per feature: an artwork, its artist, and a link to the
   artwork's detail page.
4. The theme is carried by the series' artwork detail pages, which share one
   look that differs from the rest of the site.
5. Each artwork has a discussion, held in the forum backend under an
   art-auction category and shown on the artwork page.
6. Phases: week 1 soft launch with no artwork shown; weeks 2-3 silent
   bidding; then a live online auction (live page not designed yet).
7. Three page kinds: artwork pages, article pages, and (later) the live page.

## Decisions (developer, 2026-10-03, second round)

8. All lots close on the live auction day (one close time, `live_at`).
9. Series artworks also appear in the general catalogue.
10. A feature slot may carry several artworks, and each artwork several
    published photos (slot ↔ artwork join table, with chosen `artwork_media`).
11. Artwork discussions are open to anyone signed in.
12. Articles: Studio pieces, and also an editor inside the desk (the cms-ui
    surface editor).
13. The desk team is chosen by the art-auction org's owners. The pool of
    assignable people includes the current IFAC members and roster
    (`user_organizations` and `org_profiles` for `ifac`).
14. The desk board is the org's Nextcloud Deck board (existing
    `org-deck.ts` / `packages/pipeline` integration), not a separate widget.
15. art-auction's org gets its own team (owners), team folder, Deck board and
    Talk room. Proposed owners: `jg` (justin.gillisb@gmail.com),
    `eric-brummel` (edbbde@gmail.com), `jason-ford` (fnordj@gmail.com). All
    three have Nextcloud accounts. Assumed: the org is the existing `market`
    row ("The Collective Market"), which already has Circle
    `MjN9QBVmk7I2yOxR2dJ2MTNpCTDMwy1` and folder `EAC_Network/market`, but no
    Deck board, Talk room or calendar (verified 2026-10-03).

## Deck mapping (proposed)

- One Deck board for the org (`organizations.deck_board_id`).
- Stacks = weeks of the series ("Week 1 · Soft launch", "Week 2 · Silent
  bidding", "Week 3 · Silent bidding", "Live").
- One card per slot: title = slot title, description = the brief plus a link
  to the slot editor, due date = `due_at`, assignee = the Deck assignment
  (requires a Nextcloud uid; the desk falls back to email-only for people
  without one), labels = slot status (Open, Assigned, Submitted, Approved),
  done = published. The slot row stores `deck_card_id`.
- The desk renders the board through the existing Pipeline face and adds the
  slot editor beside it; changes made in Nextcloud Deck show on the desk.

## Current state (verified 2026-10-03 unless marked)

- Splash and `/about` on the landing read the `ifac` and `elkdonis` profile
  rows (`apps/art-auction/src/lib/auction-hosts.ts`); deployed 2026-10-03.
- No grouping of lots exists: no sale/series table; `artwork.metadata.collections`
  is unread import residue. Lots are per variant (`auction_lot`), created by the
  store's owner in `/studio/artworks/[id]/auction` (`createLot`,
  `packages/commerce/src/server/auctions.ts:68`).
- Lots settle lazily on page loads (`settleExpiredLots`, `auctions.ts:180`);
  no cron. Nothing moves `scheduled` → `live`; the first bid does.
- Artwork text: `description_html`, `provenance_notes`, medium/style/subject;
  no story column. Media roles: hero, detail, scale, wall, video.
- Roles: art-auction checks store ownership (`store_member`) and global
  `users.is_admin` only. The `market` org has two `viewer` rows and no team.
- Forum categories are `org_feeds` rows; `market` has one (`general`, private).
  The pattern for a discussion attached to another object is `wikiTalkThread`
  (`packages/services/src/wiki.ts:528-575`): a normal `post` thread created on
  first use, found again by a metadata key. Replies: `postReply`
  (`packages/services/src/forum-write.ts:160`). No embeddable reply component
  exists; the forum app (3003) is stopped.
- Studio pieces are `threads` with `kind='writing'`, homed in `oad`; "Show on"
  lists a public piece on an org via `thread_orgs`; `listOrgWriting('market')`
  exists (`writing.ts:294`) but art-auction does not call it. Studio's `series`
  is free text per author, so it cannot group several writers' pieces.
- Notifications: `notifications` table (031 shape) has writers but no inbox
  route in any app (`viewer-alerts.ts:31`). Email: `sendEmail`
  (`packages/email/src/client.ts:60`). No task table; Nextcloud Deck cards can
  be assigned only to people with a Nextcloud login (`org-deck.ts:369`).

## Proposed model

Three new tables (one migration), all with `org_id`:

- `auction_series`: `id, org_id ('market'), slug, title, presenter_org_id
  ('ifac'), host_org_id ('elkdonis'), status (draft|published|closed),
  announce_at, silent_opens_at, silent_closes_at, live_at, theme jsonb,
  forum_feed_slug, created_by, timestamps`. `theme` holds palette tokens, type
  pair, hero image, and a short motif statement.
- `auction_series_slot` — the "block": `id, series_id, week_no, position,
  kind (artwork|artist|article|announcement), title, brief (what is needed),
  artwork_id, artist_user_id, thread_id (article), lot_id, assignee_user_id,
  due_at, publish_at, status (open|assigned|submitted|approved|published),
  content jsonb (story, quote, curator note, image picks),
  discussion_thread_id, timestamps`.
- `auction_series_member`: `series_id, user_id, role (editor|contributor)`.
  Editors run the desk; contributors see only slots assigned to them.
  Alternative: owner/guide rows on `market` (open question 1).

Publication rule: a slot renders publicly only when `status = 'approved'` or
`'published'` and `publish_at <= now()`; the series page reads only those.
Artworks in the series stay visible in the normal catalogue unless the slot
sets `hold_from_catalogue` (open question 4).

## Pages

| Route | Who | Content |
|---|---|---|
| `/series/<slug>` | public | Phase-aware: week 1 = announcement, hosts, this week's story, countdown to silent opening; weeks 2-3 = this week's feature, lots grid, closing countdown; after = results, live link. |
| `/series/<slug>/works/<artwork>` | public | Themed artwork page: hero image, story, artist block, bid widget while silent bidding is open, discussion, articles that reference it. |
| `/series/<slug>/notes/<thread>` | public | Themed article page (Studio piece listed on `market`), links back to the works it mentions. |
| `/series/<slug>/live` | public | Later: Talk/OBS stream embed and live lot. |
| `/series/<slug>/desk` | editors | Weekly board of slots, assignment, approval, theme settings, phase dates. |
| `/series/<slug>/desk/mine` | contributors | The slots assigned to the viewer, each a form for its missing fields. |

Theme: the series pages wrap their content in `[data-series="<slug>"]` and
set tokens from `auction_series.theme`; the rest of the site keeps its plain
gallery palette.

## Desk workflow

1. Editor creates the series and its phase dates; the desk lays out weeks
   1-3 plus "Live".
2. "Suggest a plan" proposes slots from what exists: one artist per week,
   that artist's available works, one article slot per week, an announcement
   in week 1. The editor accepts, edits or deletes each suggestion.
3. Editor assigns a slot (artist, writer, or IFAC member) with a brief and a
   due date. Assigning writes a `notifications` row (`kind='series_task'`) and
   sends an email with a link to `/desk/mine`. A reminder goes 48 h before
   `due_at`.
4. Contributor fills the slot (story, images, artwork description; or writes
   the article in Studio and attaches it) and submits.
5. Editor approves; the slot publishes at `publish_at`.
6. For weeks 2-3, "Open bidding" creates the lots for the approved artwork
   slots with the series' `silent_opens_at`/`silent_closes_at` (open question 3).
7. On first view of an artwork page a discussion thread is created in the
   series forum category (`org_feeds` row `market/<series-slug>`), following
   `wikiTalkThread`; the page shows replies and a reply box via `postReply`.

## Bid defect found 2026-10-03

- Lot `e61caa91` ("STEPHANS FACE", start $5, increment $10): bids $5, $15, then
  $1,500,010.00 on 2026-09-29. The lot settled `sold` and order `ac362477`
  for $1,500,010.00 is `awaiting_etransfer` (2026-10-02).
- Cause (verified by query and reproduction): `mapLot` passed
  `current_bid_minor` through `opt<number>` without converting; postgres.js
  returns bigint as a string, so the widget computed `"1500" + 1000 =
  "15001000"` and showed a minimum of $150,010. How the recorded amount became
  ten times that is unknown (assumed typed by the bidder).
- Fixed 2026-10-03: `optNum` for every nullable `*_minor` column in
  `packages/commerce/src/queries/index.ts`, and `Number()` in `nextMinimumBid`.
  art-auction rebuilt the same day. Not verified with a live bid (no open lot).
- Open: the order and lot outcome are the developer's decision.

## Open questions

1. Desk team: a series member table, or owner/guide roles on `market`?
2. Who may open a lot on a store's artwork: only the store owner (today), or
   series editors on their behalf after the artist agrees?
3. Lot closing: one close time for all lots, or staggered groups?
4. During the series, do its artworks also appear in the general catalogue?
5. Articles: written in Studio (arts-collective) and attached, or a simpler
   text editor inside the desk?
6. Discussion: open to any signed-in person, or to registered bidders only?
7. Name on the page: "International Fine Art Collectors" (profile row) or
   "International Fine Arts Collectors".
