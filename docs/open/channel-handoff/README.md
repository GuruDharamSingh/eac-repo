# Handoff: Channel (artist + org publishing console)

## Overview

Channel is a new surface on arts-collective.com, opened per artist and per org. It collects each piece of content (artwork, product, writing, video, series, meeting) together with every post that followed it: the network site, the artist's page, the market, Instagram, Facebook and the newsletter (Email suite). It also covers planning that content over time (Queue, routines, plan.md) and quick cross-posting.

It sits between the hub console (`apps/arts-collective/src/app/hub`) and the Studio. It reuses the hub's Surface pattern and compose catalogue, and hands long-form writing off to the Studio writing room.

This is a **first pass**. Its goal is to get the routes, data model and core screens in place so the code can catch up with the design. The visual palette is still to come (see Design tokens).

Source repo: `GuruDharamSingh/eac-repo` (branch `main`). Read `CLAUDE.md` at the repo root before any migration, build or container work.

## About the design files

The files in this bundle are **design references created in HTML**. They are prototypes that show the intended look and behaviour, not production code to copy. Recreate them in the repo's existing environment: Next.js 16 App Router, React 19, TypeScript, `@elkdonis/cms-ui` and `@elkdonis/primitives` (plain CSS on `--eac-*` tokens), and the Surface system in `packages/cms-ui/src/surface`.

To view the designs, open `Channel.dc.html` in a browser from this folder; `support.js` and the `_ds/` folder must sit beside it. The page is a pan-and-zoom canvas with three rounds, newest at the top. Each option has an id (1a … 3c), referenced below.

## Fidelity

- **Layout, structure, copy, behaviour: high fidelity.** Recreate the layouts, hierarchy, copy and interactions as shown.
- **Colour and type: provisional.** The mocks use the Broadsheet design system (Source Serif 4, paper ground, cyan and magenta accents) as a stand-in. The owner will supply muted palettes built on a **three-colour principle, one colour per area: Channel / Studio / Queue**. Build on `--eac-*` tokens, with one CSS variable per area colour, so the palette can be dropped in later. Do not hard-code Broadsheet hex values into production.

## What was decided

| Decision | Detail |
|---|---|
| Home | **1a** is Home. **1b** (coverage matrix) is Home's matrix view (Queue view switcher: Week / Month / Matrix). |
| Scope | The artist channel comes first. Artist and org content appear **together**, with each post tagged by the identity it went out under (artist or org). |
| Nav | Inside Channel, one long left column **replaces** the Studio nav (ChannelNav). |
| Piece detail | The piece card on Home is a **face that grows into a wide Surface** (the existing `surface.open(descriptor, originEl)` pattern). |
| Content library | Lives **inside network search** as its Content tab, scoped to the sites this person belongs to and grouped by site. **Change requested after the mock:** show it as a **brick/gallery grid with a lightbox**, not a list (3b shows a list). |
| plan.md | One plan per piece or series. It starts **empty** when the piece is added to the queue and fills as suggestions from the board are accepted. The action registry and agents can read and write it. |
| Editing weights | 1. Quick sheet (fill a slot or gap) → 2. expanded sheet (every outlet side by side) → 3. New post (cross-post existing work, **1d**) → 4. Focus in Studio (writing room plus Blocks) for new long writing. **1c is dropped.** |
| Action registry / MCP | Shown only as light inline "next" chips on pieces, slots and gaps. |
| Later (not this pass) | A Studio toggle in New post with in-depth editors for social posts and clips; Instagram presets and filters in the quick sheet, with a third, wider sheet size and a "Custom edit" that opens the post in Studio; Queue calendar controls (zoom, drag to reschedule, shift a whole plan); the Go live flow; Site settings and the Puck pages list. |

## Proposed implementation (first pass)

These are proposals. Check each one against the repo's conventions before building.

