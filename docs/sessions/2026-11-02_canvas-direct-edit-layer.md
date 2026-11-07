# Handover: the canvas editing layer on Puck (2026-11-02)

One session built a direct-editing layer that sits on Puck, from a brief that kept moving as the developer tried it.
This file is meant to be enough to continue. Labels: **verified** (how), **assumed**, **unknown**. Nothing from this
session is committed. Companion doc with per-slice detail: `docs/open/CANVAS_FRAMEWORK_2026-11-02.md`. Read this file
first; read that one for specifics.

**The next agent's scope, set by the developer when this session ended:** continue on Puck and on coordinating live
components (React components), including things like the surface UI. Section 8 has the starting point and section 10 the
technical seams. A rebuild, so everything can be tried signed in on the real site, is still open and is theirs to run
(see "What the permission system refused").

## 1. What the developer is after

### The goal, in their terms
A direct-editing experience for non-technical people, modelled on the claude.ai design canvas, that "walks a line
between GrapesJS, Puck (React) and canvas editing". In their words at various points:

- "a visual layer of editing, doesn't need to perfectly correspond with actuality"
- "direct ux ... direct editing for nontechnical. declared sections make sense"
- "a custom layer on puck to sort of emulate grapejs, while also giving it the live editing touch"
- "one bit at a time, firmly good foundation stones"
- "we're effectively creating an in window editor for [Puck], such that it can be edited either way. a series band
  may be dropped in looking a certain way, but the css html could be changed. its like a puck screen mcp perhaps"
- "this is custom layer on puck so your work on it was probably valuable to the ultimate end"

Puck stays as storage, block catalogue and published renderer. The editor on top is ours. Do not spend effort keeping
Puck's own editor polished ("dont worry about maintain puck as it is"), but do not throw away the Puck data format.

### Guardrails they have set
- Out of scope here: a platform-wide block and template catalogue (saving a block is fine; it may graduate later).
- Freedom levels (Family / Borrow / Free) were for classifieds only. Do not build on them for sites.
- They do not care about the classifieds page being reproduced. It was only an example to get the canvas open so
  they could show its UI. The target is the UI and the way boxes work, not that page.
- Silex itself is not a concern; GrapesJS is the reference for what Puck lacks.
- The board (sticky notes, free objects) is for org admins and owners on their own sites. Free objects should remember
  where they were created, can later be inserted into a published page, and have a submit-for-developer-review option.
- Two ways in: an edit button on the live page, and a dedicated edit suite. Both should exist.
- A developer space for prototyping and cataloguing components is wanted eventually; separate work
  (`docs/open/DEV_SPACE_PROPOSAL_2026-11-02.md`, recommends a LAN-only `apps/lab` on 3022; not started).
- Scope creep goes to a separate agent, not into the current stone.

### How to work with this developer
- Their messages are stream-of-thought and often arrive mid-task ("my mad ramblings you must endure"). Pull out the
  concrete request; treat the rest as direction. They think aloud and refine; a later message can soften an earlier
  one, as "don't worry about Puck" was followed by "well this is a custom layer on puck".
- "up to how you see it" means decide and go. They want implementing, not repeated option lists. End a stone with a
  short report and one choice, and recommend one.
- They test by hand on the private test page and report what felt wrong. That feedback is the real signal: it caught
  the thin bar, the small bar's look, the right-click scrolling, and how hard live parts are to fit.
- **Compare against their screenshots literally.** They asked for "the exact same options and look" and said twice
  that a thing had not been copied. Crop and read the images before building a UI piece. Do not approximate.
- A UI piece is not done until you have looked at a screenshot of it. Several real bugs were found this way.
- Report in plain words. Say what was and was not tested. Neutral register (`.claude/rules/01-writing-register.md`).

## 2. What the canvas is (read from their images)

Reference images are in `packages/direct-edit/harness/reference/` (their 19 screenshots plus crops of the toolbars from
their videos). Originals, including the two short videos: `~/.claude/uploads/8dfe43f1-5fe0-4a50-8e65-baa945ab489c/`.
File names describe what each shows, e.g. `textofrowlayer4.png`, `cursermenuonclickingboxshowingheadingthemeoptions.png`.

