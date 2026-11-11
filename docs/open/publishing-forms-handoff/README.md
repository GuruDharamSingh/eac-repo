# Handoff: Publishing forms (Post, Gathering, Series, Artwork, Poll/Questions, Quick compose)

## Overview
One family of creation forms for every kind of publication on the platform. All kinds share the same shell, field components, live preview and actions; each kind adds its own sections. The form runs in two places:

1. **Studio focus mode**: the full form (top bar, section index, form, live preview).
2. **Quick compose**: a compact version in a popover anchored to an "Add" button on a site page. On mobile it becomes a bottom sheet. It has fewer fields, takes the rest from a preset, and "Open in Studio" carries everything into focus mode.

Kinds:
- **Post**: writing, news and announcements.
- **Gathering**: covers meetings. With Repeat on and "Present it as a series" ticked, it becomes a **Series** in place, and a session planner grows inside the form.
- **Artwork**: store and gallery items.
- **Poll / Questions**: small add-ons, either attached to a post/gathering/series or published on their own.

Target codebase: `GuruDharamSingh/eac-repo` (Next.js 15 App Router, React 19, Turborepo/pnpm). The on-site CMS lives in `packages/cms-ui` (`surface/`); Puck page blocks are in `@elkdonis/blocks`. Per `.design-sync/NOTES.md`, don't build the base on shadcn. The product owner said to **disregard the existing compose/studio forms**; build these fresh.

## About the design files
The files in this bundle are **design references made in HTML**: prototypes showing the intended look and behaviour, not production code. Recreate them in the target codebase's environment (React components in `packages/cms-ui` or a new `packages/compose`), using its patterns for state, forms, data and routing. Don't ship the HTML.

The `.dc.html` files are self-contained "Design Components": markup with `{{ }}` holes, plus a small `class Component` whose `renderVals()` holds the state logic. Open `Publishing Forms.dc.html` in a browser (served from this folder) to see every screen on one canvas. `support.js` is the prototype runtime only.

## Fidelity
**High fidelity.** Colours, type, spacing, copy and interactions are final, within the **Broadsheet** design system (tokens and classes are in `_ds/…/styles.css`). Recreate it pixel-accurately, using the codebase's own components where they exist.

**Open decision:** the preview placement isn't settled yet. 1a/1b/1c etc. show a fixed preview column. The client then asked for a toggled preview, and two versions are awaiting a pick:
- **2a** (`layout="toggle"`): no preview by default; a Preview button in the top bar opens the right-hand column.
- **2b** (`layout="rail"`): the left sidebar switches between Sections and Preview, giving a two-column layout.

Build preview placement as a layout switch until this is decided.

---

## Screens / views (canvas ids)

| Id | Screen | Component and props |
|---|---|---|
| 2a | Shell, Post, preview behind a top-bar toggle | `Publish Form` kind=post layout=toggle |
| 2b | Shell, Post, sidebar switches Sections/Preview | `Publish Form` kind=post layout=rail previewOpen |
| 1a | Shell, Post, fixed preview | `Publish Form` kind=post |
| 1b | Gathering, RSVP and Emails open | kind=gathering expand="rsvp,emails" |
| 1c | Gathering with Repeat on, so a Series with planner | kind=gathering repeat |
| 1d | Session planner, alternate: calendar | inline in canvas |
| 1e | Session planner, alternate: programme | inline in canvas |
| 1f | Artwork | kind=artwork |
| 1g | Quick compose popover on a site page | `Quick Compose` |
| 1h | Validation: Publish pressed with errors | kind=gathering errors |
| 1i | Field states sheet | inline in canvas |
| 1j | After publish, focus mode | kind=post stage=published |
| 1k | After publish, quick compose | `Quick Compose` stage=published |
| 1l–1p | Mobile: Post, Post preview tab, Gathering, Series, Artwork | viewport=mobile |
| 1q | Mobile quick compose, as a bottom sheet | `Quick Compose` viewport=mobile |
| 1r, 1s | Poll add-on (attached); Questions (standalone) | inline in canvas |

### 1. The shell (focus mode, desktop, designed at 1320px wide)

Page background `--color-bg` #f3f2f2, text `--color-text` #201e1d, everything in Source Serif 4.

