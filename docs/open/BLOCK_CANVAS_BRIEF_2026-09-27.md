# The essay canvas: a block editor for writing (brief, 2026-09-27)

Design for the Studio's editor column as a canvas where pictures and text are
placed by drag and drop and the published page reads like a set essay. Written
after a survey of the tree (blocks, Puck, editor, sanitiser, article renderer,
media) and a research pass over block editors and editorial layout. Nothing
here is built. The direction is stated once, in §1, and the rest follows it.

Companion: `docs/open/STUDIO_BRIEF_2026-09-27.md` (§4.3a records the ask).

## 1. Direction

**Flow, not coordinates.** The canvas is a column of blocks in reading order.
A block can be as wide as the text, wider than the text, or the full page. It
cannot be placed at an x/y. Free-position canvases (Squarespace Fluid Engine,
GrapesJS absolute mode) do not survive a narrower viewport, browser zoom or a
change of type size; the engineers who built Fluid Engine say so
(engineering.squarespace.com, "Developing Fluid Engine"). Everything a
writer wants from "moving the picture around the text" is reached with
three widths, one side-by-side block, and the margin.

**Set like a book, not a poster.** The page keeps one measure (65ch), one
type scale, one spacing scale. Pictures breathe by breaking out of the
measure, not by floating inside it. Captions are set in the UI face, small,
under the picture. The margin is a place: at a wide viewport an aside sits
beside the paragraph it belongs to (Tufte); on a phone it folds inline. This
is the Ghost/Medium stance, with Medium's wrap option and Notion's columns
deliberately left out because both break on phones and in the editor.

**The writer never sees a form.** Every option is on the block, in place:
a width toggle, a caption line, an alt field, a focal point you drag on the
picture. Settings that belong to the piece (cover, layout preset, show on)
stay in the Studio's right panel; nothing about a block lives there.

**HTML stays the published form.** Thirteen routes across the sites render
the body with `ArticleView` from sanitised HTML. They keep doing so. The
canvas edits a document model and the server renders it to HTML with a
small set of `eac-` classes. No site needs a renderer for a new format.

## 2. What exists (verified 2026-09-27)

- `@elkdonis/blocks` + `@elkdonis/page-builder`: a block catalogue and its
  Puck adapter for org and person *pages* (`site_config` / `user_pages`
  JSON, rendered server-side with `@puckeditor/core/rsc`). Its `figure`
  block already has `measure|wide|full` widths and a float-with-wrap option
  (`packages/blocks/src/blocks/figure.tsx:24-120`). Puck stays for pages.
  It is not used for essays: its data model is slots and components, not a
  text document, and its output is JSON.
- `@elkdonis/cms-ui/editor`: TipTap 2.26, StarterKit, Image (URL prompt),
  tables, YouTube. No node views, drag handle, slash menu or media picker.
- `ArticleView` + `article.css`: `dangerouslySetInnerHTML` into
  `.eac-article__body`; `--read-measure: 63ch`; **no breakout, figure,
  pull-quote or aside classes**; `.eac-article__body > *` is capped at the
  measure (`article.css:175`).
- `sanitizeRichText` (`packages/utils/src/sanitize.ts`): allows `class`,
  `style`, `data-*`; **strips `figure`, `figcaption`, `picture`, `source`,
  `video`, `srcset`, `sizes`**.
- Media: `/api/media/[...path]` serves Nextcloud files; `?w=` resizes with
  sharp at 128/256/512/1024 (`packages/services/src/media-thumbnail.ts:19`);
  `srcSet()` helper in `packages/blocks/src/media.ts:15-33`; artdirect's
  route does not pass the width. `MediaPicker`/`MediaBrowser` exist with
  HTML5 drag helpers (`writeMediaDrag`/`readMediaDrop`).
- `threads.body_format ∈ {html, md, mdx}`; `body` always holds HTML; no
  JSON body anywhere.
- `@dnd-kit/core` 6 / `sortable` 8 installed in four apps and `pipeline`.

## 3. Architecture

### 3.1 Document model: TipTap, one node per block

