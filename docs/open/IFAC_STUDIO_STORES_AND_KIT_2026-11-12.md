# IFAC: Studio forms, store destinations, auction entry, and the site kit (2026-11-12)

Investigation only: no code, migrations or builds. Two read-only investigators (commerce + forms;
site standardization) reported, then reviewed each other's reports; the main session re-checked the
load-bearing facts. Labels: **V** verified (how), **A** assumed, **U** unknown. Agent-reported facts not
re-checked by the main session are marked "(agent)".

Request (developer, 2026-11-12): in `apps/ifac`, post artwork and services through the Studio forms
(`@elkdonis/studio/forms`) to the person's own store on market.arts-collective.com, to IFAC's org store,
or into an auction series. No store: a quick way to open one (LMS / action registry / MCP). Also:
how to bring the house editor, the Studio forms, the hub cards and the content library into ifac
and innergathering, which were left out of the standardization work done on hidden-enneagram and
katie-the-potter.

## 1. Current state

### Commerce (V, SELECT queries on `elkdonis_dev`, 2026-11-12)
- `store`: 10 rows, all `org_id = 'market'`, all active. 7 personal stores at 5.00% commission, 0 seats each.
  3 org stores (`owner_org_id` set: ifac, inner_group, pigeonshoot) at 0.00%, 1 `store_member` seat each.
- `auction_series`: one row, `ifac-fall-auction`: `org_id = market`, `presenter_org_id = ifac`,
  `host_org_id = elkdonis`, published, 3 `auction_series_member` editors.
- IFAC `user_organizations`: 2 owner, 4 guide, 2 viewer. No `member` rows.
- No co-owner column. "IFAC co-owns" is modelled as presenter; `seriesStore()` (`packages/commerce/.../series.ts:322`)
  resolves the lot store to the presenter's org store (agent).
- No submission or consignment flow for auction series. `addLotToSeries`, `addSeriesLot`, `addListingToSeries`
  require `canEditSeries`; the art-auction "Auction series" studio tab attaches threads only
  (`submitOwnPiece`) (agent).
- Listing into an org store requires a `store_member` seat, not org membership (`commerce/.../access.ts:19-60`) (agent).
- A store needs no Stripe account to list; an unpaid maker's share is held on `payout_ledger`
  (`checkout/server/stripe.ts:61-92`) (agent). No Stripe calls were made.

### IFAC today
- `compose:art-piece` (`apps/ifac/src/components/hub/HubSurfaces.tsx:386`) → `lib/cms/art-piece-actions.ts`.
  It already has a destination switch, `listAsOrg` (lines 45, 76-108: `getStoreForOrg('ifac','market')` +
  `canActForStore`). One picture, publishes on save, no editions, credit or auction (agent, confirmed by both).
- `/manage/store` (org store, team, beneficiaries); `/manage/submissions` is the shared `@elkdonis/hub`
  review queue for threads (`loadReviewQueue(..., { storePanels: true })`, `page.tsx:25`) (agent).
- No-store path exists: `/center` "Sell your art" journey → `lib/cms/journey-actions.ts` `publishStoreAction`;
  payouts onboarding in `lib/cms/payout-actions.ts` (agent).
- `apps/ifac/package.json` has `@elkdonis/actions`, `@elkdonis/commerce`, `@elkdonis/hub`; not `@elkdonis/studio` (agent).
- `lib/hub-links.ts:17` already builds a `studioHref` handoff to `<network>/studio` (agent).

### Studio forms
- Host contract: `FormHost` (`packages/studio/src/forms/contract.ts:280`); per-kind adapters
  `adapters/artwork.ts`, `adapters/service.ts`; wired in arts-collective `StudioApp.tsx:115-149` (agent).
- Framing is same-origin only (`contract.ts:311-318`): arts-collective's Studio cannot be iframed into
  ifacgroup.com. An in-host mount needs its own `FormHost` (agent, confirmed by both).
- arts-collective artwork actions ignore the org: `artworkFormContextAction(_orgId)` and
  `saveArtworkFormAction(_orgId, …)` (`apps/arts-collective/src/lib/artwork-form-actions.ts:133,184`, V read).
  A piece always goes to the viewer's own store; the form section says so ("It goes into your store, X").
- `/studio?org=` is honoured only for orgs from `listListableOrgs` (`packages/services/src/thread-listing.ts:81`,
  roles member/guide/owner, line 40) (V read). IFAC's 2 viewers fall back to their personal space.
- Service form: `canModerateOrg` gate (owner or guide); members' services go to ArtDirect via `saveOffering` (agent).
- `packages/studio`: 31 uncommitted entries from another session (29 modified, 2 untracked), including
  `forms/contract.ts`, `forms/shell/FormShell.tsx`, `kinds/artwork/sections.tsx` (agent, `git status`).