**Routes** (in `apps/arts-collective`, port 3007):
- `/channel`: the signed-in artist's channel (Home, 1a). Resolve the viewer from `getServerSession()`, never from request params.
- `/channel/queue`: Queue week (2a). `?view=month|matrix` (matrix = 1b).
- `/channel/piece/[kind]/[id]`: the piece board (2b), the full-page form of the piece.
- `/channel/new`: New post (1d). `?about=<kind>:<id>` prefills the piece.
- The piece pop-up (3a/3c) and the content library (3b) are **custom surfaces** registered on the host, like `OrgConsoleHost` does: `connectors.custom["channel:piece"]` and `connectors.custom["channel:library"]`, with `?surface=piece:<id>` (and `&tab=plan`) so a reload keeps them.
- The quick sheet (2c) is also a surface (`channel:quick`). Size `standard`; Expand switches it to `wide`.
- Focus (2d) is **not** a Channel route. It is the existing writing room (`packages/cms-ui/src/surface/surfaces/writing-room.tsx` and `/hub/compose?kind=post`) and the `WritingDesk`, plus a new Text / Blocks switch (Blocks = the Puck editor).

**Package:** put the UI in `packages/cms-ui/src/channel/` (exports `ChannelNav`, `ChannelHome`, `QueueWeek`, `PieceBoard`, `PieceSurface`, `ContentLibrary`, `QuickSheet`, `CoverageMatrix`). It should take data through connectors, like the rest of cms-ui: no data access and no router inside it.

**Data model** (new migrations via `/new-migration`; `org_id` on every row; store jsonb with `db.json(x)`):
- `channel_deliveries`: one row per piece × outlet × identity. Columns: `id`, `org_id`, `owner_kind` ('user' | 'org'), `owner_id`, `identity_id` (the publishing identity, see `/api/hub/identities`), `subject_kind` ('thread' | 'artwork' | 'product'), `subject_id`, `outlet` ('site' | 'page' | 'market' | 'instagram' | 'facebook' | 'youtube' | 'newsletter' | 'live'), `status` ('draft' | 'scheduled' | 'published' | 'failed'), `scheduled_at`, `published_at`, `external_id`, `permalink`, `payload jsonb` (per-outlet caption and overrides), `routine_id`, timestamps. This single table drives the timeline (1a/3a), the matrix (1b), the piece board (2b) and the queue (2a).
- `channel_routines`: `id`, `owner_kind`, `owner_id`, `org_id`, `name`, `outlet`, `cadence jsonb` (e.g. `{ "weekdays": ["tue","fri"], "time": "10:00" }` or `{ "monthDay": 1 }`), `source` ('sophia' | 'channel'). The design treats routines as **coming from the Sophia (LMS) dock**. That dock was not found in the repo, so keep `source` and expect an import from `@elkdonis/lms` later. Routines generate **slots**: they are computed at read time, not stored rows.
- `channel_plans`: `id`, `org_id`, `owner_*`, `subject_kind`, `subject_id`, `body_md text`, `created_at` (set when the piece is first added to the queue), `updated_at`, `updated_by`, `updated_by_actor` ('user' | 'agent'). Add an append-only `channel_plan_events` table (actor, verb, diff) so agent edits are attributable. This follows the LMS rule of an event log written in the same transaction.
- `channel_todos`: the user's own to-dos on a day (2a). Columns: `id`, `owner_*`, `org_id`, `date`, `text`, `done`, `subject_*` (nullable).
- If any of these write to `threads`, add the new `threads.kind` to `OFF_FEED_KINDS`.

**"In motion"** (Home list and library sort): a piece is in motion if **any** of these hold:
1. A `channel_deliveries` row is scheduled in the future (this includes `live`).
2. It has an event date ahead: `threads.scheduled_at` for event, meeting or workshop kinds.
3. It was published to any outlet in the last 14 days.
4. It has an open `channel_todos` row or an unfinished plan step.

Show the reason as the row's sub-line, for example "Writing scheduled for Nov 12" or "Goes live Sun 2 PM".

**Gaps → suggestions:** a gap is a missing `outlet × identity` for a piece, where that outlet is connected for that identity. Generate a suggestion for each gap ("+ Share", "+ Quote card", "+ Go live"). Place suggestions in time by matching them to the next open routine slot or to a dated event for the piece. Accepting one writes a draft `channel_deliveries` row and appends a step to plan.md.

**Outlet rules to enforce** (from `packages/meta/src/instagram.ts`):
- Instagram caption links are not clickable. When a post goes to Instagram, swap the site link for "Link in bio" and tell the user it was swapped.
- Images must be **JPEG** reachable from the public internet; PNG fails silently. Convert on send.
- **25 posts per rolling 24 h** per account. Show the remaining count (`remainingInstagramQuota`) in the nav and the composer, and disable Instagram when it reaches 0 ("Daily limit of 25 reached · resets in N h").
- Publishing is a two-step container then publish, so show "Publishing…" until the container finishes.
- Facebook link previews read from the site page, so **Facebook publishes after the site**.