The central finding: **the canvas has no blocks. It has one tree of boxes from the page down to a bold word, and every
box is edited the same way.**
- Names are derived from tag and layout: `<div>` flex column is Column, flex is Row, grid is Grid; `<header>`, `<nav>`,
  `<section>` name themselves. The hint is first words, aria-label, `#id` or `.class`.
- Layout is a property of any box (Block / Stack / Grid). Style cascades: type set on a Row is inherited by its Text.
- The Code tab shows the tree above, then the box's declarations, then "From `<div>`" groups of what it inherits, each
  with "+" to adopt. Elements keep `@class`, `@id`, `@href`, `@aria-label`.
- The panel depends on context: a grid child gets Column and Row span, a stack child gets Grow and Offset.
- Free objects (their oval and title) sit beside the artboard in the tree, not in it. Two layers: page and board. The
  developer noticed they do not become page structure.
- Their video of a border drag "only expands to right": a box is anchored top-left. We deliberately do not copy that:
  no left or top resize handles; the top-left corner is decorative.

## 3. Architecture as built

All in `packages/direct-edit` (plain DOM except `src/puck/`), source-exported, no build step.

| Piece | File | What it does |
|---|---|---|
| Layers from any DOM | `canvas/layers.ts` | Collapses wrappers, keeps inline marks in text, names boxes, `selectorFor`, `readLayers`. Markers `data-edit-section`, `data-edit-name`, `data-edit-atom`, `data-edit-skip` |
| Click-through | `canvas/clickthrough.ts` | Outermost first, each click reveals the next level, Esc up, Enter in, Alt+click deepest, right-click menu, handles, press-drag. Takes a `LayerSource`, so it runs on DOM or on the tree |
| Style-only edits | `block/patch.ts`, `canvas/visual-editor.ts` | Edits as one stylesheet by structural selector. Used for the small bar that is live now. Other pages can still use it; it has pills but no thin bar |
| Tree operations | `block/puck-tree.ts` | Pure functions on Puck JSON: find, move across slots, wrap, unwrap, duplicate, `cleanBoxDoc`, `mayPlace` |
| Box blocks | `puck/blocks.tsx` | `box`, `words`, `picture`, `part` (ordinary Puck blocks) and `BOX_ROOT`. Look in `props.look`. `cls`, `anchor`, `label`, `href`, `comment` |
| Editor canvas | `puck/TreeCanvas.tsx` | Draws a doc with the published components, marks `data-tree-node` and `data-tree-slot`. Editor only; Puck's `Render` still publishes |
| Tree editor | `canvas/tree-editor.ts` | The editor itself: panel context, From groups, Code sheet, drag between boxes, tools, thin bar wiring, hand, zoom, preview, Detach |
| Chrome | `canvas/edit-shell.ts`, `canvas/minibar.ts`, `panel/panel.ts`, `canvas/menu.ts`, `canvas/box-panel.ts` | Pills and save; the thin bar; the shared right panel; menu with rows that open in place; which fields a box gets |
| Detach | `canvas/adopt.ts` | Rendered HTML into nodes, keeping tag, class, inline style. Used for blocks and for converting code-built pages |
| Open a page | `puck/open-page.ts`, `puck/mount.ts` | `openPageAsTree`: convert or load, snapshot live parts, hide the page, mount the editor |

**Why this holds together.** A page is still Puck's `{ root, content }` in `site_config` `puck:<slug>`. A box is a block
with a slot, so moving between boxes is moving items between slot arrays. Published pages use Puck's `<Render>`.
Verified: editor and published drawing match element for element, and Puck's own editor opened a moved document.

**Sealed things.** Any non-own block is a sealed node: it moves like a box. Detach opens it into boxes. A `part` is a live
piece of a code-built page: named in the document, drawn by the page, not detachable.

