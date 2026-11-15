# Channel convergence: one plan (2026-11-15, system32-fc, lead)

Justin's notes of 2026-11-15 cover four things:
- **No /manage page:** the Content tab folds into Channel.
- **One Channel page:** the library of pieces, with the queue strip on top and the board matrix on the right.
- **A "Channel" hub card** in the surface UI.
- **Make into any kind:** form to form, with "Plan it" working the same on every site's /channel.

Four Sonnet agents and a2 read the code and the earlier design notes. This file merges what they found; the detail is in:

| File | Covers |
|---|---|
| A-manage-piece.md | /manage's Content tab, by app; the manage-piece action groups; the doors; retiring /manage |
| B-plan-route-and-dock.md | Studio "Plan it" → `/channel?piece=&tab=plan`; plan.md; the Dock and next moves; site parity |
| C-unified-page-and-hub-card.md | One Channel page (wireframes); a `packages/hub` Channel card; IFAC |
| D-make-into.md | The kinds Studio opens; the widened Make into; the carry-over (form to form) proposal |
| a2-notes.md | a2's view on B and C (a2 built `@elkdonis/channel/site`) |

## What the reading found

1. **There is no single "no manage page" note.** The decision is spread across PM_BOARD_2026-11-08 §B, HUB_CARD_PROMPTS (prompt 3, Publish + /content), CONTENT_LIBRARY_COMPONENT and hub-cards PLAN. Nothing on /manage is retired yet. sunjay's Content tab holds:
   - publish and draft;
   - "Make this the weekly meeting";
   - confirm and cancel a cycle;
   - who's coming;
   - email a reminder or cancellation;
   - remove.

   Most of these are per-app SQL actions or fetch routes, copied in four apps. Only post publish and pin are in the registry. (A §2)
2. **No content library hub card exists.** `ContentLibrary`, `PublishCardFace` and `PublishPopup` are built but mounted nowhere. What Justin remembers is IFAC's "Publish" surface tile, which opens /hub/compose. (C §1.3)
3. **The board, Home's Next row, the Dock, `channel-next`, MCP `whats_next` and the Studio summary already share one list of moves**, `channelNextMoves`. The gaps are where it shows, not the data. The Dock is mounted on arts-collective only. (B §3)
4. **The site URL contract breaks "Plan it".** On a site `tab` means the view (home/board/…), so `?piece=…&tab=plan` lands on Home with no pop-up. The site pop-up passes `plan: null` and `next: []`. (B §4)
5. **The "can be done in manage page" notice** was a2's cell `<dialog>`, pinned top-left by Tailwind's base reset (`*{margin:0}`), showing the dead-end line "comes from the piece itself · Manage the piece". It's fixed in this round's build. (a2)
6. **Make into:** Studio opens 8 draft kinds. `from=` is read by nothing, so nothing carries over. That is why it doesn't feel like form to form yet. (D §1-2)

## Settled here (lead's calls, so nobody waits on them)

- **One piece view everywhere: `PieceSummary`** (`@elkdonis/content/summary`). It's the Studio published-piece page with the cover that Justin pointed to. It's props-only and already on both sites and in Studio's gate.
  - It gains two things: a **Manage** section of grouped actions (A §4.2) and a **Plan** section (plan.md steps, Start the plan, Propose steps).
  - arts-collective's `PieceSurface`/`ContentDetail` pop-up moves onto it later, not the other way round. This is a2's view, and it overrides B's P2.
- **Doors:**
  - Channel-scope entries (plan, accept, slot-fill, delivery-save) stay on the site's Channel door, which is "plans only".
  - The new per-piece entries go through the hub door (`performHubAction`) as `thread`-scope `appOnly` entries:
    - `thread-publish` (meetings too), `thread-unpublish`;
    - `thread-standing`, `thread-cycle`;
    - `thread-email-attendees`, `thread-archive`.
  - A site mounts both doors. A and C agree once scope is taken into account: the hub door refuses channel-scope entries, and these entries aren't channel-scope.