### Registry, LMS, MCP (agent)
- Registry entry `store` (`packages/actions/src/catalogue.ts:26`), runner `publishStoreForAuction`
  (`server/run.ts:192`): gated by `canClaimStore` (any non-viewer org role); creates and activates at 5%.
  Agent exposure `'read'` (`agent.ts:26`).
- MCP `apps/arts-collective/src/app/api/mcp/route.ts`: `eacm_` bearer keys, canonical host only, read-only (slice 1).
- Registry routes are same-origin; IFAC calls `performHubAction` in-process (`app/hub/actions.ts:7`).

### Site standardization (agent)
The premise needs one correction: hidden-enneagram and katie share the editor (page-builder,
direct-edit, Site style), `cms-ui/manage` and the `/channel` handoff. They do not have hub cards, the
content library or the Studio forms. ifac is ahead on hub cards: it is the pilot host of `@elkdonis/hub`.

| Capability | HE | katie | ifac | innergathering |
|---|---|---|---|---|
| Puck pages + parts plugin + popup | yes | yes | no (member pages only) | Puck + older canvas, no parts plugin |
| Site style (`site_themes` + chrome) | yes | yes | own system (`IFAC_THEME_VARS`, `/manage/appearance`) | `page-edits:home`, `puck:landing` |
| `@elkdonis/hub` cards | no | no | yes (members, review) | no |
| `cms-ui/manage` | yes | yes | hand-rolled | hand-rolled |
| `/channel` handoff | yes | yes | no | no |
| `@elkdonis/content`, dock | no | no | no | no |
| `@elkdonis/studio/forms` | no | no | no | no (arts-collective only) |

- Architecture (`NETWORK_SERVING_ARCHITECTURE_2026-11-08.md` §2) classes ifac as a product ("custom forever")
  and innergathering as "custom on the kit" (it is the Nextcloud IdP). The §5 contract's mount items
  (`defineSite`, kit routes, `packages/org-site`) are not built.
- CLAUDE.md "ifac rebuild held" / "innergathering rebuild held" are stale: both were rebuilt in the
  2026-11-08 train (`PM_BOARD_2026-11-08.md:500-504`, V read). The next rebuild of either ships the
  2026-11-11 media-ownership session's uncommitted files (9 in ifac, 2 + 1 untracked dir in innergathering).

## 2. Proposed design (both investigators converged after review)

1. **Store picker in the shared artwork kind.** `stores` in the form context (from `listStoresForUser`,
   `commerce/queries/index.ts:961`), a `store` answer key, the hint naming the destination and its
   commission. The server re-checks `canActForStore(viewer, storeId)`; edits take the store from the row.
   An org-store piece accepts a credited artist (`creditedArtistUserId`, migration 209); the form must say
   that credit is not payment.
2. **Adapter placement.** Commerce keeps the store rule (form-agnostic). The form-shaped server adapter
   (`context`, `load`, `save`, `list`) goes in a new server subpath of `@elkdonis/studio`, taking
   `{ site, viewer }`. Each host keeps a thin `"use server"` file. (The commerce investigator first proposed
   `packages/commerce/src/server/form-actions.ts`; dropped because it would make commerce import studio types.)
3. **Org-aware actions first.** arts-collective's artwork actions honour `orgId` before any hop link to
   `?org=ifac&kind=artwork-form` ships; otherwise the link files pieces in the person's own store.
4. **IFAC mount.** In-host on ifacgroup.com (the developer named ifac): add `@elkdonis/studio` (container
   install), an IFAC `FormHost` beside `hub-card-host.tsx`, artwork and service forms in `/hub` replacing
   `compose:art-piece`. The no-store state becomes a button running `publishStoreAction` in-process.
   The `studioHref` hop stays as the interim.
5. **Auction entry.** A submission is a proposal the desk accepts: table `auction_series_submission`
   (series, artwork, submitted_by, status, note, decided_by/at), services `submitToSeries` / `decideSubmission`;
   acceptance calls the existing `addListingToSeries` / `createLot`. The desk sees it as a new `ReviewSource`
   (`'submission'`, `packages/hub/src/review/model.ts:10`) with approve/decline registry entries, so it appears in
   `/hub/review` and IFAC `/manage/submissions` with no new page. Lighter alternative: immediate entry with
   desk removal, held in `artwork.metadata` (no migration).
