# Plan: canvas-grade direct editing over EAC blocks

2026-11-02: direction and next work moved to `CANVAS_FRAMEWORK_2026-11-02.md`; freedom levels apply to classifieds only (developer).

For the agent picking this up. Read the Context first: it says why, and what not
to lose. The direction is firm; the steps leave room to experiment.

## Context

**Why this exists.** EAC (Elkdonis Arts Collective, monorepo `~/eac` on eris)
gives member orgs editable websites. Today editing is Puck: select a whole block,
fill a form. Justin finds that obtuse. On 2026-11-01 he recorded himself editing
a classifieds design on the claude.ai design canvas (`C:\Users\Justi\Videos\canvas
on claude.mp4`, 153 s) and asked us to study it: that canvas is the editing feel
he wants members to have. Click straight on the page, step into nested boxes,
and get a right-hand panel with the full range of controls: sizing, padding,
fonts (many), font sizes, alignment of boxes and of text, colours, borders,
effects, and boxes that can break across grid columns.

**What we keep that the canvas does not.** The canvas stores free HTML with
inline styles. That is the Silex/GrapesJS model: pages cannot be re-themed or
reused, and freely placed elements break on phones. EAC's practice is to
generalise new things for everyone. So the panel must look and feel like the
canvas while every edit lands as *block data*: `{ template, overrides, link }`,
derived from a style family and a template. Improving a template improves every
page built from it.

**Justin's direction (his words, condensed).**
- The right side bar is the priority: mature, robust, fleshed out, the full range
  of editing, each field offering its full controls.
- Fonts: as many as we can get right away, plus a shared library "we as a group
  feed into over time".
- Blocks will become org-specific: block templates, structural pattern blocks,
  multi-layered blocks per organisation. These go *under review* to be promoted
  into generalised templates or blocks.
- Not every edit must be canonical immediately. Versioning is welcome, and it is
  what lets us move closer to what the canvas provides.
- Open-ended: keep experimenting with how we fill this niche.

**What already exists (built 2026-11-01, source only, not deployed).**
- Prototype: https://claude.ai/artifact/2RjNrmiF7zYFAF2k3UCJkB (classifieds ads,
  click-deeper selection, constrained style slots, freedom levels Family /
  Borrow / Free, graft, resize, inline text, "what gets saved" panel).
- Real feature in `apps/arts-collective`: org classifieds page
  `<org>.arts-collective.com/classifieds`, editor `/hub/sites/<slug>/classifieds`.
  Files: `src/lib/classifieds/{catalog.ts, editor-engine.ts, store.ts,
  actions.ts}`, `src/components/classifieds/{ClassifiedSheet.tsx,
  ClassifiedsEditor.tsx, classifieds.css}`, pages under
  `src/app/sites/[slug]/classifieds/` and `src/app/hub/sites/[slug]/classifieds/`.
  Stored in `site_config` key `classifieds:page` through `withOrg`.
- Plan and canvas teardown: `docs/open/DIRECT_EDITING_LAYER_2026-11-01.md`
  (read its "Reference: the claude.ai design canvas" section; this plan extends it).
- Tenancy floor (same day): `withOrg(orgId, fn)` in `@elkdonis/db`
  (`packages/db/src/tenant.ts`), RLS migration 227, session verification
  (`packages/auth-server/src/verify-session.ts`). Use `withOrg` for every
  org-scoped read/write you add.

## Reuse, don't rebuild (found in the codebase)

- **Block style controls**: `packages/page-builder/src/style/schema.ts` (the
  `blkStyle` prop: padding X/Y, margins, max width, align, min height, background
  + opacity, text colour, border width/style/colour/sides, radius steps, shadow,
  hide on mobile/desktop, custom CSS; `COLOR_TOKENS` :32, `STYLE_PRESETS` :358,
  `contrastRatio` :396). Panel UI `style/field.tsx:206`, render `style/wrap.tsx`.
  It has no font fields. Reuse `contrastRatio` for the live contrast check.
- **Field controls**: `packages/page-builder/src/fields/color-field.tsx`,
  `size-field.tsx`, `image-field.tsx`.
- **Canvas helpers inside Puck**: `drag/item-focus.tsx` (click a marked item to
  open only its fields; rectangle hit-testing) and `drag/canvas-menu.tsx`
  (right-click: duplicate, delete, move, add above/below/inside, select parent;
  quick-add on empty space). Generalise these rather than writing new ones.
- **Part markers**: `packages/blocks/src/edit-item.ts` (`editItem(prop, key)` →
  `data-edit-item`). The direct-edit "part" marker should be its sibling.
- **Block registry**: `defineBlock` / `createCatalogue`
  (`packages/blocks/src/registry.ts:40,81`); the comment at :57 already expects
  `createCatalogue([...shared, ...orgBlocks])`. Block defs already carry
  `manipulate` and `resize` (`types.ts:241`).
- **Templates**: `PageTemplate` / `TemplateNode` (`packages/blocks/src/templates/
  store.ts:17`), `templateDocument()` (`templates/person.ts:102`), Templates tab
  (`page-builder/src/templates/templates-plugin.tsx`). All hard-coded today.
- **Fonts**: no shared library anywhere. Best existing pattern:
  `apps/danamccool/src/lib/fonts.ts` (`FontChoice {id,label,stack,google,kind}`,
  `FONT_ROLES` body/heading/nav/caption/reading, `fontVars()` → CSS vars, a Google
  CSS URL builder; saved in `site_config` `theme:fonts`). Block font hooks exist:
  `--blk-font-title`, `--blk-font-body` in `packages/blocks/src/blocks.css:41-106`.
  `packages/tokens` already expands DTCG typography tokens into font vars.
- **Themes**: `site_themes(org_id, page_key, vars jsonb)` resolved by
  `packages/services/src/themes.ts` (`resolveTheme` :79, `renderThemeCss` :176),
  emitted by `ThemeStyle`. Note `VALUE_RE` (:33) rejects quotes, so a font stack
  like `"Source Sans 3", sans-serif` cannot be stored yet; fix that first.
