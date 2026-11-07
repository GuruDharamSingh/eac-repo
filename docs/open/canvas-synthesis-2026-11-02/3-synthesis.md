# Synthesis: direct editing on Puck (2026-11-02, revised 2026-11-04)

Final synthesis of the survey and the two specialist specifications, for the senior advisor to translate. It states the model, the order of work and what the developer decides. Sources: `1-platform-survey.md` (Survey), `2-specialist-contract-and-overlay.md` (S1), `2-specialist-subject-and-live-controls.md` (S2), all in this folder. They hold the full shapes; this report cites their sections and does not repeat them. Their paths were corrected 2026-11-04; the 2026-11-02 text called them `1-cpo-survey.md`, `2-specialist-1.md` and `2-specialist-2.md`. They moved out of the scratchpad to this folder by 2026-11-04.

Status 2026-11-04: the developer has said go, and coding on stone 1 began under the Lead. Retracted: "Nothing is built; no file in the tree, container or row was changed in this pass" was true of 2026-11-02 only. This revision applies the platform review (`3b-platform-review.md`, abbreviated "review"; SC is its should-change list) and changes no code, container or row. Corrections are dated in place. §14 lists what happened to each of the review's 22 objections.

Labels: [V:read] code read, [V:sql] read-only SQL on `elkdonis_dev`, [V:run] executed in a probe (named), [V:web] upstream fetched, [A] assumed, [U] unknown. Names are final for this plan unless a stone's hand test changes them.

## 1. The synthesis in one paragraph

A page stays one Puck document in `site_config`, published by Puck's renderer; the editor on top of it is the direct-edit layer. Every node in the document answers three questions, and the right column shows the answers: what it is (a contract the block declares once in code: named parts, grouped options, what data it reads, what it can do, sample states), what it is about (a stored reference to a thread or occurrence, inherited down the tree the way `font-family` is), and what has changed on this page (ordinary props for settings, a `morph` prop for looks, dog-ears kept beside the document). The popup is the same editor opened on a copy of one node, drawn with sample or preview data. Edit mode, Studio and the developer space are one engine with three sets of providers: where data comes from, what actions do, where a save goes. A block gains this by listing the names and selectors of elements it already draws. No block is rewritten, and a node with nothing set publishes byte-identical markup [V:run, S1 §1 and §5, on a scratch copy of the adapter]. A page written in code enters the same document through live parts: whatever must follow data or the viewer stays drawn by the code under a name, and the rest is boxes (added 2026-11-04, stone 15).

| Term in this report | Plain word for the artist |
|---|---|
| node, block | a piece on the page |
| part | something inside a piece: its title, its button |
| contract | what a piece says about itself (kept in code, never seen) |
| subject | what a piece is about: "About: Running the Script" |
| `morph` | the look of this piece on this page |
| dog-ear | a saved version of a piece, kept for later; visitors never see it |
| sample state, fixture | "show it as if the meeting were full" |
| provider | where data comes from and where a press goes; differs per room |
| live part | a piece of a coded page that keeps drawing from its code |
| revision, draft | an earlier save of a whole page; a save visitors do not see yet |

## 2. The model

### 2.1 What is stored where

| Thing | Where | Form | Reaches visitors | New storage |
|---|---|---|---|---|
| Page | `site_config` `puck:<slug>` | Puck `{ root, content }`, as today | Through `<Render>` | None |
| Settings of a piece | The node's props | Ordinary props. Settings stay here, not in `morph` (corrects the earlier thesis, S1 §0.3) | Yes | None |
| Group | A `box` node, or any block with a slot | No group type exists. A group is a container holding a `subject` | Layout only | None |
| Thread binding | `props.subject` on any node or on `root.props` | A reference: `{ k: "thread", id, at }`, `{ k: "next", of }`. No org, no copied data (S2 §2.2). Corrected 2026-11-04 (SC11): first round `at` is `"next"`, `"series"` or `{ n }`; `{ at }`, `{ dep }` and the stored `{ k: "route" }` wait until asked. Rule 4 of §5.1 needs no stored form | Reference is never drawn | None |
| Look of a sealed piece | `props.morph` on the node | `{ v, parts, tokens }` in the existing `PartStyle` vocabulary (S1 §2.2). Corrected 2026-11-04 (SC11): `rows` is deferred with per-row looks. Own blocks (`box`, `words`, `picture`) keep `look` | Compiled to one scoped stylesheet | None |
| Page colours and fonts | `root.props.vars` | Name, type, value; drawn as `--dv-<name>`, shown in Code as `{{paper}}` (S1 §10.4) | Yes | None |
| Dog-ears | `site_config` `puck-ears:<slug>` | Per node, newest first: a whole-node copy minus `subject` and resolved keys (S1 §2.3). A person's page in `user_pages` has no such key: stone 18 | Never read on a public path | A new row key; no migration |
| Coded page as a tree (added 2026-11-04) | `site_config` `puck:<slug>`, slug refused as a public address | Boxes, words, pictures and `part` nodes. A part stores its name only; the code draws it per request | Through `<Render>` with the page's parts in metadata | None |
| Page revisions (added 2026-11-04) | `page_revisions`; `puck:<slug>` stays the published copy | Full snapshots per save (stone 16) | Never read on a public path | One migration |
| Resolved thread data | Nowhere | Loaded per request into `metadata.$subjects`, one load per distinct reference (S2 §4) | Only fields the block declares | None |
| Contract | Source: `BlockDef` and `PropDef` | `parts`, `tokens`, `needs`, `actions`, `fixtures`; `group`, `part`, `when`, `more` | Not stored | None |

Not stored anywhere: selectors, sample data, a record on the thread that a page refers to it (S2 §12.4). `morph`, `subject` and `live` join `RESERVED_PROP_NAMES` (`packages/blocks/src/registry.ts:79`). `overlay` was rejected because `store-frame` already declares it (`packages/blocks/src/blocks/store-frame.tsx:59`, [V:read]).

### 2.2 One example

Org `sunjay`, key `puck:next-session`, drawn at `/next-session` by `apps/sunjay/src/app/[feed]/page.tsx:58` [V:read]. The thread is the series `running-the-script`, published and public [V:sql]. The `live-*` block ids and this row do not exist yet.

```json
{
  "root": { "props": { "title": "Next session" } },
  "content": [
    {
      "type": "box",
      "props": {
        "id": "box-next", "tag": "section", "label": "Next session",
        "subject": { "k": "thread", "id": "bl0whFnG6dS_7J9NvvLyS", "at": "next" },
        "look": { "layout": "stack", "gap": 24 },
        "items": [
          { "type": "live-countdown", "props": { "id": "c1", "label": "Starts in", "source": "subject", "until": "", "endedText": "We are meeting now",
            "morph": { "v": 1, "parts": {
              "root":   { "fill": "#10223a", "padding": 24, "radius": 4 },
              "digits": { "font": "Playfair Display", "size": 64, "weight": 300, "color": "#f4f1ea" } } } } },
          { "type": "live-event", "props": { "id": "e1", "showCover": true, "showFacts": true } },
          { "type": "live-rsvp", "props": { "id": "r1", "label": "I'm coming", "showCount": true,
            "morph": { "v": 1, "parts": { "button": { "fill": "#b85c3a", "color": "#ffffff", "radius": 0 } }, "tokens": { "--blk-accent": "#b85c3a" } } } },
          { "type": "words", "props": { "id": "w1", "tag": "h2", "html": "Talk about <b>{{title}}</b>" } },
          { "type": "live-discussion", "props": { "id": "d1", "heading": "Conversation", "limit": 20,
            "morph": { "v": 1, "parts": { "root": { "margin": [64, 0, 0, 0] } } } } }
        ]
      }
    }
  ]
}
```

The dog-ear beside it, `puck-ears:next-session`:

```json
{ "v": 1, "nodes": { "c1": [
  { "id": "e-3kd92hsa", "name": "Navy, large digits", "kind": "named", "at": "2026-11-03T02:14:00Z", "by": "<session user id>",
    "node": { "type": "live-countdown", "props": { "id": "c1", "label": "Starts in", "source": "subject", "morph": { "v": 1, "parts": { "digits": { "size": 64 } } } } } }
] } }
```

Reading it:
- The group is `box-next`. Its `subject` is the only place the thread is named. All five pieces inside follow it, including the heading through `{{title}}`.
- Settings (`label`, `showCount`) are props. Looks are in `morph`. No row of data appears anywhere in the document.
- The dog-ear is not in the page, so saving one publishes nothing, and it survives the piece being deleted.
- The compiled stylesheet is in S1 §11. Each rule starts at a `<template data-morph>` marker placed right before the block's root, so a look cannot leak to another piece.

### 2.3 Where each idea comes from

| Source | What it gives | What is not taken |
|---|---|---|
| Puck | Document format, block catalogue, `<Render>`, `resolveAllData`, frozen block ids | Its editor gets no new work, but must keep opening every document. It keeps unknown props on save [V:run, S1 §7]. Which door an artist gets: §7, Edit door |
| GrapesJS | Traits → grouped options. Style Manager → the panel's sections over `PartStyle`. Component `view` → sample states. Symbols with overrides → dog-ears and later `morph.base`. Layer Manager's `root` → the popup's tree. Data Sources → subject and `{{tokens}}` | Its engine, its stored format, stored selectors |
| The claude.ai canvas (`harness/reference/`) | Click to go deeper, tree on top of the panel, Properties, Code, Tweaks, From groups with `+`, thin bar, pills | Free objects and the board are separate work |
| Existing surface UI | Main-plus-rail anatomy, faces and surfaces a block may open on the published page, the `RsvpResult` shape | Connectors as functions: they cannot cross from a server render into a client component (`packages/page-builder/src/config.tsx:428-434`), so write targets are data on the view (S2 §9.2). This corrects the earlier thesis |
| IFAC series | The worked example of "one event, several pieces": window event sync, week reference by number, no writes on read | ~~The pages stay code.~~ Corrected 2026-11-04 (review blocking 3): the code stays the source of their data, and the pages gain a stored layout of live parts (stone 15b) |

## 3. The options model for blocks (R6)

### 3.1 The problem, measured

- Shared blocks: 30 blocks, 173 props, 86 of them aesthetic, mostly layout selects. Inner elements are out of reach. `hero-banner` offers align and height only; its title, subtitle and wash are fixed (`packages/blocks/src/blocks/hero-banner.tsx:72-103`, [V:read]).
- Elktours: 11 blocks, 22 props, 2 aesthetic. `TourMain` is one 95-line function holding description, highlights, route and booking.
- Sunjay: 26 blocks, 94 props, 20 aesthetic; `pt-banner` holds 7 of them.
- `blocks.css`: 1145 declarations, 768 literal. `blkStyle` wraps one `div`, cannot reach inside and has 0 stored uses [V:sql].
- Installed base: 31 Puck rows, 172 nodes on 3 orgs, so the stored-data risk of changing how options are declared is small [V:sql].

### 3.2 The ladder

Each rung is per piece, per page, and derived from the document (S1 §10.1).

| Rung | What the artist does | Stored as | Cost to the block |
|---|---|---|---|
| Moves | Drag, duplicate, delete, put in a box | Position in the tree | None (exists) |
| Options | Fields in the right column | Props | None: groups default from the prop's kind |
| Parts | Click in, restyle, hide | `morph` | One line per part |
| Live atoms | "Open up": the piece becomes a box of smaller live pieces | A `box` of nodes | Real refactor per block. Last, only if parts prove insufficient |
| Frozen | Detach: HTML into boxes, data stops | Own blocks | None (exists); gains baked looks and bindings |

### 3.3 What every block gets with no edit

A root look (fill, padding, margin, radius, opacity), style tokens (`--blk-accent` and seven others), and its existing options in sections. The default section comes from the kind: text-like and media kinds go to Content, `select`, `number` and `boolean` to Layout. S1's `groupOf` (§9.1) needs one addition: a `string` with `format: "color"` goes to Look, or `captionColor` lands under Content.

### 3.4 What a block author adds

Parts, one line each, existing classes where they exist (`hero-banner`, no markup change):

```ts
parts: {
  root:  { label: "Banner",  sel: "> .blk-hero" },
  wash:  { label: "Wash",    sel: ".blk-hero-wash" },
  title: { label: "Title",   sel: ".blk-hero-title", prop: "title" },
}
```

Then, optionally, a word per option: `group: "look"`, `part: "caption"`, `when: { prop: "captionPlace", is: ["on"] }`, `more: true`. Then, for data blocks, `needs`, `actions`, `fixtures` (§5).