- **The hub card's writes** go through the site's Channel door: `host.act` → `runChannelAction`.
- **Route contract:** on every host, `piece` plus `tab=overview|plan` means the piece pop-up. Site views move to `view=`, and old `tab=board|queue|…` links stay as aliases. (B P1)
- **Studio's "Plan it"** links to the org's own site `/channel` when it has one, otherwise to arts-collective's. (B P3)
- **Make into:** every kind, the three likeliest as chips, the rest under "More". Word art stays under More. "Next meeting" carries the series cadence when known, otherwise the date is blank.
- **Order of retirement:** sunjay's /manage Content tab goes first, once the Manage groups are live. Other apps follow per app. IFAC's Channel comes later.

## Done today (2026-11-15)

- **a2's five fixes, in katie + sunjay builds:**
  - Library as a cover grid.
  - A one-row Queue toolbar.
  - By week: kinds across, days down, plus a Routines column.
  - View live per site (`threadPath`).
  - Cells answer with a form, and the dialog is centred.
- **fc:** `makeIntoFor` widened to every kind Studio opens (D §3-4), and `/studio/make` accepts all of them. Create's Library shows three chips plus "More". Typecheck 0 in content, studio, arts-collective, sunjay and katie.

## Next, in order

**Phase 1: no decision needed (in progress)**

| # | Work | Lane | Size |
|---|---|---|---|
| 1 | Site `tab`→`view` with alias; set `links.plan`; "Next for this piece" from `channelNextMoves` | a2 | S |
| 2 | `site/summary-view.ts` (lift `buildPieceSummaryView`) + `./site/board` exports for the hub card | a2 | S |
| 3 | PieceSummary **Plan** section (steps through the door, Start the plan, Propose steps); `channel-plan-save` later | fc | M |
| 4 | Studio "Plan it" → the org's site when it has Channel | fc | S |
| 5 | Make into **carry-over**: a `from=` seed on the Studio page → initial answers through the forms' preset path; field map per pair (D §5) | fc + forms owner (`state.ts`) | M |

**Phase 2: after Justin's answers below**

| # | Work | Lane | Size |
|---|---|---|---|
| 6 | The six `thread-*` registry entries + catalogue rows + runners | fc | M |
| 7 | PieceSummary **Manage** groups (Publish, Schedule, Share, People, Edit and make, Remove); `manage` block on the view | fc | S-M |
| 8 | Site loader `manage` block; `runHubAction` on sunjay; the pop-up passes the groups (meetings first) | a2 | M |
| 9 | **One Channel page**: Home becomes the page (queue strip on top, pieces as cover bricks, compact board on the right, Out below); the other tabs stay reachable until it proves itself, then go | a2 | M-L |
| 10 | **Channel hub card** on sunjay (`packages/hub/src/channel/`): mini-matrix face; a pop-up with the chart and the pieces; a piece opens PieceSummary | fc (hub lane free) + a2 exports | M-L |
| 11 | Retire sunjay's /manage Content tab: links, `redirects()`, drop the tab | fc | S |

**Phase 3:** the Dock on sites (B P5.2-3), IFAC Channel and card, other apps' /manage, and arts-collective's own cells reusing `ChannelGrid`.

## Justin's decisions

1. **One page.** Fold Home, Board, Queue and Library into one Channel page: queue strip on top, pieces as covers, board matrix on the right, Out below. Recommend **yes**, built as the new Home first, with the tabs removed once it reads right. (a2 noted that a toggle between board and queue was asked for earlier; the one page keeps that toggle on the matrix: Outlets | Week.)
2. **"Make this the weekly meeting".** Today it only sets what leads the hub, and "Repeat" is a separate form field. Recommend two plain labels: "Repeat weekly" in the form, "Lead the hub with this" in the pop-up.
3. **Emailing attendees from the pop-up.** "Email a reminder to everyone coming" sends real mail. Recommend yes, with a confirm step.
4. **The hub card's look.** Recommend the Industry hub-card look (like Members and Site Builder; it has a gate, an allow list and a pop-up), with the surface look as the alternative. The surface look needs a new `/api/hub/channel` route.