**Keeping the look when converting.** Classes and inline styles are kept and the site's stylesheet still applies, as the
canvas does (its `@class`). Computed styles are not copied, because that would lose responsive rules.

## 4. Where it is wired

`apps/innergathering`:
- `src/app/page.tsx`: nine live parts in a `parts` map, each root with `data-landing-part`: hero-actions, offerings,
  login-banner, gallery, join, forum, fundraising-progress, fundraising-status, board-list. If `puck:landing` exists the
  page renders it with those parts through `metadata`; otherwise the coded page.
- `src/components/landing/EditPageButton.tsx`, `page-editor-mount.ts`, `page-picture-chooser.tsx`.
- `src/lib/puck/landing.ts` (`LANDING_SLUG`), `actions.ts` (`savePageAction` runs `cleanBoxDoc`; `restoreLandingAction`),
  `store.ts` (`deletePage`), `config.client.ts` (`canvasConfig`, `puckConfig`), `config.server.ts`.
- `src/app/studio/[slug]/canvas/page.tsx` + `components/studio/CanvasEditor.tsx`: the editor on any Puck page.
- `/p/landing` and `/studio/landing` redirect home; `/studio` hides it.
- `src/lib/page-edits.ts`, `page-edits-actions.ts`: the old style-only path, still read by the coded page.

No other app uses any of this yet. Adding it to another host: add `@elkdonis/direct-edit` and `@elkdonis/fonts` to its
`transpilePackages` and dependencies, `blocks: [...SHARED_BLOCKS, ...BOX_BLOCKS]`, `root: BOX_ROOT`.

Shared-code side effects to know about:
- `safeDecls` allow-list widened to layout, custom properties and `position: relative|static`; `BOUNDS` widened for whole
  pages. Both also widen what classifieds accepts.
- `direct-edit` no longer depends on `page-builder`; `contrastRatio` is duplicated in `model/color.ts` on purpose.
- `MiniBar` is shared, so the classifieds and cards editors got the new look. `deeperIn` now takes `holds` and they start
  with nothing selected. Their Windows test suites were not rerun.

## 5. State on 2026-11-02

Live:
- elkdonis-arts.org runs an **earlier** build: click-through and the small bar on nine declared sections. **Verified**
  edge markup. **Verified** the developer saved through it: production `site_config` `page-edits:home` holds hero fill
  `#c60c0c`. Leave that row; the conversion carries it over.
- arts-collective runs pass 3 of the classifieds and cards editors (earlier handover
  `docs/sessions/2026-11-02_direct-editing.md`).

Source only, in the working tree, uncommitted, not rebuilt: right panel, move and resize, picture chooser, right-click tools,
box tree, Code sheet, thin bar, pills, Detach, landing as a tree. Production has no `puck:landing` row (**verified**).

Private test page, real code with sample data: https://claude.ai/artifact/WzHAvvUd4tPGMqsvpfeaev (views: Landing page,
Classifieds, Any page, Feed cards, Old ad editor). Saves stay in the page. Pictures use a pasted address because it has no
storage. The source is the harness below. The developer's main way of trying things: republish after each stone.

Testing: **verified** in an isolated browser with no DB writes: `drive` 43, `drive4` 39, `drive5` 14, `drive6` 35, `drive7`
18, `drive8` 29, `drive9` 54, `drive10` 46, `drive11` 56, `drive12` 20. check-types 0 in direct-edit, innergathering,
arts-collective. Real Next app, preview only: `/` 200 with nine parts, `/studio/try-it/canvas` 307, `/p/try-it` 200, `/p/landing`
307; stored tree rendered through a test page bound over `/data`: all parts, moved heading, red hero, no editor markers, no errors.

**Not verified, in order of risk:**
1. Opening the tree editor signed in on the real app, a real tree save, and Restore. The picture chooser against real routes.
   The first rebuild will be the first run of all of it.
2. Resolver rows (feeds) in the canvas; touch input; Firefox and Safari; CSS `zoom` on a real page.
3. Classifieds suites from the Windows scratchpad after the bounds, allow-list, `deeperIn` and MiniBar changes.