TipTap 2 (ProseMirror) is already the editor, the team knows it, and its
schema is the right shape: a block is a node, its options are node
attributes, its React node view is the in-place UI. The drag handle in the
margin is `@tiptap/extension-drag-handle` (MIT since June 2025), drop
targets are block boundaries via `prosemirror-dropcursor`, and moves use
ProseMirror's own drag so undo, selection and collaboration stay coherent.
`@dnd-kit` is used only *inside* a node view that reorders its own children
(the gallery), where it adds keyboard sorting and live-region announcements.

Rejected: Lexical (a second editor stack for no gain), Editor.js (JSON only,
renderer per surface), Puck for essays (see §2), Craft.js (no UI, no text).

### 3.2 Storage: JSON source, HTML product

- New column `threads.body_doc jsonb`: the TipTap document, the editing
  source. Migration via `/new-migration`.
- `threads.body` stays the sanitised HTML, rendered **on the server** from
  `body_doc` at save (`renderEssayHtml(doc)` in `@elkdonis/studio/render`,
  a pure function over the schema), then passed through `sanitizeRichText`.
  The browser's `getHTML()` is never trusted or stored.
- `body_format` gains `'doc'` (migration; the CHECK from 083). Sites do not
  read it: they render `body` as today.
- A piece with `body` but no `body_doc` (everything written so far) loads
  through the schema's `parseHTML`; the first save writes `body_doc`. No
  bulk migration.

This is Ghost's model (Lexical JSON as source, HTML for themes) without the
per-card renderer coupling, because the renderer lives beside the schema in
one package.

### 3.3 The grid the sites render

`article.css` gains the named-line grid (Comeau "Full-Bleed Layout",
Mulligan "Layout Breakouts") with two breakouts and full:

```css
.eac-article__body {
  display: grid;
  grid-template-columns:
    [full-start] minmax(var(--read-gutter, 1rem), 1fr)
    [wide-start] minmax(0, var(--read-wide-ext, 6rem))
    [content-start] min(var(--read-measure, 65ch), 100%) [content-end]
    minmax(0, var(--read-wide-ext, 6rem)) [wide-end]
    minmax(var(--read-gutter, 1rem), 1fr) [full-end];
}
.eac-article__body > * { grid-column: content; }
.eac-article__body > .eac-w-wide { grid-column: wide; }
.eac-article__body > .eac-w-full { grid-column: full; }
```

The existing `max-width` on `.eac-article` moves to the header (title,
lede, meta) so the body can span. Every org's theme keeps its `--read-*`
tokens; an org may set `--read-wide-ext: 0` to forbid the wide breakout on
its site, which is the "org imposes its layout" rule from the Studio brief
applied at the block level.

### 3.4 Sanitiser

`sanitizeRichText` adds: tags `figure figcaption picture source aside`;
attributes `srcset sizes loading decoding data-width data-align
data-focal-x data-focal-y`; `ALLOW_DATA_ATTR: false` with that named list;
a class allow-list by prefix `eac-`. `style` is removed from the essay
path (rule 7, §6). Existing bodies with `style` keep rendering through the
old path until re-saved from the canvas.

### 3.5 Images

Every image block emits `width`/`height` (from the asset row or a HEAD on
the media route), `srcset` at 512/1024/1600/2400 and `sizes` matched to
its width class (`(min-width: 1200px) 65ch, 100vw` for content;
`min(100vw, 65ch + 12rem)` for wide; `100vw` for full), `loading="lazy"`
below the first screen, and `data-focal-x/y` applied as `object-position`.
The media thumbnail route gains 1600 and 2400 widths and artdirect's route
passes the width. The Studio brief's `assets` table (§7.2 there) is where
dimensions, alt and focal point live once it exists; until then they are
node attributes.

### 3.6 Static and live blocks

Two classes, decided after the developer's questions (2026-09-27 evening):

- **Static** blocks (text, image, gallery, figure with text, pull quote,
  aside, divider, embed card, code) are rendered to HTML at save by
  `renderEssayHtml` and never change until the piece is saved again.