6. **Standardization order.** (a) `/channel` handoff in ifac and innergathering (small, no shared-package
   work). (b) innergathering editor port from hidden-enneagram (parts plugin, popup, canvas options, Site style).
   (c) innergathering hub cards (`@elkdonis/hub` + `/hub/members`, copying ifac's three host files).
   (d) Content card in both once `@elkdonis/content` pass 3 (`listContent`) lands. (e) ifac Site style
   (map `IFAC_THEME_VARS` to a `SITE_STYLE` schema); Puck pages on ifac only if wanted.
   Write per-app glue in the §5 `defineSite` shape so it survives the kit.

## 3. Risks
- `packages/studio/src/forms` is being edited by another session (31 entries): sequence with it before
  editing the artwork kind or contract.
- An ifac or innergathering rebuild ships the media-ownership session's files; back up `.next` (`docs/reference/ops.md`).
- Do not loosen `canActForStore`: `seriesDeskClause` and every marketplace write use it.
- An org-store piece without a maker earmarks 100% to the org.
- innergathering is an IdP: keep editor work away from `proxy.ts`, login and auth routes.

## 4. Decisions (developer, 2026-11-12)
1. Forms: in-host on ifacgroup.com; the `/studio?org=ifac` hop is the interim, after the org fix (§2.3).
   2026-11-12 (developer, later): the forms reach ifac through the site's own Channel (`ifacgroup.com/channel`,
   quick tier), as in `docs/open/CHANNEL_ON_SITES_2026-11-12.md` §3.1; deeper edits hand off to
   `arts-collective.com/studio` with `back`. The store picker and the auction destination therefore belong in the
   shared quick artwork form (`@elkdonis/channel` / `@elkdonis/studio`), so katie-the-potter and ifac get the same
   one. Not started. Two gaps from that brief apply to ifac: its hub uses the site-bound action door, which refuses
   every `channel` scope entry (`packages/actions/src/server/run.ts:418-420`), and katie's quick artwork save takes
   CAD/USD only while the form offers EUR/GBP.
2. IFAC's store: ~~owners and guides are seated automatically~~. Corrected the same day: seats stay per
   person, assigned by the org's or store's owners (`canManageStoreTeam`, `/manage/store`); no sync, no
   access-rule change. 2026-11-12: Kroot's Alley seated as `staff` on IFAC's store at the developer's
   request (V, row returned by the INSERT); the store's roll is now Eric Brummel (owner) + Kroot's Alley (staff).
3. Auction entry: immediate; the desk removes. This replaces §2.5's proposal table. Who: owners, guides
   and members of the series' presenting org, host org, or an accepted invited org. When: the series is
   published and before `live_at` (no per-series switch, no migration). Removal by the desk withdraws an
   entered lot (refused with bids); other lots are only detached. The artist sets starting bid, reserve and
   buy-now. Built 2026-11-12 in `packages/commerce/src/server/series.ts` (`enterSeries`, `canEnterSeries`,
   `listEnterableSeries`; `removeLotFromSeries` changed), nothing calls it yet; shipped in art-auction's 2026-11-12 18:35 EST rebuild (the desk's removal behaviour is now live there). Verified:
   commerce `tsc --noEmit` 0 errors; `packages/commerce/scripts/probe-series-entry.mts` 21/21 against the
   live DB inside one rolled-back transaction (counts unchanged afterwards: 3 lots, 10 stores).
4. ifac editor: direct-edit on the existing code pages, no Puck pages. Mechanism already used on
   elkdonis-arts.org: `data-edit-section` markers + "Edit page" + `site_config` `page-edits:<page>`
   (`apps/innergathering/src/lib/page-edits.ts`, 36 lines). Page patches carry look and pictures only
   (`packages/direct-edit/src/block/patch.ts:28-48`); words on ifac pages come from `org_site_sections`
   (agent), so editing text in place needs slot targets of the `SiteSlotTarget` shape
   (`packages/actions/src/server/site-adapter.ts`, section + field). Plus Site style for theme and chrome.
   No new pages and no block rearranging on this path.

## 5. Open questions (developer; 1-4 and 7 answered in §4)
1. IFAC forms: in-host on ifacgroup.com, or the hop to arts-collective `/studio?org=ifac` first?
2. Who may list into IFAC's store: seated `store_member`s only (1 today), or IFAC owners and guides seated automatically?
3. Auction entry: proposal + desk acceptance (migration), or immediate entry with desk removal (no migration)?
4. Starting bid, reserve, buy-now: set by the artist at submission, or by the desk at acceptance?
5. IFAC viewers (2): may they open a store (`canClaimStore` refuses today)?
6. MCP: write scope to open stores now, or lesson-driven only?
7. ifac editor: Site style only, or Puck pages too? innergathering landing as a canvas page (`puck:landing` freezes hero/about copy against `/manage/pages`)?