Known small problems:
- The hero's scroll cue shows an "Empty box" label in the editor (an empty `<span>` without a class). Editor only.
- Saved tree loses the hero image's `srcset` (one size). Inline styled spans inside words lose their styling on conversion.
- A deleted live part can only come back through undo or Restore: Add does not offer parts.
- Phones have no right-click, so the menu opens only through the bar's More.
- Hint text sits in the middle and may overlap site nav (it has a backing now).

## 6. Rebuilding and what the permission system refused

Rebuild innergathering (the developer runs these; the auto-mode classifier refused me with [Production Deploy]):

```bash
cd ~/eac && mkdir -p ~/eac-backups/next && docker exec eac-innergathering sh -c 'cd /app/apps/innergathering && tar -czf - --exclude=.next/cache .next' > ~/eac-backups/next/innergathering-$(date +%Y%m%d-%H%M).tgz
```
```bash
docker exec eac-innergathering sh -c 'cd /app/apps/innergathering && NEXT_BUILD_CPUS=4 pnpm build'
```
```bash
cd ~/eac && docker compose up -d innergathering
```

A build deploys every uncommitted file it reaches, including other sessions' work in shared packages. Then check through the edge:
`curl -sk --resolve elkdonis-arts.org:30022:127.0.0.1 https://elkdonis-arts.org:30022/` and the logs. Tell the developer that
saving a tree freezes the hero, about, cities and vision copy against `/manage/pages` and the landing config, and that Restore goes back.

Also refused: creating a temporary owner or guide test account on the production DB ([Modify Shared Resources]; it worked once earlier,
then was refused). So signed-in tests need the developer. Do not work around either refusal.

`elkdonis_scratch` is not usable for rendering the home page: `eac_tenant` lacks grants there and it has little data (the server fell over).

## 7. Testing setup

`packages/direct-edit/harness/` (copied from the session scratchpad; bundles, the landing snapshot and CSS are not kept). It is outside
`tsconfig` `include`. To use it: pick a scratch folder `S`, copy the harness to `$S/h3`, `mkdir $S/h3/shots`, install the driver, set `S`:

```bash
docker run --rm -u 3003 -e HOME=/tmp -v "$S/h3:/h" -w /h node:24-alpine npm i --silent playwright-core@1.60.0
```
```bash
S=<scratch> sg docker -c "bash $S/h3/runall.sh drive11.cjs drive12.cjs"
```

- `hb.sh` bundles real source with esbuild in `eac-dev`. `runall.sh` runs each driver against a `zenika/alpine-chrome` container with
  `--network none`, driven through `--network container:<chrome>`. No site, no DB.
- 2026-11-04: `runall.sh` as stored failed with `invalid mode: /w`, because its volume argument was in single quotes and `${S:?...}` was not expanded. Repaired; it now stops with a message when `S` is unset. `/tmp` is mounted noexec, so run a script there as `bash script.sh`.
- Output lines are filtered by a grep in `runall.sh`; widen it when debugging. Screenshots go to `$S/h3/shots/`. Look at them.
- `tree.html` is a small document; `tree.html#classifieds` is the classifieds tree from `sample.ts`. `landing.html` needs `land.css`
  and `land-body.html` from `preview-snap.sh`, plus an assembly step: see `landing.ts`, and build it as doctype, the two stylesheets, the body, then `landing.js`.
  2026-11-04: `pack-test.cjs land <published.html>` writes `land-data.json`, `land.css`, `land-body.html`, `landing.html` and `snapshot.html` from a published copy of the test page, with no `next dev`. `drive5` needs `snapshot.html` and `drive12` needs `landing.html`.
- `preview-snap.sh`: throwaway `next dev` of innergathering, reads the production DB read-only, captures the landing HTML and CSS.
  `preview-tree.sh`: the same with `t-page.tsx` bound over `/data` to render a stored tree from a file. Both leave
  `apps/innergathering/next-env.d.ts` modified: `git checkout` it afterwards. `apps/innergathering/src/app/data/page.tsx` shows modified from
  someone else's earlier work; leave it.
