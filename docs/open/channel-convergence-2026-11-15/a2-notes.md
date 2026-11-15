# a2's notes on B (Plan it route, Dock) and C (one Channel page, hub card)

2026-11-15, system32-a2 (I built `@elkdonis/channel/site`). Read against B-plan-route-and-dock.md and
C-unified-page-and-hub-card.md. Opinions, not decisions; Justin decides.

## B. Plan it and the Dock

**Agree, and I can take these in the next Channel round (lane a2):**
- **P1, `tab` → `view` on sites.** Rename the site's tab parameter to `view` and keep `tab=home|board|queue|out|library` as a
  read-only alias. Then `?piece=<key>&tab=plan` means the same on every host. Small. Watch two things: `SiteLinks.tab()`
  builds every link, and katie's and sunjay's header "Channel" links use the plain `/channel`, so they don't change.
- **P5.1, one list of next moves for a piece.** Feed the pop-up's "Next for this piece" from `channelNextMoves(model, { pieceKey, limit })`
  instead of the raw `p.suggestions`, so the site pop-up, Studio's summary and the Dock list the same moves. The rows keep
  their buttons: a move with a site-runnable `run` gets a `RunButton`, and a suggestion keeps Accept / Plan it / ✕.
- **P3, the site link.** Set `links.plan` in the site pop-up once P1 lands.

**Differ on P2 ("one piece view" = move PieceSurface + ContentDetail into @elkdonis/channel):**
- I'd go the other way. The single piece view should be fc's `PieceSummary` (`@elkdonis/content/summary`).
  - It is props-only, already on both sites, and already in Studio's gate.
  - `ContentDetail` needs `SurfaceProvider` and `useLayer` from cms-ui, which the sites don't mount.
- So add a **Plan section to PieceSummary** (fc lane, a slot or props):
  - plan.md steps (tick and add, which `PieceSteps` in `site/runs.tsx` already does through the door);
  - "Start the plan" / "Propose steps" (`channel-plan`);
  - the goal and notes, read-only at first.
- Then arts-collective's `PieceSurface` moves onto `PieceSummary` too, rather than the sites moving onto `ContentDetail`.
- `plan.save`, editing plan.md as text, needs a door entry. Today it is `savePlanAction`, app-local on arts-collective. Add
  `channel-plan-save` to the registry when the Plan section wants free text. Until then: steps only.

**P4 (cells answer with a form):** done on sites this round. The "toast" Justin saw was my cell `<dialog>` pinned to the
top left by Tailwind's base (`*, ::backdrop { margin: 0 }`), and its dead-end lines; it is now positioned and gone.
arts-collective's own Queue/Board cells are a separate job. They could reuse `ChannelGrid` directly; its only host
dependency is a `ChannelDoor` with a `run`.

**P5.2/5.3 (Dock on sites):** agree it is its own lane.
- The site door already exists (`performSiteChannelAction`).
- If the Dock runs moves on a site, its allow list should be `SITE_DOOR_ALLOW` minus `channel-suggestion-dismiss`, which the registry keeps to the host's own pages.
- The site's `/api/actions/dock` should read `siteChannelLoader({ orgId }).load`, so it never sees other orgs.

## C. One Channel page, and the hub card

**The page.** Justin's direction today (2026-11-15) was "a toggle of board and queue and queue options to show by week
or piece". Collapsing the five tabs into one page goes against that, so I'd not do it yet. A middle path that keeps both:
- **Home becomes C's overview**: the queue strip (next moves, "did not go", today's routine slots), the pieces as cover
  bricks (the Library cards now on sites, plus mini outlet marks from `p.row`), and a compact Board. It's one glance, and
  every piece opens the same pop-up.
- **Board, Queue (by week / by piece), Out and Library stay** as the full views behind it, reached from Home's sections.
- On a phone, Home's sections stack; the full views stay as they are (the grid scrolls in its box, the pop-up and the
  square forms come from the bottom).

**The hub card.** Agree with a `packages/hub` contract card. For the exports C asks of me:
- I'll add `./site/board` (or widen `./site`) exporting `boardGrid`, `BOARD_COLUMNS`, `ChannelGrid`, and a lifted
  `buildPieceSummaryView(piece, model, links)`. Today that builder is inline in `tabs.tsx` `PieceSummary`; I'll move it to
  `site/summary-view.ts` so the page and the card share one mapping.
- `ChannelGrid` is a client component that runs moves through `ChannelDoor`'s context. The card's pop-up must wrap it in
  `<ChannelDoor run={…}>` with a site door (`performSiteChannelAction` for the site's org), not the hub door. The hub door
  refuses channel-scope entries by design.
- The card's data should come from `siteChannelLoader({ orgId }).load`, reduced on the server. Never send the whole
  `ChannelModel` to the client; it is large.

## Order I'd suggest (my lane)
1. P1 (`view` param + alias) and P5.1 (next moves in the pop-up). Small.
2. `site/summary-view.ts` + the `./site/board` exports for the hub card.
3. Home as the overview (C's strip + bricks + compact Board), behind Justin's yes.
4. With fc: the Plan section in PieceSummary. Then arts-collective's PieceSurface onto PieceSummary.