- **Versioning precedent**: `lms_course_versions` / `lms_step_versions` with
  `published_version_id` (`packages/lms/src/authoring.ts`); also
  `thread_revisions`, `wiki_revisions`.
- **Review precedent**: `packages/services/src/user-pages.ts`
  (`submitUserPage` :96, `listPendingUserPages` :118, `reviewUserPage` :145) over
  `user_pages.status` draft/pending/published/archived.
- **Capabilities**: no `org_capabilities`; `org_grants(org_id, capability)` exists
  but a CHECK allows only `nextcloud_access` (migration 139).
- **Pages today**: org Puck pages live in `site_config` `puck:<slug>` (39 rows),
  overwritten on save with no history (`page-builder/src/store.ts:99`).

## What the canvas does (the target, observed frame by frame)

Panel tabs: **Properties · Code · Tweaks**. Properties, in order:

1. **Layer tree** around the selection. Rows named role + text: Heading,
   Paragraph, Text, Row / Column (flex by direction), Grid `.pair` (class), Column
   `#for-sale` (id), Section "First page of ads" (label), group. Eye toggles
   visibility; a link glyph marks anchors.
2. **Align row**: left / centre / right / top / middle / bottom (within parent).
3. **Size**: Width and Height, each with a mode (Hug; presumably Fill, Fixed).
   Position Inline / Absolute (+ Offset X, Y). Grow. **When the parent is a grid:
   Column span and Row span.** That is "break through columns".
4. **Layout** (containers): Block / Stack (/ Grid). Direction row / column +
   wrap toggle. Align: a 3+3 icon set that changes with direction. Gap ("Mixed"
   when children differ). Padding one value or per side (toggle); Margin.
5. **Link**: destination.
6. **Text**: Text style (document scale "Heading 2…15", "Caption"; any change
   makes it "Custom"). Font: searchable dropdown, group "In this design", each
   name drawn in its own face. Weight, Size, Spacing (line-height + letter
   spacing), Colour with live **Good / Poor contrast**, Align left / centre /
   right / justify.
7. **Appearance**: Fill, Opacity, Radius (one or per corner), Border style
   none / solid / dashed / dotted + colour + width.
8. **Effects** (+): Layer blur, Background blur, Transform (X, Y, rotate,
   scale X / Y).
9. **Export**, **Advanced**: z-index, overflow x/y, cursor, pointer-events,
   object-fit, white-space, text-overflow, text-decoration, box-sizing,
   aspect-ratio, transition, animation.
10. **Debug**: node record `{tid, tag, parent, attrs, style}`.

Cross-cutting details: a **reset arrow** appears beside any field changed from
the original. Colour picker has **Theme** (colours used in the design) and
**Custom** tabs. **Code** tab lists the element's written declarations, editable.
Canvas: floating text toolbar (style, colour, B/I/U, link, list, align, comment,
more); hover and selection outlines; edge handles and a mid-edge grabber; drag
with an insertion line to reorder or drop into another container; Text tool
drops an absolutely placed "Your text here"; unsaved dot beside the title; the
frame reloads after some edits.

Inferred mechanics: elements get tracking ids; the panel reads
`getComputedStyle` and writes declarations onto the node; text styles are the
distinct (font, size, weight, line-height) sets ranked by size; contrast walks
up to the first opaque background (WCAG ratio).

## Direction (non-negotiable)

1. Canvas-grade panel and canvas interactions.
2. Edits stored as block data, never as free HTML.
3. Constraint is a dial, not a wall: freedom levels (Family / Borrow / Free)
   decide which values a control offers; out-of-range values are flagged amber
   with "Snap to family", never silently changed.
4. Shared, growing libraries (fonts, palettes, templates) that the group curates.
5. Versions and review instead of instant canonical edits.

## Work plan

Phases are ordered; inside each, experiment freely. Ship each phase behind the
classifieds editor first, then generalise.

### Phase 1. Extract a reusable panel: `packages/direct-edit`
Lift the engine out of `apps/arts-collective/src/lib/classifieds/editor-engine.ts`
into a package (source-exported like `@elkdonis/services`), split into:
- `model/`: node registry over block parts (`data-part`, `data-ad` today;
  generalise to `data-node` ids), selection path, history (undo/redo with
  coalescing, already in the engine), dirty tracking.
- `panel/`: one section component per canvas section above (Size, Layout,
  Text, Appearance, Effects, Advanced, Link, Code). Each control declares the
  property it edits and reads its allowed values from a **slot schema** (below).
- `canvas/`: overlay (hover / selection boxes, handles, grip), click-deeper,
  inline text, wheel shortcuts, drag-reorder with insertion line.
- Keep it framework-light (the engine is plain DOM today, mounted by a thin React
  wrapper). Decide React vs plain DOM for panel sections early; React is fine if
  it stays outside Puck's render tree.

**Slot schema.** Today `SLOTS` and `allowed()` live in the engine. Promote them
to data per block part: `parts: { title: { text: true, size: [13, 26], font:
"display" }, frame: { box: true, span: true } }`, resolved against the family and
the freedom level. The panel shows only sections a part declares, so a member
never sees "z-index" on an ad title unless the org is at Free.