- ~~The test page HTML is assembled by hand: `test.ts` bundle, `editor.css`, `blocks.css` and a JSON block of landing data inlined. Its
  wrapper lives in `$S/h3/click-through-test.html`, which was not copied; rebuild it per the Artifact tool's page rules, or ask for a simpler page.~~ Replaced 2026-11-04: `harness/test.html` is the wrapper, with placeholders for `editor.css`, `blocks.css`, the land data and `test.js`, and `pack-test.cjs page` fills it to `click-through-test.html`. It refuses an unescaped closing tag and a page over 16 MB. It joins cut pieces rather than using `String.replace`, because `$&` and `$'` in a bundle would be read as patterns.
- Added 2026-11-04 for stone 1: `view-blocks.html` and `view-blocks.ts` (standalone Blocks view for drivers, development React), `blocks-fixture.ts` (seed document, the contract, the test bar), `drive13.cjs` with `drive13-canvas.cjs` and `drive13-panel.cjs` (`ONLY=canvas` or `ONLY=panel` runs one). `smoke.cjs` now checks the assembled page, six views, and prints `pass N fail M`.
- Added 2026-11-04 for stone 2 (plan: `docs/open/canvas-synthesis-2026-11-02/5-build-plan-stone-2.md` sections 6 and 7): `walk.cjs` and `walk2.cjs` (stone 1's hand-test walkers, on the assembled page); `render-published.ts` and `.sh`, `compare-render.cjs` (what the published path draws, as bytes; baseline `~/eac-backups/direct-edit/baseline-render-stone2.json`, from the source in `direct-edit-stone2-base.tgz` beside it); `parity/` (no-contract comparison of baseline source against the tree, stone 1's 416 states and 36-step flow); `sunjay-extract.cjs` and `sunjay-banner.css` (pt-banner's rules from sunjay's served chunk, through the edge); `smoke-morph.ts`, `.html`, `.cjs` (hostile values, parts, cascade, spacing, hydration; `ONLY=<group>` runs one) and `smoke-morph.mutants.py` (removes one fix at a time on a scratch copy); `drive14.cjs` with `drive14-hand.cjs`, `-tools.cjs`, `-review.cjs` (the panel, tree and tools on a part); `walk3.cjs` (stone 2's hand test on the assembled page). The test page's overlay deselects when it opens and restores the selection on Close (2026-11-04).
- `blocks-fixture.ts` holds a harness-only block, "Test: breaks on purpose" (`test-throw`), offered in Add on the test page. It throws on every draw. The word `heal` in its one field lets it draw, `globalThis.__healed` does the same, and `globalThis.__lateThrow` makes it throw 60 ms after mounting.

To rebuild the test page. The land data (1.5 MB of captured landing HTML and CSS) is not in the repo; the published page is its durable copy. A reboot clears `/tmp`, scratch copies included:

```bash
# published.html: Artifact action "read" on the page URL names the saved file holding the full page; copy it to $S/h3/.
docker run --rm -u 3003 -v "$S/h3:/h" -w /h node:24-alpine node pack-test.cjs land published.html
docker run --rm -u 3003 --network none -v /mnt/pool1/home/guru/eac:/app:ro -v "$S:/w" --entrypoint sh eac-dev /w/h3/hb.sh
docker run --rm -u 3003 -v "$S/h3:/h" -w /h node:24-alpine node pack-test.cjs page
S=$S sg docker -c "bash $S/h3/runall.sh smoke.cjs"
```

Publishing needs the `artifact-design` skill and a `read` of the URL first; `$S/h3/click-through-test.html` is the file to publish. Plan section 11 (`docs/open/canvas-synthesis-2026-11-02/4-build-plan-stone-1.md`) has the steps. **2026-11-04: the stone 1 work has not published the page, so the URL does not show the Blocks view yet.**

Type checks need no running service: `docker run --rm -u 3003 --network none -e HOME=/tmp -v /mnt/pool1/home/guru/eac:/app:ro --entrypoint sh eac-dev -c 'cd /app/packages/direct-edit && ./node_modules/.bin/tsc --noEmit --incremental false'`. Importers to check after a direct-edit change: `apps/arts-collective`, `apps/innergathering`, `apps/elktours`. `packages/blocks` has 2 errors at `services/src/gather.ts:704,706` that predate this work (measured 2026-11-02 and 2026-11-04).

Traps that cost time here:
- `sed -i` or `python` inside an unquoted heredoc runs backticks as commands; a quoted heredoc leaves `\\\`` literal. Use the Edit tool for code with backticks.
- A `str.index` patch matched the first occurrence and cut a page in half. Prefer Edit with exact strings.
- `.reveal` is `opacity: 0` until a script adds `in-view`; snapshots and adoption must add it.
- Pictures start a native drag, which cancels the pointer; `dragstart` is prevented and every drag handles `pointercancel`.
- A cancelled drag leaves `class=""`, so selectors using `:not([class])` break.
- Redrawing a toolbar between press and release loses the click; `MiniBar` only replaces HTML when it changed.
- Puck's slot passes only `className`, `style`, `ref` to `as`, so attributes need the cached `tagWith` component.
- The panel's soft render replaces only `[data-sync]` nodes while a field has focus; anything new that appears mid-typing needs a stable `data-sync` placeholder. This also covers what changes because of the typing: a sealed block's Detach button sits in `[data-sync="block-actions"]` for that reason (2026-11-04).
- A page scroll closes an open menu by design (`canvas/menu.ts`), and Playwright's click scrolls first. Let the scroll land before a right-click in a driver, or the driver closes its own menu (2026-11-04, the first version of check C12).
- Sites set `scroll-behavior: smooth`; measure after `behavior: "instant"`.
- `scope.contains` plus a nested `display: contents` wrapper: a part's box is its first real element (`NodeMark` descends).