**Top bar**: a flex row, `padding: 14px 24px 14px 14px`, `gap: 16px`. No border and no background change.
- Left: ghost button "← Studio" (13px, Phosphor `arrow-left` 16px).
- Kind label: 18px/600, e.g. "New post", "New gathering", "New series", "New artwork". After it: `caret-down` 14px in neutral-700, which opens the kind switcher.
- Status tag: `.tag.tag-neutral` "Draft". When live it's `.tag.tag-accent` "Published".
- Saved line: 12px neutral-700, "Draft saved 12:04".
- Right, gap 10: `.btn-secondary` "Save draft", `.btn-secondary` "Schedule…" (clock icon), `.btn-primary` "Publish". In layout=toggle a Preview button comes first (see Interactions). When published, the actions become ghost "Unpublish" and secondary "Back to Studio".

**Body**: a flex row with three columns, stretched to equal height.

1. **Section index (rail)**: `flex: 0 0 220px`, `padding: 28px 18px 32px 24px`, column gap 34px.
   - **Start from (presets slot)**: a group label (see Typography), then a select styled as `.input` (13px) with `stack` icon in accent, preset name, and caret. Below it a 12px/1.45 neutral-700 note describing the preset.
     - Post: "Blank post". Note: "Or: Lab notes, Announcement, or your last post's settings."
     - Gathering: "Thursday open studio". Note: "This org's usual setup: Studio 4, 2 hours, 24 places, a reminder the day before."
     - Artwork: "Editioned print". Note: "Edition of 25, framed and unframed variants, in the store."
   - **Index**: an "Essentials" group label, then items; a "More" group label (22px top margin), then items. Each item is 14px with a 16px status icon, 9px gap, 3px vertical padding.
     - Done: `check-circle` in accent #0088b0, text in text colour.
     - Optional and empty: `circle` in neutral-500 #9b9797, text neutral-700 #605d5d.
     - Error: `warning-circle` in accent-2 #d6006c, text accent-2-700 #aa0b56.
     - Warning: `warning` in accent-2-600 #d82071, text accent-2-700.
   - **Readiness** (pinned to the bottom with `margin-top:auto`): 13px with an 18px icon. "Ready to publish", or "2 things to fix before it can go out. 1 warning.", or "Published at 12:14. Edits go live when you save."
2. **Form column**: `flex:1; min-width:0; padding: 28px min(48px,5%) 64px`. The inner stack is `max-width: 600px`, column, gap 30px.
3. **Preview column**: `flex: 0 1 420px`, background `--color-surface` #eae9e9, `padding: 22px 24px 32px`, gap 14px.
   - Header row: "Preview" group label; "on Lab work" (12px neutral-700); a small `.seg` (Card | Page) on the right, with the seg background set to `--color-bg` and options at 12px, padding 5px 10px.
   - **Sheet**: background `--color-bg`, `box-shadow: var(--shadow-md)`, padding 18/18/22. It contains:
     - A breadcrumb line: "Elkdonis Arts Collective" (13px/600) then "/ Lab work" (11px neutral-700).
     - The kind's card or page.
     - A faded neighbour item at opacity .45 ("EARLIER" 10px caps, then a 15px/600 title) to show context.
   - Footnote (12px neutral-700): "Updates as you type. A draft only you can see."

### 2. Shared field components

- **Title (every kind)**: comes first in Essentials and is set as the headline, with no box. A borderless input on a transparent background: heading font, 600, **34px**/1.15, letter-spacing −0.015em, caret in accent. On mobile it's a textarea at 27px with `field-sizing: content`. Placeholder "Title".
- **Group label** ("Essentials", "More", "Start from", "Preview"): 11px, letter-spacing .1em, uppercase, neutral-700.
- **Field**: column, gap 8–10px.
  - Label: 14px/600.
  - Optional inline hint after the label: 12px neutral-700.
  - Control: `.input` — surface fill, 1px `--color-divider` border, radius 2px, min-height 36px, padding 6px 10px, 14px.
  - Hint below: 12px/1.45 neutral-700.
  - Leading icons in inputs: 16px Phosphor duotone in accent.