### Phase 2. Fill out every section to canvas parity
Map each canvas control to block data:
- Size: Hug / Fill / Fixed map to grid span (Fill = full row; "break through
  columns"); Column span / Row span shown when the parent is the 6-column sheet.
  Absolute position only at Free.
- Layout: for multi-layer blocks (Phase 4), Stack direction, wrap, align, gap,
  padding per side, margin.
- Text: text-style presets = the family's type scale (title, body, caption…),
  "Custom" after any edit; font, weight, size, line-height, letter-spacing,
  colour, align incl. justify; live contrast against the resolved background
  (`contrastRatio` in `style/schema.ts`). Precedent for per-block text style:
  `apps/danamccool/src/lib/puck/text-style.tsx` (font role or face, weight,
  case, tracking, italic).
- Box styling for Puck blocks: map panel sections onto the existing `blkStyle`
  fields first (padding, margins, background, border, radius, shadow), adding
  only what is missing (fonts, per-side padding, per-corner radius, effects).
- Appearance: fill, opacity, radius per corner, border style / colour / width.
- Effects: blur, backdrop blur, transform; Free level only at first.
- Advanced and Code tab: write to the part's sanitised `css` override
  (`safeDecls` allow-list in `catalog.ts`); Code shows the part's effective
  declarations, editable at Free.
- Reset arrow per field (compare against template value, which the engine
  already computes in `setPart`).
- Colour picker: Theme tab = family inks + org theme colours + colours in use;
  Custom tab = hex.

### Phase 3. Font library
- First fix `VALUE_RE` in `packages/services/src/themes.ts` so quoted font
  stacks can be stored (keep it strict otherwise: no `url(`, no `;`, no braces).
- Generalise danamccool's `FontChoice` / `FONT_ROLES` / `fontVars()` into a shared
  package (e.g. `packages/fonts`), feeding `--blk-font-title` / `--blk-font-body`
  and the classifieds part styles.
- A `fonts` catalogue: start with a large curated Google Fonts list (hundreds,
  grouped: serif, sans, display, mono, script, blackletter), each entry `{family,
  category, weights, italics, source}`. Load on demand (only fonts used on a page
  ship to visitors; the picker previews lazily).
- Group-curated growth: a DB table (e.g. `font_library`: family, category,
  source `google|upload`, file refs in Nextcloud, added_by, status
  `proposed|approved`), so members propose fonts and admins approve. Uploaded
  font files need a licence field.
- Picker UX like the canvas: search, "In this page" group first, then "Family"
  (style family's fonts), then the library by category; each name in its face.
- Freedom level decides which groups are offered.

### Phase 4. Org blocks, patterns, versions, review
- **Versioned documents.** Follow the `lms_course_versions` /
  `published_version_id` pattern: e.g. `page_revisions(org_id, page_key, rev, doc
  jsonb, author, created_at, note)` plus a published pointer. Autosave drafts as
  revisions; Publish moves the pointer. History panel: list, preview, restore.
  Apply to classifieds first, then Puck pages (`puck:<slug>`, today overwritten).
  Add the new tables to the RLS policy set (migration 227 pattern, `withOrg`).
- **Org templates / patterns.** "Save as template" (exists, stored inside the doc)
  becomes an org-level table (`org_blocks`: org_id, kind `template|pattern`,
  name, doc, base template, version). Multi-layered blocks = a pattern containing
  nested parts / child blocks (Stack layouts from Phase 2).
- **Promotion.** An org template can be submitted for review; reviewers see it
  side by side with the base, comment, and approve into the network catalogue
  (`BASE_TEMPLATES` and the TS `PageTemplate` sets become data). Reuse the
  `user-pages.ts` submit / list pending / review flow and status values. Record
  provenance (org, revision). Org blocks join catalogues via
  `createCatalogue([...shared, ...orgBlocks])`. Who reviews is open (ask Justin).
- **Freedom level per org**: needs a home. Either a new `org_capabilities` table
  (key + jsonb config) or widen `org_grants`' CHECK. Prefer the new table; the
  one-app review (decision 5) already calls for it.

### Phase 5. Generalise beyond classifieds
- Mount the same panel inside Puck (overrides `iframe` for the overlay, `fields`
  for the panel; `drag/item-focus.tsx` already proves one level of click-deeper
  inside Puck) so org landing pages get it.
- ArtDirect classifieds (13 families, 155 templates in
  `apps/artdirect/src/classifieds/`) as the richer family source.

## Open questions for Justin (ask, don't assume)
- Default freedom level for members; whether Free (raw CSS, absolute) is ever for
  members or only admins.
- Who reviews promotions (admins, a council of orgs, Justin).
- Font uploads: allowed, and with what licence check.
- How long drafts and revisions are kept.

## Constraints and house rules
- eris: `ssh eris`; no node on host, run tooling in a container
  (`sudo -n docker exec -w /app/<path> eac-admin …`). Migrations allowed any time
  (`packages/db`, `node scripts/migrate.mjs`), next number after 227.
- Do not rebuild or restart production containers without Justin; another
  session (Studio) edits `packages/services`, `studio`, `reels`. Production apps
  only change on rebuild (`docs/reference/ops.md`).
- Never commit unless asked. Keep the CLAUDE.md status section current.
- Type-check with `pnpm -s check-types` in the workspace you touch.

## Verification (each phase)
- `check-types` clean for touched workspaces.
- Engine and panel: esbuild a harness page (as done 2026-11-01: bundle the engine
  with a sample doc and a fake `onSave`) and drive it with Playwright: select,
  click deeper, change every control, undo/redo, resize, reorder, save; assert
  the saved doc passes `cleanDoc` and matches expectations.
- Rendering: a temporary dev container of arts-collective on a spare port
  (`docker compose run -d --rm --no-deps --name <x> -p 127.0.0.1:3998:3007 -e
  NODE_ENV=development … next dev`), seed a test org (`testerhrheh`), curl the
  subdomain page with a `Host:` header, then remove the seed and the container.
- Visual: one screenshot of editor and public page per phase, compared with the
  canvas frames listed in the teardown.
- Versioning: create, autosave, publish, restore; RLS check that another org's
  revisions are invisible under `withOrg`.

## Progress

### 2026-11-01: Phases 1 and 2, start of Phase 3 (source only, not deployed, not committed)

**Phase 1: `packages/direct-edit`** (source-exported; in arts-collective's
dependencies and `transpilePackages`). Plain DOM, no React, so it can later sit
outside Puck's render tree.
- `model/`: `schema.ts` (slot schema: `SlotSpec` per part with offers at Family /
  Borrow / Free, `resolveSlots`, `fits`, `outsideKeys`), `nodes.ts` (`data-node` /
  `data-part` markers, hit test, click-deeper, up), `history.ts` (undo / redo
  with coalescing, dirty tracking), `css.ts` (one property inside the raw `css`
  override; dropped declarations), `color.ts` (hex helpers; contrast verdict
  over page-builder's `contrastRatio`, exposed as the new subpath export
  `@elkdonis/page-builder/style/schema`, which has no Puck import).
- `panel/`: the right-hand panel, tabs Properties · Code · Saved.
- `canvas/`: overlay (hover / selection boxes, tag, edge handles, grips),
  click-deeper and hover binding, inline text, wheel shortcuts, grid-span resize,
  ghost drags (graft; move with an insertion line).
- `direct-edit.css` (`de-` prefix).
- The classifieds editor (`lib/classifieds/editor-engine.ts`) is now a thin host
  over the package. Its hard-coded `SLOTS` / `allowed()` became data in
  `lib/classifieds/schema.ts` (`PART_SCHEMA`).

**Phase 2: panel at canvas parity for classifieds parts.**
- Sections in canvas order: Layers (selected ad and its parts, role names such as
  Heading / Paragraph / Text plus first words; eye hides a part, link glyph),
  Align row (place in the ad; vertical place), Size (ad: Width Hug / Fill / Fixed,
  Column span, Height Hug / Fixed, Row span; part: Width Hug / Fill, Grow,
  Position Inline / Absolute and Offset X / Y at Free), Layout (padding, one value
  or per side; ad gap and distribute), Link (thread or web page), Text (text style
  from the family's type scale plus "In this page", "Custom" after edits; font;
  weight; size; line height; letter spacing; colour with live Good / Poor
  contrast against the resolved background; case; italic; align incl. justify;
  the words), Appearance (family, rule, tone, ink for the ad; header style; fill;
  opacity; radius one or per corner; border style / colour / width), Effects
  (layer blur, background blur, move X / Y, rotate, scale X / Y; Free only,
  collapsed by default) and Advanced (z-index, overflow, white-space,
  text-overflow, decoration, word-break, hyphens, blend, shadows, cursor: each
  writes one property of the sanitised `css` override).
- Code tab: the part's written declarations plus "Your CSS" (editable at Free);
  what the sanitiser drops is listed ("Not kept: …"), and the doc stores only
  what the server keeps. Saved tab: the stored record.
- Reset arrow beside every overridden field; values outside the level are
  flagged amber ("outside"), with a "N settings outside … Snap to family" banner;
  nothing is clamped to a level's range (only to the server's hard bounds).
- Colour picker: Theme (family inks, paper, white, every family's inks, colours
  in use) and Custom (picker + hex; offered at Free, gated with a note below).
- Font picker: search, "In this page" first, then Family, Other families
  (Borrow), then the whole library by category (Free); each name drawn in its
  face, previews loaded lazily as they scroll into view.
- Typing in a number / hex / text field never loses focus: the panel re-renders
  every row except the focused one, so reset arrows, flags and contrast update
  live.
- New override fields are validated server-side: `PartStyle`, `cleanStyle`
  (`BOUNDS`, `WEIGHTS` 100-900, quads for padding / radius, any library font)
  and `safeDecls` (wider allow-list, still no `url(` / `image-set` / `@import`).
  `partDecls` / `frameDecls` render them; the public sheet hides hidden parts.

**Phase 3 (start).**
- `packages/services/src/themes.ts` `VALUE_RE` accepts quotes (each kind
  balanced) so a font stack like `"Source Sans 3", sans-serif` can be stored;
  stricter otherwise: no line breaks, and no `url(` / `image(` / `image-set(` /
  `cross-fade(` / `element(` / `src(` / `expression(` (previously `url(...)`
  passed). The one `site_themes` row has no values affected.
- `packages/fonts`: `FONT_LIBRARY` (503 curated Google families: serif 120,
  sans 150, display 110, script 70, mono 35, blackletter 18; plus 8 system
  faces), each `{family, category, weights, italics, source}` generated from
  Google's metadata by `scripts/build-catalogue.mjs`; `fontStack`,
  `googleFontsHref` / `googleFamilyParam` (axes only from real weights), roles
  (`FontChoice`, `FONT_ROLES`, `fontVars`, `blockFontVars` feeding
  `--eac-block-font-title/body`), and a browser loader (`loadFont`,
  `previewFont`). The public classifieds page now ships only the fonts it uses
  (`classifiedsFontsHref`). danamccool keeps its own `fonts.ts` for now (its
  stored ids differ).

**Verification.** check-types 0 errors in fonts, direct-edit, page-builder and
arts-collective (services has 17 errors in other files, none in themes.ts).
esbuild harness of the real engine + panel with a fake `onSave`, driven by
Playwright (isolated Chromium): 64/64 checks (select, click deeper, Escape, every
panel section at each level, font search and on-demand load, theme / custom
colour, contrast Good / Poor, per-side padding and per-corner radius, effects,
advanced, Code tab drops, reset, undo / redo / Ctrl+Z, eye, span fields, edge
resize, drag-reorder, family switch, inline text, save); the saved doc passes
`cleanDoc` unchanged. The saved doc server-renders through the public
`ClassifiedSheet`, and every library entry's stylesheet URL returns 200 from
Google. No dev container or DB seed was used.

**Not done yet.** `font_library` table (proposals, uploads, approvals) and
Phase 4 (versions, org templates, review), which wait on the open questions;
Layout Stack / direction for multi-layer blocks (needs Phase 4 patterns); the
floating text toolbar; mounting the panel inside Puck (Phase 5).

## Gap analysis vs the claude.ai canvas (2026-11-01, from the recording and the harness screenshots)

Match: click-deeper selection, breadcrumb, hover/selection outlines with labels, layer rows named by role + text
with eye toggle, align row, padding one/per side, text style presets switching to Custom, searchable font picker
drawn in face with "In this page" first, weight/size/line height/letter spacing/align incl. justify, live contrast
verdict (ours also shows the ratio), fill/opacity/per-corner radius/border, effects, advanced fields, Code tab,
reset arrows, Theme/Custom colour tabs, drag reorder with insertion line, grid span resize.

Gaps to close next, in order:
1. Show computed values in every field (canvas shows 0, 420px, 1.4 even when untouched; ours leaves blanks).
2. Width/Height as numbers with a mode (Hug / Fill / Fixed px), not only Hug/Fill chips.
3. Layer tree for the whole page, not only the selected ad; expand/collapse; hover in tree highlights canvas.
4. Floating text toolbar on selection (style, colour, B/I/U, link, list, align) and rich text inside parts.
5. Insert tools: add text or a box anywhere inside a block (canvas Text tool, frame tool), within slot limits.
6. Margin and Gap fields (Gap "Mixed"), Layout direction/wrap/9-way align for multi-part blocks (needs Phase 4).
7. Zoom and pan of the sheet; a phone-width preview toggle.
8. Overlay labels and grips must not cover the selected text (place them outside the box when space allows).
9. Export (image/PDF of an ad) and a Debug view for admins.
Ours only, keep: freedom levels with amber out-of-level flags and Snap to family; graft; Saved tab (stored record);
server-side validation of every value; fonts loaded on demand from a 503-family library.

### Live test of the canvas (2026-11-01, Claude in Chrome, read-only: menus opened and closed, no values changed)
- One click on text selects the text element itself and opens the floating toolbar; the panel opens from the
  panel button beside zoom. Hovering a layer row highlights it on the canvas.
- Width / Height: a number plus a mode menu Hug / Fixed / Fill. Position: Inline / Relative / Absolute / Fixed /
  Sticky. Containers show computed values ("auto", "543px").
- Layout menu: Block / Stack / Grid. Grid shows columns (6) and rows (auto), Gap, Align, Padding. A "+" beside a
  section adds optional fields (Layout: Justify, Margin), so the panel stays short until asked.
- Text style menu: a numbered scale drawn in each face with its size (Heading 1 88px … Heading 10 22px).
- Font picker: "In this design" first, then "All fonts", a short list of about 30 common families (Georgia,
  Helvetica, Inter, Lato, Lora, Manrope, Merriweather, Montserrat, Nunito, Open Sans, Playfair Display, Poppins,
  Raleway, Roboto, Space Grotesk, Tahoma, Times New Roman, Trebuchet MS, Verdana, Work Sans). Ours: 503.
- Code tab: the element's own declarations, its class (`@class: bigtitle`), and inherited properties from
  ancestors with token references (`From <a> color {{paper}}`), with "+" to add a property.
- Tweaks tab: design-wide variables (paper, spot) as colour fields; editing one recolours everything that
  references it. This is the canvas's theme layer; ours is the style family plus the org theme (site_themes).
Additions to the gap list: progressive "+" fields per section; computed values in every field; Position menu
(at Free); a Tweaks-like tab exposing the org theme and family variables; Code tab showing inherited and
token-referenced values; Grid columns/rows for containers.

### Live test, second pass (2026-11-01): menus, tools, cursors
- Floating mini toolbar appears on selecting text while the panel is closed: text style, colour, B, I, U, link,
  bulleted list, align, comment, more (⋯). (The ⋯ menu could not be opened reliably by automation.)
- Right-click menu: Cut, Copy, Copy as PNG, Copy as SVG, Copy as HTML, Paste, Duplicate (Ctrl+D), Move to last (]),
  Move to first ([), Group (Ctrl+G), Ungroup, Scale… (K), Flip horizontal (Shift+H), Flip vertical (Shift+V),
  Detach instance (so the canvas has components with instances), Wrap in flex (Shift+A), Wrap in grid, Delete.
- Toolbar: Page menu, Select, Hand, Text (T), Artboard (A), Note (N), Pencil (P) / Pen (Shift+P), Rectangle (R) /
  Oval (O) / Arrow (Shift+L) / Line (L); right side Present, panel toggle, zoom. Artboards have their own header
  icons (settings, expand, download). A "Duplicate this artifact" tip offers a private copy to edit and remix.
- Cursors: the canvas renders in a cross-origin frame and Chrome screenshots draw a generic arrow, so cursor shapes
  come from Justin's recording: arrow for select, text I-beam in fields and inline text, a move grabber on the
  mid-edge handle, resize cursors on corner handles.

## Next build pass (pass 2): what it adds

Goal: close the visible gaps so editing a classifieds sheet feels like the canvas, still writing only block data.

1. Panel fidelity
   - Computed values in every field (read from the effective style / getComputedStyle), never blanks.
   - Width / Height: number + mode menu Hug / Fixed / Fill (Fill = full row; Fixed = column span in grid units).
   - "+" per section reveals optional fields (Layout: Justify, Margin; Text: decoration, indent; Appearance: shadow),
     so the default panel is short.
   - Position menu (Inline / Relative / Absolute / Sticky) at the Free level only.
   - Code tab also lists inherited values and token references (family ink, paper) like `From frame color {{ink}}`.
   - A Tweaks tab: the sheet's shared variables (paper, ink, spot, title/body font) editable in one place; stored
     as a doc-level theme override now, wired to site_themes later.
2. Canvas interaction
   - Floating mini toolbar on text selection when the panel is closed: text style, colour, B / I / U, link, list,
     align, more. Needs rich text in parts: store a small allow-listed markup (b, i, u, a, ul/li) in copy, cleaned
     by cleanDoc like CSS.
   - Right-click menu on an ad or part: Cut / Copy / Paste, Duplicate (Ctrl+D), Copy as PNG and Copy as HTML,
     Move to first / last ([ / ]), Select parent, Snap to family, Delete. Reuse ideas from
     packages/page-builder/src/drag/canvas-menu.tsx.
   - Keyboard: Delete, Ctrl+D, [ and ], arrows to nudge order, Enter to go deeper, Esc to go up (exists).
   - Cursors: default arrow (select), grab / grabbing (move, graft), ew / ns / nwse resize on handles, text I-beam
     while editing, crosshair for insert tools, pointer on chips and buttons.
   - Overlay labels and grips placed outside the selected box so they never cover its text.
3. Toolbar and view
   - Select, Hand (pan), Text tool (drop a text part where a block allows one), zoom in / out / fit, phone-width
     preview toggle. Artboard, Note, Pen and Shapes stay out (Note may later map to comments).
4. Layers
   - Whole-page tree with expand / collapse, hover in tree highlights on canvas, eye to hide, drag in tree to reorder.

Still out of scope for pass 2: Phase 4 (versions, org templates / patterns, review, font_library table), components
with instances (the canvas's "Detach instance" is the model for org patterns later), free shapes and drawing.
Verification as in the plan: check-types, esbuild harness + Playwright covering every new control and menu, screenshots.

## Pass 2 progress (2026-11-01, source only: not rebuilt, not deployed, not committed)

Scope was "Next build pass (pass 2)" above. Everything lands as block data validated by `cleanDoc`; freedom levels
(Family / Borrow / Free), amber out-of-level flags and Snap to family are unchanged.

**New in `packages/direct-edit`** (plain DOM, no React, no new dependencies):
- `model/richtext.ts` (subpath export `@elkdonis/direct-edit/richtext`): the allow-listed markup `b i u a[http(s)] ul/li br`.
  `sanitizeRich` is canonical and idempotent (a second clean changes nothing; fuzzed 8000 random inputs), `parseRich` gives a
  tree, plus `richPlain`, `toggleWhole`, `toggleList`, `wholeHas`. Pure strings: runs on the server, in the editor and in React.
  Hand-rolled on purpose (about 250 lines, no dependency): the markup is tiny and has to be the same function on server,
  editor and page. Tiptap / DOMPurify / floating-ui from the research note were not needed for this scope; revisit if the markup grows.
- `canvas/minibar.ts` (floating text bar: text style, colour, B I U, link, list, align, more), `canvas/menu.ts` (right-click menu:
  arrows, Esc, closes on outside press / scroll / blur, kept on screen), `canvas/view.ts` (`Viewport`: zoom 25-300 %, fit, phone
  preview, hand pan; the page is scaled inside an unscaled wrapper so the overlay measures in screen pixels), `canvas/export.ts`
  (clipboard; Copy as PNG through SVG foreignObject with the used Google faces embedded as data URIs).
- `canvas/interact.ts`: `startInlineText` returns a session (rich, `execCommand` b/i/u/link/list, paste as plain text,
  `keepFocus` for the bar's link field); `bindCanvas` has `onClick` / `onContext` hooks; ghost drags take `axis: "y"` (tree) and
  set body cursor classes. Fixed a pass-1 bug the new tests exposed: the Enter that commits inline text bubbled to the
  document handler and re-opened the edit.
- `canvas/overlay.ts`: tag and grips are one chip row outside the box (above, or below near the page top).
- `panel/panel.ts`: tabs Properties, Code, Tweaks, Saved; `dim` control (number + Hug / Fixed / Fill menu); `optional` slots behind a
  "+" per section (auto-open when they hold a value); computed values in every field (`PanelContext.computed`, lighter tone);
  whole-page layer tree (expand / collapse, hover outlines on the canvas, eye, drag to reorder ads with an insertion line);
  Code tab lists `From frame color {{ink}}` style inherited values and shows `{{token}}` beside written values.
- `model/schema.ts`: `SlotSpec.optional`, `numKey`, `covers` (the mode menu explains the stored keys it writes, so no false
  "outside" flags); `PartSchema.rich`, `insertable`.

**In the classifieds host** (`apps/arts-collective`):
- `catalog.ts`: `Theme` (`doc.theme`: paper, ink, spot, title font, body font; `cleanTheme` keeps only `#rrggbb` and library fonts; the
  renderers check again), `baseParts` / `effective` apply it, `sheetDecls` sets `--paper`; `RICH` (title, body with bullets, price,
  contact take markup; header stays plain text) and `cleanCopyText`; `PartStyle` gains `w`, `h`, `margin`, and `pos` relative /
  sticky; `frameDecls` honours `hide` (the eye on an ad). Body is now a `div` (a list cannot live inside `p`).
- `schema.ts`: Width / Height as `dim` slots (Free offers Fixed; Borrow Hug / Fill; Family none for parts), optional groups
  (Layout margin / distribute; Text case, style, decoration, indent; Appearance border colour / width, shadow; Size grow, offsets),
  Position menu at Free only, `TWEAK_SCHEMA` (palette at Family and Borrow, any colour and any library font at Free).
- `editor-engine.ts`: tools Select / Hand / Text (V H T), zoom and fit, phone preview, panel toggle (P), floating bar when the
  panel is closed or a range is selected, right-click menu, shortcuts, cursors, layer tree, Tweaks wiring, computed values.
  Text tool puts "Your text here" in the clicked or first empty slot the schema marks `insertable`, or says there is none.
- `ClassifiedSheet.tsx`: rich words are built as React elements from `parseRich` (no `dangerouslySetInnerHTML` anywhere); a link inside
  a card that is itself a link is drawn as plain styled text (anchors cannot nest).

**Verification** (esbuild harness of the real engine, panel and `cleanDoc`, Playwright / Chromium at 1600x950):
- `check-types`: direct-edit, fonts, arts-collective all 0 errors.
- `drive1.cjs` (the pass-1 suite, selectors updated for the new Size / "+" controls): 64/64.
- `drive2.cjs` (pass 2): 194/194: no blank field at Free on a part and on the ad (computed values), Width / Height numbers equal the laid-out
  size, Hug / Fixed / Fill on ad and part at each level, "+" groups, Position menu, Code inherited / tokens, Tweaks (paper, ink, spot, fonts,
  reset, undo, level gating), rich text (typing, selection bar, B I U, link field, bullets, whole-part toggles), hostile markup and CSS
  stripped (`img`, `script`, `iframe`, `style`, `on*`, `javascript:`; `url()`, `expression`, `position`), `cleanDoc` on a hostile document,
  right-click menu (every item, keyboard, close rules, on-screen), Copy as HTML and Copy as PNG (real clipboard read back), shortcuts,
  cursors (computed values of the listed cursors incl. during drags), Text tool, zoom / fit / Ctrl+wheel with the overlay still on the
  element, hand pan, phone preview, layer tree (collapse, expand, hover, eye, drag), save: the saved doc passes `cleanDoc` byte for byte.
- Public render: the saved doc and a hostile doc (rendered without `cleanDoc`) through `ClassifiedSheet` with `renderToStaticMarkup`:
  no script / img / handler / `javascript:` / `url(`, no nested anchors, links get `rel="noopener noreferrer nofollow"`.
- Screenshots (Windows scratchpad `...\scratchpad\harness\`): `p2-panel-open-title.png`, `p2-panel-open-frame.png`, `p2-minibar-panel-closed.png`,
  `p2-context-menu.png`, `p2-tweaks-tab.png`, `p2-code-tab.png`, `p2-phone-preview.png`, `p2-layers-hover.png`, `p2-layers-drag.png`,
  `p2-zoom-out.png`, `p2-copy-as-png.png`, `p2-public.png`.

**Not done / known limits.** Phase 4 and the `font_library` table (out of scope). Parts are the ad's five fixed slots, so the Text tool
fills an empty slot rather than adding free text, and parts cannot be reordered in the tree (ads can). Tweaks is a doc-level override, not
yet wired to `site_themes`. Copy as PNG and the clipboard need a Chromium-class browser; the faces are fetched from Google when the PNG is
drawn. Not exercised in Firefox or Safari. `execCommand` drives range formatting (deprecated but universal). No Space-to-pan, no Copy as
SVG, Group, Flip, Artboard, Note, Pencil or shapes. Not rendered through a Next dev container (SSR was `renderToStaticMarkup` over the
real component); no DB writes. An existing stored copy containing a literal `&` or `<` is entity-escaped by the first clean (display is unchanged).

## Pass 3 progress (2026-11-02, source only: not rebuilt, not deployed, not committed)

Justin's feedback after passes 1-2: parts were fixed slots ("it doesn't move when I click and drag it"); resize jumped across a fixed
6-column grid ("should be smooth; perhaps a natural grid to be used and to be chosen"); editing stopped at classifieds ("the layout of
the card on a feed that is serving live data, or the layout of a tour page ... each stop"). Two more requests arrived during the pass:
real colour choice at every level, and every text element treated as its own box.

### Decisions (and why)

1. **A generic block model in `packages/direct-edit/src/block/` (subpath `@elkdonis/direct-edit/block`), pure and server-safe.**
   `style.ts` (the node style vocabulary, `partDecls` / `boxDecls` / `ruleDecls`, `cleanStyle`; lifted out of the classifieds catalog),
   `tree.ts` (`TreeNode {id, kind, kids}`, find / move / insert / wrap / unwrap, `canPlace`, `cleanTree`), `grid.ts` (`GridSpec {cols, gap,
   row}`, `scaleSpan`, `cleanGrid`), `bind.ts` (`{{token}}` filling, `safeSrc`). Why: classifieds, feed cards and (later) Puck blocks and
   elktours need the same model; keeping it free of DOM and React lets servers validate and render with the code the editor uses.
   Families, templates and kinds stay in the host (`lib/classifieds/catalog.ts`): they are design content, not the model.
2. **The tree stores structure only; styles and words stay keyed by node id.** The five original parts keep their names as ids (`title`
   is always a title), so `o.parts.title` / `o.copy.body` mean what they did, and a block that never changed its structure stores no tree
   (it follows its template's, default the five parts). Why: no data migration. Every saved pass-1/2 doc reads byte-for-byte the same
   (verified on three saved docs), templates still improve every ad, and structure is just one more override with a reset.
3. **Smooth resize with a landing ghost, snapping on release, on a grid each sheet chooses.** While dragging, the ad follows the pointer
   pixel for pixel (it overlaps neighbours; nothing reflows), a dashed ghost labelled "3 × 4" shows the cells it will take ("moves down a
   row" when it will wrap), and the grid is drawn. Release snaps. The sheet picks 4/6/8/12/16/24 columns, gutter and row height (Page panel
   with nothing selected; G shows the grid). Stored spans rescale when the grid changes, so sizes are kept. Exact (unsnapped) sizes only
   at Free: a Snap toggle in the toolbar, Alt inverts it live; stored as frame `w` / `h` inside the cells it covers. Why: the jump came from
   rounding on every move; the canvas feel is "follow, then land".
4. **Parts are nodes in containers.** Press on a selected part and pull: an insertion line shows where it lands in whatever container is
   under the pointer (direction and grid order read from the page's own layout), the container is outlined, and near a container's edge the
   pointer belongs to the container around it (that is how a part is pulled out of a row). Parts move into other ads (keeping their words
   and own settings, taking that ad's family, renamed when the id is taken). Ctrl+G groups in a row (menu: column), Ctrl+Shift+G
   ungroups, Ctrl+D duplicates, Delete removes, [ ] and arrows reorder within the container, Enter goes in, Esc goes up. The left rail adds
   heading / paragraph / label / price / small print / divider / row / column / grid (Borrow) / picture (cards) by click or by dragging
   onto the sheet; the Text tool adds words where you click. Structure follows the freedom dial: Family one level of boxes and stacks only,
   Borrow two levels and grids, Free three. Why: Justin dragged a part and nothing moved; drag must work at the default level.
5. **Feed cards: one design, every item.** The card is a classifieds block with a card template (`c-editorial`, `c-picture`, `c-index`,
   `c-stop`) and the new "Plain site" family; its words name item fields as `{{tokens}}` ("{{when}} · {{place}}", picture `{{cover}}`),
   filled per item at render time; empty fields drop their node and dangling separators. The editor's pattern mode draws the design once per
   item (live: the org's newest public posts via `getOrgFeed`, which now also selects `metadata->>'coverImageUrl'`), so editing any card
   edits all of them (other cards show dashed "follow" outlines). The panel's Text section gets "Comes from" (bind to a field) and "Insert
   field"; pictures get "Picture from". Stored in `site_config` `cards:feed` via `withOrg` (no migration: one row per org, RLS from 227).
   Why: the instances model of the patterns prototype, applied to data rows, with no new table.
6. **Every node is a box** (Justin, mid-pass). Headings, paragraphs, prices, contacts, dividers, pictures and rows all get Align, Size
   (Hug / Fill, Fixed at Free), Padding, Margin, Fill, Opacity, Radius, Border at every level, Effects and raw CSS at Free; text nodes add
   Text on top. Margin is a default field now.
7. **Real colour choice at every level** (Justin, mid-pass). The popover's Palette tab lists groups: the family (inks, paper, white),
   tints and shades of its inks, other families, a curated set of 28 more, then "On this page" and "Recent" (colours not already shown
   above). Custom (picker + hex) and an eyedropper (where the browser has one) at every level. The level only decides what counts as
   inside: Family = the family palette, Borrow = the wide palette, Free = anything; outside values are kept, marked amber, with Snap to
   family. Live contrast unchanged.
8. **No new dependencies.** Pragmatic drag-and-drop / Floating UI / Immer from the research note were not needed: the drag is ~150 lines
   because the hard part (what may go where) is our own rules, and history stays JSON snapshots.

### Files
- `packages/direct-edit`: new `src/block/{style,tree,grid,bind,index}.ts`, `src/canvas/{resize,nodedrag}.ts`; changed `model/nodes.ts`
  (`hitChain`, `deeperIn`), `canvas/interact.ts` (press-drag, nested click-deeper), `canvas/overlay.ts` (`find`, `follow`),
  `panel/panel.ts` (palette groups, recent, eyedropper, popover scrolls into view, kind icons), `panel/icons.ts`, `direct-edit.css`,
  `index.ts`, `package.json` (subpath `./block`).
- `apps/arts-collective`: `lib/classifieds/{catalog,schema,editor-engine}.ts` (rewritten onto the tree, grid, plan renderer, pattern
  mode), new `components/classifieds/BlockView.tsx` (React renderer of the plan), `ClassifiedSheet.tsx` (through the plan),
  `classifieds.css`; new `lib/cards/{catalog,store,actions}.ts`, `components/cards/{FeedCards,CardsEditor}.tsx`,
  `app/hub/sites/[slug]/cards/page.tsx`; `components/sites/OrgDefaultPage.tsx` ("What's on" drawn with the cards when saved, link to the
  designer); `lib/org.ts` (`cover_image_url`).
- Not touched: apps/elktours (another session), packages/studio, reels, services, blocks, page-builder.

### Verification
- check-types 0 errors: direct-edit, fonts, page-builder, arts-collective.
- Harness (esbuild bundle of the real engine, panel and cleaners; Playwright / Chromium 1600×950; Windows scratchpad `harness3\`):
  drive1 64/64 and drive2 197/197 (the pass-1/2 suites; checks changed only where pass 3 changed behaviour on purpose, each annotated in
  the script), drive3 141/141 (pass 3): resize widths step 12 px per 12 px of pointer with no reflow, ghost label, snap on release,
  Escape cancels; grid 6 → 12 keeps widths and makes snapping finer, back to 6 rescales stored spans, gutter, gating (24 columns outside
  Family, flagged), G grid lines, undo; Free exact size with Snap off and Alt; drag reorder with insertion line and outlined container,
  undo / redo, Escape cancels; drag into another ad (renamed id, words kept, destination family); Ctrl+G, drag into the row (side by side),
  row panel, Enter in, pull out, Family depth refusal said plainly, Borrow nesting, ungroup; duplicate / arrows / Delete; rail click and
  drag; box sections on a heading at Family; colour groups, amber marks, out-of-family pick flagged, tint inside, Borrow inside, custom
  flagged, Recent; save → cleanDoc unchanged (trees, grid, spans, moved part); hostile docs cleaned (bad ids, unknown kinds, fixed-id
  mismatch, depth > 4, > 40 nodes, card template on a sheet, url(), javascript: pictures, markup, pollution; idempotent); pass-1/2 docs
  unchanged and still five-part; phone; feed cards (6 instances, tokens filled, separators dropped, row heights shared, edit any card →
  all, follow outlines, bind Place, insert {{duration}}, Cover field (2 pictures, 4 placeholders), picture dragged to the top of every
  card, field chip dragged onto a card, design switch, card width on the grid, items shown, save → cleanCards unchanged, tokens not data,
  hostile design and items); tour stops (4 stops, "Stop {{n}}", 3 pictures + 1 placeholder, 12-column grid, edit any stop → all).
- Server render (`renderToStaticMarkup` over the real components in the container, `harness3\ssr3.tsx`): the saved sheet through
  `ClassifiedSheet` (12-column grid, boxes, dividers, no editor markers, unchanged by cleanDoc); feed cards through `FeedCards` over
  thread-shaped rows (links `/slug`, two cover pictures, the essay card without Meta / price, no tokens, hostile slug not linked, hostile
  title stripped to text, kind markup escaped, no `javascript:` href / src); a hostile sheet rendered without cleanDoc (no script / img /
  handler / javascript: / data: / url()).
- Screenshots: `harness3\p3-resize-ghost.png`, `p3-grid-12.png`, `p3-grid-24-lines.png`, `p3-drag-reorder.png`,
  `p3-drag-between-ads.png`, `p3-drag-into-row.png`, `p3-nested-row.png`, `p3-rail-insert.png`, `p3-text-part-box-sections.png`,
  `p3-colour-palette.png`, `p3-cards-instances.png`, `p3-cards-follow.png`, `p3-cards-picture-field.png`, `p3-cards-picture-design.png`,
  `p3-tour-stops.png`, `p3-phone-nested.png`, `p3-public-sheet.png`, `p3-public-cards.png`, `p3-public-cards-phone.png`.
- Test artifact (republished, same slug): https://claude.ai/artifact/Tj5dDXsKcxoEuYQ14szwD9 (#sheet, #cards, #stops; add -borrow / -free).

### Known limits / next
- Not rebuilt: the live site still runs pass 2. A rebuild of arts-collective is needed before members see any of this.
- Not run through a Next dev container or a real org's `cards:feed` row (no DB writes made); the feed-card surface is proven by the
  harness over thread-shaped rows and by SSR of the real components.
- Tour pages: a harness demo over elktours-shaped stops only (elktours is another session's; its pages are not wired). Wiring needs the
  plan renderer (`BlockView`) moved into a package elktours can import, then a "stops" block in its tour layout.
- Puck mounting (stretch) not started.
- No auto-scroll while dragging near the canvas edge (drop targets must be on screen); the drag ghost keeps the grab offset, so a wide
  part's ghost can sit partly over the left rail. Tree rows reorder parts only beside other rows (nesting is done on the canvas).
- Recent colours live in this browser's storage only. Copy as PNG of a single nested part draws it on its own.
- `PartStyle` / decls now live in the package, but families and templates are still classifieds code; org templates / review (Phase 4)
  and the font_library table are untouched.