## Screens / views

All desktop artboards are 1280 px wide. The left column (ChannelNav) is 244 px wide and the main area fills the rest. Main padding is 30px 40px (composer: 26px 36px).

### ChannelNav (left column, every desktop screen) · `ChannelNav.dc.html`
- Full height, background `surface`, padding 18px 10px 12px, gaps of 14 px between blocks.
- **Header:** a 32 px avatar (artist: circle with initials; org: 2 px-radius square), name in heading type at 14/600, sub-line at 12 px ("Artist channel · 1 org" or "Channel"), and a caret-up-down switcher icon.
- **Link row:** ← Hub · Studio · Site ↗ (12 px, accent-700).
- **Sections** (collapsible; the header is a button 26 px tall with 10.5 px uppercase text, letter-spacing 0.1em, and a caret):
  - (no title): Home, New post, Queue (4), Live (next live time, magenta)
  - **Publishing as** (artist scope only): Guru Dharam · You; Elkdonis Arts Collective · Org
  - **Content:** Writing 23, Video 6, Artwork 41, Series 3, Meeting 8
  - **Outlets:** Website ●, Instagram "18 of 25" (magenta at 0), Facebook ●, YouTube "Connect"
  - **Audience** (collapsed by default for artists): Newsletter "Email ↗" (opens the Email suite, `@elkdonis/cms-ui/email`), People 212
  - **Site settings** (collapsed by default): Pages "Puck", Template, Identity and SEO
  - Footer: Channel settings
- **Rows:** 29 px tall, padding 0 8px, 2 px radius, a 17 px icon, 14 px label and 12 px meta. The active row has an accent background at 12%, accent-800 text and an accent icon.
- **Props:** `active`, `owner` ('artist' | 'org'), `igLeft`.

### 1a · Home
- **Header:** h1 "Channel" (36 px) with the sub-line "Each piece of work and the posts that followed it, across the site, Instagram and Facebook." On the right, "Go live" (secondary button, magenta broadcast icon) and "New post" (primary).
- **Replace the four count bands with the routines strip from 2a.** This was owner feedback: the bands imply goals that don't exist yet.
- **Body:** a grid of 360 px (list) and 1fr (piece face), with a 40 px gap.
  - **List "In motion · N":** each row is a button with a 52 px thumbnail, 15/600 title, kind glyph and label, seven 14 px outlet icons coloured by state (published = ink, scheduled = accent-700, live = magenta-700, draft = neutral-700, empty = neutral-300) and the reason line. The selected row has an accent background at 11%.
  - **Piece face** (right): cover (200 × 150), kicker, h2 title, meta, links, a "Where it has gone" timeline and "Next for this piece" chips. **Clicking it opens the 3a surface.**

### 1b · Coverage matrix (Home's matrix view)
- Grid columns: `minmax(0,1.8fr) repeat(7, minmax(0,1fr))`. Columns are Website, Instagram, Facebook, Video, Writing, Live, Letter.
- **Cells:** filled cells show a state icon and date. An empty cell with a suggestion shows a dashed chip "+ Go live" (12 px, accent-700, dashed border at accent 50%). An empty cell without one shows "—" in neutral-400. Rows are 64 px with an 8% rule between them.
- A kind filter (segmented control) and a legend sit above the matrix. Below it is "Coming up · Nov 8 – 14", a 7-day strip.

### 1d · New post (kept as the cross-post view)
- **Header:** breadcrumb, h1 "New post", "Saved 1:24 PM", Publish now ▾, Save draft, and "Publish to N places" (primary; N = enabled outlets).
- **Shared text block** (surface background): 132 px cover, title in heading type at 22 px, body, and the line "Every outlet below starts from this. Edit one and the rest keep the shared version."
- **Three preview columns** (Website / Instagram / Facebook). Each has a header with an "On" tag, a status line, the rendered preview (neutral-100 background, shadow-sm), and a line saying what was edited ("Edited here: link replaced with 'Link in bio', 3 hashtags added") with "Edit for Instagram".
- Later: a Studio toggle that opens the in-depth editors.