- **Segmented choice**: `.seg` + `.seg-opt`. The selected option is filled with accent and has bg-coloured text.
- **Switch** (Repeats, Take RSVPs): a 34×20 track with radius 2px. On: accent; off: neutral-400. The knob is 14×14 with radius 1px, bg colour, inset 3px. It sits in a row with the label (14px/600) and a summary (13px neutral-700).
- **Checkbox rows**: native checkbox 16px with `accent-color: var(--color-accent)`. Label 14px; optional second line 12px neutral-700.
- **More row (collapsible)**: a full-width button.
  - Row: `padding: 11px 10px; margin: 0 -10px`, `align-items: baseline`, gap 12. Hover: `color-mix(text 5%)` background, radius 2px.
  - Content: a `plus`/`minus` icon (13px, accent), the section name (17px/600), and **the current value as a summary** (13px neutral-700, ellipsis).
  - Body when open: `padding: 4px 0 22px 25px`, gap 14–20px.
  - No dividers between rows; spacing alone separates them.
  - When a closed row has a problem, the summary turns accent-2-700 with a `warning` icon.
- **Image placeholder** (for real images): a newsprint dot screen, `radial-gradient(circle, color-mix(text 20%) 30%, transparent 33%) 0 0/4px 4px` over neutral-300 #d7d3d3, radius 1px. In production, print images with the system's `.halftone` (or `.cmyk` for showcase).
- **Image sources**: three ghost buttons, Upload (`upload-simple`), Library (`images`), Camera (`camera`). They're 13px with 15px icons.
- **Inline lists (session planner, variants table)**: CSS grid rows.
  - Header: 11px, .08em, uppercase, neutral-700, with a bottom border in `--color-divider`.
  - Rows: 10px vertical padding, bottom border `color-mix(text 8%)`. These are the same rules as the DS `.table`.

### 3. Post (1a, 2a, 2b)
**Essentials:** Title, Body, Cover, Goes on.

- **Body: block editor**, in focus mode only.
  - Meta line: `.tag-neutral` "Blocks", then "412 words, about 2 minutes" (12px).
  - Floating toolbar: bg colour, `--shadow-md`, radius 2px, padding 4px 6px, 13px items. Items: "+" | H2 H3 | **B** *I* U | " " • List 1. List Link, with dividers 1×16px in `--color-divider`.
  - Body text 16px/1.65, paragraph gap 14px.
  - Pull quote: italic 21px/1.4, 28px indent, with a drag handle (`dots-six-vertical`) hanging in the left margin. No coloured left border.
  - Picture block: 16:8 image with a 12px neutral-700 caption.
  - Ghost "+ Add a block" at the end.
  - The "+" menu offers Paragraph, Picture, Gallery, Picture with text, Pull quote, Aside, Divider, Meeting card, Artwork card, Piece card, Heading. This list comes from the existing Studio editor; the client likes the picture block.
- **Cover**:
  - Label "Cover", with hint "On cards, at the top of the page and in link previews."
  - A 200px-wide 16:9 thumbnail next to an alt-text input ("Inking the Albion press, first morning") and the hint "Alt text, read aloud to people who can't see the picture."
  - Ghost buttons: Focal point, Upload, Library, Camera.
- **Goes on**: a select ("Lab work · Elkdonis Arts Collective", newspaper icon) plus a seg with Public (globe) | Members (lock). Hint: "Members-only posts show a locked card to everyone else."

**More rows** (summaries in brackets):
- **Excerpt** ("From the opening of the body"): a textarea. "One or two lines for cards and link previews. Left empty, it is taken from the body."
- **Tags** ("printmaking, soy ink"): a tag input with `.tag-accent` chips.
- **Also show on** ("Your profile"), open by default:
  - Home org, checked and disabled: "Where it lives. Change it under Goes on."
  - "Your profile · Mara Okafor", checked.
  - "Inner Gathering", unchecked: "Another org. Their editors approve it before it shows."
- **Schedule** ("Goes out when you press Publish"): date and time inputs, plus the hint "Publish then becomes Schedule. Eastern time (Toronto)."
- **Poll or questions** ("None"): buttons "Add a poll", "Add questions", and ghost "Attach one you made".

