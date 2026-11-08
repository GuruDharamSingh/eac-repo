# Channel console: design spec (2026-11-07)

Layout, tokens, markup, states and copy for the Channel console
(`packages/channel`, first host `arts-collective.com/studio/channel?org=<org_id>`).
It follows the left-column direction in `STUDIO_PIPELINE_DESIGN_2026-11-06.md`
§2.9 and the CMS-admin reference the developer chose (grouped, foldable column;
breadcrumbs, title and white cards in the main area). Design only; no code in
the tree. Visual design (Claude Design canvas: Overview, Artwork, phone):
https://claude.ai/artifact/BYQ9PEbR52mZ3EzZFRo2So (private to the developer).

## 0. Slice 1 status (2026-11-07, source only, not deployed)

- Package: a subpath of the Studio package, not a new `packages/channel`
  (no install needed; arts-collective already depends on it):
  `@elkdonis/studio/channel` = `packages/studio/src/channel/` (`types.ts`,
  `nav.ts`, `ChannelConsole.tsx`, `channel.css` = this spec's stylesheet).
  Server component, no client state; the host passes `ChannelData` and a
  "Post this" server action.
- Host: `apps/arts-collective/src/app/studio/channel/page.tsx`, loader
  `src/lib/channel-data.ts` (orgs where the person is owner or guide; the
  org's stores = `store.owner_org_id` plus a site's `site_config` `shop:store`
  pin; social posts, publish jobs, connections, `org_channels`; every read
  best-effort), action `src/lib/channel-actions.ts` (`postArtworkAction`:
  re-derives the channel, makes a draft `social_posts` row from the piece and
  opens `/studio?kind=post&id=`; nothing is sent).
- Org site: `apps/katie-the-potter/src/app/channel/page.tsx` (SSO hand-off to
  `<network>/studio/channel?org=katie-the-potter`) and a Channel card on its
  `/hub`. Per-site Site-group paths: `SITE_PATHS` in `channel-data.ts`.
- Verified 2026-11-07: `tsc` 0 errors in arts-collective and katie-the-potter,
  none in `packages/studio/src/channel`; the console rendered to static HTML
  with sample data and screenshotted at 1440 px and 390 px (Chrome container):
  no overflow, no script errors. Not verified: the loader against the live
  database, signed-in use.
- Deployed 2026-11-07 10:20 EST: arts-collective rebuilt (BUILD_ID
  `vTuvRoTYPzT3LCP0kgUIu`) and katie-the-potter rebuilt (`KcqlTjwD646kbTY1pEgKk`)
  from commit `30aa615` with a clean tree. Verified through the edge signed out:
  `/studio/channel?org=katie-the-potter` 307 to login with the query kept;
  pottery.arts-collective.com `/channel`, `/hub`, `/manage*` 307 to login, `/`
  200. Backups: `~/eac-backups/next/{arts-collective,katie-the-potter}-20261107-1015.tgz`.
- Differs from the sections below: "Posting for the org" is shown inside
  Accounts (setting it stays in the Center's Connections); "Post this" makes
  a draft post server-side instead of a `&piece=` parameter; Video and
  Writing on a piece open the Studio kind without preselecting the piece;
  Overview has no Continue or Newsletter card yet.

## 1. Layout

| Width | Column | Main | Tiles | Cards |
|---|---|---|---|---|
| >= 1100px | 272px (`--ch-col-w`, same as the Studio drawer, `studio.css` `.studio-frame`) | padding 24px 32px, content max 1120px | 4 across | 2 across, wide cards span both |
| 760-1099px | 232px | padding 24px | 2 across | 1 across |
| < 760px | hidden; nav moves into the top bar's "Menu" disclosure | padding 16px | 2 across | 1 across |

- Top bar 52px, sticky, panel ground: Menu (phone only), "← Studio", wordmark
  "Channel" (serif), org picker, spacer, "Center".
- Column: sticky under the top bar, own scroll, panel ground, right rule.
  Main: Studio `--st-bg` ground with panel cards (the reference's grey/white).
- Phone, no script: the shell renders the nav twice, once in `aside.ch-side`
  and once in `details.ch-menu > .ch-menu__panel` (a fixed sheet under the
  top bar). CSS shows one per breakpoint; `display:none` keeps the other out
  of the accessibility tree. Tapping "Menu" again closes it. The Today block
  is also rendered at the top of main as `.ch-today--main` (phone only).
  Decision to confirm: duplicated markup (~30 links) in exchange for no
  script. Alternative later: one nav plus `details::details-content`, once
  Firefox support is checked.
- Phone targets: `--ch-hit` 36px becomes 44px; buttons 40px.

## 2. Tokens

Defined on `.ch`. Each maps to the Studio token with the Studio's hex as
fallback, so the console reads the same with or without `.studio` on the root.
Dark values (fallbacks) are the Studio's dark set (`studio.css:58-93`); keep
them equal when the Studio palette changes.

| `--ch-` | Studio token | Light fallback | Use |
|---|---|---|---|
| bg | --st-bg | #f3f1ec | main ground |
| col, card | --st-panel | #ffffff | column, cards, top bar |
| card-2 | --st-panel-2 | #eae7df | hover, image wells, picker |
| line | --st-line | #d8d3c7 | rules, card edges (decorative only) |
| control-line | --st-control-line | #737d87 | picker and input borders (>= 3:1) |
| ink / muted / faint | --st-ink / -muted / -faint | #1c2530 / #55616c / #626e7a | text |
| accent / accent-ink | --st-accent / -accent-ink | #8a6d1f / #fff | primary button, active bar, links |
| active | --st-accent-soft | #f1e7c9 | active item ground |
| ok / warn / danger | --st-ok / -warn / -danger | #276a43 / #8f5a17 / #a63d3d | status pills |
| shadow, serif, sans | --st-shadow, -serif, -sans | Newsreader, IBM Plex Sans | |

Own tokens: `--ch-top-h` 52px, `--ch-col-w` 272px, `--ch-main-max` 1120px,
`--ch-r` 8px, `--ch-r-sm` 6px, `--ch-s1..s6` 4/8/12/16/24/32px, `--ch-hit`.
Type: body 14/1.45 sans; h1 26px serif 600 (22px phone); card title 15px sans
600; group header 11px 600 uppercase, tracking 0.07em; meta 12-13px.

Audit note: the Studio has no spacing or radius tokens (6px/8px and paddings
are literals across `studio.css`); the `--ch-s*` scale is new and could move
into the Studio later. Faint text on `--st-panel-2` is 4.22:1 in light, so the
spec never puts `--ch-faint` text on `--ch-card-2`.

## 3. Groups and items

`view` = rendered in the console (slice 1); `out` = link to an existing screen
(trailing ↗ glyph, same tab); `soon` = shown, not a link. Hidden rows are not
rendered. URLs marked (assumed) need checking by the implementer.

| Group | Item | Type | Target / condition |
|---|---|---|---|
| (top of column) | Today | block | current LMS routine step; absent when none |
| Content | Overview | view | `?org=` default view |
| | Posts | view | list of `social_posts`; "New post" → `/studio?kind=post&org=` |
| | Artwork | view | the org's store pieces; count = pieces; hidden when the org has no store |
| | Writing | out | `/studio?kind=writing&org=` |
| | Video | out | `/studio?kind=video&org=` |
| | Recordings | out | `/studio?kind=recording&org=` |
| | Meetings | out | `/studio?kind=meeting&org=`; Series via the org site's `/hub/series` where `series-site` is mounted (assumed) |
| Audience | Newsletter | out | `/email?org=` (assumed param); hidden for Just me |
| | Comments | soon | becomes a view over `thread_external_comments` (slice 2) |
| | Live | soon | |
| Social media | Accounts | view | the Center's Connections data |
| | Posting for the org | view | `org_channels`; hidden for Just me |
| | Activity | view | `publish_jobs`; count = failed in 30 days, red |
| Site (owners, guides) | Pages | out | `/hub/sites/<slug>/design` for network-hosted orgs, else the org site's `/studio` |
| | Site style | out | only where the site has it (elktours today) |
| | Details | out | Center org section (`OrgManage`) |
| | People | out | Center org section |
| Network | Store | out | org store admin (e.g. katie `/manage/pieces`, market `/admin`) |
| | Directory listing | out | `directory.arts-collective.com/<slug>`; for Just me, or an org with a listing |
| | Center | out | `/center` |

Changes from the proposal, to confirm:
- "Channels" renamed "Posting for the org": "Channel" is the console's name.
- "Platform" renamed "Network": it holds network pages, not platform admin.
- "Identity and SEO" dropped until a screen exists; "Details" points at the
  Center's org section instead.
- "Post" is the in-console "Posts" list; Series folds under Meetings.
- Org picker lists "Just me" plus orgs where the person is owner or guide
  (the roles that can publish for an org). Members-only orgs are left out.

Default fold state: a group is `open` when it holds the active item or is
Content, Audience, Social media or Site; Network starts closed. In the phone
menu only the active group is open.

## 4. Markup and class names

```
div.ch[data-theme?]
  svg (symbol sprite, aria-hidden, 0x0)    a.ch-skip "Skip to content"
  header.ch-top
    details.ch-menu > summary.ch-menu__toggle + div.ch-menu__panel > nav.ch-nav
    a.ch-top__back  span.ch-top__mark  span.ch-top__spacer  a.ch-top__link
    details.ch-org > summary.ch-org__current (span.ch-org__for "For",
      span.ch-org__name, chevron) + ul.ch-org__list > li > a.ch-org__opt
      [aria-current="true"] (+ span.ch-org__role)
  div.ch-frame
    aside.ch-side > div.ch-today + nav.ch-nav[aria-label="Channel"]
      details.ch-group[open?] > summary.ch-group__head (span label,
        svg.ch-icon.ch-group__chev) + ul.ch-group__list > li >
        a.ch-item[aria-current="page"?] (svg.ch-item__icon, span.ch-item__label,
          svg.ch-item__out | span.ch-item__count[--alert])
        span.ch-item.ch-item--soon[aria-disabled] (... span.ch-item__soon "Soon")
    main.ch-main#ch-main[tabindex=-1]
      div.ch-today.ch-today--main (phone)
      nav[aria-label="Breadcrumb"] > ol.ch-crumbs > li (last: aria-current="page")
      div.ch-head > h1.ch-head__title, p.ch-head__sub, div.ch-head__actions
      div.ch-tiles > a.ch-tile[--alert] > span.ch-tile__n, span.ch-tile__label
      div.ch-grid > section.ch-card[--wide][aria-labelledby]
        div.ch-card__head > h2.ch-card__title + a.ch-card__more
        div.ch-card__body[--flush] | ul.ch-rows > li.ch-row
          (svg.ch-row__icon, span.ch-row__main > .ch-row__title + .ch-row__meta,
           span.ch-row__act)
```

Shared parts: `.ch-btn` (`--primary`, `--quiet`, `--sm`; mirrors
`.studio-btn`), `.ch-status` (`--ok`, `--warn`, `--fail`, `--wait`),
`.ch-empty` (`__title`, `__text`, one `.ch-btn`), `.ch-pieces`/`.ch-piece`
(`__img`, `__body`, `__title`, `__meta`, `__acts`, `__link`), `.ch-filter` >
`a.ch-filter__opt[aria-current="page"]`, `.ch-table` (`__when`, `__err`),
`.ch-icon`, `.ch-sr` (visually hidden), `.ch-note`.

Folds reuse the forum's script-free pattern (`packages/forum-ui/src/shell.tsx:183`,
`<details className="gf-side-group gf-side-fold">`), with the marker hidden
and a chevron that turns 180° when open (down = closed, up = open, as in the
reference).

## 5. States

| Element | Default | Hover | Active / current | Focus-visible | Disabled |
|---|---|---|---|---|---|
| `.ch-item` | ink, muted icon, 3px clear left bar | `--ch-card-2` ground | `aria-current="page"`: `--ch-active` ground, accent left bar and icon, 600 | 2px accent outline, offset -2px (inside the scroller) | `--soon`: faint text, no hover, not focusable, "Soon" pill |
| `.ch-group__head` | muted uppercase | ink | — | outline offset -2px | — |
| `.ch-btn` | panel, line border | `--ch-card-2` | — | 2px accent, offset 2px | `:disabled` 0.5 opacity |
| `.ch-tile` | panel, line | control-line border | — | outline | `--alert` when n > 0: danger left bar and number |
| `.ch-status` | word + glyph on a 12% tint of its colour | — | — | — | — |

Status words: Sent ✓, Failed !, Queued ◷ (`--wait`), Connected ✓,
Reconnect by <date> ↻ (`--warn`), Not connected (plain meta text).

## 6. Views (slice 1)

**Overview.** Head: org name (or "Your channel" for Just me), sub "What
<org> has published, where it went, and what is waiting." Actions: "New
writing", "New post" (primary). Tiles (each links to its view): Posts in the
last 30 days · Pieces not yet posted · Failed sends · Accounts connected.
Cards: Continue (drafts from `studio_items`, newest 5, "Continue" each) ·
Recent activity (last 5 sends) · Not yet posted (wide; up to 4 pieces) ·
Accounts (one row per provider) · Newsletter (last letter sent). A card
whose source is hidden for the scope (Newsletter, pieces for Just me without
a store) is not rendered.

**Artwork.** Head "Artwork", sub "Pieces in <org>'s store. Post one, or
follow it up with a video or writing." Filter: All · Not posted · Posted.
Grid of `.ch-piece` (min 168px): square image (`<img alt="">`: the title
follows as text), title, meta "$64 · For sale · Posted 2 times, last 3 Nov" or
"· not posted", actions "Post this" (primary, `/studio?kind=post&org=&piece=<id>`,
assumed param), "Video", "Writing" (Studio kinds with the piece preselected).
Each action carries the piece title in `.ch-sr` text.

**Posts.** `.ch-table`: Post · Sent to (platform names) · When · Status;
"New post" in the head.

**Accounts.** One `.ch-card` per provider (Facebook Page, Instagram, Threads,
YouTube): account name, status, Connect / Reconnect / Remove through the
existing Connections routes. **Posting for the org:** per provider, a radio
list of the person's connected accounts, legend "Posts for <org> go out as",
"Save" button (server action).

**Activity.** Filter: All · Failed · Sent; table columns When · Piece · Where
(platform and account) · Status · (action: "View" to the permalink when sent,
"Try again" to the piece's Post kind when failed). Failed rows put the reason
under the status as `.ch-table__err`. Below 760px each row stacks, with
`td[data-label]` labels. `<caption class="ch-sr">Sends from <org>, newest first</caption>`.

## 7. Empty and error copy

| Where | Title | Text | Action |
|---|---|---|---|
| Overview, nothing yet | Nothing published from <org> yet. | Posts, writing and videos you publish show up here, with where each one went. | New post |
| Continue | No drafts. | Drafts you start in the Studio appear here until they are published. | — |
| Recent activity / Activity | Nothing sent yet. | Each time a post goes to Facebook, Instagram or Threads, the send is listed here. | New post |
| Activity, Failed filter | No failed sends. | Sends that fail in the last 90 days are listed here with the reason. | — |
| Artwork | No pieces in the store. | Add pieces in the store, then post them from here. | Open the store |
| Posts | No posts yet. | A post is a short text with pictures, sent to the network and to the accounts you choose. | New post |
| Accounts | No accounts connected. | Connect Facebook, Instagram, Threads or YouTube to post there from the Studio. | Connect (per row) |
| Posting for the org, none connected | Connect an account first. | Then choose which account posts for <org> on each platform. | Go to Accounts |
| Newsletter card | No newsletter sent yet. | Letters to <org>'s subscribers are written and sent in the email suite. | Write a letter |
| Load failure (any view) | <View> could not be loaded. | Reload the page to try again. | — |

## 8. Icons

Inline SVG sprite rendered once by the shell (`<symbol id="ch-i-*">`, 16×16
viewBox, `stroke: currentColor`, 1.5 width, round caps; no icon library):
overview, post, artwork, writing, video, recording, meeting, series,
newsletter, comments, live, accounts, speaks, activity, pages, style,
details, people, center, store, directory, chevron, out, back, menu. Paths
are in the mock-up. All icons are `aria-hidden`; the label carries the name.

## 9. Dark mode

Same mechanism as the Studio: `.ch[data-theme="light"|"dark"]` wins; without
it `prefers-color-scheme` decides. Set `data-theme` from the same preference
the Studio shell's toggle writes, so the two screens match. Tints use
`color-mix(in srgb, <status> 12%, var(--ch-card))` and need no dark overrides.

## 10. Hub card (each org site's /hub)

`<HubLinkCard href={channelHref} glyph="◎" title="Channel" blurb="Posts,
videos, newsletter and social accounts for <site>, in one place on the Arts
Collective." />`. `channelHref` goes through the site's network SSO hand-off to
`https://arts-collective.com/studio/channel?org=<org_id>`. Owners and guides
only, beside "Center" in the card grid (e.g. `apps/katie-the-potter/src/app/hub/page.tsx:35`).

## 11. Accessibility review (WCAG 2.1 AA, of this spec and the mock-up)

Contrast, computed from the token hex values (script, 2026-11-07):

| Pair | Light | Dark | Need |
|---|---|---|---|
| ink on active ground | 12.5 | 10.9 | 4.5 |
| muted group header on column | 6.3 | 6.7 | 4.5 |
| faint "Soon" on column | 5.2 | 5.2 | 4.5 |
| accent link text on card | 4.9 | 9.5 | 4.5 |
| accent-ink on accent (primary button) | 4.9 | 10.4 | 4.5 |
| accent bar / focus ring on active ground | 3.97 | 7.8 | 3.0 |
| accent focus ring on main ground | 4.3 | 10.5 | 3.0 |
| control-line picker border on column | 4.2 | 3.4 | 3.0 |
| ok / warn / danger text on its 12% tint | 5.5 / 4.9 / 5.2 | 6.0 / 6.2 / 4.8 | 4.5 |

Findings and how the spec handles them:
1. Status by colour alone (1.4.1): every pill has a word and a glyph.
2. Link-outs vs views (1.3.1): the ↗ glyph is decorative; links stay in the
   same tab, so no "opens in new window" text is needed.
3. Repeated "Post this" / "Continue" (2.4.4): each carries the item title in
   `.ch-sr` text.
4. "Soon" items: `span` with `aria-disabled`, not focusable; read as
   "Comments, Soon".
5. Landmarks (1.3.1, 2.4.1): banner, one visible `nav "Channel"`,
   `nav "Breadcrumb"`, `main`; skip link to `#ch-main`; cards are `section`s
   named by their `h2`; tiles sit under a visually hidden `h2`.
6. Folds and pickers (4.1.2): native `details/summary` (expanded state read
   by screen readers, Enter/Space toggle). The org picker list does not close
   on outside click or Escape without script; acceptable, noted as open.
7. Focus (2.4.7): 2px accent outline everywhere; inset (-2px) inside the
   scrolling column so it is not clipped.
8. Targets (2.5.5 is AAA; 2.5.8 in 2.2 needs 24px): 36px desktop, 44px phone.
9. Breadcrumb separators use `content: "/" / ""` so they are not read.
10. Reflow at 320px (1.4.10): one column, stacked table rows, org name
    truncated with ellipsis (full name in the picker list).
11. Reduced motion: chevron transition removed.

Not verified: the mock-up was not rendered (the host's headless Chromium
lacks system libraries and containers were out of scope); no screen-reader or
keyboard pass has been made.

## 12. Open items

- Developer: confirm the renames in §3, the org-picker roles, and duplicated
  nav for phone.
- Implementer: check the (assumed) URLs and query params in §3 and §6.
- Comments view (slice 2); Live when the broadcast screen moves under Out
  (pipeline §2.5).
- Escape-to-close for the org picker and phone menu needs a small client
  script if wanted.
