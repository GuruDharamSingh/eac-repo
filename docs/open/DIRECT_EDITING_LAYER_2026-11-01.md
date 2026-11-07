# Direct editing layer over Puck (2026-11-01)

Status: experiment. A standalone prototype exists; nothing in the repo uses it yet.
Prototype (classifieds ads): https://claude.ai/artifact/2RjNrmiF7zYFAF2k3UCJkB

## The idea

Keep blocks as the data model. Replace Puck's "select a block, edit a form" with
GrapesJS-style direct editing on the page itself:

- Click selects a block; a second click goes inside it to a part (heading, body,
  image, frame). Esc goes up. A breadcrumb and a layer tree show the path.
- The right panel shows only the style slots that part declares (font, size,
  weight, case, align, leading, border, tone, padding, header style).
- Drag edge handles to resize on the grid; double-click text to type in place;
  Alt + scroll cycles fonts, Shift + scroll changes size.
- Graft: drag a part onto another block to give it that part's look (and, for a
  header, its words). Graft then "Save as template" is how templates merge.
- Copy style / paste style between parts.
- A freedom level per org or per user: Family (only what the style family
  allows), Borrow (fonts and sizes from any family), Free (anything, plus raw CSS,
  i.e. GrapesJS). Overrides outside the current level are flagged amber, with
  "Snap to family"; nothing is silently changed.

Every edit is stored as `{ template, overrides }` on the block, never as HTML.
Improving a template or a family improves every block built from it.

## Why not GrapesJS or Silex as the engine

GrapesJS (BSD-3) edits a free HTML/CSS component tree. Its interaction model is
the part worth taking; its data model (free HTML, generated CSS rules) is the
part that made Silex sites unreusable. Our blocks are React components with
declared props. So: port the interaction concepts (selection depth, layer
manager, style manager sectors, resizer), not the engine. Any code lifted from
GrapesJS (for example its Resizer util) keeps its BSD-3 notice.

## How it maps onto Puck 0.23

| Prototype concept | Puck hook |
|---|---|
| Block data `{ template, overrides }` | Component props; Puck `Data` unchanged |
| Undo/redo | Puck history (free) |
| Nested blocks | Puck slots (`type: "slot"`) |
| Parts inside a block | A marker like `editItem` (@elkdonis/blocks edit-item.ts): blocks wrap each part in `editPart(name)`; generalises `drag/item-focus.tsx` |
| Click-deeper selection, hover boxes, handles, graft grip | `overrides.iframe`: an overlay in the canvas document, hit-tested by rectangle (Puck sets pointer-events: none inside components, already handled in item-focus) |
| Inspector of style slots | `overrides.fields`: render slot controls for the focused part instead of the block's whole form |
| Writes | `dispatch({ type: "replace", ... })`, the same path item-focus uses, then the block's resolver |
| Inline text | Puck 0.23 inline richtext (`contentEditable`) where the prop is richtext; our own for plain strings |
| Style slots and ranges | New per-block declaration beside `fields`: `parts: { title: { font: "display", size: [13, 26] } }`, resolved against the org's family/theme |
| Freedom level | `org_capabilities` config (decision 5 of the one-app review), default Family |
| Layer tree | A Puck plugin tab (left rail) listing blocks and their parts |

## Order of work

1. Part markers and style-slot declarations in `@elkdonis/blocks` (two or three
   blocks first).
2. The iframe overlay: selection depth, hover, breadcrumb; inspector override.
3. Resize handles for grid-span props; graft and copy/paste style.
4. Classifieds as the first host (ArtDirect), then org-site pages.

Open questions for Justin: which freedom level members get by default; whether
Free (raw CSS) is ever offered to members or only to admins.


## Reference: the claude.ai design canvas (teardown of Justin's recording, 2026-11-01)

Source: `C:\Users\Justi\Videos\canvas on claude.mp4` (153 s), Justin editing the
"Classifieds — newspaper prototype" design. Observed directly unless marked
"inferred".

### What the panel offers (observed)

Right panel, tabs Properties · Code · Tweaks. Properties top to bottom:

- Layer tree (the selected node's neighbourhood), each row named by role + first
  text: `Heading "Drawing tab…"`, `Paragraph "Beech top…"`, `Text "For sale"`,
  `Row "$120 Box 6"`, `Column "For sale Drawing…"`, `group`, `Section Second page
  of ads`, `Column #studios`. Eye icon toggles visibility.
- Align row: left/centre/right, top/middle/bottom.
- Size: Width / Height with a mode each (Hug, presumably Fill and Fixed),
  Position (Inline / Absolute; Absolute adds Offset X/Y), Grow.
- Layout (containers): Layout (Block / Stack), Direction (row / column + wrap),
  Align (9-way), Gap (shows "Mixed" when children differ), Padding uniform or per
  side (toggle), Margin.
- Link: Destination URL.
- Text: Text style (a document-wide scale: Heading 2, 7, 8, 10, 15, Caption;
  editing one property turns it into "Custom"), Font, Weight, Size, Spacing
  (line-height and letter-spacing), Colour with a live "Good contrast / Poor
  contrast" check, Align (left/centre/right/justify) with a reset arrow when
  changed.
- Appearance: Fill, Opacity, Radius (uniform or per corner), Border (none /
  solid / dashed / dotted, colour, width).
- Effects (+): Layer blur, Background blur, Transform (X, Y, rotate, scale X/Y).
- Export, then Advanced: z-index, overflow (x/y), cursor, pointer-events,
  object-fit, white-space, text-overflow, text-decoration, box-sizing,
  aspect-ratio, transition, animation.
- Debug: `{"tid":21,"tag":"p","parent":"div","attrs":{},"style":"margin: 0;
  font-size: 34px; …"}`.

Code tab: the selected element's tag + text snippet, then its declarations as an
editable list (`font-size: 34px; line-height: 1.8; filter: blur(4px); …`).

Canvas: floating text toolbar on a selected text box (text style, colour, B, I,
U, link, list, align, comment, more); hover and selection outlines with corner
handles; a mid-edge grabber to drag height; dragging an element shows an
insertion line and can drop it into another container (the Swiss "FOR SALE" tab
was moved into the broadsheet ad; the Swiss ad dropped out of the four-up row
became full width). Free placement sets Position: Absolute with offsets. Left
toolbar: select, hand, text, frame, sticky/comment, pen, shapes; zoom; present.
Title shows a dot while there are unsaved changes.

### How it works (inferred)

1. The design is real HTML in an iframe. On load every element gets a tracking id
   (`tid`) and a node record: tag, parent, attrs, inline style.
2. The panel reads `getComputedStyle` (values like `420px`, `Old Standard TT`,
   `Bold` are computed) and writes inline style declarations on the element
   (the Code tab and Debug show only what was written). Saving serialises the
   edited DOM back into the design file.
3. Layer names: h1–h6 → Heading, p → Paragraph, text-only span/div → Text,
   flex containers → Row or Column by `flex-direction`, else group; a section
   uses its label; an id shows as `#id`; plus the first ~20 characters of text.
4. Text styles: the distinct (font, size, weight, line-height) combinations in
   the document, ranked by size and numbered; choosing one writes all four.
5. Contrast: text colour against the first opaque background found walking up
   the ancestors, WCAG ratio, threshold about 4.5:1.
6. Hug / Fill / Fixed = `width: fit-content|auto` / `flex: 1` or `100%` / px.
   "Breaking out of a column" is either a reparent (drop into the outer
   container) or switching width to Fill in a wider parent.

### What to take, what to leave

Take: the panel's order and grouping; computed-read / scoped-write; the layer
naming; the document type scale as presets; the contrast check; drag to reorder
and reparent with an insertion line; the per-side padding and per-corner radius
toggles; Advanced as a raw-CSS catch-all; a Code tab.

Leave (for member sites): free HTML with inline styles as the stored result, and
Absolute positioning outside the Free level. Both make pages that cannot be
re-themed or reused and that break on phones. In our layer the same controls
write to block-part overrides, the text-style presets are the family's type
scale, Hug / Fill map to grid span (Fill = full row, "break through columns"),
and Advanced writes to the part's sanitised `css` override.