**Preview card**: a `.card` with no padding.
- 16:9 image.
- Body padding 14/16/16, gap 6.
- Kicker "LAB WORK" (`.card-kicker`, colour overridden to accent-700 for contrast).
- Title 19px/600, live from the title field.
- Excerpt 13px neutral-800.
- Meta "Mara Okafor · 2 min read".

**Page preview**: kicker, title 24px, meta, image, then a paragraph.

### 4. Gathering (1b) and Series (1c)
**Essentials:** Title, When, Where, Description. Sessions is added after When when it's a series.

- **When**:
  - A row with a date input (calendar icon, "Thu 19 Nov 2026"), a time input (96px, "18:30") and a duration seg: 1h | 1½h | **2h** | 3h | Other.
  - Hint: "Ends 20:30 · Eastern time (Toronto) · Change".
  - Then the **Repeats** switch, with the summary "Does not repeat" or "Every week on Thursday, 8 sessions".
- **Repeat on** opens a sub-block indented 46px:
  - "Every [week ▾] on [Thursday ▾]", plus a seg: **8 sessions** | Until a date.
  - Checkbox **"Present it as a series"**: "It gets a series page that lists every session. People can join the whole run or single evenings."
  - When ticked: the title bar reads "New series", the rail adds Sessions and Series page, the preview becomes a series card, and the **Sessions planner** appears.
- **Sessions planner (1c, list version)**:
  - Summary line: "8 sessions · 19 Nov to 21 Jan · 2 dates skipped".
  - Grid columns `24px 82px minmax(0,1fr) 30px`: No. | Date | Title and note | action.
  - Active row:
    - Number: 15px/600.
    - Date: 13px.
    - Title: 15px. If untitled, italic neutral-600 "Session 8, no title yet".
    - Note: 13px italic neutral-700, or "+ note" in accent-700.
    - Action: icon button `calendar-x` "Skip this date".
  - Skipped row:
    - "–" in place of the number.
    - Date struck through in neutral-600.
    - "Skipped: Christmas Eve" in italic.
    - Action: `arrow-counter-clockwise` "Put this date back", in accent.
  - Skipping and restoring renumber the sessions live.
  - Below: ghost buttons "Add a session" and "Skip dates…", then the hint "Each session gets its own page and RSVP. Untitled sessions read "Session 8"."
- **Planner alternates**: 1d **Calendar** and 1e **Programme**.
  - 1d: three month grids with 26px cells.
    - Session days are filled accent-200 with accent-900 bold text. The selected day is filled accent with a 2px bg plus 1px accent ring.
    - Skipped days have a dashed neutral-500 border and struck-through text.
    - A side panel on the surface colour holds the selected session's Title and Note, "Change for this session", and Skip / Put it back.
  - 1e: the planner is set as the printed series programme.
    - Each entry has a misregistered `.cmyk-num` numeral (44px/600), a date in 11px caps, a 21px/600 title that edits in place (with an accent underline and caret), and an italic note.
    - Skipped entries read "No session on 24 December: Christmas Eve."
  - Pick one; the client hasn't chosen yet.
- **Where**:
  - Seg: Place (`map-pin`) | Online link (`link`) | Talk room (`video-camera`).
  - **Place**: address input, plus ghost "+ Also online".
  - **Online link**: URL input. "Only people who RSVP see the link, in their confirmation and reminder."
  - **Talk room**: "A room is made in the collective's Nextcloud when you publish. People join from the page; the link goes out with their RSVP." Checkboxes: "Let people in without an account" (on) and "Open the room 10 minutes early" (off).
- **Description**: the toolbar editor, not blocks.
  - A surface box with a 1px divider border, radius 2.
  - Toolbar 12px: **B** *I* U H2 H3 • List 1. List Link, with a bottom border.
  - Body 14px/1.6, min-height 88px.

**More rows**:
- **Hosts** ("You"): a people input with chips.
- **Places and RSVP** ("24 places · closes when it starts"):
  - Inputs: Places (hint "Empty means no cap."), Needs at least (hint "Below this, we ask you two days ahead."), RSVPs close ("When it starts" ▾).
  - "Answers people can give": Going ✓, Maybe ✓, Can't come ☐, Waitlist when full ✓.
  - Ghost "Ask something when people RSVP", which opens the Questions add-on.