### 2a · Queue (week)
- **Header:** h1 "Queue", a ‹ Nov 8 – 14 › date range, Week | Month | Matrix, and New post.
- **Routines strip:** 4 columns. Each shows an icon, name (15/600), cadence (12 px) and status (13 px; accent-700 when a slot is open). Above it: "From your dock in Sophia. Each one opens slots in the week." and "Edit routines ↗".
- **Week:** 7 columns, 12 px gap, a 1 px top rule per day, and a day label (15/600). Item types:
  - **Post card:** surface background. Piece name (11 px), title (14/600), outlet icons and time, a stage tag, and an optional routine line with a repeat icon.
  - **Routine slot:** dashed border in accent-400. "Instagram slot", "Tuesdays and Fridays routine", and a suggestion chip.
  - **Event anchor:** magenta-700, 12 px, calendar icon.
  - **To-do:** a 14 px checkbox and 13 px text.
  - **Suggestion:** a text line and a chip.
  - Each day ends with "+ To-do".
- **"Not placed yet · 4" tray:** 4 columns of draggable cards (⠿ grip). Each card shows its type (Draft · Video / Gap / Your note), title, sub-line and an action chip.

### 2b · Piece board (opened from Queue in the pop-up)
- **Header:** 112 × 84 cover, kicker, h1 (32 px), meta, "Open in Studio" and "New post about this".
- **Board:** the label column is 132 px, then 7 week columns (Oct 26 … Dec 7). Lanes: Dates, Website, Instagram, Facebook, Video, Writing, Live, Newsletter, each at least 54 px tall. Items are chips styled by state:
  - done: surface background
  - scheduled: accent-100 background, accent-800 text
  - draft: neutral-400 outline
  - suggestion: dashed accent-400 border, accent-700 text
  - event: magenta-100 background, magenta-800 text
- **Today line:** a 1.5 px magenta vertical line positioned by date, labelled "Today".
- **Footer:** "5 suggestions, placed in your routine slots and around the open studio on Nov 21." with Dismiss and "Add 5 to the queue".

### 2c · Quick sheet
- A right-side sheet over a dimmed page (scrim: neutral-900 at 30%), shadow-lg. Width 460 px; **Expand** widens it to 900 px (transition: width 280 ms, cubic-bezier(0.2,0.9,0.3,1)).
- **Header row:** kicker "Filling · Friday Instagram slot", Expand / Collapse, Open in Studio (icon button) and close. The title "Quote card: Winter Reading Circle" (22/600) sits below.
- **Body:**
  - Piece chip with Change (opens the content library).
  - "Quote, set on the card".
  - A 150 px quote-card preview with notes (JPEG; link goes in bio).
  - Caption with a 2,200-character counter.
  - Send to: Instagram is locked to this slot; "Also post to Facebook" is a toggle.
  - When: "Fri Nov 13, 10:00 AM · From your Instagram routine".
- **Expanded:** a 380 px form column beside Instagram and Facebook previews.
- **Footer:** "Saved to the queue as a draft", Save draft, and "Schedule for Friday" / "Schedule to 2 places".

### 2d · Focus (Studio writing room; no Channel chrome)
- **Top bar (60 px):** ← Content, "Writing · follow-up to Salt Marsh, Low Tide", the **Write | Side by side | Preview** control (as in `WritingDesk` / `writing-room`), the **Text | Blocks** control (new), "Draft · 1,240 words · 6 min", Save, and "Publish…".
- **Write:** one centred column, max 780 px (text 660 px). Title 44/600, standfirst 20 px italic in neutral-700, body 18/1.75.
- **Blocks:** labelled blocks with dashed outlines (Heading, Text, Artwork card, Image). The selected block has a 2 px accent outline and a floating toolbar (⠿ ↑ ↓ ⋯). Below them, "Add block: Text, Image, Artwork, Video, Quote, Gallery, Sign-up". Implement with Puck; this mock is a generic stand-in, not Puck's UI.
- **Side by side:** two equal columns; the preview uses neutral-100 and should be `ArticleView`.
- **Footer (46 px):** "Scheduled Thu Nov 12, 9:00 AM · Website, Studio notes", "Fills this week's Studio note routine", and "Once it's published, New post offers it to Instagram and Facebook".