## 8. Next work, in the order I would take it

### Live component editor (the developer's last idea, not started)
They found live parts hard to fit to a page: "another popup that goes deeper into one live component at a time to custom it to the page,
and its save that way per page", "or a preview of the live features, where the right bar specifies exactly what live data to be put there or
how they conspire together when groups a badge, an rsvp".

Correction, 2026-11-02: "live features" means **the blocks offered under right-click > Add** (`SHARED_BLOCKS`: Feed, the happening/cancelled badge, Card, Picture wall, Gallery grid, Store shelf, and so on), which the developer added on the test page and could not fit. An earlier version of this section and my proposal read it as the landing page's nine parts and pointed at What's on. That was wrong as the starting point; the parts are the same problem, second.

Why those blocks were hard: once added a block is sealed. The panel offers only "Put it in a box" and "Detach", and on the test page there is no block editor link and no data, so a data block has no way to say what it shows.

What to build, as asked: a deeper editor for one block at a time, in a popup, showing it with real or preview data, where the right panel says exactly what live data goes where and how grouped pieces (a badge, an RSVP) work together, saved per page. **Confirm this reading with the developer before coding, in one short question.** Nothing here has been designed with them yet.

Starting points: each block's `PropDef`s (`packages/blocks/src/types.ts`, `toPuckFields`) give the fields; `resolveData` resolvers give the data; a preview needs sample rows (`sample()` exists, not used in the canvas). The feed-card work has bindings (`block/bind.ts` `{{tokens}}`, "Comes from", `lib/cards/`). There is no RSVP block in `SHARED_BLOCKS` (RSVP lives in `apps/innergathering/src/components/landing/OfferingsBand.tsx`), so "live controls" need a decision. Store per-page settings on the node in the page document. Do not build a catalogue.