- **Emails** ("Confirmation, reminder a day before, changes"), each with an "Edit wording" link where shown:
  - ✓ "When someone RSVPs, a confirmation"
  - ✓ "A reminder [1 day ▾] before"
  - ✓ "If the time or place changes"
  - ☐ "Afterwards, thanks with the materials"
  - ☐ "To hosts, the morning's RSVPs"
- **Cover and pictures** ("None yet"): a dashed dropzone, "Drop pictures here. The first one is the cover.", plus the Upload/Library/Camera buttons.
- **Materials** ("Files, links or a shared document"): Add files, Add a link, and the checkbox "Make a living document": "A shared page in Nextcloud for notes and a running order."
- **Poll or questions** ("None").
- **Series page** (series only, "Listed on Series · colour picked for you"; keep it collapsed by default): checkboxes "Listed on the Series page", "In the landing page slides", "Featured, first on Series and the landing page".
- **Publishing** ("Public · Lab work · Elkdonis Arts Collective"): the Goes-on select plus the Public/Members seg.

**Preview cards**:
- Gathering:
  - 16:7 image.
  - Kicker "THU 19 NOV · 18:30 TO 20:30".
  - Title.
  - The where line.
  - `.btn-primary` "I'm coming" (13px), with "24 places".
- Series:
  - The same frame, with a tag "Starts 19 Nov" on the image.
  - Kicker "SERIES · THURSDAYS, 18:30".
  - "8 sessions, 19 Nov to 21 Jan · Studio 4".
  - "First: *Monotype basics*".

### 5. Artwork (1f)
**Essentials:** Title, Pictures, Maker and credits, Price, Availability.

- **Pictures**:
  - Hint "Drag to reorder. The first is the one on cards."
  - A primary image (4:5, max 300px) with a `.tag-accent` "On cards" in its corner, beside a 2×2 grid: three square thumbnails and a dashed "+ Add" tile.
  - Upload/Library/Camera buttons.
- **Maker and credits**: rows of [role select, 120px] + [person/name input].
  - "Artist" → chip "Mara Okafor".
  - "Printed by" → "Elkdonis Lab".
  - Ghost "+ Another credit".
- **Price**: seg Price | On request | Not for sale.
  - Price: "$ 180" input (150px) plus "CAD", and the hint "Variants below set their own prices. The card reads "From $180"."
  - On request: "The page shows "Price on request" and an Ask button that emails you."
  - Not for sale: "Shown in the gallery with no price and no button."
- **Availability**: seg Available | Reserved | Sold. Hint: "18 of 25 left. Turns to Sold by itself when the last one goes."

**More rows**:
- **Details** (open by default, "Etching · 40 × 50 cm · 2026"):
  - Medium: "Etching and aquatint on Hahnemühle, 300 gsm".
  - Size: H × W × depth (optional), with a cm | in seg.
  - Year: 90px input.
- **Edition and variants** (open, "Edition of 25 · 2 variants"):
  - Seg: One of a kind | **Edition** | Open.
  - "of [25] + [3] proofs".
  - Variants grid `1fr 84px 64px`: Unframed sheet $180, 14 in stock; Framed in oak $320, 4 in stock.
  - Ghost "+ Add a variant".
- **Description** ("None yet").
- **Where it shows** ("Store and gallery · Elkdonis Arts Collective"): Store ✓, "Gallery on your profile" ✓.

**Preview card** (max 240px):
- 4:5 image.
- Title 18px/600.
- "Mara Okafor · Etching, 2026".
- Price line 15px/600 ("From $180", "Price on request" or "Not for sale"), with `.tag-accent` "Available".

**Page preview**: a main image with three thumbnails, then title, credits, details, a variant seg, and Buy.

### 6. Quick compose (1g, 1k, 1q)
- **Context**: a site page.
  - `.nav` with brand "Elkdonis Arts Collective" and links Lab work (current), Gatherings, Series, Store, About, Mara.
  - H1 "Lab work" and the standfirst "Notes, nights and experiments from the print lab."
  - H3 "Coming up", with an **Add** button styled as accent-100 fill, accent-300 border and accent-800 text.
  - The "Coming up" list: a grid `96px 1fr` with dates at 13px, titles at 18px/600 and meta at 13px.