### 3a · Piece pop-up (Overview)
- A wide surface opened from the Home face (it grows from the card). Inset over the page: top and bottom 36 px, left 288 px, right 44 px; radius 4 px; shadow-lg.
- **Masthead:** 84 px cover, kicker "▣ Artwork" with the identity line "Yours · presented by Elkdonis Arts Collective", title 28/600, meta, "Switch piece" (opens 3b on the stack) and close.
- **Actions row:** New post (primary), Queue (opens 2b), Open in Studio, and "View on your page ↗".
- **Tabs:** Overview · Plan (with a count of waiting suggestions).
- **Body:** a grid of 1fr and 340 px.
  - **Timeline** "Where it has gone": date, an identity avatar (18 px; artist = circle, org = square), outlet icon, label and sub-line, and a status tag.
  - **"Coverage by identity":** rows are identities and columns are Page/site, Instagram, Facebook, Market and Letter. Gaps show as "+" suggestions.
  - **"Next for this piece"** chips.
- **Footer:** "Opened from Home · ?surface=piece:salt-marsh" and "Esc closes".

### 3b · Content library
- Stacked on the piece surface, which stays visible behind it under a second scrim (neutral-900 at 16%). A back link "‹ Salt Marsh, Low Tide" sits at the top left.
- Kicker "Network search", title "Content library", a search field ("Search your sites, or the whole network"), and the scope options **Yours | Elkdonis Arts | Whole network**.
- The search tabs **Content** · People · Sites · Forum show that the library is one tab of network search. A kind filter (All, Artwork, Writing, Video, Series, Meeting, Product) sits on the right.
- Results are grouped by site: identity avatar, site name, host.
- **Implement as a brick/gallery grid with a lightbox** (owner request), not the list in the mock. Each brick shows the image, title, kind, outlet icons, the in-motion reason and an "Open now" tag on the current piece. The lightbox shows a large view plus the piece's actions: open the pop-up (manage) and see its coverage across outlets.
- Picking a piece replaces the piece surface with that piece's pop-up.

### 3c · Piece pop-up (Plan tab)
- **Left:** "plan.md", the line "Started Nov 5, when you added this to the queue · last edited by you, Nov 6", and a Read | Markdown switch. The document (neutral-100, shadow-sm) has the sections Goal, Dates, Steps (checkboxes; steps accepted from the board are tagged "from the board" in accent-700) and Notes.
- **Right:** "From the board · N waiting". Each dashed suggestion card shows the text, the reason, and Accept / Dismiss. Accepting moves it into Steps. Below them: "Actions in the registry can read and edit this file. Every change is listed with who made it." and "Open the board for this piece".

### 1e · Mobile composer (reference)
- Two 360 × 740 screens. Write: piece chip, title, text, images, and "Send to" chips at least 44 px tall. Review: Site / Instagram / Facebook tabs, the preview, notes, "Publish now ›", and a 50 px primary "Publish to 3 places".

## Interactions and behaviour
- Clicking a Home list row selects the piece. Clicking the face opens the `channel:piece` surface growing from the card (the existing Surface open-from-element animation). Esc pops the surface. The stack has a back link.
- Switch piece pushes `channel:library`. Picking a result replaces the current layer.
- Queue opens `/channel/piece/...` (2b). "Add N to the queue" writes draft deliveries and appends steps to plan.md.
- Composer outlet toggles update "Publish to N places". Instagram is disabled when the quota is 0. With no outlets selected, the button reads "Choose where to publish".
- Quick sheet: Expand / Collapse switches width. The Facebook toggle switches the label "Schedule for Friday" ↔ "Schedule to 2 places".
- Focus: the view and mode controls switch the layouts. `beforeunload` warns when there are unsaved changes (as `WritingDesk` does).
- Suggestion chips are action-registry entry points. When the `actionChips` setting is off, they are hidden and gaps show "—".
- Live state: when a broadcast is live, a magenta band shows on Home and the Queue: "Live now · Print pull from the studio · on Instagram and the site · 38 watching · 24 min" with "Open control room".

## State management (first pass)
- Server: deliveries, routines (and their computed slots), plans with events, to-dos, connected outlets per identity, and Instagram quota per identity.
- Client: the selected piece, the surface stack (via `?surface=`), the composer's outlet toggles and per-outlet overrides, the quick sheet's wide state, the focus view and mode, the library's kind filter and scope, and the plan's accepted suggestions (optimistic, then saved).