Measured adoption (S1 §14): `hero-banner` 6 parts, 12 lines. `picture-wall` 5 parts, 20 lines. `pt-banner` 8 `data-part` attributes (or none: the selector form matched today's markup [V:run]). `TourMain` 8 parts, 10 lines, in a separate contract file with no edit to the held tour files. A Tailwind block uses `data-part`, since utility selectors break when a utility is edited.

### 3.5 Why it works without rewriting

- Delivery is a `<template data-morph="<hash>">` marker before the block's root, plus one scoped stylesheet with `!important` on every declaration. Ran in Chromium against real `blocks.css` and sunjay's served CSS: the morph wins over inline styles, Tailwind utilities and specificity chains on layered and unlayered hosts alike. Without `!important` the result differs per host (S1 §5.3).
- Corrected 2026-11-04 (review note 2): the marker is inert, but S1 §5.5 places a font `<link>` after the block, so a morphed block with a font stops being `:last-child` (`blocks.css:423,848,1038`). Stone 2 writes the link before the marker.
- A `display: contents` wrapper was tested and rejected: restyling a heading moved the block under it in `space-y` and `.blk-flow-body` parents (S1 §5.2).
- Nothing unset changes output. A host with no morph option strips the prop. Client components never receive it (S1 §5.5).
- Safety is at render: `cleanMorph` and `sheetSafe` refuse selectors, `url(`, overlays, click traps and unbalanced values. 35 hostile inputs refused [V:run, S1 §6.3]. CSS cannot reveal what the server did not send, so hiding a part is a look, not access control.
- Limit, added 2026-11-04 (review note 4): structured `pos: relative` with `x`, `y`, and `sx`, `sy`, `tx`, `ty` still emit a transform on a part (`style.ts:52-58,116-143`), so an invisible link can move or grow. Only org editors write morphs before stone 18, which drops these keys wherever members save.
- The 768 literal declarations stay. A part reaches any of them by selector; a token is added only where several parts should move together, on evidence.
- An option and a look can set one thing. The look wins; the panel shows both.

### 3.6 Which blocks first

`hero-banner`, `section-heading` (35 stored), `prose` (15), `picture-wall`, `feature-card`, then `pt-banner` as the Tailwind case. The `live-*` controls are born with parts. Then series pieces, then the `pt-event-*` data side. `TourMain` comes last because a session holds elktours (`docs/open/ELKTOURS_CONVERGENCE_2026-11-02.md:6-7`, re-read today). `dm-plate` (26 stored) moves up only if decision D3 picks danamccool.

## 4. The popup and the right column (R2)

### 4.1 What is drawn

A second mount of the same `mountTreePage`, on a working copy: `{ root: <page root>, content: [<copy of the node>] }`. It is the same code, with the same click-through, panel and thin bar. A group opens the same way, with everything inside it.

- Opened by double click on a sealed piece, a row in the right-click menu, or a button in the thin bar. A double click on a part that shows a prop still types in place.
- The stage draws the piece at the width it has on the page, zoomed to fit (the zoom control exists, `tree-editor.ts:157-166`). ~~With a phone-width switch.~~
- Corrected 2026-11-04 (SC5): a same-document stage narrows width only (`view.ts:44-48`), so `@media` rules and Tailwind breakpoints do not respond: 7 width rules in `blocks.css`, 4 in the `pt-banner` file, 13 breakpoint utilities in `tour/blocks.tsx`. The switch would have shown a false phone view on the monoliths R6 names. "Phone" is therefore a read-only `<iframe srcdoc sandbox="allow-same-origin">` at 390px, holding a copy of the page's stylesheets and of the stage's current HTML, redrawn after each change. Scripts do not run in it and there is no React context: it tests CSS, not behaviour. Editing stays on the stage. A real phone is still checked at stone 8a. Hosts with a `style-src` policy: [U], none found outside `apps/forum` [V:read].
- Esc goes up a level, then closes. Close with changes asks first.
- "Use on this page" replaces the node in the page's document as one undo step. Nothing is public until the page's Save.
- Undo inside the popup is its own history, so discarding is free.

No reference image exists for the popup itself. The stone starts with a static mock-up on the test page for the developer's eye, and only the frame is new: pills as in `reference/c_right.png` and `c_tools.png`, right column as in `rowlayer4.png` and `text chosen, box around it shownabletoexpand.png` (all read 2026-11-02).

Work this needs, corrected against the code [V:read]:
- Chrome is appended to `document.body` at more places than the survey listed: `tree-editor.ts:183`, `:554`, `:743`, `edit-shell.ts:75`, `clickthrough.ts:83`, `menu.ts:39`, `box-drag.ts:147`. A `chromeHost` option covers them.
- `de-editing` and `de-vpanel-open` on `<html>` are added and removed per mount (`clickthrough.ts:84,289`, `tree-editor.ts:184,791`), so closing a popup would strip them from the page's editor. They need counting.
- The page's editor must pause: `busy = true` already stops its keyboard handlers (`tree-editor.ts:763,770`), `ct.hold(true)` stops its clicks, and panel and bar are hidden. A `pause()` on the handle.
- Selection boxes redraw on capture-phase scroll (`clickthrough.ts` `L.on(window, "scroll", later, true)`), so a scrolling stage already works.
- Depth limits count from the copy's root, so the mount needs a base depth. The copy's root node cannot be deleted or dragged out.

### 4.2 What the right column lists

Same panel, same order as the references, with new sections marked. Tabs Properties, Code, Tweaks, and in the popup only, Saved.

Corrected 2026-11-04 (SC11): the 2026-11-02 list gave every piece nine Data rows at once. The first round shows the four an artist needs, and the rest open from the section's `+`. No reference image holds a Data section, so stone 5a starts with a mock-up for the developer's eye.

```
[tree, rooted at this piece; parts as rows, "Caption ×12" for a repeated part]
Data (new)                                         +
  About     # Running the Script                   Change
  Which     Next session · Session 4, Thu 13 Nov   ▾
  Seen by   Everyone. Join link: followers and up (set, hidden here).
  Now       3 coming · 2 comments
  behind +  From, Reads, On page; Can do (stone 5b); Try it: Seen as, State, what would happen (stone 5b)
Content (new)     the block's text and pictures
Align, Size, Layout, Link, Text, Appearance   as for a box, on the selected part; option rows first
Behaviour (new)   what it shows when
Foot              "Block · parts changed on this page · 3 of 6", Detach
```

A block with no subject shows, in place of About and Which, "Comes from: this org's feed" from `needs.other`, plus whether the rows are sample rows. The Code tab keeps the sheet of `rowlayer4.png`, with `subject "Running the Script" · next` as a From row whose `+` copies the reference onto this piece. Fields are drawn in plain DOM from `PropDef`, not through Puck's `AutoField`, so nothing here depends on Puck's panel or its version. Hosts' existing React pickers mount in a slot control (`ServicePickerField` ran outside `<Puck>` without error [V:run, S1 §9.3]).

### 4.3 What is live and what is mock

| Thing | In the popup and canvas | On the published page |
|---|---|---|
| Component, markup, CSS | The real ones | Same |
| Data | Sample on the test page and in the lab. On a real host, preview-tier views with a Sample switch | Per viewer |
| Secrets (join links, Talk URLs, attendee names) | Omitted for every role, owners included. The panel says "set, hidden here" | As gated today |
| Clicks | Captured. In Try it, they pass only into pieces that declare `actions` | Normal |
| Presses that write | Simulated and logged ("Would write a yes on Session 4"). Views carry no write address | Real |
| Any non-GET request | Refused by a fence for the whole life of the mount; shown in the panel | No fence |
| Timers | Tick | Tick |
| Polling | Off | On |
| Links | Captured; logged in Try it | Normal |
| A control with no ported actions | Drawn live, held inert. "Runs on the published page; try it there." On the test page, a labelled stand-in | Normal |

`useRouter()` throws under `createRoot` (`mount.ts:46`). On real hosts the canvas draws through a portal, which kept router context and control state under real React 19 and Next code in jsdom [V:run, S2 §10.1]. Not run in a real App Router [U]. No router stub, because a stub would hide writes.

### 4.4 The surface UI rule

Default: the popup is editor chrome in a non-modal fixed layer, in surface proportions (up to the `full` width of 1180px, main plus a right column), not a `<dialog>`. The right column is 330px, the panel's width, not the surface rail's 272px, because the reference is the panel. Reasons:
- IFAC public pages have no `SurfaceProvider` [V:edge, Survey §1].
- Esc means pop a layer there and up a level here.
- A modal makes chrome outside it inert [A; not run].

Surfaces opened by a live control stack above it, because `showModal` uses the top layer. If an editor is ever opened from inside a surface, `chromeHost` puts its chrome in that dialog. The rule's text says "do not add a dialog/sheet/modal primitive" (`.claude/rules/areas/css-ui.md`). In force 2026-11-04: D1 is A. The popup is editor chrome, the developer said rewriting surfaces looks unnecessary, and no surface code changes.

## 5. Groups cohering (R3)

### 5.1 The rule

For a piece that declares `needs.subject`, nearest wins (S2 §3.1):

1. Its own `subject`.
2. The nearest container above it holding one, through any slot, including sealed containers such as `pt-band` and `split-row`.
3. `root.props.subject`: a large grouped page about one thread, with the discussion lower down.
4. The route: a thread page's own thread. In an editor, a "Drawn for" thread, not stored.
5. The next upcoming, if the block declares it, shown as "Next upcoming (automatic)" with a way to pin it.
6. Nothing: the piece draws its empty state and the panel asks.

Automatic coherence is the absence of a choice: drop a countdown, an RSVP and a discussion into a box and they share one subject.

### 5.2 Grouping and moving

| Action | What happens | What the artist sees |
|---|---|---|
| Group pieces with no subject | They inherit from above | Nothing to decide |
| Group, one subject among them | Lifted to the box | "This group is about X." |
| Group, they disagree | Each keeps its own | "2 subjects in this group", Make all about X |
| Drop a piece into a scoped box | Inherits | About row shows the box |
| Move a piece with its own subject in | Keeps it | "Own: Y. The box is about X." Use the box's |
| Move a piece out | Follows its new place | "Now about Z (was X)." Keep X |
| Duplicate a group | Same thread; counts stay in step | Re-point with Change |
| Unwrap a box | Subject pushed to pieces inside | Meaning kept |
| Restore a dog-ear | Subject not touched | About row unchanged |

### 5.3 How an author overrides

"Change" in the Data section, on any piece or box, opens a picker over this org's threads: upcoming first, standing and presented series named. Choosing a series opens a second row: Next, The series itself, or a week. A private choice warns before it is set. The reference is stored by week number, so a moved week stays the same week (`SeriesWeekPage.tsx:28-29`).

Corrected 2026-11-04:
- A recurring meeting's date and a tour's departure leave the first round (SC11; the text said "or a date").
- Candidates pass `canViewThread` with the editor's real role (SC7). S2 §12.3 filtered by org, kind and status only, so titles of "Only me" and owners-only threads would reach guides through `/api/live/candidates`.
- Kinds are one allow-list shared by the picker and the loader (SC7): `event, meeting, series, workshop, reading_group, tour`. The loader returns `hidden` for any other kind, so a hand-edited document cannot name a `document`, `wiki_page` or `writing` thread. Whether `post` joins the list is D7.

### 5.4 What each failure looks like

A visitor's page is the same for every hidden case, so a page never reveals that a private thread exists. The artist sees the words below in the right column.

| Case | Visitor | Artist in the editor |
|---|---|---|
| Thread deleted | Piece's empty state; words with tokens not drawn | "This thread no longer exists." Change |
| Thread archived | Same | "Archived." Change |
| Draft thread | Same | "Draft. Visitors see nothing here until it is published." Seen as: Editor draws it |
| Draft series | Same | "Draft series. It cannot be previewed until published." |
| Another org's thread | Same, for everyone | "Not on this site." Change |
| Private thread on a public page | Nothing, or the piece if allowed | "Followers and above", with the count of pieces that draw nothing for visitors |
| Nothing coming | "The next session will be announced here." | Same, plus a note if a draft week exists |
| Cancelled | Cancelled state; RSVP closed | Same |
| Pinned and past | Countdown's ended text; RSVP hidden | Same |
| This site has no route for the action | Link to the thread's page, or nothing | "This site cannot take answers for this kind of event." |
| Loader error | Group empty, logged, page renders | "Could not read this thread. Refresh." |
| A piece throws in the canvas | n/a | That piece shows a stand-in with its name; the rest draw |

### 5.5 Rules that protect production

- One loader for every read, with the org from the deployment and `canViewThread` (S2 §6). No `ensure*` on a read: a week with no row reads as count 0 and an empty list, and writes make the row.
- `pickView` passes a client only the fields the block declares, so the right column's Reads list is accurate and the HTML holds nothing else (S2 §7).
- `apps/sunjay/src/lib/puck/data-event.ts:41` checks only `status` [V:read today]. It is safe now, because `threadId` arrives only from a route that already ran `mayRead`. It must take `canViewThread` in the same stone that lets a stored reference reach it, or an ORGANIZATION thread would be exposed.

Added 2026-11-04 from the review:
- Seen as caps what is drawn, not only the role. `canViewThread` returns true on its first two lines for a platform admin or the thread's author (`thread-audience.ts:91-93`), so with `viewAs` set the loader passes `{ userId: null, role: capped, isGlobalAdmin: false }`. Otherwise "Seen as: Visitor" would draw a private thread for the people most likely to test it (SC1).
- Detach copies what the canvas drew (`tree-editor.ts:481-493`, `adopt.ts:88-92`). It is refused on a node drawing sample or fixture rows, because sample text would become public content. On a real host it redraws at Visitor tier with Sample off before adopting, and it is refused when the effective audience is not everyone (SC2).
- Reply bodies pass `sanitizeRichText` in the loader. `listReplies` returns the stored column as is (`forum.ts:735`), replies also arrive by Nextcloud sync, and `live-discussion` sits on public pages. S2 §2.3 marks only `bodyHtml` as sanitised; this line overrides it for `items[].html` (SC6).
- A picture in a `Private/` path shows to the editor and not to visitors, and Seen as cannot reveal that because the browser holds the editor's cookies. The guard is `isPrivatePicture` in `shell.openPicture` (`edit-shell.ts:16-20,116`), and `cleanBoxDoc`'s `safeSrc` does not check it (`bind.ts:66-71`), so image rows, rows' picture columns and `fieldControls` image kinds all go through the shell (note 3).
- A coded page is adopted only from its signed-out HTML, and a page with many instances or gated content is never adopted: stone 15.

### 5.6 What it writes to, by kind of event

From S2 §5. One-off and recurring: `/api/threads/:id/rsvp`, guests `/api/rsvp` on four hosts. Series week: `/api/series/rsvp` and `/api/series/comment`, sign-in only. Series level: no RSVP, Talk links to the forum. Tour: a booking link, not an RSVP. The right column says which applies. The first controls are `live-countdown`, `live-event`, `live-rsvp`, `live-discussion`, then `live-calendar` and `live-talk`, all in `SHARED_BLOCKS` on tokens. ~~The six existing RSVP implementations stay until their hosts are next touched.~~

Corrected 2026-11-04 (SC8), because that sentence made seven implementations with no end: when a host ships `live-rsvp`, its RSVP block (`pt-event-rsvp` on sunjay) leaves Add, and stored nodes keep drawing because block ids are frozen. RSVP on coded pages (`rsvp-panel.tsx`, `SeriesRsvp`) is not offered in Add and stays until its page is next touched. The cascade is proved first with the existing `pt-event-*` blocks and `live-countdown`, with no new write route (stone 8b). `LiveRoutes` `style: "status-body"` is dropped until IFAC has Puck pages.

## 6. Dog-ear (R5)

### 6.1 Where it lives

In the sidecar row `puck-ears:<slug>`, written through `withOrg`, independent of the page's save. `listPages` uses `LIKE 'puck:%'`, which does not match it (`packages/page-builder/src/store.ts:117`, per S1 §2.3). Caps: 12 per piece, 64 KB each, 256 KB per row; the oldest automatic one goes first.

### 6.2 The states of a change

| State | Who sees it | Written |
|---|---|---|
| Working copy in the popup | The artist | Nowhere |
| Used on the page, not saved | The artist | Nowhere |
| Dog-ear | Editors of the org | Sidecar |
| Page saved | Everyone | `puck:<slug>` |

Corrected 2026-11-04 (SC10, SC11). The developer asked for "just dog earing it"; the 2026-11-02 text needed the popup, the Saved tab and a name.

- Dog-ear is one press: a row in the right-click menu and a button in the thin bar, on the page and in the popup, for any piece or box. It writes one row at once, opens no dialog, and takes the next automatic name ("Version 3", S1 §2.3). A line says "Dog-eared as Version 3" with Rename beside it. Visitors see nothing, and the page is not marked as changed.
- The popup's Saved tab lists them: Use, Compare (the field-by-field list), Restore (Use on an older one; an automatic dog-ear keeps what it replaced), Rename, Delete.
- A dog-ear of a group includes its arrangement. Detach and Open up take an automatic dog-ear first, which is how they are undone after a save.
- Deferred until the developer asks: Compare's second read-only canvas, and the 30-day "Removed blocks" list. A deleted piece's dog-ears stay in the sidecar under the caps above.

**Limit: a change can be held back per piece.** A whole page cannot be drafted, previewed by someone else or scheduled, because a Save is public at once and `page_revisions` does not exist [V:sql, 2026-11-02]. That is D2, scheduled as stone 16.

### 6.3 Promoting it deeper

`Ear.node` is already what an `org_blocks` row would hold (`docs/open/PATTERNS_VERSIONS_REVIEW_PROTOTYPES_2026-11-01.md:79-91`). Saving deeper later means copying it into a wider store, and a node gains `morph.base`, which compiles under the node's own looks. Page → org → network is then one mechanism at three scopes. Nothing is reserved now: `cleanMorph` passes only known keys, so adding one costs a line and no data migration. No catalogue is built, per standing direction.

### 6.4 When the underlying block changes

| Change | Published page | Dog-ear in the editor |
|---|---|---|
| A part is removed from the block | Compile ignores that name; the rest applies | "2 looks for parts this block no longer has", Remove |
| A prop changes | `coerceProps` on Use: undeclared dropped, ranges clamped | Named in the differences before Use |
| A class is renamed under a part | The look stops applying, silently | Parts smoke fails at authoring time (S1 §3.3). It starts at the stone 15a install; harness runs cover parts until then (review note 1). Elktours has no smoke until `checkParts` is run by an app script |
| The block is removed from the catalogue | `<Render>` drops it, as today | "This block no longer exists", disabled |
| New data needs on a block | Picked up at render: subject and resolved data are not in the ear | Nothing to do |

Part names are stored like block ids and are not renamed casually.

## 7. Three contexts on one engine (R7)

| | 1. Edit mode | 2. Studio | 3. Developer space |
|---|---|---|---|
| Reached by | Edit button on the live page | `/studio/<slug>/canvas` per host; a Pages kind in arts-collective's `/studio` | `apps/lab`, LAN only, dev mode, port 3022 |
| For | Owners and guides, on the page in front of them | The same people, working through a site | Developers |
| Frame | The page, with pills and right column over it | Page list, canvas, right column in `StudioColumns` (`packages/studio/src/frame.tsx:59`) | Index of entries, variant switcher, side-by-side |
| Data provider | Preview-tier views, `/api/live/views`, Sample switch | Same, plus "Drawn for" on template pages | Fixtures from the contract. `elkdonis_scratch` only if an entry asks |
| Action provider | Simulated | Simulated | Simulated, log shown |
| Save target | `puck:<slug>` through `cleanBoxDoc`; `puck-ears:<slug>`. From stone 16, a revision, and `puck:<slug>` on Publish | Same | None: shows the JSON and the clean result |
| Canvas root | Portal under the host's router | Portal | `createRoot` plus per-node boundary, as on the test page |
| Only here | Works on the page being looked at. ~~Declared sections on code-built pages.~~ Corrected 2026-11-04: code-built pages as a tree with live parts (stone 15) | Page list and settings, template pages, a page-wide dog-ear list | Ingest, contract checks, others' experiments, breaking a block on purpose |
| Until it exists | The private test page and harness stand in for all three | | |

The engine's options are the only difference: `contract`, `data`, `runtime`, `mode`, `canvasRoot`, `chromeHost`, `fieldControls`, plus `onSave`. A page opened in Studio and on the live page is the same document, the same panel and the same fence.

Edit door, added 2026-11-04 (SC14). Today sunjay's "Edit this page" goes to `/studio/<slug>`, Puck's editor (`apps/sunjay/src/lib/puck/render.tsx:67`), with the canvas on a separate route.
- On a wired host, Edit opens the canvas.
- Puck's editor is reached only through "Edit its settings" on a block whose fields the panel cannot draw (`blockEditorHref`, `tree-editor.ts:314`).
- A host drops that link when none remain: its catalogue has no field the panel cannot draw, every stored document has opened and saved in the canvas with no prop lost, and the developer agrees.
- `/studio/<slug>` stays for developers until stone 13 passes, because the document format is still Puck's and this is the way back if the canvas fails on a document. Whether to remove it then is the developer's call.

Two facts shape Studio [V:read]:
- `@elkdonis/studio` is mounted on arts-collective only, and arts-collective's catalogue holds `SHARED_BLOCKS` plus two blocks. So the Pages kind there can edit orgs hosted on arts-collective. A site with its own blocks (`pt-*`, `dm-*`) uses its own `/studio/<slug>/canvas`, which exists on innergathering (`apps/innergathering/src/app/studio/[slug]/canvas/page.tsx`).
- `STUDIO_KINDS` has no pages kind (`packages/studio/src/kinds.ts:8`); a `StudioExtension` adds it the way Video and Posts were added.

Developer space, as in `docs/open/DEV_SPACE_PROPOSAL_2026-11-02.md` option A: `fromBlock(def)` makes an entry from a contract with no hand-written file, using `fixtures` as variants. That is why it follows the contract. Review means a per-entry checklist: licence, parts check, tokens only, sanitiser pass, phone width, reduced motion. The outcome is a `review` object in the entry's own source file (`by`, `at`, checklist), so it travels with the code and needs no table (added 2026-11-04; the review listed this as unspecified). Experiments are entries tagged as such. No production credentials are in the service. Default reach is LAN plus a shared token, no proxy host, per that proposal; cookies on a bare LAN address are untested [A].

## 8. Ingest (R4)

The working-style rule treats a named product as exploratory, so this is confirmed with the developer when its stone starts. Recommendation below.

### 8.1 CodePen

| Way | What it is | Finding | Position |
|---|---|---|---|
| Integrate: embed a pen on a site | CodePen iframe on a public page | Third-party frame and script on artists' pages, no tokens, no parts, no data | No |
| Integrate: read at run time | Page fetches a pen's `.css` or `.js` | CodePen's page says those URLs "should not be used in production" [V:web, Survey §9] | No |
| Build, thin: author-time intake in the lab | Paste a URL; fetch `.html`, `.css`, `.js` once into a sandboxed frame for review; record licence and credit; port to a workspace block | Follows the existing pens (`packages/silex-nextcloud-connector/src/pens`, `manifest.json` `credit`, `traits`) | Yes |

Output of intake: a block file with a prefixed stylesheet and a contract, in a workspace package or an app. It reaches a site through an ordinary rebuild.

### 8.2 Custom React

| Way | Finding | Position |
|---|---|---|
| A source file in `apps/lab/src/entries`, compiled by `next dev` | Hot reload today; the same route to production as every block. No new dependency | Yes |
| `react-live`, Sandpack or `esbuild-wasm` in the lab | None installed (grep, Survey §9). New dependency, new review. Would help editing in a browser | Deferred; ask again if the developer finds file editing too slow |
| Any compiler for artists, or stored JSX | A way to run authored code on a public origin shared with sign-in | No |

### 8.3 The security line

1. No author-supplied script, selector or unfiltered CSS is stored in a document or served on a public page. Documents hold data; `cleanMorph` and `sanitizeRich` enforce it at render.
2. Only source in the repo, read by a person, reaches a site, and only through a rebuild.
3. An unreviewed pen runs only in `<iframe sandbox="allow-scripts">` with no same-origin, in the lab, which holds no production credentials and points at `elkdonis_scratch`. It is a viewing window, not a delivery route.
4. Licence gate as `docs/reference/authoring.md:199-212`: MIT, Apache-2.0, CC0, CC-BY. Public pens are MIT by default; private pens carry no licence and are refused. The credit travels with the block.
5. Artists do not see ingest. They see the resulting block in Add.

### 8.4 Deferred

A sandboxed iframe block on sites. Automatic pen-to-block conversion. Pens with script beyond a reviewed port to a `*.client.tsx`. Artists submitting a free object for developer review (the board's idea). A platform catalogue, out of scope by direction.

## 9. Puck: upgrade or not

Yes, as its own stone, not as a prerequisite. "Could use an update re how it handles its components options" has two answers:
- The options model is ours and is §3. It does not depend on the Puck version, because the custom panel does not use Puck's field panel.
- The package moves from 0.23.0 to 0.24.0 (latest per the npm registry, MIT, [V:web today]; declared non-breaking by its guide [V:web, Survey §7]).

What 0.24 gives:
- `renderFields` and `FieldGroup`, so hosts still on Puck's panel (danamccool, art-auction, ArtDirect's designer) could get the same groups from one `renderFieldsFor(def)`. Corrected 2026-11-04 (review note 5): this is new work in Puck's own editor, which the standing direction says not to polish. It is a separate item the developer opts into, not part of stone 13.
- Slot prop forwarding, which removes the `tagWith` workaround.
- A listed fix for repeated `resolveAllData` runs. 0.23 resolves a node `depth + 1` times, 13 `loadEvent` runs per view on sunjay's template [V:run, S2 §4.4]. The cascade's pre-pass and a `cache()` cover this regardless.

Not used: `fieldTransforms`, `AutoField`.

When: after the first real host works, so that a fault there is not ambiguous between our work and the upgrade. Sooner only if every host is due a coordinated rebuild anyway. Added 2026-11-04: stone 17's danamccool step comes first, and art-auction's rebuild waits until the November silent auction closes unless the developer accepts it during the auction.

Cost:
- Exact pins in 9 `package.json` files [V:read].
- One `docker compose run --rm install`, coordinated with other sessions.
- A rebuild of each host importing it: art-auction, artdirect, arts-collective, danamccool, elktours, ifac, innergathering, sunjay. The developer runs them; each deploys all uncommitted work.
- Added 2026-11-04 (SC13): that rebuild also means an HTML change cannot be attributed to Puck. danamccool's build was dated 2026-10-04 when the review read it, so its rebuild ships a month of tree to the largest stored user, a live client site. It is its own step, with its 27 rows compared by screenshot.

Risk: `packages/page-builder/src/drag/item-focus.tsx:131-142` writes an undocumented key. Its form is unchanged in 0.24.0's dist [V:read, S1 §9.2], not run. Stored data unchanged [A from the guide]. Test first in the harness bundle against a scratch copy of 0.24.0, then open one stored document per host in Puck's editor. `ELKTOURS_CONVERGENCE` says elktours stays on 0.23.0 until the repo moves, so it moves with the others.

## 10. Coverage

| Req | What it asks | Stones |
|---|---|---|
| R1 | One way of editing, Puck-centred, on the existing code | 1 to 8c (engine); 15 (coded pages); 16 (before artists); 17, 18 (more hosts, artists' own pages); §7 Edit door; 13 keeps Puck current |
| R2 | Popup canvas, mock or preview, right column confirming data and relations | 1 (right column, samples), 3, 4 (popup, phone frame), 5a (Data section) |
| R3 | Groups attach to one thread, automatically or chosen | 5a, 5b on fixtures; 8b, 8c on real data |
| R4 | CodePen and custom React, developer arena | 11 (lab), 12 (ingest) |
| R5 | Dog-ear per page, promoted later | 6; 4's working copy is its first half; 16 holds back a whole page. Promotion designed, not built |
| R6 | Monoliths: parts, options, and Puck's package | 1, 2, 3 (options, parts); 15b (coded series pages); 9 and 14 (series, elktours); 13 (package) |
| R7 | Three contexts, one engine | 8a and 15 (edit mode), 10 (Studio), 11 (lab); test page until then |
| R8 | Build on surface UI and IFAC series | 4 (proportions, stacking), 5a, 5b (series behaviour), 15b (series pages editable), 9 (series pieces) |

Corrected 2026-11-04: the 2026-11-02 table counted R1 and R8 as covered, while the plan ended with the developer editing one new page on sunjay (review blocking 2 and 3).

## 11. Stones in order

Rules for every stone: hand-tested by the developer; a screenshot is looked at and compared with `harness/reference/`; each ends with a short report and one choice. Stones 1 to 7 run on the private test page with fixtures, and need no migration, no production rebuild and no Puck upgrade.

Order changed from the direction notes: parts come before the popup. S1 ran parts in the real panel with 70 added lines (`s1-probes/out/part-selected.png`), and a popup holding only fields would be hard to judge. The popup's right column also gains from having parts and rows to show.

Added 2026-11-04:
- Stones 1 to 7, with 5a and 5b, stay on the test page and now also need no install. The install stone 5 asked for moves to stone 15a. `direct-edit` gains no dependency before it: it receives `contract` and the subject functions through options, and the harness imports them by absolute path, as stone 1 does. The reason: a rebuild of elktours, innergathering or arts-collective by another session ships whatever is in the tree, and an unresolved import would fail that build.
- For the same reason every save stays valid, a host that passes no contract behaves exactly as before, and check-types shows no new errors in `direct-edit`, `blocks`, `apps/arts-collective`, `apps/innergathering` and `apps/elktours`. Elktours is the third importer since 2026-11-03 (`apps/elktours/src/components/landing/page-editor-mount.ts`).
- No stone rebuilds or commits while the test-page stones run (D4, D5).

Corrected 2026-11-04 16:25 EST. The developer, on stones 1 and 2: "this so far shows nothing new... i want a way to edit a react component layout look as a popup in a site, the sealed blocks". The popup moves ahead of stone 3, with no static mock-up first, and gains Arrange: rearranging a sealed block's own parts, stored in `morph`. Phone, "Show with" and Saved wait. Order from here: popup and Arrange, Para Theater live, parts on the blocks artists use, page colours and fonts. The developer chose 2026-11-04 to keep the function stones planned (groups following a thread, presses, developer space, ingest): they follow those four, and each stone runs with one coder and one review. The table below is the earlier order. Corrected 2026-11-04 16:32 EST: the developer wrote "if we re getting ahead of our selves chill on the poup. but just dont oversell the stones". The popup coder was stopped after reading only; it changed no file. Order: Para Theater live, stone 3, then the popup as stone 4 with Arrange added; then parts on more blocks and page colours and fonts; the function stones stay planned after them. Each report says first what is visibly new.
Corrected 2026-11-04 16:58 EST: the developer then wrote "so yea jump ahead", so the popup and Arrange were built ahead of stone 3 by one coder in 21 minutes (`canvas/popup.ts`, `canvas/arrange.ts`), reusing `mountTreePage`, the Layout rows, `lookDecls` and `startBoxMove`. Phone, "Show with", Saved and Data are still left out. Next stone is 3.

Order of work. Stone numbers are names, kept so that the review and the build plan stay citable; this table is the order.

| Order | Stone | Runs on | State 2026-11-04 |
|---|---|---|---|
| 1 | 1: a block's own settings, with sample data | Test page | Coding under the Lead |
| 2 | 2: click into a block | Test page | Not started |
| 3 | 3: rows, pictures, option groups | Test page | Not started |
| 4 | 4: the popup | Test page | Not started |
| 5 | 5a: a group follows one thread | Test page | Not started |
| 6 | 5b: presses and Seen as | Test page | Not started |
| 7 | 6: dog-ears | Test page | Not started |
| 8 | 7: page colours and fonts | Test page | Not started |
| | Gate: what is left of the first signed-in run; R-a | A rebuild the developer runs | Part settled |
| 9 | 15a: coded pages with one instance | sunjay `/`, `/about`, `/community`, `/publications` | Not started |
| 10 | 8a: first real site, no data | sunjay Puck pages | Not started |
| 11 | 16: before the first artist | sunjay; the first artist's own hand test | Not started; one migration |
| 12 | 15b: series pages as a layout of live parts | sunjay, then IFAC | Not started |
| 13 | 8b: real threads, read only | sunjay | Not started |
| 14 | 8c: real presses | sunjay | Not started |
| 15 | 9: series pieces as blocks | sunjay, IFAC | Not started |
| 16 | 10: Studio page kind | sunjay, innergathering, arts-collective | Not started |
| 17 | 17: roll-out to more hosts | Hosts in its table | Not started |
| 18 | 18: artists' own pages | ArtDirect | Not started |
| 19 | 11: developer space | `apps/lab` | Not started |
| 20 | 12: ingest | `apps/lab` | Not started |
| 21 | 13: Puck 0.24 | All Puck hosts | Not started |
| 22 | 14: elktours tour blocks, and live atoms if asked | elktours | Not started |

### Repairs, independent of the stones

- R-a. `safeDecls` (`packages/direct-edit/src/block/style.ts:97-99`) passes `color: red /*` and `color: rgb(1,2`, and slices long values. `patchCss` (`patch.ts:102`) then loses the next box's rule [V:run, S1 finding d; lines V:read]. `patchCss` draws elkdonis-arts.org. Only editors can trigger it. Refuse comment markers, `!`, unbalanced brackets and quotes, and over-long values. Shared with classifieds: the drive1-3 suites are in a Windows scratchpad (`DEV_SPACE_PROPOSAL:13`) and cannot be rerun here, so this is verified with `harness` `tree.html#classifieds`. Reaches the site on its next rebuild. Due before stone 15a (added 2026-11-04). Refusing `!` is safe: 0 `site_config` rows contained `!important` [V:sql, review, 2026-11-02].
- R-b. `loadEvent` under `cache()`, from 13 runs per view to one (a `React.cache` probe gave 1 load for 13 calls [V:run, S2 t5]), with `canViewThread` at `data-event.ts:41`. Signed-out HTML identical through the edge. Due with stone 8b.
- R-c. `savePage` with `ifUpdatedAt` for concurrent saves (S1 §8.4). Before a second person edits one page. Scheduled in stone 16 (corrected 2026-11-04: it had no slot).

### Stone 1: a block's own settings, with sample data

Status 2026-11-04: coding began under the Lead. `4-build-plan-stone-1.md` holds the working scope and wins where it differs from this section. It already applies SC12 (seed document, what an empty wall shows, Code tab as read-only JSON, `harness/test.html`, "Show as published") and the stone 1 half of SC2 (Detach refused on sample rows, stand-ins and empty labels).

Scope:
- Selecting a sealed block shows its props in the right column, in sections from `groupOf`, using the same rows as a box.
- Data blocks draw from `sample()`, never stored.
- One failing block draws a named stand-in instead of blanking the canvas.
- Rows are listed by count, not yet editable.
- The test page gains a view "Blocks", because "Any page" runs the style-only `mountVisualEditor` and "Classifieds" is a sample tree (`harness/test.ts:44-50`, [V:read]).

Touches, all editor-only:
- `packages/blocks/src/contract.ts` (new: `contractOf`, `groupOf`, `dataOf`).
- `model/schema.ts` (sections `content`, `behaviour`; controls `text`, `textarea`).
- `panel/panel.ts`.
- `tree-editor.ts` (the sealed branch at `:303-311`, `p:` keys in `change`, `look` guarded at `:648,:663,:666,:684,:692`, because `faq` and `pt-link` declare a prop named `look` that Reset would delete).
- `puck/mount.ts`, `puck/TreeCanvas.tsx`, `harness/test.ts`.

No file on a published path changes. Classifieds shares `Panel`; the additions are new cases only [V:read]. The test page's wrapper was not kept in the repo; a copy was recovered from the published artifact today, holding `fixture`, `stage`, `land-data` and the five views [V:read].

Done when the developer can, on the test page, view Blocks:
1. Right-click, Add, Feed: it draws sample rows, not an empty box. The panel says "Sample rows. Not saved."
2. Click Hero banner: Content (title, subtitle, picture, its description) and Layout (align, height), in the row shape of `reference/text chosen, box around it shownabletoexpand.png`.
3. Type in the title: the hero changes per letter and the cursor stays. Undo takes the typing back in one step.
4. Change the picture wall's gap, shape and caption colour. Colour opens the same popover as a box; the reset arrow returns the default.
5. Save, switch view, come back: the settings are there. "Show saved document" shows the Feed with no rows in it.
6. Right-click the FAQ: Reset style is not offered, and its Look setting stays.

Automatic: a new `drive13` in isolated Chromium with no network; `drive`, `drive4` to `drive12` still pass; check-types 0 in `direct-edit`. Corrected 2026-11-04 from the build plan: `blocks` has 2 existing errors in `services/src/gather.ts`, so its criterion is no new errors, and `apps/elktours` joins the check.

### Stone 2: click into a block

Scope:
- `BlockDef.parts`, `morph`, `MorphMark`, the adapter diff (S1 §5.5), `TreeCanvas.tsx:63`, part rows in the tree, `writeLook` on a part, "This block" in Tweaks, `smoke-morph`.
- First blocks: `hero-banner`, `section-heading`, `prose`, `picture-wall`, `feature-card`, and `pt-banner` with sunjay's CSS inlined.
- The adapter diff is in shared `page-builder/src/config.tsx`, so it reaches any host at its next rebuild. Byte-identical when unset [V:run on a scratch copy]; check through the edge on that rebuild.
- Added 2026-11-04: `MorphMark` writes a font `<link>` before the marker (note 2). `morph` holds `parts` and `tokens` only; `rows` is deferred (SC11). The positional limit of §3.5 is recorded, not closed (note 4). `smoke-morph` runs in the harness, since the parts smoke needs the stone 15a install (note 1).

Done when: click Hero, click, click: Words, then Title, with the same colour, size and font controls as a box. It restyles live and the selection holds. Hide Subtitle, reset, undo. All captions on a wall restyle at once. A Tailwind block and a tokens block behave alike. Save, switch view, return: it draws from the document. ~~`window.published` shows the same.~~ Corrected 2026-11-04 (SC12), because a console call is not a hand test: the "Show as published" button draws the same through `<Render>` with no editor markers. A block with a font look keeps its spacing against `blocks.css:423,1038`.

### Stone 3: rows, pictures, option groups

Scope: `rows` control (about 150 lines [A]), `list`, `image` by prop name, `group`, `part`, `when`, `more` on the first blocks. Corrected 2026-11-04:
- A repeated part offers "All 12" only. "Just this one" and its key remapping in `morph.rows` wait until the developer asks (SC11).
- `image` rows and rows' picture columns go through `shell.openPicture`, so a `Private/` path is refused. Any later `fieldControls` image kind must make the same check (note 3).

Done when: on the picture wall, add a picture, reorder, open one row, change one caption alone. Fields appear and disappear with `when`. Selecting a caption on the wall says "All 12", and a look applies to all. A pasted `Private/` address is refused with words, on an image row and on a wall row. On the test page no block needs Puck's editor.

### Stone 4: the popup

Scope: §4.1. A static mock-up comes first; the developer's response to its look comes before wiring. D1 is in force: editor chrome, no surface code changes. Added 2026-11-04 (SC5): the Phone frame of §4.1 replaces the phone-width switch.

Done when: double-click a block: it opens large with the page dimmed, its tree in the right column, its fields and parts. "Show with" draws it with a subtitle, without, and so on. Esc goes up, then out. Close asks if changed. "Use on this page" changes the page; one undo takes it back. A box opens with everything in it. In a phone-width window the panel is a sheet.

Phone (corrected 2026-11-04): press Phone on `pt-banner` and on a block with a `blocks.css` width `@media` rule. Both take their phone form in the frame, and a driver asserts the computed values differ from the same block on a narrowed stage. A change on the stage redraws the frame. The frame says it is a preview and takes no clicks. What it does not test is stated beside it: behaviour, touch and a real phone, which remain open until stone 8a.

### Stone 5, split 2026-11-04

The 2026-11-02 text had one stone holding a package, four blocks, the Data section, the picker, tokens, Try it, two menus and the fence (SC4). Retracted from its done-when:
- "State Cancelled flips all four": `live-discussion` reads only `replies, title, href`, and `pickView` enforces that (S2 §9.1).
- "the count moves in another block": no other block in the set reads `rsvp`.

Its install moved to stone 15a.

### Stone 5a: a group follows one thread

Scope:
- `cleanSubject`, `scopeMap`, `pickView` as pure functions in `packages/utils/src/subject.ts`, with one `exports` line and no dependency change. Stored references are the first-round forms of §2.1.
- Fixture threads of each shape, including draft, deleted, another org's, private, cancelled, and a `document` thread.
- `live-countdown`, `live-event`, and `{{title}}` in words.
- The picker: candidates filtered by `canViewThread` with the fixture editor's real role, one kind allow-list (§5.3).
- The Data section, read only, four rows plus `+` (§4.2). A static mock-up comes first, because no reference image holds it; the developer's response comes before wiring.
- Detach refused on a piece drawing fixture data (§5.5).

Done when:
1. Put a countdown, an event card and a heading in a box and choose a thread on the box: all three follow, and the heading shows its title.
2. Point one elsewhere; "Use the box's" brings it back.
3. Choose the cancelled fixture: the countdown and the card show cancelled, and the heading keeps the title.
4. Choose the deleted-thread fixture: the failure words of §5.4 appear.
5. Move a piece out: "Now about Z (was X)".
6. As the guide fixture, the picker lists no "Only me" or owners-only title. A document naming the `document` thread draws the empty state.
7. The Data section matches the mock-up the developer accepted: About, Which, Seen by, Now, and the rest behind `+`.

### Stone 5b: presses and Seen as

Scope:
- `live-rsvp`, `live-discussion`.
- Try it, Seen as and Can do behind the Data section's `+`. State and the log of what would happen sit behind the same `+`, and move to the lab when it exists (SC11).
- The write fence and its log.
- Seen as passes `{ userId: null, role: capped, isGlobalAdmin: false }` (§5.5, SC1).
- Reply bodies pass `sanitizeRichText` in the same function the real loader will use at stone 8c (§5.5, SC6).

Done when:
1. State Cancelled: the countdown, the card and the RSVP flip, and the discussion stays.
2. Put two RSVP pieces in a box. In Try it, press "I'm coming" in one: the count moves in the other and in the Now row, the log says what would happen, and no request leaves the page (driver with no network).
3. With the fixture viewer set as the thread's author and as a platform admin, Seen as: Visitor on a private thread draws the empty states. A driver asserts both.
4. A fixture reply holding `<img onerror>` and `<script>` draws clean, tested through `sanitizeRichText` per `.claude/rules/03-verification.md`.
5. A harness button that POSTs on mount is refused and logged, and Save still saves.

### Stone 6: dog-ears

Scope: §6, on the test page's store; the one-press gesture on the page and in the popup; the Saved tab in the popup. Compare is the field list only. Removed blocks is deferred (SC10, SC11).

Done when:
1. Select a piece and press Dog-ear on the thin bar, or right-click and choose it. No dialog opens. A line says "Dog-eared as Version 1", with Rename. One press, one store write, and "Show saved document" is unchanged.
2. Restyle, dog-ear again, restyle again. Open the popup's Saved tab: both are listed, newest first. Compare lists the fields that differ. Use "Version 1", then undo.
3. A dog-ear of a box brings back its arrangement. The About row does not change on Use.
4. Remove a part from a test block: the stale message appears.

Retracted 2026-11-04 from the done-when: "Delete the block and bring it back from Removed blocks".

### Stone 7: page colours and fonts

Scope: Tweaks "This page", `root.props.vars`, `{{paper}}` in Code (`reference/grouplayer1.png` shows `background: {{paper}}`; `text chosen…png` shows `Fill {{spot}}`). No review objection touches this stone.

Done when: change Paper in Tweaks and every box using it follows. The Code tab shows `{{paper}}`; the From row names it.

### Gate: first signed-in run

~~The engine has never run signed in on the real app (`docs/sessions/2026-11-02_canvas-direct-edit-layer.md` §5).~~ Corrected 2026-11-04: on 2026-11-03 the tree editor ran signed in on elktours, in a production build, with a real save (`docs/open/ELKTOURS_BRIEF_2026-10-18.md:217-223`). The gate shrinks to what that run did not reach.

| Check | State 2026-11-04 | How, or what is missing |
|---|---|---|
| Open the tree editor | Done | Elktours, LAN URL, temporary guide account, since removed |
| A real tree save | Done | Save disabled until an edit; saved page equal to the coded page at section heights 556, 1193, 238, 285; four parts, six cards, three guides |
| Restore | Done | Page name pill; deletes the row |
| Visitors get no editor | Done | No button or editor CSS signed out. A signed-in person with no role sees no "Edit page", through the edge |
| Picture chooser against real routes | Open | "A picture upload in the editor" was not tested |
| Feed rows in the canvas | Open | Elktours offers box, words and picture only: it has no `/api/blocks/thread-feed`. Sunjay, innergathering and danamccool have that route |
| A signed-in non-editor calling the save action | Open | The guard is in code (`getApiEditor`), not exercised |
| The stones' source on a real host | Open | The run was on source of 2026-11-03. Stone 1's source dates from 2026-11-04 |
| The developer's own hand, through the edge | Open | The run was an agent's, on the LAN URL. Password sign-in through the edge was verified separately. Google sign-in and Dana's account were not tested |
| Touch, Firefox, Safari | Open | Touch is named as not tested; the browsers are not named at all |

What the run settles: the tree editor loads by dynamic import in a production App Router build; `createRoot` on a real page; a server action through `cleanBoxDoc`; `<Render>` with live parts from metadata; Restore; visitors downloading nothing of the editor.

What it does not settle:
- Stones 1 to 7: they are additive by design, and only a rebuild holding them shows that a host passing no contract behaves as before.
- The portal, `morph`, the fence, the sidecar, `subject`: none of these ran. Elktours draws its parts as HTML under `createRoot` and holds no sealed block.
- A page that differs by viewer or by thread: elktours' landing differs only by the button, so adoption of such a page is unproven, and stone 15 forbids it.
- Safety of test saves: a test save put a heading on the public page for about 15 minutes (2026-11-03, 17:38 UTC). Until stone 16, a test save is public, so make only invisible edits and delete the row at once.

The open checks run on a rebuild that holds the test-page stones, with `.next` backed up first and a compare through the edge after. Stone 15a does not start before them. Timing is D4. The developer runs the rebuild, per `docs/sessions/2026-11-02_canvas-direct-edit-layer.md` §6; the permission system refused it to agents, and that is not worked around. Which host: innergathering, because it is the only host with the tree editor wired, Feed rows available and a `/studio/<slug>/canvas` route. Its build was dated 2026-11-02 19:36 UTC when the build plan read it, which predates the tree in its source.

The two runs the review found without an owner (SC9) are entry conditions of stone 8a.

### Stone 15: code-built pages

Added 2026-11-04 (review blocking 3). The developer named the IFAC series pages and sunjay's public pages as the example, and no earlier stone made them editable: sunjay's `/`, `/about`, `/community` and `/publications` hold 12 `data-edit-section` markers and no editor dependency, and `packages/series-site` holds no markers [V:read, grep, 2026-11-04].

**Mechanism: `openPageAsTree` with live parts, the form of the elktours landing pilot (`apps/elktours/src/app/page.tsx`, `components/landing/page-editor-mount.ts`, `lib/puck/`).** The code keeps drawing, under a name, whatever follows data or the viewer. The rest is boxes and words in one stored Puck document. With no row the coded path runs unchanged, and Restore deletes the row.

| | Tree with live parts (chosen) | Visual stylesheet (the review's proposal: `mountVisualEditor`, `page-edits:<page>`) |
|---|---|---|
| Signed-in save in production | Elktours, 2026-11-03, agent with a temporary account | elkdonis-arts.org, by the developer (`page-edits:home`, handover §5) |
| Words, order, adding things | Yes | No: CSS only |
| Stored address | Node id and part name | `nth-child` path from a section (`layers.ts:203-209`, `patch.ts`). It lands elsewhere when the DOM differs by viewer or thread: `SeriesPage.tsx` crumb link for editors and cover or no cover; `SeriesWeekPage.tsx` `WeekEditor` wrapper for editors |
| Later stones | `morph`, popup, dog-ears, revisions all apply | None: a second store and a second editor, against R1 |
| Can freeze data | Yes, by adoption: hence the two rules below | No |
| Host files | Elktours and innergathering both call `openPageAsTree`. No host in source mounts `mountVisualEditor` [V:read, grep, 2026-11-04]. Innergathering's `page.tsx` still applies `page-edits:home`, and its first tree save carries that over (`edits`, `open-page.ts`) | The files the review proposed to copy have moved to the tree |

Rules that keep the tree safe:
1. A page with one instance is adopted once, from its signed-out HTML, not from the editor's DOM: `fetch(location.href, { credentials: "omit" })`, parsed with `DOMParser`, passed to `adoptChildren`, which reads no layout (`adopt.ts`). Sunjay's `/` draws "You are signed in" or `JoinFrame` by viewer and a `BannerEditor` for editors, so the editor's DOM is not what visitors get. If the fetch fails or is redirected, the editor does not open and says so. It is a new option of `openPageAsTree`: elktours and innergathering adopt from the editor's DOM today, each with its per-viewer pieces marked as parts, and they behave as before until they pass it. [A] not run; the SSO arrival check may redirect it [U].
2. A page with many instances or gated content is never adopted. `SeriesPage.tsx:115-128` and `SeriesWeekPage.tsx:89-91,201-207` draw the join link, meeting id and passcode for anyone signed in with a role, which includes every editor, and `adopt.ts` copies what is in the DOM. It opens on a layout declared in code, in which every data piece is a part. Its words stay where they are edited today: the planner and `WeekEditor`.

Known limits, stated to the artist where they apply:
- Adopted words stop following `/manage/pages`, as on elktours. The panel says so before the first Save.
- A saved tree does not receive later changes to the page's code. A part added in code does not appear until it is put back from Add. Restore returns to the code.
- Elktours' planned landing rebuild (`docs/open/ELKTOURS_CONVERGENCE_2026-11-02.md` item 5) would be hidden by a saved `puck:landing` until Restore. That file's item 6, the visual mode on the landing, is overtaken by the pilot. Coordinate with whoever holds elktours.
- Touch: no right-click on phones, so the menu opens only from the bar (handover §5).

### Stone 15a: coded pages with one instance

Scope:
- Entry: the gate's open checks and R-a.
- One coordinated `docker compose run --rm install`. It adds `@elkdonis/direct-edit` and `@elkdonis/fonts` to sunjay, `@elkdonis/utils` to `page-builder` and `direct-edit`, the `./subject` export's consumers, and `node-html-parser` to `blocks` for the parts smoke. Re-read `ELKTOURS_CONVERGENCE` Round A first and merge what remains: elktours' `direct-edit` line is already in (`apps/elktours/package.json:25`). It touches every container's `node_modules`, so it is the developer's to time.
- Copy the host files from elktours to sunjay: `EditPageButton`, `page-editor-mount`, `page-picture-chooser`, save and Restore actions behind `getApiEditor`, box blocks in `config.client.ts` and `config.server.ts`.
- Stored slugs join `TEMPLATE_SLUGS` (`apps/sunjay/src/lib/puck/reserved.ts:20`). Otherwise the `/[feed]` route would serve the tree at its own address with its parts missing (`[feed]/page.tsx:58`). Innergathering guards `/studio`'s list the same way (`studio/page.tsx:29`).
- Mark as parts everything that reads data or the viewer. `/`: the banner picture with `BannerEditor`, `EventStage`, `StandingMeetingFace`, `ForumFace`, the signed-in note or `JoinFrame`. `/about`: people cards, latest and featured. `/community`: stage, standing meeting, calendar and materials, forum. `/publications`: the list. These lists are from a first read of `/` and of the `data-edit-section` markers; each is confirmed against the page's code at that stone.
- `SiteShell` stays code, outside the root the editor opens on.

Done when, signed in by the developer, through the edge on `paratheater.arts-collective.com`:
1. On `/`, Edit page shows the page with no visible jump. Click through to a heading, retype it, restyle a box. Save stays disabled until the first edit.
2. After Save, the signed-out page shows the edit. The stage, the standing meeting and the forum show current data. A visitor gets the join frame and a member the signed-in note, each from code.
3. The stored row holds no text only the signed-in render draws: the developer's display name, "You are signed in", "Edit series".
4. Restore returns the coded page. Signed-out HTML equals the baseline after stripping `data-edit-*` and `data-landing-part`.
5. The stored slugs are 404 at their own address and absent from `/studio`'s list.
6. A signed-in non-editor sees no button, and calling the save action is refused.
7. The same on `/about`, `/community` and `/publications`. Each test save is an invisible edit, and its row is deleted at once.

### Stone 8, split 2026-11-04

The 2026-11-02 text had one stone with about ten deliverables, and the first production run of five mechanisms at once: portal, morph on a host, stored subject, sidecar writes and a new public write route. A fault there would be ambiguous, which is the reason §9 gives for delaying Puck 0.24 (review blocking 1). Default host sunjay; see D3.

### Stone 8a: first real site, no data

Entry, each with its own short report:
- `next dev` with a stored morph in a test document (`harness/preview-tree.sh`). The review's probe ran real Puck under Next's vendored Flight and Fizz in jsdom; Next's router layer and a real browser remain unrun.
- A browser run logging any unblocked write on a page holding every block, for a library caching `fetch` before the fence.

Scope:
- `morph: MorphMark` in sunjay's two configs. `CanvasOutlet`, `/studio/<slug>/canvas`. The fence. `page-builder/src/ears.ts`. The `savePage` choke point.
- Sunjay's dependency and box blocks arrive in stone 15a.
- `fieldControls` with the picture check of stone 3.
- Edit opens the canvas (§7, Edit door; `render.tsx:67`).
- Non-data blocks only: `hero-banner`, `section-heading`, `prose`, `picture-wall`, `feature-card`, `pt-banner`.

Done when, signed in by the developer, through the edge:
1. Edit on `/next-session` opens the canvas. Click into the hero's title, restyle it, press Dog-ear, Save. Signed out, the look shows with no editor markers and no `morph` in the HTML.
2. A block using `useRouter` and `Link` draws through the portal with no throw. This settles the portal's [U].
3. `puck:event-detail` opens in the canvas and saves with no prop lost. The thread page it draws has identical signed-out HTML before and after.
4. Puck's editor, through "Edit its settings", opens the same document and keeps `morph` on save.
5. In Try it nothing leaves the page, and the fence's log shows it.
6. A real phone: the page and the look read as the Phone frame showed them. This closes or restates the risk in §13.
7. Pages with no morph: signed-out HTML identical through the edge.

Stored names (`morph`, part names) freeze from this stone (§13).

### Stone 16: before the first artist

Added 2026-11-04 (review blocking 2). D2 recommended that no artist other than the developer edit a real page until `page_revisions` exists, and neither it nor R-c had a slot. Scope:
- One migration through `/new-migration`: `page_revisions`, the shape in `docs/open/PATTERNS_VERSIONS_REVIEW_PROTOTYPES_2026-11-01.md:190-213`, with `org_id VARCHAR(50)` as on `site_config` (`045_site_config.sql:12`; that document says `uuid`). Check `\d` first. RLS as in migration 227; writes through `withOrg`.
- `puck:<slug>` stays the published copy, so no public reader changes (same document, "Cheapest path"). The editor loads the head revision.
- Save writes a revision, which visitors do not see. Publish writes `puck:<slug>`. A preview address draws a revision for signed-in editors of that org only; a link for people with no account, and scheduling, are not in this stone.
- Earlier versions are listed from the page name pill, and Use makes a new revision. Restore on a coded page deletes the published row and keeps the revisions.
- R-c: `savePage(orgId, slug, data, { ifUpdatedAt })`. The per-host stores all reach `packages/page-builder/src/store.ts:78`. The direct deletes (`apps/elktours/src/lib/puck/store.ts:16`, `apps/arts-collective/src/lib/puck/store.ts:37`) take the same check.
- Puck's editor saves through the same path, so a document saved there also leaves a revision.
- No change to dog-ears: a dog-ear holds back a piece, a revision a page.

Done when:
1. Save a change: signed-out HTML is unchanged through the edge. Preview shows it to a second editor of the org, and a visitor at the preview address gets the public page.
2. Publish: signed out shows it. Use an earlier version, then Publish: signed out shows that.
3. Two browsers on one page: the second Save is told who saved and when, and neither edit is lost.
4. Under `withOrg(A)`, B's revisions are not listed, and an insert with B's `org_id` fails.
5. The exit: the first artist (D6), signed in as themself on their own site, with the developer not at the keyboard, edits a real page, previews and publishes it. Their words are recorded in the stone's report, and what they could not do is listed before stone 17 starts.

### Stone 15b: series pages as a layout of live parts

Follows stones 8a and 16: it needs `morph` on a host, and it edits a page that many visitors reach.

Scope:
- `SeriesPage.tsx` and `SeriesWeekPage.tsx` build a `parts` map, and the coded path draws from it. Parts on the series page: head, top (`SeriesTop` whole, since it is one client state, S2 §14.1), sessions, rota. On the week page: crumb, main article with `WeekEditor`, RSVP and join side, host, previous and next, conversation.
- `SeriesSite` gains one optional host function, returning the stored layout. With none, or no row, today's path runs. Rows `puck:series-page`, `puck:series-week`, one each per org. They apply to every series on that site, and the top bar says so.
- Layouts declared in code in `packages/series-site`. `openPageAsTree` receives one as `tree`, so nothing is adopted.
- Looks: `morph` on a `part` node, with inner parts declared per part name by existing classes, one line each and no markup change: `h1`, `.ist-gen`, `.ist-next`, `.ist-next__t`, `.ifs-btn--primary`, `.ifs-srow`.
- A part's panel says "Words come from the planner" and links to `/hub/series/<id>#settings`.
- Add lists parts absent from the layout, because a deleted part otherwise returns only through undo or Restore (handover §5).
- Not here: moving the Next band apart from the general card, since `SeriesTop` holds their state. The `/series` index follows on request.
- IFAC gains the `direct-edit` dependency. IFAC's rebuild has been held for another session's `/center` and payouts work since 2026-10-18 (`CLAUDE.md`), so the developer chooses when.

Done when:
1. With no row: signed-out HTML of IFAC `/series/art-for-non-professionals` and its week 1, and sunjay `/series/running-the-script` and a week, is identical before and after, stripping only the inert attributes.
2. On sunjay, signed in by the developer: move Sessions above the card, restyle the Next band's title, take out the rota, Save. Signed out, the page shows that, with current titles and dates. A later edit in the planner shows with no change to the layout.
3. The join link is absent from signed-out HTML and present for a role-holder. "I'm coming" works as today. The stored rows hold no join URL, meeting id or passcode value.
4. A second series on the same site draws the same layout. A series with no cover leaves no gap.
5. Restore returns the coded page.
6. The same layout steps on IFAC's series page, when its rebuild runs.

### Stone 8b: real threads, read only

Scope:
- `services/subject.ts` as a change by itself, because one broken file fails every app's type check.
- R-b. `data-event.ts:41` takes `canViewThread`.
- `scopedMeta`, `/api/live/views`, `/api/live/candidates` (§5.3).
- `live-countdown`, `live-event`, and the existing `pt-event-*` blocks scoped by a box (S2 §3.3). This proves the cascade on real data with no new write route (SC8).
- Seen as and Detach as in §5.5.

Done when, signed in by the developer:
1. Open `puck:event-detail` drawn for a chosen thread. The canvas shows real data, with no join details in the network tab.
2. On `/next-session`, a box with a subject holds `pt-event-header` and `live-countdown`, and both follow it. Signed out, it draws.
3. Seen as: Visitor, as a platform admin and as the thread's author, on an ORGANIZATION thread: the pieces draw nothing.
4. As a guide, `/api/live/candidates` holds no "Only me" or owners-only title. A document naming a `document` or `writing` thread draws the empty state.
5. Detach on a piece whose effective audience is not everyone is refused. On a public one, it adopts what Seen as: Visitor with Sample off draws.
6. Through the edge: signed-out HTML of the existing thread page is identical before and after. `series_sessions` row count is unchanged after viewing an unmaterialised week.
7. Secrets, corrected 2026-11-04 (SC3). The old check, "no `talkUrl`, `meetingUrl` or `passcode` in any signed-out page", cannot pass: `/gatherings/qi-gong-and-alchemical-yogas` holds those keys with null values, and `/gatherings/ritual-theatre-lab` holds `zoom.us` 6 times because the coded thread page prints join links by existing policy (`apps/sunjay/src/app/[feed]/[slug]/page.tsx:179-184,205-212`). Assert values, not names: on pages using `live-*` or the event template, no non-null `talkUrl` or `meetingUrl` for a thread that has one, and no `/call/` token. The coded thread page is excluded (D8).

### Stone 8c: real presses

Scope:
- `live-rsvp`, `live-discussion`, `liveRoutes`, `/api/live/reply`, `LiveRoutes` without `status-body`.
- The retirement rule of §5.6 on sunjay.
- Replies through `sanitizeRichText` in `loadSubjectView`, and `reply.post` limited to the kind allow-list, because `postReply` has no kind check (`forum-write.ts:107-128,161-176`).

Done when, signed in by the developer:
1. Build the §2.2 group on `/next-session`. Signed out it draws; pressing "I'm coming" goes to sign-in.
2. A signed-in press on a thread the developer names records one RSVP and mails as today.
3. A stored reply holding hostile markup draws clean, tested through the sanitiser.
4. `pt-event-rsvp` is no longer in Add on sunjay, and a stored one still draws.
5. The secrets check of stone 8b passes with a thread that has a room.

### Stone 9: series pieces as blocks

Scope: in `@elkdonis/series-site/blocks`: cover, about, session rows, rota, stage, week when, host, previous and next, conversation list (S2 §14.1). The Next band's markup becomes a presentational component: `SeriesTop` passes its own actions, the block passes `live-rsvp`'s. The state in `SeriesTop` stays (`series-top.tsx:337-373` holds handlers [V:read today]; this reconciles S1 §3.2 and S2 §14.1). ~~The series pages stay code.~~ Corrected 2026-11-04: the routes stay code, drawn through stone 15b's layout, where a block can replace the part of the same name. IFAC gets a Puck page route only if asked.

Done when: IFAC and sunjay series pages' signed-out HTML is identical before and after, and on sunjay a Puck page shows the Next band with its title restyled in the popup.

### Stone 10: Studio page kind

Scope: `/studio/<slug>/canvas` with a page list on sunjay and innergathering (which has the route); a Pages `StudioExtension` on arts-collective for orgs it hosts. Other hosts gain theirs in stone 17 (named 2026-11-04; the 2026-11-02 text said "per-host").

Done when: from Studio, open a page, edit, dog-ear, check in the Phone frame. The same page opened from the live Edit button shows the same result.

### Stone 17: roll-out to more hosts

Added 2026-11-04 (review blocking 2), after stone 16's exit. One host at a time. Each deploys all uncommitted work, so each starts with a `.next` backup and a baseline: signed-out HTML and a screenshot of every stored page. When Edit stops offering Puck's editor is the rule in §7, applied per host in the last column.

| Order | Host | What is wired | Waits for | Edit door after |
|---|---|---|---|---|
| 0 | sunjay | Stones 15a to 8c, so already wired | Nothing further | Canvas since stone 8a. The link goes when `ServicePickerField` and the other pickers run as `fieldControls` |
| 1 | innergathering | Puck pages through its existing canvas route; the landing tree in source | The gate's rebuild | Canvas; "Edit its settings" until none remain |
| 2 | arts-collective | Org pages on `SHARED_BLOCKS` (`/hub/sites/<slug>/design`), Studio Pages kind. First host where owners of several orgs edit | Stone 10 | Canvas; its catalogue is shared blocks plus two, so the link should go first here |
| 3 | elktours | `/studio/tour-detail`, `experience-detail`, `experience/[id]` in the canvas. The landing has it already | Whoever holds those paths; `TourMain` is stone 14 | Canvas on the landing; Puck's on tour layouts until stone 14 |
| 4 | amrit-canada | Coded pages in stone 15a's form. It has no `page-builder` today (`package.json`); it is the template for new org sites, so new sites inherit this | One install | Canvas |
| 5 | danamccool | Its own step. 27 of 31 stored rows [V:sql, 2026-11-02]. A same-tree rebuild on 0.23 first, with a screenshot compare of the rows, since its build is a month behind the tree. `fieldControls` for its React fields | The developer's slot with Dana's site | Puck's link stays until `tile-arrange-field` and the others have controls |
| 6 | art-auction | Its Puck pages | The November silent auction closing | Canvas |

Not in this roll-out: ifac's Puck pages (no route; stone 15b covers its series pages), hidden-enneagram (Silex pages stay on Silex), fourthwayBookreaders (no `page-builder`), forum, admin, Sophia, stopped and retired apps. ArtDirect is stone 18.

Done when, per host: its owner or guide opens from Edit, edits, previews, publishes and restores on a real page. Every stored document opens in the canvas and saves with no prop lost. Signed-out HTML of pages not edited matches the baseline on the region the stone's work reaches. The Edit door is as in the table, or the report names which fields keep Puck's link.

### Stone 18: artists' own pages

Added 2026-11-04 (review blocking 2). A person's page on ArtDirect (`/[slug]`, `/[slug]/featured`) is a Puck document in `user_pages`, org `oad` [V:read, `apps/artdirect/src/lib/person-pages.ts`], with 3 rows [V:sql, 2026-11-02]. It differs from an org page in three ways:
- It has a draft already: keys `profiledraft`, `featureddraft`. So it needs no `page_revisions`.
- It has no sidecar. `profileears` and `featuredears` fit the key CHECK (`157_user_pages.sql:58`), with no migration. The public readers (`person-pages.ts`, `[slug]/page.tsx`, `user-store.ts`, `ifac/person-view.tsx`) are audited first, to confirm each asks for one key.
- Members save it, not org editors. So morphs on this store drop structured `pos`, `x`, `y`, `sx`, `sy`, `tx`, `ty` (§3.5), and only `memberSafe` blocks are offered.

Done when: an artist other than the developer, signed in as themself, restyles a piece on their own page, dog-ears it, previews and publishes it. Another member's save on that page is refused. A morph with a stored transform draws without it. The 3 existing rows open and draw unchanged.

### Stone 11: developer space

Scope: `apps/lab` slice 1 of the proposal, then `fromBlock(def)`. Review outcomes recorded as in §7.

Done when: on the LAN address, every shared block is listed with its fixture states and parts check, one entry is a direct-edit mount with a fake save, a request carrying `X-Forwarded-Host` gets 404, and no write reaches `elkdonis_dev`.

### Stone 12: ingest

Scope: §8, confirmed with the developer first.

Done when: paste a public MIT pen, review it in the sandbox with licence and credit recorded, port it, see it pass the checklist in the lab, and after a rebuild see it under Add.

### Stone 13: Puck 0.24

Scope: §9, the package only. `renderFieldsFor` is a separate item the developer opts into (note 5).

Done when: harness passes on 0.24, one stored document per host opens in Puck's editor and saves, clicking a picture opens its row, and `tagWith` is gone. ~~Signed-out HTML per host is unchanged.~~ Corrected 2026-11-04 (SC13), because each rebuild deploys all uncommitted work and a whole-page change cannot be attributed to Puck: the Puck-rendered region per host matches a baseline taken from a same-tree rebuild on 0.23. danamccool's 27 rows are compared by screenshot, in their own step.

### Stone 14: elktours tour blocks, and live atoms if asked

Scope: `TOUR_CONTRACT` sidecar and `fieldSlots` when the held paths are free; re-read `ELKTOURS_CONVERGENCE` first. The atoms rung only if the developer, after trying parts on real blocks, says parts are not enough (S1 §10.2). Corrected 2026-11-04: elktours is no longer last for the tree editor, since its landing has run it since 2026-11-03. What stays last is `TourMain`'s parts.

## 12. Decisions

### For the developer

D1. Decided 2026-11-04: A. The popup is editor chrome in surface proportions, not a registered surface. No surface code changes; the developer said rewriting surfaces looks unnecessary. Evidence in §4.4.

D2. What does Save mean for an artist? A: stays public at once, and the dog-ear is the hold-back per piece, with no migration. B: page-wide drafts and a preview link through `page_revisions`, one migration. Recommendation: A up to stone 16, then B before any artist other than the developer edits a real page. Corrected 2026-11-04: B is scheduled as stone 16 and no longer says "built now". The developer can still decide that dog-ears are enough, which removes the migration and leaves R-c. Added 2026-11-04: the elktours landing pilot already offers Edit to that org's owners and guides, with no revisions. Its reach is one page and Restore removes a save. Default: it stays open; the developer may hold it until stone 16. Needed before stone 16.

D3. Which real site first? A: sunjay, Para Theater: every route, series and recurring data, a stored template to protect (S2 §14.2). B: danamccool: the largest stored use (27 rows), no live controls, so it tests looks but not groups. C: ArtDirect person pages: a member's own page in `user_pages`, which raises who may style what on a shared host. Recommendation: A. Added 2026-11-04: B and C are no longer dropped; they are stones 17 and 18. Elktours, now running the tree, has no `/api/blocks/thread-feed` and no series pages, and a session holds its tour paths, so it does not displace A. Needed before stone 15a.

D4. When will a rebuild run the gate's open checks? In force 2026-11-04: no rebuild during the test-page stones (the default). The gate runs after stone 7, unless the developer calls it sooner at a clean point between stones. The review's option, "now, before stone 1", was overtaken: coding began under the default, and elktours' run of 2026-11-03 covered open, save and Restore on source from before stone 1. The rebuild deploys the whole uncommitted tree; back up `.next` first; commands in the handover's §6. Corrected 2026-11-04 15:30 EST: the developer wrote "doesnt need to be private test space. you can test on anything live", and asked for much heavier testing. So the wiring of stone 8a (non-data blocks, part of 15a's dependency) moves ahead of stones 3 to 7, on sunjay; sunjay is rebuilt when stone 2 closes, after a shadow build and a signed-out baseline (`packages/direct-edit/harness/bench/`, `~/eac-backups/direct-edit/live-baseline-sunjay-2026-11-04/`). Later stones land on sunjay as they close, as well as on the test page. Test saves on sunjay are public until stone 16 (D2); the test document is the unlinked page `try`. Payments and mail to real people stay out of testing. Corrected 2026-11-04 16:05 EST: "much heavier testing" above was the advisor's misreading. The developer wrote "stop the crazy over exstensive testing for now... give it a good once over then move on". Each stone now gets one pass (type check, a build, one walk, one review of what matters); the browser matrix in `harness/bench/` is parked, the rig kept.

D5. Baseline commit of `packages/direct-edit` and `packages/series-site`? `git ls-files` shows 0 tracked files in each [V:read 2026-11-02], in a shared tree, and live sunjay and IFAC depend on the second. In force 2026-11-04: B, no commit, with the snapshot in `~/eac-backups/direct-edit/` as the rollback. The snapshot covers `direct-edit` only; `packages/series-site` has no such copy named in the build plan, which matters at stone 15b. The developer can still ask for A.

D6, added 2026-11-04. Who is the first artist, and on which site? A: the owner of org `sunjay` on Para Theater, where stones 15a and 8a have run. B: Dana on the elktours landing, already wired, which tests the tree but no sealed block or thread. Recommendation: A. Needed before stone 16's exit.

D7, added 2026-11-04. Does `post` join the subject kinds? It is the most common published kind (40 published [V:sql, Survey]), and without it "a discussion lower down" cannot attach to a post. With it, the picker's list grows, and `reply.post` reaches posts through the new route. Recommendation: yes, at stone 8c, once replies through the loader are checked. Needed before stone 8b.

D8, added 2026-11-04. Decided by the developer 2026-11-04 16:10 EST: signed-out visitors do not see Zoom links or passwords on Para Theater. Source gate in `apps/sunjay/src/lib/data.ts` (`withJoinLink`) and `packages/services/src/forum.ts` (`placeOnly`); it ships with each app's rebuild. The one database row needs its own change. Does the policy stand that sunjay's coded thread page prints join links to anyone? `/gatherings/ritual-theatre-lab` holds `zoom.us` 6 times signed out (`apps/sunjay/src/app/[feed]/[slug]/page.tsx:179-184,205-212`; edge, review, 2026-11-02). Stone 8b excludes that page from its check and changes nothing there. No recommendation: it is an access decision about existing pages. Needed before stone 8b.

### Decided, conventional

- Timer: a countdown to the subject's next occurrence, with a fixed date as an option (`source: "subject" | "fixed"`).
- Who may dog-ear: whoever may save the page (owners and guides today).
- Guests on `live-rsvp`: yes where `/api/rsvp` exists. Series stays sign-in only, per the owner's decision of 2026-10-08 (`routes/rsvp.ts:15-16`).
- Attendee names and faces on `live-rsvp`: members only, as on thread pages. The series week page's public faces stay as they are.
- The main right column stays Properties, Code, Tweaks as in the screenshots; Saved appears in the popup only.
- A dog-ear of a group includes its arrangement; it holds no subject.
- Lab reach: LAN plus token until a second developer needs otherwise.
- `morph` as the prop name, `PartStyle` as the one style vocabulary, `blkStyle` frozen.
- No `thread_orgs` threads in the picker in the first round. No record on the thread. ~~No migration in stones 1 to 14 unless D2 picks B.~~ Corrected 2026-11-04: one migration, in stone 16, and none elsewhere.
- Coded pages use the tree with live parts, not the visual stylesheet (§11, stone 15). `page-edits:home` keeps drawing until innergathering's first tree save carries it over.
- Phone in the popup is a read-only frame, not a narrowed stage (§4.1).
- One-press dog-ears take automatic names and count as named, so the cap evicts automatic ones first (S1 §8.2).
- Preview of a draft is for signed-in editors of the org in the first round.

## 13. Risks and what is not known

| Risk or unknown | Effect | What settles it |
|---|---|---|
| ~~Engine never run signed in.~~ Corrected 2026-11-04: it ran signed in on elktours with a real save and Restore. Part is open: stones 1 to 7 on a real host, picture upload, Feed rows, the developer's hand | Stones 2 to 7 still add source on a base verified only up to 2026-11-03 | The gate's open checks; D4 |
| Stones' source shipped by another session's rebuild of elktours, innergathering or arts-collective (added 2026-11-04) | A half-finished or failing panel in a production editor, or a failed build taking a site down | Valid at each save; new engine options are optional; no new dependency before stone 15a; check-types on all three; a host passing no contract behaves as before |
| Stored names freeze at the first production `morph` or `subject` | A wrong shape becomes data to migrate | Stones 1 to 7 stay on the test page; the shape can change freely until stone 8a. Added 2026-11-04: `box`, `words`, `picture` and `part` may already be stored by elktours' editors |
| Adoption freezes what the DOM drew (added 2026-11-04) | Words stop following their source; a private or per-viewer value could reach a public document | Signed-out adoption on one-instance pages; no adoption on series pages; stone 15a done-when 3, 15b done-when 3. Fetching signed out through SSO [U] |
| A saved coded page hides later code changes (added 2026-11-04) | A site's code edit does not show, with no error | Stated before the first Save; Restore; "put back" under Add on series pages. Elktours' planned landing rebuild is the first case |
| Test saves are public until stone 16 (added 2026-11-04; incident 2026-11-03) | A test heading on a live page | Invisible edits only; delete the row at once; stone 16 |
| Elktours' Edit is open to its owners and guides with no revisions (added 2026-11-04) | A mistaken save is public at once on one page | Restore; D2 |
| Portal under a real App Router [U]. Run only in jsdom with real React and Next code. Not settled by elktours, which uses `createRoot` | Live controls may not draw on hosts | Stone 8a done-when 2; `pt-standing` also tests surface context |
| Hoisted `<style>` and `<template>` under a real RSC stream, a late Suspense boundary, hydration. Narrowed 2026-11-04 from the review's probe: real Puck under Next's vendored Flight, Fizz and `hydrateRoot` in jsdom kept markers adjacent, with 0 recoverable errors. Next's router layer and a real browser [U] | Looks missing or a hydration warning | `next dev` with a stored morph in a test document, via `harness/preview-tree.sh`: stone 8a's entry |
| A site's CSS relying on `:first-child` of a block root [U] | A morphed first block loses a site rule | Screenshot compare per host. `blocks.css` has none [V:read, S1 §5.2] |
| A font `<link>` placed after a morphed block breaks `:last-child` (review note 2) | Small spacing change on that block | Stone 2 writes it before the marker; screenshot compare |
| A site's Tailwind `!` utility beats a morph [A] | One look not applied on one element | Grep served CSS per host |
| `!important` also beats a block's `:hover` and `@media` for that property | An artist can defeat a hover reveal or a phone rule | Accepted as what the artist asked for; panel note if it recurs |
| No breakpoints in `PartStyle`. One guard: sizes over 32px become `min()` | A look fine on desktop may misbehave on a phone | The Phone frame shows it (corrected 2026-11-04: a narrowed stage would not). Stays open until a real phone at stone 8a. `morph.parts[x].phone` is a known next step |
| Phone frame copies HTML and CSS only (added 2026-11-04) | A block that lays itself out by script looks wrong in it; a host's `style-src` could block it [U] | Stated beside the frame; real phone at stone 8a |
| Parts on light and dark sites: `PartStyle` colours are hex only | A look may not follow the theme | Palette writing `var(--blk-*)`, open (S1 §6.1) |
| Contrast: artists can make unreadable text | Public pages | Existing contrast note on `color` reads the part's real background |
| Selectors on Tailwind literals in `TourMain` | Silent loss after a utility edit | `checkParts` script; elktours last |
| A library caching `fetch` before the fence, or a GET with side effects [U] | A preview write could reach production | Browser run logging unblocked writes on a page with every block: stone 8a's entry |
| Saves are last-write-wins, and public at once | Two editors overwrite each other; a mistake is live | Stone 16 (R-c, D2); dog-ears per piece until then |
| Shared tree: another session's rebuild ships our shared-file edits; `config.tsx` is touched by stones 2 and 8a; `services` breaks all type checks | Unplanned deployment | Unset output is byte-identical; `git diff` before edits; services change by itself in stone 8b |
| danamccool's rebuild ships a month of tree to a live client site (SC13) | Changes unrelated to this work appear on its 27 pages | Its own step in stone 17, same-tree baseline first |
| Art-auction's silent auction opens November 2026 | A rebuild during it risks the auction | Stone 17 and stone 13 wait for it to close, or the developer accepts the rebuild |
| `elkdonis_scratch` lags production and has no `eac_tenant` grants | The lab cannot render tenant paths | Fixtures by default; refresh is a separate approval |
| Elktours is under active edit | Plans go stale | No work in held paths; stone 14 re-reads first |
| The developer's hand test may reject a reading: parts as the unit, or the popup's frame | A stone's look changes | That is what the order is for. Mock-ups first at stones 4 and 5a |
| The first artist may not find this usable (added 2026-11-04) | Stones 8b onward answer the wrong question | Stone 16's exit comes before them and before any roll-out |
| Firefox, Safari, touch [U] | Editor behaviour | By hand at the gate; touch also at stone 15a |
| Effort per stone [U] | Pace | Reported per stone; no estimate is offered here |

Run so far: S1 ran part selection, the panel and `<Puck>` keeping unknown props in Chromium on scratch copies. S2 ran the cascade, portal and `cache()` probes in Node and jsdom. ~~Nothing ran in a real Next app, signed in, or against stored documents.~~ Corrected 2026-11-04: elktours' landing ran the tree editor in a real production Next build, signed in, against a document it stored and then deleted (`docs/open/ELKTOURS_BRIEF_2026-10-18.md:217-223`, recorded by that session, not re-run here). The specialists' blocks, `morph` and `subject` have still not run in a real Next app or against stored documents.

Checked in this revision, on 2026-11-04:
- Read: `3b-platform-review.md`; `ELKTOURS_BRIEF_2026-10-18.md:217-223`; `apps/elktours/src/app/page.tsx`, `components/landing/*`, `lib/puck/{actions,store,landing,config.server}.ts`; `open-page.ts`, `puck-tree.ts`, `adopt.ts`, `patch.ts`, `layers.ts:203-220`, `view.ts`, `visual-editor.ts:1-50`, `Part` in `puck/blocks.tsx`; `apps/innergathering/src/lib/page-edits.ts`, `components/landing/page-editor-mount.ts`; `apps/sunjay/src/app/page.tsx`, `lib/puck/reserved.ts`, `lib/puck/render.tsx`; `SeriesPage.tsx`, `SeriesWeekPage.tsx`; `thread-audience.ts:85-103`; `forum.ts:725-745`; `store.ts:70-125`; `user_pages` in migration 157; `site_config` in migration 045; `person-pages.ts:30-45`; `PATTERNS_VERSIONS_REVIEW_PROTOTYPES_2026-11-01.md:180-235`; `ELKTOURS_CONVERGENCE_2026-11-02.md`; the handover's §5 and §6.
- Greps: importers of `direct-edit`, `page-builder`; `mountVisualEditor`; `data-edit-section` counts (4, 3, 4, 1 on sunjay; 0 in `packages/series-site` and `apps/ifac/src/app`); `/api/blocks/thread-feed` routes; canvas routes; `Content-Security-Policy`.
- File mtimes in `packages/direct-edit`, `packages/blocks` and `packages/page-builder` after 2026-11-03 12:00: only `puck-tree.ts` (2026-11-03, elktours session) and stone 1's own files. Line numbers cited for `tree-editor.ts`, `mount.ts` and `TreeCanvas.tsx` are as of 2026-11-02; stone 1 moves them.
- Not re-queried: read-only SQL for this revision was refused by the permission system on 2026-11-04 and not worked around. Every [V:sql] figure here (31 Puck rows, 27 on danamccool, 3 `user_pages` rows, `page_revisions` absent) is dated 2026-11-02 and carried from the survey or the review. Elktours may have added or removed a row since. Stone 16's `\d` and stone 17's baseline re-read them.
- Not run: nothing was executed in this revision. The tree over signed-out adoption, the Phone frame and `morph` on a `part` node are designs here, [A].

Checked in the first pass, on 2026-11-02:
- Read: `tree-editor.ts`, `panel.ts`, `TreeCanvas.tsx`, `mount.ts`, `clickthrough.ts`, `edit-shell.ts:50-109`, `schema.ts`, `style.ts:60-149`, `patch.ts`, `config.tsx:60-479`, `types.ts:120-359`, `registry.ts`, `hero-banner.tsx:60-115`, `series-top.tsx:334-376`, `data-event.ts:25-46`, `frame.tsx:1-70`, `kinds.ts`, `SurfaceProvider.tsx` around `showModal` and `onCancel`, the two handover and proposal documents.
- Reference images read: `rowlayer4`, `grouplayer1`, `rootlayer0onrightcolounm`, `textofrowlayer4`, `headerlayer3`, `columninsectionundernav`, `c_right`, `Screenshot 2026-11-02 125351`, `text chosen, box around it shownabletoexpand`, `sectionundernav`, and S1's `part-selected.png`.
- Queries and fetches: three thread ids and the sunjay `puck:` row [V:sql]; `git ls-files` for both untracked packages; npm registry for `@puckeditor/core`; a copy of the published test page, saved under the scratchpad's `artifact-files/`.
- Not re-run: the specialists' probes. Their [V:run] labels are carried from their reports.

Corrections to earlier notes:
- Thesis: option overrides are not in `morph`; connectors are not used for live actions.
- Direction 2 and the survey: more chrome sites than the three listed.
- Direction order: parts before the popup.
- S1 §9.1: `groupOf` needs the colour case.
- S1 §14: `series-next` is an extraction with its actions passed in, not a move.
- `CLAUDE.md` and rules still to update when work lands: the Current work line, `RESERVED_PROP_NAMES` in `.claude/rules/areas/puck-blocks.md`, and doc corrections listed at Survey §11.
- Added 2026-11-04. S2 §2.3 (reply `html` sanitised), §6.1 (real `userId` passed under `viewAs`), §9.1 ("six RSVP implementations stay"), §12.3 (candidates unfiltered) and §16 (secret check by key name) are overridden by §5.3, §5.5, §5.6 and stone 8b here. S1 §5.5 (font link after the block) and §8.2 (Dog-ear only in the Saved tab; Compare with a second canvas) are overridden by stones 2 and 6. Those documents were left as written.
- Added 2026-11-04. The review's blocking 3 says innergathering's visual-mode host files can be copied. Those files have since moved to `openPageAsTree` in source. The build plan's line 67 repeats it and is overridden by stone 15.
- Added 2026-11-05. Stone 2's parts covered static blocks only. Parts on Para Theater's seven data-drawn block types were added and deployed 2026-11-04 18:53 EST, with the popup and Arrange ahead of stone 3 on the developer's word (`CANVAS_FRAMEWORK_2026-11-02.md`). The popup reaches stored pages only (`/try`, the `event-detail` template), so proposed order after the developer's test of `/try`: stone 15a's coded pages, then stone 3. Not yet confirmed by the developer.
- Added 2026-11-05. The developer confirmed starting the home page ahead of stone 3. Stone 15a for `/` is in source. Its install step was not needed (sunjay already depends on `direct-edit`). Its live pieces are sealed blocks rather than `part` nodes, so the popup reaches them (`CANVAS_FRAMEWORK_2026-11-02.md`). Its done-when items are unrun: they need a signed-in session on the site.

## 14. Disposition of the review

All 22 objections of `3b-platform-review.md`, as of 2026-11-04. Two were applied in a different form from the one proposed; the reason is in the row.

| Objection | Applied where | Note |
|---|---|---|
| Blocking 1: stone 8 is too much at once | Stones 8a, 8b, 8c | As proposed. Box blocks and the dependency move to stone 15a, which runs first |
| Blocking 2: no stone for artists or more hosts | Stones 16, 17, 18; D2, D6 | `page_revisions` chosen, with R-c inside; the "explicit decision" alternative stays open in D2. First artist named by the developer, with a default |
| Blocking 3: no stone for code-built pages | Stones 15a, 15b; §7 | Different mechanism: tree with live parts, not the visual stylesheet. Reasons in stone 15: it stores `nth-child` paths that shift by viewer and thread, edits no words, and is a second store. The host files proposed for copying have moved to the tree |
| SC1: Seen as still passes admin and author | §5.5; stones 5b, 8b | As proposed, with a fixture and a driver assertion |
| SC2: Detach freezes sample and private text | §5.5; stone 1 (build plan); stones 5a, 8b | As proposed |
| SC3: secret check cannot pass | Stones 8b, 8c; D8 | As proposed: values, not names |
| SC4: stone 5 not firm, done-when contradicts spec | Stones 5a, 5b; §4.2 | As proposed, with a Data section mock-up first |
| SC5: phone switch shows a false phone | §4.1; stone 4; §13 | The review's second option: read-only iframe. Chosen over renaming to "Narrow", because artists need the phone answer and only a frame evaluates `@media` |
| SC6: reply bodies unsanitised | §5.5; stones 5b, 8c | As proposed |
| SC7: candidates and kinds | §5.3, §5.5; stones 5a, 8b; D7 | As proposed |
| SC8: seven RSVPs, no retirement | §5.6; stones 8b, 8c | As proposed, including dropping `status-body` |
| SC9: D4 lacks "now"; two runs without an owner | Gate; D4; stone 8a's entry | Runs assigned. "Now, before stone 1" not taken: coding began under the default no-rebuild decision, and elktours' run of 2026-11-03 covered open, save and Restore |
| SC10: dog-ear is not cheap | §6.2; stone 6 | As proposed: one press, automatic name, no dialog |
| SC11: heavier than the first round needs | §2.1, §4.2, §5.3, §6.2; stones 2, 3, 5a, 5b, 6 | As proposed. Spec field counts (26 subject fields, 15 state ids, 10 note reasons) are not cut here: each stone takes only what its blocks read |
| SC12: stone 1 hand-test gaps | Stone 1 through the build plan; stone 2 | As proposed |
| SC13: stone 13 HTML compare, danamccool | §9; stones 13, 17 | As proposed |
| SC14: two editors, which door | §2.3, §7; stones 8a, 17 | As proposed |
| Note 1: install list short | Stone 15a; §6.4; stone 2 | Applied, and the install moved out of the test-page stones. Elktours' `direct-edit` line is already in |
| Note 2: font link breaks `:last-child` | §3.5; stone 2; §13 | As proposed: link before the marker |
| Note 3: `Private/` guard is in one place | §5.5; stones 3, 8a | As proposed |
| Note 4: `cleanMorph` leaves structured transforms | §3.5; stones 2, 18 | Recorded at stone 2, closed at stone 18, the first store members write |
| Note 5: `renderFieldsFor` is Puck polish | §9; stone 13 | As proposed: separate opt-in |

The review's "Requirements not covered" are met as follows: R7 context 1 and R8 by stone 15; artists' precondition by stone 16; roll-out by stones 17 and 18; the Edit door by §7; R7 context 3's review record by §7 and stone 11; R2's phone by stone 4.