- **Popover**:
  - 440px wide, anchored 12px below Add (left −14px), with a 12px rotated-square caret.
  - Background `--color-bg`, radius 4px (`--radius-lg`), `--shadow-lg`.
  - Body padding 16/18/14, gap 14.
  - Contents in order:
    - A kind seg (Gathering | Post | Artwork, 12px) and a close icon button.
    - A title input at 23px/600, with kind-specific placeholders: "What is happening?", "Title", "Title of the piece".
    - Gathering: date + time + duration (2h ▾); a Where input with mode icons inline (pin, link, video; the active one has an accent-100 fill); a mini toolbar editor (B I • List Link), min-height 58px.
    - The preset line: "From **Thursday open studio**: 24 places, RSVP on, a reminder the day before. Change".
    - Post: the toolbar editor (min-height 110px, "Write it here. Pictures, pull quotes and cards are in Studio.") and the Cover sources.
    - Artwork: a 112px dashed "Add pictures" tile, plus maker, a Price | On request seg, and a price input.
    - The footer line: "Goes on Lab work · Public" (globe icon, 12px).
  - Footer bar on the surface colour, radius at the bottom only, padding 10/14: ghost "Open in Studio" (`arrows-out-simple`), then secondary "Save draft" and primary "Publish" on the right.
- **After publish (1k)**:
  - The popover body becomes: ✓ "Published", the title at 22px/600, "It's on Lab work under Coming up. RSVPs are open.", and a link field with "Copy".
  - Footer: Open in Studio, Add another, primary **Done**.
  - The new row appears at the top of the list, highlighted accent-100, with a `.tag-accent` "New".
- **Mobile (1q)**: a bottom sheet over a 45% neutral-900 scrim.
  - Radius 4px at the top, with a 40×4 grab handle.
  - Every control at least **44px** high.
  - Footer: full-width Publish, then Save draft and Open in Studio.