### Then
- Fields for sealed blocks in the panel, which removes the last reason to open Puck's editor (`toPuckFields`, `PropDef`). Rows and images need the most care.
- The board: free objects beside the page, `{ anchor, dx, dy }` memory, submit for review. Tools are already shown disabled in the pill.
- Tweaks tab and `{{paper}}`-style variables (their Code screenshots show `background: {{paper}}`).
- Styles on inline runs (`<b>` with its own letter-spacing), class names editable, Add offering removed parts.
- Other hosts, then a page-level Edit button elsewhere. Live edit declared sections on pages not converted to a tree still use `mountVisualEditor`; decide whether to retire it.

### Open questions for the developer
- Who may convert or restructure: owners and guides today.
- Whether a tree save should go through a draft and publish step: saves are public at once. Versions (`page_revisions`, Phase 4 of the older plan) are not built.
- What should keep following `/manage/pages` after conversion, e.g. hero words bound to their fields instead of frozen. Bindings could solve this; not built.

## 10. Coordinating live React components: the seams

The hard part of the next scope is that the editor is plain DOM around React that was not written to be edited. As built on 2026-11-02:

- **Three kinds of thing can be on a page.** Own blocks (`box`, `words`, `picture`): fully editable. Shared Puck blocks: drawn live by React in the canvas, sealed, moved as one; Detach freezes them. Page parts (`part`): server-rendered by the page, shown in the canvas as a static HTML snapshot, not hydrated.
- **Clicks are captured.** `clickthrough.ts` stops clicks inside the canvas, so no live control works while editing. Preview also holds clicks, so it does not exercise them either. A deeper editor needs a way to let a component's own controls run.
- **Two data paths.** A block's rows come from `resolveData`: browser resolvers over HTTP in the editor (`lib/puck/config.client.ts`), database resolvers when published (`config.server.ts`). `mount.ts` takes resolved props separately and never saves them; only innergathering's `CanvasEditor` fills them; the test page has none, so data blocks draw empty there. `sample()` exists on blocks and is not used by the canvas.
- **Server-only parts cannot render in the client canvas.** That is why parts are snapshots. Anything needing live data in an editor needs a client path or an endpoint.
- **Interactive blocks** have the `puck` prop stripped (`page-builder/src/config.tsx`), because functions cannot cross into client components. Slot `as` components and `metadata.parts` work only because those paths are server components: **verified** for a stored tree in the real app with test parts; **not verified** with real interactive parts in a stored tree.
- **Fields.** `toPuckFields` and `PropDef` declare every block's settings. The panel does not read them yet; `rows`, `image` and `slot` kinds need the most care. `permissions.insert` hides non-member-safe blocks from Add.

Surface UI (`packages/cms-ui/src/surface/`): **not read in this session.** What is known comes from `.claude/rules/areas/css-ui.md`: a popup is a descriptor in `surface/types.ts`, a surface in `surface/surfaces/`, cases in `SurfaceRouter.tsx` and `url.ts`, and a host connector; do not add another dialog or modal primitive, because the one-dialog system replaced four. `.eac-face-live` is for a control inside a face, never a whole preview. Grep every path through `SurfaceCard` when adding a capability. So a deeper block editor in a popup should be checked against this rule first; the editor's own drawer, bar and pills are not surfaces. Memory: `project_surface_system.md`. Start with `/orient frontend-ui`.

## 9. Other documents

- `docs/open/CANVAS_FRAMEWORK_2026-11-02.md`: guardrails, per-slice progress and verification. Its long proposal section lower down predates the guardrails; they win.
- `docs/open/DIRECT_EDITING_PANEL_PLAN_2026-11-01.md`, `DIRECT_EDITING_LAYER_2026-11-01.md`: the earlier plan and first canvas teardown. Direction moved on; its panel gap list is still useful.
- `docs/sessions/2026-11-02_direct-editing.md`: passes 1 to 3, tenancy, fonts, feed cards.
- `docs/open/DEV_SPACE_PROPOSAL_2026-11-02.md`, `docs/open/SILEX_PUCK_SURVEY_2026-10-04.md`.
- `CLAUDE.md` "Canvas framework" line carries the one-paragraph status. Keep it current.