## Design tokens (provisional: Broadsheet stand-in)
- **Ground and ink:** bg `#f3f2f2`, surface `#eae9e9`, text `#201e1d`, divider = text at 16%.
- **Accents:** accent `#0088b0` (100 `#e9f8ff`, 400 `#62c5ee`, 600 `#1186ac`, 700 `#006786`, 800 `#004961`); accent-2 / magenta `#d6006c` (100 `#fff1f4`, 700 `#aa0b56`, 800 `#790e3d`).
- **Neutral ramp:** 100 `#f8f4f4`, 200 `#eae7e7`, 300 `#d7d3d3`, 400 `#bab6b6`, 500 `#9b9797`, 700 `#605d5d`, 800 `#444141`, 900 `#2d2b2b`.
- **Type:** Source Serif 4 throughout (400, 600, italic). Sizes 10.5 / 11 / 12 / 13 / 14 / 15 / 18 / 20 / 22 / 28 / 32 / 36 / 44. Uppercase kickers at 11 px with letter-spacing 0.1em.
- **Spacing:** 5 / 10 / 15 / 20 / 30 / 40 px (1.25× density).
- **Radius:** 2 px (4 px for surfaces).
- **Shadows:** sm `0 1px 2px` at 14%, md `0 3px 10px` at 16%, lg `0 12px 32px` at 22% (all `#2d2b2b`).
- **State colours** (keep the roles; values will change): published = ink, scheduled = accent-700, live = magenta, draft = neutral-700, empty = neutral-300, suggestion = a dashed accent outline.
- **Coming:** three area colours (Channel / Studio / Queue), muted. Expose them as `--eac-area-channel`, `--eac-area-studio` and `--eac-area-queue`.

## Assets
- Icons: Phosphor, duotone weight (`@phosphor-icons/web`). Names used: squares-four, pencil-simple-line, calendar-blank, broadcast, article, film-strip, image, stack, users-three, globe, instagram-logo, facebook-logo, youtube-logo, envelope-simple, users, browsers, palette, identification-card, gear-six, check, clock, pencil-simple, lightning, repeat, storefront, user-circle, arrows-left-right, arrows-out-simple, arrows-in-simple, arrow-square-out, magnifying-glass, plugs-connected, info, x, caret-*. If the repo standardises on another icon set, use that.
- Kind glyphs: as in `packages/cms-ui/src/surface/kinds.ts` (◉ Writing, ◆ Event, ◎ Meeting, ◈ Workshop/Series, ▣ Product/Artwork).
- Images: all images are striped placeholders. Real artwork images come from the commerce and media library (`MediaPicker`).
- Sample data (Elkdonis Arts Collective, Guru Dharam, Salt Marsh, Field Notes, Winter Reading Circle and so on) is illustrative.

## Files
- `Channel.dc.html`: every screen. Round 3 (3a–3c) is at the top, round 2 (2a–2d) is next and round 1 (1a–1e) is last. The logic class at the bottom holds all the sample data and derived state, which is useful as a shape reference for the API.
- `ChannelNav.dc.html`: the left column, with props `active`, `owner` and `igLeft`.
- `support.js`, `_ds/…/styles.css`, `_ds/…/_ds_bundle.js`: what the HTML files need in order to open locally.
- `github.md`: the repo association and a map from each screen to the repo files it was built from.

## Repo files these designs were grounded in
- `apps/arts-collective/src/components/hub/console/*`: AttentionBands, ConsoleSurfaces, ConnectionsBand, OrgConsoleHost (custom surfaces, connectors)
- `packages/cms-ui/src/surface/*`: SurfaceFrame, SurfaceSection, kinds.ts, PostToSurface, writing-room.tsx, WriteSurface
- `packages/cms-ui/src/compose/catalogue.ts`: content kinds and when each is available
- `packages/cms-ui/src/writing/WritingDesk.tsx`: the Write / Side by side / Preview pattern
- `packages/meta/src/instagram.ts`: Instagram publishing rules
- `apps/art-auction/src/app/studio/*`: the current Studio overview
- `lms/SYNTHESIS.md`: Sophia and its rules (event log, actor type, agents drafts-only)