### 7. Validation (1h, 1i)
- **Rules shown**:
  - **Blocking** (accent-2, magenta): a start date in the past ("This date has passed. Pick a day from today on."); Online link chosen but empty ("Add the joining link, or switch to a Talk room.").
  - **Warning** (doesn't block): "Needs at least" is greater than "Places" ("Needs 12 to go ahead, but only 10 places").
  - Required for all kinds: Title. Required per kind:
    - Gathering: date, time, and Where. With Online link, the URL is required.
    - Artwork: at least one picture, plus a price unless the price mode is On request or Not for sale.
- **On pressing Publish with errors**:
  - The draft is saved.
  - A summary appears at the top of the form: `role="alert"`, accent-2-100 fill, accent-2-800 text, radius 2px, padding 14/16, `warning-circle` 22px.
    - Title: "Two things before this can go out".
    - Anchor links to each field: "When: the date has passed", "Where: no joining link".
    - "Your draft is saved. Nothing has been sent."
  - The rail marks each section and the readiness line changes.
  - Each field in error gets a 1px accent-2 border with a 1px inset accent-2 shadow (2px total), an accent-2 icon, `aria-invalid`, and a 13px accent-2-700 message with `warning-circle` below.
  - A closed More row with a problem shows it in its summary.
  - Publish stays enabled until pressed, so the problems can be shown.
- **States sheet (1i)**:
  - Inputs: empty, focused (accent border plus 2px accent outline), filled with hint, error, warning (accent-2-400 border; neutral text with an accent-2-600 icon).
  - From a preset (a `.tag-neutral` with a stack icon naming the preset: "Change it here, for this one only.").
  - Set by the series (45% opacity, lock icon, "Change for this session").
  - More rows, closed: normal and with a problem.
  - Main action: Publish; "Schedule for Tue 10 Nov, 09:00"; "Publishing…" (accent-700 fill, spinner); disabled (45%).

### 8. After publish, focus mode (1j)
The form column is replaced; the preview stays and shows the live card. Contents, max-width 600, gap 22:
- ✓ "Published at 12:14" (14px accent-700; icon 22px accent).
- H1 42px "It's on Lab work."
- "Public, on Elkdonis Arts Collective and on your profile." (16px neutral-700).
- Link: an input showing the URL, with secondary "Copy link". On click it becomes "Copied" with a check for 1.6s.
- Primary "View on site ↗" (`arrow-square-out`), and secondary "Keep editing".
- A "Make another" group label, with ghost buttons "Post with these settings" (stack icon), "Blank post", "Gathering".

There is no share or Channel step, by request.

### 9. Mobile (1l–1p, designed at 390px)
- **Top bar**: close icon button, kind label (16px/600) over the saved line (11px), and primary Publish.
- Under the top bar, a full-width seg **Form | Preview**.
- No rail. The presets slot becomes a "Start from [select]" row at the top of the form.
- Fields reflow: rows wrap and inputs use flex-basis.
- **Bottom bar**: Save draft and Schedule, equal width, bg colour with a `0 -1px 0 divider` top edge.
- In the real app both bars are sticky.

### 10. Poll and Questions (1r, 1s)
- **Header**: a seg Poll (`chart-bar-horizontal`) | Questions (`list-checks`), with the attachment shown on the right: "On Thursday printmaking", or "On its own, on Lab work".
- **Poll**:
  - Question title at 23px/600.
  - Options are inputs with a drag handle and a remove button; "+ Add an option".
  - "People pick": One | Several.
  - "Results show": After voting | At close | Hosts only.
  - "Closes": a date.
  - A results preview on the surface colour: bars 8px high in accent-300, with the leader in accent.
- **Questions**:
  - A numbered list of question rows: title 15px, then type and required state at 12px.
  - "+ Add a question" with a type select.
  - Hint: "Answers collect in Studio and can be exported. People who answer can be emailed with the same triggers as an RSVP."

---

## Interactions and behaviour
- **Title → preview**: the preview card or page title updates on every keystroke. An empty title shows "Untitled".
- **More rows** toggle open and closed. Several can be open at once. Default open:
  - Post: Also show on.
  - Gathering: Places and RSVP.
  - Series: none.
  - Artwork: Details, and Edition and variants.
- **Preview**: switches between Card and Page.
  - Mobile: a Form | Preview tab.
  - Layout `toggle`: a top-bar button with `eye`/`eye-slash`. When active it has an accent-100 fill, accent-300 border and accent-800 text; an × in the column closes it.
  - Layout `rail`: the sidebar's Sections | Preview seg swaps the index for the preview, which then sits on the left.
- **Where** seg swaps the fields underneath it.
- **Repeats** switch → the cadence block. "Present it as a series" → the kind becomes Series, plus the planner, the Series page row and the series preview card.
- **Session skip and restore** renumber live; the summary counts update.
- **Price mode** swaps the field and hint, and the preview price line.
- **Quick compose**: the kind seg swaps the fields. The title is kept per kind.
- **Copy link** shows feedback for 1.6s.
- **Presets** ("Start from…"): applying one fills fields. Those fields show the preset name in a neutral tag until edited ("Change it here, for this one only").
- **Focus** follows the DS: `:focus-visible` gives a 2px accent outline with 2px offset; inputs get an accent border.
- **Hover**:
  - `.btn-primary` → accent-600, pressed accent-700.
  - Secondary/More rows → text at 5–7% tint.
  - Ghost → accent at 10%.
- **Transitions**: none specified. Use 150ms ease-out for row open/close and the preview column slide-in.

## State management (suggested)
Form state per draft:
- `kind`: post | gathering | artwork. A series is a gathering with `repeat.enabled && repeat.asSeries`.
- `title`, `body` (blocks or rich text), `cover` / `pictures[]` (with alt and focal point), `goesOn { orgId, pageId }`, `audience` (public | members), `alsoOn[]`, `tags[]`, `excerpt`, `schedule { at? }`, `addons[]` (poll or questions refs).
- Gathering: `start` (date, time, timezone), `durationMin`, `where { mode: place|link|talk, address?, url?, talk { guests, openEarlyMin } }`, `hosts[]`, `rsvp { enabled, cap?, min?, closes, answers[], waitlist }`, `emails { confirm, reminder {on, before}, changes, after, hostDigest }`, `materials[]`, `livingDoc`.
- Repeat/series: `repeat { enabled, every: week|…, weekday, count | until, asSeries }`, `sessions[] { date, title?, note?, skipped?, reason? }`, `seriesPage { listed, slides, featured, colour? }`.
- Artwork: `credits[] { role, personId | name }`, `price { mode: price|request|nfs, amount, currency }`, `availability`, `details { medium, h, w, d?, unit, year }`, `edition { type: unique|edition|open, size?, proofs? }`, `variants[] { name, price, stock }`, `description`, `shows { store, gallery }`.

UI state: `openSections` (set), `previewOpen`, `previewMode` (card | page), `mobileTab`, `validationAttempted`, `saveStatus`, `publishedAt`.

Data needs:
- Presets per org.
- Orgs and pages the user can publish to.
- People search (hosts, credits).
- Media library.
- Nextcloud Talk room creation on publish.
- Email trigger templates.

## Design tokens (Broadsheet, from `styles.css`)
- **Colour**:
  - Base: bg #f3f2f2 · surface #eae9e9 · text #201e1d · accent (cyan) #0088b0 · accent-2 (magenta) #d6006c · divider = text at 16%.
  - Neutral 100–900: #f8f4f4 #eae7e7 #d7d3d3 #bab6b6 #9b9797 #7d7979 #605d5d #444141 #2d2b2b.
  - Accent 100–900: #e9f8ff #cbeeff #99e0ff #62c5ee #38a6cf #1186ac #006786 #004961 #0a303e.
  - Accent-2 100–900: #fff1f4 #ffdee6 #ffc0d0 #ff90b1 #ff458e #d82071 #aa0b56 #790e3d #4b1528.
  - Process yellow #edbb00 is for print treatments (`.cmyk-num`) only.
  - Use accent-700 for any small text in cyan (contrast).
- **Type**: Source Serif 4 (400, 600, italic 400) for everything; no sans.
  - Sizes used: 42 (h1), 34 (form title), 27 (mobile title), 23, 22, 21, 19, 18, 17 (More row titles), 16 (body), 15, 14 (labels, inputs), 13, 12 (hints), 11 (group labels, uppercase .1em), 10.
  - Headings use letter-spacing −0.015em.
- **Spacing scale**: 5, 10, 15, 20, 30, 40px (`--space-1…8`). Common gaps in the forms are 8, 10, 14, 22 and 30.
- **Radius**: 1 / 2 / 4px (sm/md/lg). Inputs, buttons and segs use 2px; the popover uses 4px.
- **Shadows**:
  - sm: `0 1px 2px` neutral-900 at 14%.
  - md: `0 3px 10px` at 16% (preview sheet, toolbar, canvas cards).
  - lg: `0 12px 32px` at 22% (popover, sheet).

## Assets
- **Icons**: Phosphor, **duotone** weight, loaded from `@phosphor-icons/web@2.1.1`. Names used: arrow-left, caret-down, clock, stack, check-circle, circle, warning-circle, warning, x, plus, minus, dots-six-vertical, crosshair, upload-simple, images, camera, image, newspaper, globe, lock, calendar-blank, calendar-x, arrow-counter-clockwise, map-pin, link, link-simple, video-camera, list-checks, chart-bar-horizontal, paperclip, eye, eye-slash, arrows-out-simple, arrow-square-out, copy, check, circle-notch, user-circle, list, dots-three. Use `@phosphor-icons/react` with `weight="duotone"`.
- **Images**: none supplied. Every picture is a dot-screen placeholder; use real media with `.halftone`/`.cmyk`.
- **Sample content**: all names, orgs, dates and prices are made up.

## Files
- `Publishing Forms.dc.html`: the canvas holding every screen with its id, plus the inline planner alternates (1d, 1e), the field states (1i) and Poll/Questions (1r, 1s).
- `Publish Form.dc.html`: **the shared shell and all kinds**. Props: `kind`, `viewport`, `layout` (split | toggle | rail), `previewOpen`, `repeat`, `errors`, `stage`, `expand`, `preview`, `tab`. Its `renderVals()` is the clearest spec of the state logic: rail statuses, series derivation, session renumbering.
- `Quick Compose.dc.html`: the site page with the popover or sheet. Props: `viewport`, `stage`.
- `_ds/…/styles.css`: Broadsheet tokens and component classes (`.btn`, `.input`, `.seg`, `.tag`, `.card`, `.nav`, `.cmyk-num`).
- `support.js`, `_ds/…/_ds_bundle.js`: prototype runtime only; not needed for the build.