- **Live** blocks carry another row's state and cannot be frozen: a
  meeting card (date, place, who is going), a piece card, an artwork
  (availability), a workshop (registration). They render to a marker,
  `<eac-embed data-kind="thread" data-id="…" data-view="card">`, which
  `sanitizePostBody` already admits, and each site resolves the marker at
  request time into the card component it uses on its own feed (the
  surface system's thread cards). A site that has no resolver shows the
  marker's fallback: the title as a link.

### 3.7 The kind's fields make the card; the canvas makes the page

For every kind, the standard expression (a card on a feed, the hub, the
Center, or inside another piece) is generated from the row's fields and is
never laid out by hand. The dedicated page is the header from the fields
(a meeting's when, where, RSVP, hosts) followed by the body from the
canvas. So a meeting or workshop page can carry pictures, a gallery and an
aside like an essay, and the fields stay in the Studio's settings panel,
never in blocks.

### 3.8 Preview and render profiles

`renderEssayHtml(doc, profile)` has profiles: `page` (the grid and
classes above), `email` (inline styles, single column, images at fixed
widths, live blocks as their fallback link) for `@elkdonis/email`, and
later `print`. The Studio's Preview calls the `page` profile and shows the
result in `ArticleView` under the tokens of a chosen "show on" org, so
preview and page share one function and cannot drift.

### 3.9 Turning a plain post into blocks

A body saved before the canvas loads through `parseHTML` as a column of
paragraph blocks; nothing changes until it is touched. From there:

- **Select text → "Turn into…"**: a floating menu on any text selection
  (also on right-click) offering Figure with text (the selection becomes
  the text beside a picture dropped in next), Pull quote (a copy; the
  original stays), Aside, Quote, Heading. In ProseMirror these are
  wrap-selection commands.
- **Insert between paragraphs**: the margin `+` or `/` on an empty line:
  image, gallery, thread card, divider, embed.

The first save from the canvas writes `body_doc`.

## 4. Blocks

Ten. Each is a schema node, a node view, a renderer case, and a CSS block.
"Width" is `content | wide | full` unless stated.

| Block | Options | Notes |
|---|---|---|
| Paragraph, heading | h2, h3 only | StarterKit; h1 is the title |
| Image | width, caption, alt (required), focal point, link | `figure.eac-image > picture + figcaption` |
| Gallery | 2–6 images, width wide/full, per-image caption | rows by aspect ratio (Ghost's `flex: w/h`); dnd-kit reorder in the node view |
| Figure with text | image left/right, image share 40/50/60, caption | side by side only ≥ 60ch container; stacks below (container query) |
| Pull quote | width content/wide, attribution | must repeat text in the body (warn) |
| Blockquote | attribution | StarterKit + attr |
| Aside | none | margin note at ≥ 1200px (`grid-column: wide-end / full-end` beside its anchor), inline card below |
| Divider | rule, ornament, space | three glyphs |
| Embed | URL → oEmbed card, or YouTube/Vimeo player | replaces the Youtube node; bookmark card for other URLs |
| Cards (live), one per kind | **which** thread, chosen from a picker over the author's own things (search by title); view card/compact | Meeting card (when, where, going, RSVP), Piece card (title, reading time, date), Artwork card (image, medium, dimensions, **price and for-sale state** from the store), Workshop card (dates, registration). One node type `threadCard` with `kind`; the face differs per kind (dev, 2026-09-27) |
| Code | language | existing lowlight node |

The card node stores a snapshot (title, meta, cover, price) so a site with
no resolver still shows something true at save time, plus
`data-thread-id`/`data-kind` so a site with one replaces it live.

**"Use blocks" (dev, 2026-09-27):** the canvas is offered in the Studio's
settings panel as a per-piece switch. Off, the piece keeps the small
editor and `body_format = 'html'`; on, the body is parsed into blocks and
the next save writes `body_doc` and `body_format = 'doc'`. The switch
remembers the writer's last choice for new pieces.

Deliberately absent: columns, free tables of images, text wrap around
images, colour and font-size marks. Each of these is where writers' pages
stop reading well and where the editor and the phone disagree.

## 5. Code structure

```
packages/studio/src/canvas/
  schema/
    index.ts            extensions list for the Editor (StarterKit tuned + blocks)
    image.ts            Node: attrs {src,width,height,alt,caption,widthClass,focalX,focalY,href}
    gallery.ts          Node with content 'galleryImage+'
    figureText.ts       Node with content 'image paragraph+'
    pullQuote.ts, aside.ts, divider.ts, embed.ts
  views/
    ImageView.tsx       node view: picture, width toggle, caption field, alt, focal handle
    GalleryView.tsx     dnd-kit sortable grid, add/remove, per-image caption
    FigureTextView.tsx, PullQuoteView.tsx, AsideView.tsx, DividerView.tsx, EmbedView.tsx
    BlockChrome.tsx     shared: width toggle, move up/down, remove, block menu
  handle/
    DragHandle.tsx      @tiptap/extension-drag-handle + dropcursor config
    keyboard.ts         Mod-Alt-Up/Down move block; Mod-Shift-W cycle width
  insert/
    SlashMenu.tsx       "/" opens the block list; "+" in the margin does the same
    MediaDrop.ts        drop from Library/desktop → upload → image or gallery
  render/
    renderEssayHtml.ts  doc → HTML string (server); one case per node
    essay.css           the grid, widths, figure/caption/aside/pull-quote rules
  Canvas.tsx            the editor: EditorContent + handle + menus; props {doc, onChange}
  index.ts
```

- `renderEssayHtml` is pure and runs in the server action
  (`saveStudioPiece`), so a browser cannot submit arbitrary HTML for a
  `doc` body. The same function powers Preview, so preview and page cannot
  drift.
- `essay.css` is imported by `article.css` (one file the sites already
  load), not by each app.
- `WritingEditor.tsx` swaps `RichTextEditor` for `Canvas` behind a
  `body_format` check: `doc` (or empty) → Canvas; `html` → Canvas via
  `parseHTML`; `md` → the read-only Nextcloud view.
- Nothing in `cms-ui/editor` changes; the org sites' comment boxes and
  compose popups keep the small editor.

## 6. Rules the editor enforces

1. The measure is fixed at 65ch; nothing sets a text width.
2. Two breakouts (`wide`, `full`) plus `content`; no other widths exist.
3. No text wraps around an image. Figure-with-text is the one side-by-side
   block, and it stacks under 60ch.
4. Every image has alt text before the piece can publish; captions are set
   in the UI face and may be empty.
5. One vertical spacing scale (three steps); a block picks its gap, never a
   number.
6. Images always emit `width`, `height`, `srcset`, `sizes`; no bare `<img>`.
7. No inline `style`, colour, or font-size survives a save.
8. Two heading levels; two headings may not be adjacent.
9. A pull quote should repeat text in the body; the editor warns, not blocks.
10. Drop targets are block boundaries. A dragged block never splits a
    paragraph.

## 7. Interaction, in order of what the writer meets

- Type. Paragraphs and headings as now; `/` opens the block list.
- Hover a block: a grip appears in the left margin (drag) and a `+` (insert
  after). Right of a wide-capable block: the width toggle `▭ ▭▭ ▭▭▭`.
- Drop an image from the Library (or the desktop) anywhere: it lands at the
  nearest block boundary as an Image at content width; drop several: a
  Gallery. The drop cursor is a line between blocks, never inside text.
- Click an image: caption line under it, alt in a small field, focal point
  as a draggable dot; width toggle in the margin.
- Keyboard: Mod-Alt-↑/↓ moves the block; Mod-Shift-W cycles width;
  Backspace on an empty caption removes only the caption.
- Preview renders the same HTML the site will, in the piece's layout
  preset and the first "show on" org's tokens.
- Phone: no drag handle; move up/down buttons in the block chrome; widths
  collapse (everything is `content` under 700px, `full` stays full).

## 7a. Other uses of the same editor

- Workshop, meeting and series pages: header from fields, body from the
  canvas (§3.7).
- Reading-circle session notes with a figure and the recording embedded.
- Exhibition or catalogue pieces: gallery, figure with text, live artwork
  cards that keep their availability.
- Newsletters: the `email` profile of the same doc.
- The forum wiki, if wiki pages should carry figures the same way (open;
  the wiki has its own editor today).
- Export: the doc is JSON, so PDF or `.docx` is a renderer, not a rewrite.

## 7b. Built 2026-09-27 (same evening)

Phases 1–3 shipped in arts-collective builds 11–13, with these departures
from the plan above:
- The renderer lives in `@elkdonis/utils/essay` (`essay-render.ts`,
  `essay-types.ts`), not a `packages/essay`: services imports it, and every
  app already transpiles utils; a new source package would have needed
  seventeen `transpilePackages` entries. `essay.css` sits beside
  `article.css` in cms-ui for the same reason.
- Blocks shipped: image (width, caption, alt, focal point), pull quote,
  aside, divider, gallery (2–6, rows by aspect ratio, order with arrows,
  per-picture caption and alt), picture with text (side, 40/50/60 share,
  stacks under 60ch), cards (meeting/event/workshop/piece via `threads`,
  artwork via `artwork` + `artwork_media` + `artwork_variant` with image,
  price and for-sale state) with a picker and a content/wide width. Insert
  is the `+` at the foot of the hovered block (developer's preference over
  a top bar); "Turn into…" on a selection offers pull quote, aside, picture
  with text, heading. Not yet: embed card, `/` slash menu, email render
  profile, site-side live card resolvers (the snapshot renders), layout
  blocks (columns) which the developer asked to consider.
- Usability pass (dev feedback, build 18): ProseMirror's defaults made
  blocks feel unlike paragraphs (typing replaced a selected block; no way
  out of a single-line block; nowhere to type after a trailing atom). The
  `EssayKeys` extension (`schema/keys.ts`) fixes each; `+ Block` in the
  bar and "Add a block at the end" reach the menu without hover, which is
  what phones need. Verified by a scripted run: divider kept when typing
  straight after it, Enter leaves the pull quote, the doc ends with an
  empty paragraph, 400px has no overflow.
- "Use blocks" is a per-piece switch in the Studio's settings panel; the
  writer's last choice is remembered per browser.
- Two traps recorded in `docs/reference/apps.md`: JSON-clone the doc before
  the server action (null-prototype attrs become temporary references), and
  compare the doc against what was sent (jsonb reorders keys).

## 8. Phases

1. Grid and classes in `article.css`, sanitiser additions, image `srcset`
   widths in the thumbnail route. Sites gain nothing visible yet.
2. `body_doc` migration; `renderEssayHtml`; the save path renders on the
   server. `WritingEditor` still uses the small editor; bodies round-trip.
3. Canvas with Image, Pull quote, Divider, drag handle, slash menu, Library
   drop. Ship behind a Studio toggle ("Canvas (beta)").
4. Gallery, Figure with text, Aside, Embed. Retire the toggle.
5. Focal point and the `assets` table; org `--read-wide-ext` policy.

Effort, assumed: phases 1–2 one session; 3 two to three; 4 two; 5 one.

## 9. Open questions

- Whether `body_doc` should be `metadata.doc` instead of a column. A column
  is proposed: it is large, queried on every open, and not metadata.
- The aside's anchor: the previous block (simple) or an explicit reference
  (survives moves). Previous block proposed.
- Whether org sites should get the wide breakout on by default or opt in.
  On by default proposed; IFAC's dark theme is the first to check.
- The reading preset (journal/gazette/quiet) vs the Studio brief's layout
  presets (essay/feature/note/announcement): the latter should become
  values of the former, not a second axis.

## History

- 2026-09-27: written from a tree survey (blocks, page-builder, editor,
  sanitiser, ArticleView, media, dnd libraries) and a research pass
  (TipTap node views and drag handle, Koenig, Gutenberg, Editor.js, Puck,
  Craft.js, GrapesJS, Fluid Engine, Comeau/Mulligan grid, Tufte, Bringhurst).
  Mockup published alongside.
