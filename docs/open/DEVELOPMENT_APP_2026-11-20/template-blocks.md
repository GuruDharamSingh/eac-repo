# Bigger template blocks in Puck: how much would they help? (worker P, 2026-11-20)

Read-only study. Sources: the repo (page-builder `templates/`, per-app templates, direct-edit, docs), counts from `site_config` `puck:*` rows (no content copied), and generic web research.

## 1. Direct answer

**Yes, it would help meaningfully, but mostly at one moment: the start of a page and the adding of a new section. It would not help much with fine editing.**

- **Who gains most:** a new owner facing a blank canvas with ~100 small blocks to pick from. Today the choice is "Heading and text" or "Blank page" (elktours `NEW_PAGE_STARTS`), or a whole-page template in apps that have one (sunjay, katie, art-auction, arts-collective org home). A section like "Three-card row with heading" saves 6 to 10 drops, a nested slot drag and a lot of guessing.
- **Where it will not help:** (1) tweaking an existing page: the owner still edits ordinary blocks; (2) sites with a strong single voice that compose unique pages (Dana's `dm-*` pages are hand-composed, one-of-a-kind sequences); (3) data-driven pages, which already come from one shared document (sunjay `event-detail`, `journal-piece`); (4) anything where the owner wants to change the inner layout: a locked section frustrates them.
- **The real gap today:** the existing Templates tab (`templatesPlugin`, `packages/page-builder/src/templates/templates-plugin.tsx`) can only **replace the whole canvas** (after a confirm; undo restores it). There is no "add this section here". That is why templates are used once at page creation and never again. A bigger unit that you can **insert between existing blocks** is the missing piece, and it needs almost no new machinery: the `instantiate()` function there (fresh ids, slot-aware) already does the hard part.
- **Evidence is thin, say so plainly:** only 35 `puck:*` pages exist, 27 of them Dana's (many are composition experiments). `site_page_templates` (migration 257, org-saved page templates) has 0 rows. Template use is not recorded anywhere, so we cannot say which templates were applied. Treat the numbers below as direction, not proof.

## 2. What exists today

| Where | What | Shape |
|---|---|---|
| `packages/page-builder` `templatesPlugin` + `TemplatesPanel` | "Templates" tab on the left rail, SVG swatch thumbnails, applies `PageTemplate` (`@elkdonis/blocks`: `{id,name,description,swatch,cards,content: TemplateNode[]}`) | whole-page starter, replaces canvas |
| sunjay `templates.ts`, `home-template.ts` | home + `event-detail`, `services`, `journal`, `journal-piece`, `post-detail`; built from `pt-band` + `split-row` helpers | whole-page, some **shared document** (one doc draws every event) |
| art-auction `templates.ts` | featured, auction, article-detail, card-kit, plain | whole-page |
| katie `templates.ts`, `piece-template.ts` | about (`ktp-about`), piece template | whole-page |
| arts-collective `template.ts` | `orgHomeTemplate(seed)` / `blankOrgTemplate`, seeded from org data (name, social links) | whole-page, personalised |
| elktours `starts.ts` | "Heading and text" / "Blank" | tiny starter |
| hidden-enneagram `boxify.ts`, `presets` | converts `he-welcome/hero/passage/orb` into box trees (so they can be edited in the direct editor) | conversion, not a template |
| studio-forms `presets.ts` | "Start from" form presets: SETTINGS only, never content | a good precedent for "settings, not content" |
| direct-edit `BOX_BLOCKS` | `box` (slot), `words`, `picture`, `part` | primitives; "every element is its own box" |
| classifieds `catalog.ts` families/templates, "pattern mode" (CardsEditor) | block data `{template, overrides, link}`: improving a template improves every ad | **already the synced-with-overrides shape** |
| `PATTERNS_VERSIONS_REVIEW_PROTOTYPES_2026-11-01.md` | org patterns with instances, review queue promoting org patterns to network templates | designed, prototypes only |
| slot/containers | `pt-band` (ground/padding/width/rule + content slot), `split-row`, `grid`, `flow-column`, `card-grid`, `sticky-split`, `tab-set`, `box` | the building material for sections |

Direction already set by Justin (direct-editing session): data `{template, overrides, link}`, "never free HTML", freedom "dial not wall", org patterns promoted into network templates by review. So shape (c) is already the stated long-term intent for classifieds; Puck pages have only (a), whole-page.

## 3. What real pages look like (counts, `site_config puck:*`)

- 35 pages, 5 orgs: danamccool 27, sunjay 4, elktours 2, katie 1, hidden-enneagram 1. Plus 4 rows in `user_pages` (not analysed).
- 247 block nodes: 160 top-level, 87 nested. Average **4.6 top-level blocks/page** (sizes 1 to 16, median 3 to 4). Nested: depth 1: 36, depth 2: 23, depth 3: 19, depth 4: 8, depth 5: 1. So nesting is real but shallow; containers hold about a third of all nodes.
- First block: `section-heading` on 18 of 35 pages (a page starts with a title, not a hero). `dm-plate` 4, `pt-banner` 2.
- Most used: `section-heading` 35 (32 top-level), `box` 29 (21 nested inside boxes), `words` 22 (all nested in boxes: direct-editor pages), `dm-plate` 17, `pt-band` 15, `dm-image-set` 14, `prose` 12, `entry-list` 8, `dm-gallery-grid` 6, `divider` 6, `link-button` 5, `picture-wall` 4, `contact-form` 4, `video` 4, `split-row` 4.
- Recurring pairs (single-org unless noted): `pt-band > pt-band` 12 (sunjay designed pages: stacked bands), `dm-plate > dm-plate` 7, `section-heading > entry-list` 7 and `entry-list > section-heading` 6 (a repeating "heading + list" pair, 5 triples), `dm-plate > dm-image-set` 6, `section-heading > prose` 5, `section-heading > dm-gallery-grid` 4, `section-heading > picture-wall` 3, `box > box` 5 (2 orgs), `divider > section-heading` 3.
- Reading: the dominant unit is **"section heading + one content block"** (prose, entry-list, gallery/picture wall, image set). That is a section in the WordPress/Shopify sense. The second is **a band wrapping a split-row** (sunjay). Hand-built boxes/words trees exist only in direct-editor pages.
- Not recorded: which template a page started from. Recommendation below adds a tiny note for that.

## 4. Outside view

- **Puck:** slots (0.19+) are the supported way to nest; DropZone is deprecated. Puck itself ships no template library; a "bigger block" is a component with slot fields, a "template" is data you insert. Known issue (Puck GitHub #1208): editor lag when updating props on a slot holding several nested components, so avoid giant deeply nested sections. The slot data model differs from DropZone zones, so any code that rewrites the data tree must understand slots (our `instantiate()` already does). We found no official "insert pattern" API; we dispatch `setData` ourselves. (Sources: puckeditor.com docs slot + multi-column pages, Puck 0.19 release post.)
- **WordPress:** three tiers. *Patterns* (unsynced) insert a copy; later edits do not propagate. *Synced patterns* (ex reusable blocks): edit once, all instances change; you can detach. *Overrides* (6.6): synced layout, but chosen blocks (heading, image, button) stay per-instance editable via Block Bindings; each block opts in; nested patterns are not supported. Lesson: pure synced is too rigid for content, pure copy drifts; the useful middle is "locked layout, editable words and pictures". (developer.wordpress.org news on overrides; wptavern.)
- **Shopify / Squarespace / Webflow / Framer** (search gave little; Shopify and much of this is general knowledge, unverified): Shopify sections have a few typed settings and repeatable inner "blocks"; owners add/reorder/hide sections from a list with previews; layout is code-locked. Squarespace offers pre-designed sections in a categorised gallery with thumbnails, then you edit text, images and a few style choices. Webflow components have designer-defined editable properties plus a "detach" escape; Webflow's selling point is designers build templates once, editors update content without breaking them. Framer has a section/component marketplace. Common pattern: gallery of previews grouped by purpose (Hero, About, Gallery, Contact), inserted at a chosen position, a few visible settings, an escape hatch.
- **What helps non-technical editors most:** pick by picture and purpose; insert at the place I am looking at; few settings; sensible placeholder text; undo. **Known traps:** detached copies drifting from the master with nobody knowing; locked parts that block a reasonable change ("why can't I move this button"); too many variants; placeholder text published by accident; stale thumbnails that no longer look like the section; override rules the owner cannot see.

## 5. The three shapes compared

### (a) Starter templates: insert a pre-filled group of ordinary blocks
- **Effort here:** small. Reuse `PageTemplate`/`TemplateNode`, `instantiate()`; add an "insert at position / at end" action beside "replace page". Content is plain data per app or shared in `@elkdonis/blocks`. Direct-edit already speaks this data. Roughly 2 to 4 days for plumbing plus tab; each section is then about an hour of data authoring.
- **Owner sees/does:** opens a "Sections" tab, sees thumbnails grouped by purpose, clicks or drags one in; it appears as normal blocks with example words; edit anything, delete parts, rearrange.
- **Risks:** low. Copies drift from "the template" by design, but nothing is promised. Placeholder text can be left in (mitigate: visibly marked example words, Publish nudge). Thumbnails go stale if blocks change (mitigate: render from real blocks, section 7).

### (b) Section blocks: one bigger block, own few settings, locked inner layout
- **Effort here:** medium to high per section. Each is a new Puck component (React, schema, render, theme tokens, behaviour in the house-editor canvas and direct-edit). `pt-band` and `split-row` are close in spirit. Several apps own separate block registries, so each section must be built once in a shared package and registered per app.
- **Owner sees/does:** one entry in Blocks; five fields (heading, text, three picture+title pairs). Simple and hard to break; a new section type needs a developer.
- **Risks:** a long tail of block types (the catalogue already has 100+); the owner hits the locked wall ("I want a fourth card"); layout fixes only through code. Reserve for sections that are data-driven or need logic anyway (event header, store shelf, threads).

### (c) Synced patterns: one definition used on many pages
- **Effort here:** high. Needs a store for patterns (`site_page_templates` is the nearest, 0 rows), a reference block `{pattern, overrides}`, render-time resolution, versioning/review (`page_revisions`, from the Phase 4 plan), a "detach" action, an owner-facing "used on N pages" and edit flow. Weeks, not days. The classifieds engine already does this for ads (`effective()`), but not for Puck pages.
- **Owner sees/does:** "Join band (used on 6 pages)". Edit once, all pages change; or detach.
- **Risks:** surprise ("I changed one page and five moved"); draft/publish interaction (does a pattern edit publish all pages at once?); slots inside a referenced pattern; caching and static generation; the review queue. Right for site-wide strips (footer call-to-action, newsletter band, "Join" band), wrong for body content.

**Summary:** (a) now, (b) only for the few logic-heavy sections, (c) later and narrow (site-wide bands), built from (a)'s data format with a `link` flag so the move is additive.

## 6. Candidate sections (from the measured sequences)

All are (a) unless stated. "Bundles" uses block ids seen in the data.

1. **Heading + text**: `section-heading` + `prose` (+ optional `link-button`). Most common unit. Every site.
2. **Heading + picture wall**: `section-heading` + `picture-wall` (or `dm-gallery-grid`). Dana, katie, sunjay, elktours.
3. **Heading + list**: `section-heading` + `entry-list` (writings, events, services). The repeating pair (7+6). Dana, sunjay, art-auction.
4. **Feature band**: `pt-band` wrapping `split-row` with picture one side, text + button the other. sunjay, katie, arts-collective.
5. **Three cards**: `section-heading` + `card-grid` of three cards (`ha-card-image` in art-auction). Home pages of all orgs.
6. **Hero opening**: `opening` / `pt-banner` + one line + two buttons. Dana, sunjay, art-auction.
7. **Plate + images**: `dm-plate` + `dm-image-set` (alternating; 6+3 pairs). Dana mainly; a "gallery row" for any artist.
8. **Quotes strip**: `press-quotes` + `divider`. Dana, katie, art-auction.
9. **Contact block**: `section-heading` + `prose` + `contact-form` (4 uses). Every org.
10. **Join / call-to-action band**: `pt-band` + heading + `link-button` (+ `home-join`). Later candidate for (c): site-wide.
11. **About strip**: `career-timeline` + `prose` + `text-image`. Dana, katie (about), arts-collective profile.
12. **Event / series pieces** (shape b, not a): `pt-event-header`, `pt-steps`, `pt-talk-room`, RSVP already exist as logic blocks; keep as blocks or shared whole-page documents, not starters.

Most measured data is Dana's plus a few orgs, so expect to adjust after more pages exist; the first five are safe.

## 7. How it would appear

- **Puck left rail:** keep `Blocks`; rename today's `Templates` to `Pages` (whole page, replaces, asks first); add **`Sections`** beside Blocks. Purpose groups (Start, Words, Pictures, Lists, Buttons and contact), 2-column thumbnail cards with a one-line description, a search box.
- **Insert:** drag a thumbnail onto the canvas, or "Add after the selected block" (default: end of page). A hover "+" line between top-level blocks on the canvas opens the same list as a popover. Inserted blocks are selected as a group and scrolled into view. Dropped inside a container slot, a section inserts only its inner blocks, not another band.
- **After insert:** ordinary blocks, a one-time note "Example words: replace them", optionally an "Example" badge on placeholder text until edited.
- **House-editor canvas** (direct-edit tree editor): same data, so sections arrive as box trees; add the same insert-between "+" and a "Sections" entry beside Add words / Add box / Add picture. No new model. Shape (b) blocks show as one selectable box with their few fields in the panel.
- **Themes:** sections use only existing theme roles (`--eac-*`, `--blk-*`), never fixed colours, so any site theme re-skins them. Thumbnails render through the real block components in the current theme, replacing today's static SVG `Thumb`.
- **Development app gallery:** a "Sections" shelf beside blocks; each card previewed in the test theme and switchable across themes with the same toolbar, with a live-controls panel for the few settings. It doubles as QA that thumbnails and themes agree, and gives worker T's theme-editor preview a list of sections to mock.
- **Recording use:** write the section id into the page (root props or a meta field) on insert so we can finally count which sections are used.

## 8. Recommendation

**Build shape (a) as a `Sections` tab with insert-at-position in `@elkdonis/page-builder`, from one shared, themed section library in `@elkdonis/blocks`. Keep (b) for logic-heavy blocks only. Defer (c); prepare for it by giving each section a stable id and recording the id on insert.**

**First small step (about a day):** extend `templatesPlugin` with an "Add to page" mode per template that calls `instantiate()` and **inserts** into `content` after the selected block (or at the end) instead of replacing; author 3 sections (heading + text, heading + picture wall, heading + list) as data. No new blocks, no DB, additive. Try it on sunjay (already mounts the plugin), watch whether the owner uses it, then add real thumbnails and the rest. Check `git status --short` first: katie's editor files hold another session's uncommitted work.

## 9. Decisions for Justin

1. **Which shape first?** (a) starters, (b) section blocks, (c) synced. *Pick (a).* Fastest, matches how the data already works, reversible.
2. **Locked or free after insert?** Free (ordinary blocks), locked (section block), or mixed. *Pick free,* locked only for logic blocks; revisit after seeing use.
3. **Where do sections live?** Per app (as today) or one shared library every site draws from. *Pick shared library with per-app opt-in lists,* so a gallery site does not see "Event header".
4. **Can an org save its own sections** (table `site_page_templates` exists, empty), and do they go through review to become network sections (as the direct-editing plan proposes)? *Pick yes to saving, review-to-network later.*
5. **Page start:** keep "replace the page" templates and add Sections beside, or retire whole-page templates in favour of stacking sections. *Pick keep + add.*
6. **Synced "site strips"** (join band, footer call-to-action): never / later / now. *Pick later,* after (a) shows which strips owners repeat.
7. **Example words:** visible placeholders or empty fields. *Pick visible example words plus a Publish nudge.*
