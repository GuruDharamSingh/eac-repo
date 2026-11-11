# Handoff: Hub cards — Site Builder and Member Management

## Overview

Every org on the platform has a shared **hub**: its back office for coordinating members and managing the site. Hub items are **cards**. Each card has three states:

1. **Collapsed card** on the hub grid (glanceable summary + 1–2 actions)
2. **Pop-up** opened from the card (quick actions)
3. **Detail page** (deep work, tabbed)

Every app's separate `/manage` page is being retired by folding it into a few fundamental hub cards. This package covers two of them, designed for the shared hub system (not one app):

- **Site Builder** — the site's structure, copy, theme and identity. Replaces the *Page builder*, *Site copy*, *Appearance* and landing-copy tabs in today's `/manage` pages, and the org card form on `/center`.
- **Member Management** — everyone who touches the org: members with roles, arrivals from other network sites, anonymous visitor analytics, storage-access status. Replaces the *People*, *Access*, *Artists & dealers*, *Visitors* and *Cloud storage* tabs.

Content (posts, articles, series, reading groups) is **not** in either card; it lives in a separate Content card.

## About the design files

The files in this bundle are **design references created in HTML**: prototypes showing the intended look and behaviour, not production code to copy. Recreate them in the target codebase (`GuruDharamSingh/eac-repo`, a Next.js/React monorepo with `apps/*` and `packages/services`, using Puck as the visual page editor) with its existing patterns, components and data layer.

- `Site Builder.html` and `Member Management.html` are self-contained and open offline in any browser. Every frame on them is clickable.
- `source/` holds the editable design sources (`*.dc.html`). They need to be served over HTTP (e.g. `npx serve source`) because they load sibling files at runtime. All markup uses inline styles, so values can be read straight from the source.
- Each board labels its frames (`1a`, `1b`, …). This README refers to them.

## Fidelity

**High fidelity** for layout, hierarchy, copy, states and behaviour. The visual style is the **Industry** design system (tokens below): square corners, hairline borders, `+` registration marks on framed objects, Barlow Condensed headings over Barlow body. If the hub already has its own component library, keep the structure, copy and behaviour exactly and map these tokens onto it.

Colours inside page thumbnails, the theme preview and the identity-card preview are **sample site themes** (IFAC, Fourth Way Book Readers) and come from each org's own theme at runtime.

All names, pages, numbers and copy-slot values are sample data. All UI copy (labels, helpers, empty states, confirmations, toasts) is final and should be used verbatim.

---

## Shared hub patterns (both cards)

| Element | Spec |
|---|---|
| Top bar | 52px high, padding 0 28px, 1px bottom border `--color-divider`. Left: 26×26 org mark (1px `--color-text` border, initials Barlow Condensed 600 12px), org name Barlow Condensed 600 18px, "HUB" 11px uppercase tracking .1em `--color-neutral-700`. Right: 26×26 avatar (bg `--color-accent-100`, fg `--color-accent-800`), name 13px, role 11px neutral-700. |
| Hub grid | padding 28px; heading "Hub" (h2) + "Back office for {org}" 14px neutral-700; grid `repeat(3, 384px)` (Members: 380px), gap 24px. |
| Card | `.card.blueprint`: transparent fill, 1px `--color-divider` border, radius 0, four 11×11 "+" corner marks offset −6px (`color-mix(text 55%)`). Padding 20/20/16 (Members 18/18/14), vertical gap 16px. Hover: border-color `--color-accent`. Clicking anywhere on the card opens the pop-up; buttons inside the card stop propagation. |
| Pop-up | Absolutely positioned over the hub at top 104px (Members 112px), left 28px. `.blueprint.elev-lg`, bg `--color-bg`. Width 640px (Site Builder), 540px (Members). Scrim below the top bar: `color-mix(--color-neutral-900 32%, transparent)`; clicking it closes. Header: 20px icon in accent, title Barlow Condensed 600 24px (Members 22px), ghost "Open page ↗" (opens detail page), 34×34 ghost close ×. |
| Detail page | padding 20px 28px 44px. Breadcrumb: ghost "← Hub" / "Site builder" 13px. H1 + subline 15px neutral-800. Tabs: Barlow Condensed 600 19px (Members 17px), padding 10/18, 2px bottom border `--color-accent` when active, inactive text neutral-700, count pill 12px (active: accent bg, bg text; inactive: neutral-200 bg, neutral-800 text). |
| Confirm dialog | `.dialog.blueprint.elev-lg` centred, scrim neutral-900 at 45%. Title, body, an info strip (1px accent-300 border, accent-800 text, cloud icon) describing the storage effect, then Cancel (secondary) and the action (primary). |
| Toast | top 64px, right 28px, `.blueprint.elev-md`, padding 10/14, 14px; check icon (Site Builder) or spinner (Members) in accent-700. Auto-dismiss after 3.2s (Members 3.4s). |
| Segmented filter | inline-flex in a 1px divider border; options 13–14px, padding 7–8/11–12px, separated by 1px divider; active: bg `--color-accent`, text `--color-bg`. Hover: `inset 0 0 0 1px --color-accent`. |
| Square toggle | Members "Listed": 32×18, 1px border. On: bg + border `--color-accent`, 12×12 knob `--color-bg` at left 16px. Off: transparent bg, border neutral-400, knob neutral-500 at left 2px. Knob transition `left .15s`. Disabled (guides): opacity .55, default cursor. |
| Expanding rows | Chevron (Lucide `chevron-right` 16px, neutral-600) rotates 90° with `transform .15s`. Expanded row bg `color-mix(accent 7%)`, expansion panel bg `color-mix(accent 6%)`. Row hover `color-mix(text 4%)`. Row dividers `color-mix(text 8%)`. |
| Primary button | `.btn.btn-primary.blueprint` with the four corner marks: the only solid object. Secondary `.btn.btn-secondary`; tertiary `.btn.btn-ghost`. Disabled = 45% opacity (built into the system). |

---

## Site Builder

Board: `Site Builder.html`. Source: `source/Site Builder.dc.html` (board), `source/SiteBuilderCard.dc.html` (all states), `source/PageThumb.dc.html` (thumbnail + placeholder).

### Page kinds (core concept)

Both kinds appear in one list and are always labelled:

- **Editor** page: built block by block in the visual editor (Puck). Tag: bg accent-100, text accent-800, 1px accent-200 border. Legend copy: "Laid out block by block in the visual editor."
- **Template** page: a fixed layout an app provides, with **copy slots** filled in the hub. Tag: transparent, text neutral-800, 1px neutral-400 border. Legend copy: "A fixed layout with copy slots you fill in here."

Templates and their slots come from each app; owners can't create new template pages, so every new page is an editor page. A page can also be a **shared layout** (e.g. "Event page layout", slug `events/…`), shown with an accent-700 note: "Draws every event page".

### 1a / 1b — Collapsed card (IFAC with 20 pages, Book Readers with 2)

Card min-height 372px, top to bottom:

1. **Header:** Lucide `panels-top-left` 20px accent, "Site builder" (`.card-title`, 26px), `arrow-up-right` 18px neutral-700 at the right.
2. **Count:** page count Barlow Condensed 600 52px / line-height .9 + "pages" 19px. Below at 15px neutral-800, the kind split:
   - mixed: "{n} built in the editor · {m} fixed templates"
   - all editor: "All built in the editor" ("Both built in the editor" when there are 2)
   - all template: "All fixed templates with copy slots" ("Both fixed templates with copy slots")
3. **Last edited:** thumbnail 120×75, then "LAST EDITED" (12px uppercase, tracking .1em, neutral-700), page title 19px 600, "{when} · {who}" 15px neutral-800. The last edited page is the most recently saved one.
4. **Theme:** five 22×22 swatches (page background, panel background, text, accent, second accent) in a 1px divider frame; "Aa" set in the site's heading font, 700, 21px; "{Look} · {heading font}" 15px neutral-800, ellipsis.
5. **Actions** (margin-top auto, 1px top divider, padding-top 14px; two equal buttons, 15px, gap 10):
   - Primary "Open page editor" (Lucide `square-pen`) opens Puck on the most recently edited editor page. If the site has no editor pages, the label becomes "Edit copy" and it opens the pop-up with the first template page expanded.
   - Secondary "List pages" (Lucide `list`) opens the pop-up.

All text on the card is 15px or larger, except the 12px "Last edited" label.

### 1c — Page thumbnail and the no-thumbnail placeholder

Thumbnails are 16:10 previews of the page in the site's theme. In production, capture a screenshot when a page is saved. Sizes: grid 100% × 178px, list row 104×65, pop-up 80×50, card 120×75, exception row 80×50, new-page tiles 100% × 84px, theme preview strip 100% × 150px.

**Placeholder** (no thumbnail yet), always in hub colours so it can't be mistaken for a render:
- Background `--color-bg` with a drafting grid of 1px `--color-neutral-200` lines, `background-size: 12.5% 20%` (8 × 5 cells).
- Inset 7% frame: 1px dashed neutral-400, fill `color-mix(--color-bg 82%)`, contents centred.
- Large sizes (grid card and up): page title in Barlow Condensed 600 (8.5% of thumb width, neutral-800, single line, ellipsis) and "No preview yet. One is taken the next time this page is saved." (4.4% of width, neutral-700, max 30ch).
- Small sizes (list, pop-up, card): only a Lucide `file` icon at 26% of the width, stroke neutral-600.

### 1d / 1e — Pop-up

- Search input: placeholder "Find a page by name or address". Case-insensitive match on title or path; filters live.
- Label (11px uppercase neutral-700): "ALL {n} PAGES", or "{n} MATCHES" while searching. Empty result: "No page matches “{query}”."
- **List** of every page in site order. Max-height 520px, scrolls inside the pop-up, 1px divider top border.
- **Row** (padding 8/16/8/20, 1px row divider): thumbnail 80×50; title 16px 600; "{path} · {last edited}" 13.5px neutral-700; kind tag; then:
  - secondary button, 100px wide: "Edit page" on editor pages (opens Puck); "Edit copy" on template pages (expands the row inline, then reads "Close");
  - ghost "View ↗" (opens the live page in a new tab).
- Template rows are clickable and expand (1e shows Book Readers' Home). The panel (padding 12/20/16/112, bg accent 7%) holds the page's copy slots in a 2-column grid, with group headings in Barlow Condensed 600 17px followed by a 1px rule. Slot controls are the same as in the detail page (below). Below them: save status 13.5px and a primary Save, disabled while nothing has changed.
- Editor rows don't expand; their action is Edit page.
- Footer (1px top divider, padding 12/20): secondary "+ New page" opens the New page dialog. Ghost "Theme" with small 12×16 swatches opens the detail page's Theme tab. Right-aligned ghost button, 13px, ellipsis: "Profile: {Main kind}, also {kind}, {kind}" opens the Profile tab.

### 1f–1j — Detail page: Pages tab

**Header actions:** ghost "View site ↗"; primary "+ New page". Subline: "{domain} · {n} pages · {Look} · {heading font}".

**Toolbar:** search (250px, "Find a page"); segmented "All {n} / Editor {n} / Template {n}"; "Showing {x} of {y}" (or "{n} pages" when unfiltered) 13px neutral-700; right-aligned Grid / List segmented control with icons (Lucide `layout-grid`, `list`). Under it, the two-tag legend (14px).

**Default layout:** grid when the site has more than 4 pages, list when it has 4 or fewer.

**Grid (1f):** 4 columns, gap 20px. Each item is a blueprint card: thumbnail 178px high; padding 12/14/14; title 18px 600 + path 13.5px neutral-700 on the left, kind tag on the right; nested pages add "Under {parent}" (13px neutral-800); shared layouts add their accent-700 note; "Edited {when} by {who}" 13.5px; then a secondary button ("Open editor" or "Edit copy") and a ghost button ("Notes", "Add notes" or "Notes & copy"). The ghost button and "Edit copy" switch to the list view with that row expanded.

**List (1g, 1h):** columns `104px | minmax(0,1fr) | 110px | 150px | 44px | 128px | 24px`, gap 16px, padding 10/12. Header row: 11px uppercase tracking .08em neutral-700 ("Page, Kind, Last edited, Notes"). Cells:
- thumbnail 104×65;
- title 16px 600 + path 13.5px. Nested pages show a 14×13 L-connector (1px neutral-500 left + bottom borders) and indent `(depth − 1) × 22px` beyond the first level;
- kind tag;
- last edited: date 14px over name in neutral-700;
- notes indicator (Lucide `sticky-note` 18px): accent-700 when the page has notes (tooltip shows the note), neutral-300 when it has none;
- secondary edit button;
- chevron.

Clicking a row toggles its expansion.

**Expanded row** (padding 18/20/18/132):
- Left column: "NOTES FOR THE NEXT EDITOR" (11px uppercase), a 7-row textarea with placeholder "What this page is for, what to keep, copy notes for whoever edits it next.", and the helper "Only seen here in the hub, never on the site." (12.5px).
- Right column, **template page** (columns `1fr 2fr`): "COPY ON THIS PAGE" + "{n} slots", then a 2-column grid (gap 14/18) with group headings (Barlow Condensed 600 18px + rule) when the page has more than one group. Slot types:
  - `text`, `url`: single-line input, 15px.
  - `textarea`, `rich`: full-width textarea with per-slot row count. `rich` keeps headings, lists, bold and links.
  - `image`: framed strip (6px padding; 1px solid neutral-400 border, dashed when empty) with a 68×44 preview tile (accent-100 when filled), the filename or "No image", and a ghost "Upload" / "Replace".
  - An optional hint sits under the field (12.5px neutral-700).
- Right column, **editor page** (columns `1fr 1.2fr`): "PAGE SETTINGS" with Title; Address (read-only); and Link preview text (2 rows, placeholder "Shown when the page is shared. Left blank, the opening of the page is used."). Then a theme line: 5 small swatches, then "Uses the site theme" or "Page exception: own {roles}", then a ghost link "Add an exception" or "See in Theme" (opens the Theme tab with that page preselected). Then the helper "Words, images and layout on this page are edited in the visual editor."
- Footer (1px top divider):
  - left, the status: "Unsaved changes" (accent-800) or "Saved · edited {when} by {who}" (neutral-700);
  - right: ghost "Save as template" (editor pages only), ghost "View page ↗", secondary "Open editor" (editor pages only), primary "Save" (disabled while nothing has changed).
  - Saving sets the edit time to "Just now", the editor to the current user, and toasts "{Title} saved. It’s live on the site."

**1i — Book Readers (2 pages):** The old landing-page tabs become grouped copy slots on the **Home** template page:

| Group | Field | Type | Hint |
|---|---|---|---|
| Hero | Hero image slide | image | Optional. With no image the hero has one slide fewer. |
| Hero | Caption | text | |
| Vertical banner | Banner image | image | Tall and narrow, about 1 : 3.4. Left empty, a book spine is drawn. |
| Vertical banner | Where it links | url | |
| The book | Title, Author | text | |
| The book | Why this book | textarea (3) | |
| Structure of a meeting | How a meeting runs | textarea (4) | One step per line. |
| Books ahead | Next books | textarea (3) | One per line: title — author. |
| Mission | The line under the two columns | textarea (2) | Left empty, the site’s default line is used. |

"About" is a template page with a single `rich` slot. Reading groups, Overview and Suggested go to the Content / Series card. Source for these fields: `apps/fourthwayBookreaders/src/app/manage/site/page.tsx`.

**1p — Save as template:** "Save as template" on an editor page's expanded row opens an inline panel above the footer (1px accent-300 border, bg `--color-bg`, padding 12/14). It contains:
- a Lucide `bookmark` icon;
- "Save {Title}’s layout as a template called", followed by a name input (220px, prefilled with the page title);
- the explainer "Keeps the blocks, layout and words as a starting point. It appears under New page → Saved templates.";
- Cancel, and a primary "Save template" (disabled while the name is empty).

Saving toasts "Saved “{name}” as a template". The template is a **snapshot**: changing it later doesn't affect pages already made from it.

**1j / 1o — New page dialog** (800px wide, 84px from the top, padding 22/24/20, gap 16):
- **Page name** (placeholder "Visiting") and **Place under**: "Top level" or any existing page with a real slug, shown as "{Title} /{slug}".
- **Address:** one bordered field showing `{domain}/` plus the parent's slug and a trailing slash in `--color-text` when a parent is chosen, followed by the slug input. The slug is generated from the name (lowercase; apostrophes removed; other non-alphanumerics become `-`; trimmed) until the user edits it by hand.
- **Validation:**
  - the slug must match `^[a-z0-9]+(-[a-z0-9]+)*$`, otherwise "Use lowercase letters, numbers and dashes.";
  - the full path must be unused, otherwise "/{path} is already a page. Pick another address."
  - Errors show at 13.5px in accent-800.
- **With a parent (1o):** a dashed neutral-400 box shows the parent ("{Title} /{slug}") and below it, with an L-connector, "{New title} /{full path}" plus an accent "New" tag. Beside it: "Listed under {parent} in Pages. If {parent} moves, this page moves with it."
- **Start from:** 4 tiles in a 4-column grid, each with an 84px thumbnail, a name 15px 600 and a note 12.5px:
  - Blank: "An empty page. Add blocks in the editor."
  - Services: "Services as cards, one in full, a booking form."
  - Writing: "An index of pieces from the writing room."
  - Copy a page: "Same layout as a page you already have."

  The selected tile gets an accent border, a 1px inset accent ring and an accent 6% fill. These built-in starts map to `apps/sunjay/src/lib/puck/templates.ts`.
- **Saved templates:** "Made from {org}’s own pages", then tiles in the same 4-column grid, with sub-text "From {page} · {who}, {date}".
  - When there are none: a dashed box with a bookmark icon and "None yet. Open an editor page’s row in Pages and choose Save as template."
  - When a saved template is selected, a panel appears (1px accent-300 border, accent 6% fill):
    - "{Name} · {n} blocks" (15px 600);
    - its description (14px);
    - "Saved from {page} by {who} on {date}. The new page gets its own copy, so changing the template later won’t touch it." (13.5px neutral-800).
- **Copy a page:** "Copy the layout of [select editor pages]".
- **Info line:** "Posts, articles and series are added from the Content card. A page here is part of the site’s structure."
- **Actions:** Cancel, and primary "Create and open editor" (disabled while the slug is empty or invalid). Creating a page:
  - inserts it directly after its parent's last descendant (or at the end of the list);
  - switches to the list view with the new row expanded;
  - prefills its notes with "Made from the {X} template." or "Started as a copy of {X}.";
  - toasts "Created /{path}. Opening it in the visual editor", then opens Puck.

### 1k — Detail page: Theme tab

The theme is **site-wide**. This card states what the site uses and lists per-page colour exceptions. Editing happens in the existing theme editor (`apps/ifac/src/components/hub/AppearanceCard.tsx`, `packages/services/src/themes.ts`, `apps/ifac/src/lib/theme-tokens.ts`).

- **Header:** "Site theme" (h4) and "What every page wears, unless it’s listed under page exceptions." (15px). Right: primary "Edit theme ↗", which opens the theme editor.
- **Live preview** (blueprint panel, padding 14/16/16, label "LIVE PREVIEW"): grid `1.5fr repeat(3, 1fr)`, gap 14px.
  - The first cell is a mock of the site rendered in its own tokens:
    - a nav bar: surface background, 1px line-colour bottom rule, the site name in the heading font 15px, nav links 12px, the last link in the accent colour;
    - a hero: heading font 700 26px, body font 14px, an underlined accent link;
    - a solid accent button whose label automatically uses the paper or ink colour, whichever contrasts more with the accent;
    - an outline button drawn with the skin's border (Framed: 2px frame colour; Paper: 1px line colour; Gallery: no border, surface fill).
  - The other three cells are page thumbnails (150px).
- **Stated values strip:** 4 cells (`.9fr 1fr 1fr 1.7fr`) separated by 1px divider gaps:
  - LOOK: skin name 17px 600 plus its note;
  - HEADINGS: the font name set in itself, 22px;
  - BODY TEXT: the font name set in itself, 17px;
  - COLOURS: a 14px swatch and role name for each colour. Frame appears only when the look is Framed.
- **Looks:**
  - Paper: "Hairline rules around cards and panels. Quiet and bookish."
  - Framed: "A coloured frame around panels, galleries and the footer."
  - Gallery: "No rules. Cards sit on the panel colour and images lead."
- **Colour roles:** paper "Page background", surface "Panel background", ink "Text", line "Rules & borders", accent "Accent", accent2 "Second accent", frame "Frame".
- **Page exceptions** (max-width 1040px): "Page exceptions" (h4) and a count "{n} pages"; "Pages that change some of the site’s colours. Everything they don’t change follows the site theme." Exceptions change **colours only**; looks and fonts are never set per page.
  - Row (grid `80px 1fr 1.5fr auto`): a thumbnail rendered with the exception colours; title and path; for each changed role, a 14px swatch, the role name and its hex in monospace 12.5px neutral-700; then secondary "Edit ↗" (opens the theme editor on that page) and ghost "Remove" (toasts "{Title} follows the site theme again").
  - Empty: "Every page follows the site theme."
  - Add row: "Add an exception for" + a select ("Choose a page", listing pages without exceptions) + secondary "Open in theme editor" (disabled until a page is chosen).

### 1m / 1n — Detail page: Profile tab (org identity card)

Intro: "How the platform sees {org}. This identity card travels across the network and says what kind of org this is. It replaces the org card form on /center." The profile doesn't switch hub cards on or off.

Layout: grid `minmax(0,1fr) 380px`, gap 44px.

- **What kind of org this is** (h5 20px + "One thing it mostly is, and anything it also does. Click a kind to add or remove it."). 3-column tile grid, gap 12px; tiles min-height 124px, padding 14/14/12. Each tile shows the kind's name in Barlow Condensed 600 22px and its note at 14px.

  | Kind | Note |
  |---|---|
  | Artist | One person’s work: a portfolio, a studio, commissions. |
  | Collective | A group whose members make, show or meet together. |
  | Services | Sessions, lessons or work people book. |
  | Store | Things for sale through the marketplace. |
  | Gatherings | Meetings, groups and events people come to. |
  | Writing | Articles, essays and reading lists. |

  Tile states:
  - **main**: bg accent, text `--color-bg`, "MOSTLY" (11px uppercase, right). Clicking it does nothing.
  - **also**: 1px accent-400 border, accent 7% fill, "ALSO" in accent-700, plus a ghost "Make this the main one". That button swaps the two: this kind becomes main and the old main becomes an "also".
  - **off**: 1px divider border. Clicking an off or also tile toggles it in or out of "also".
- **The card** (2-column form):
  - Name;
  - Where (placeholder "A city, a few cities, or Online");
  - Short line: full width, 2 rows, max 120 characters with a "{n} / 120" counter, helper "Shown under the name wherever the card appears.";
  - Mark: a 44×44 tile in the second accent with the paper colour and the heading font, showing the initials when there's no mark; the filename or "No mark yet. The initials are used."; ghost "Upload" / "Replace". The frame is dashed when empty;
  - Website: read-only.
- **How the network shows it** (sticky right column): a blueprint preview card with:
  - a 52×52 mark;
  - the main kind (11px uppercase, accent-700);
  - the name in Barlow Condensed 600 23px;
  - the short line at 15px;
  - "{where} · {domain}" at 13.5px neutral-700;
  - the "also" kinds as `.tag-outline` tags.

  Under it: "Seen in the network directory, in Across the collective on members’ hubs, and in link previews when the site is shared." At the bottom, the status ("Saved" / "Unsaved changes") and a primary "Save identity card" (disabled while nothing has changed); saving toasts "Identity card saved. The network shows the new card now."

---

## Member Management

Board: `Member Management.html`. Source: `source/Member Management.dc.html` (board) and `source/MemberHub.dc.html` (all states).

### Roles and rules

| | Owner | Guide | Member | Viewer |
|---|---|---|---|---|
| See people and arrivals | ✓ | ✓ | — | — |
| Welcome arrivals | ✓ | As viewer | — | — |
| Give or change roles | Below owner | — | — | — |
| List or unlist in the directory | ✓ | — | — | — |
| Remove people | ✓ | — | — | — |
| Shared storage | Full | Edit | View | — |
| Storage controls | ✓ | — | — | — |
| Visitor analytics | ✓ | — | — | — |

- Nobody can change their own role. Nobody can change an owner's role.
- **Demotions, promotion to owner, and removal** need a confirm step. Promotions below owner apply immediately.
- **Every role change queues a sync** to the org's shared storage: the person's storage status becomes `pending` ("Syncing", with a spinner) until the sync completes, then `synced`. Viewers end at `none` ("— No access").
- No email invites and no placeholder profiles. A disabled "Invite" button with "Coming with the roster service" is the hook for the future roster service.

**Role chips** (`.tag`, 1px border):
- Owner: bg accent-800, text `--color-bg`.
- Guide: bg accent-300, text accent-900.
- Member: bg accent-100, text accent-800, border accent-200.
- Viewer: transparent, text neutral-700, border neutral-300.

On read-only chips, a tooltip gives the reason:
- "You can’t change your own role."
- "An owner’s role can’t be changed."
- "Only owners change roles."

### Collapsed card (1a ledger: chosen default; 1b role bar and 1c faces: alternatives)

- **Header:** Lucide `users` 18px accent, "Members" 21px, ↗ arrow.
- **Ledger:** a 4-column grid with 1px divider gaps. Each cell shows the count in Barlow Condensed 600 30px and the plural role label (10px uppercase, tracking .1em, neutral-700). Under it, a second strip with "{n} new arrivals" and "{n} visitors this week". The visitors count is hidden for guides.
- **Needs-attention line** (margin-top auto, 1px top divider): a 7×7 square dot (accent when there's something to act on, neutral-400 otherwise) and 13px text. It shows the first of these that applies:
  1. "{n} arrival(s) waiting · {oldest name} for {wait}"
  2. (owners) "{n} storage sync(s) in flight"
  3. "All caught up", or "Nothing needs attention" for a one-person org.
- **Small org (2–5 people, 1e):** list each person (26×26 initials avatar, name, "you" marker, role chip) instead of counts, then "{n} new arrivals · {n} visitors this week".
- **Solo org (1f):** "Just you so far" (Barlow Condensed 600 28px) + "People who sign in from other sites on the network land here as arrivals, ready to be welcomed."

### Pop-up (1g owner, 1h inline demote, 1i guide)

- **Search:** placeholder "Find a person by name or @handle". When empty, the list shows "RECENTLY ACTIVE": the 5 most recently seen people, excluding yourself. While searching, it shows up to 6 matches; with none, "No one in {org} matches “{q}”."
- **Row** (min-height 52px):
  - 30×30 initials avatar;
  - name 14px 500;
  - a sub-line: "{handle} · seen {when}", or a spinner with "Syncing shared storage";
  - on the right, a role select (112px, when you can change this person's role) or a role chip.
- **Inline confirm (1h):** for a demotion or promotion to owner, the row turns accent-100. Its sub-line becomes "Demote to viewer? Loses shared storage access." / "Demote to {role}? Storage access drops to view." / "Make {first name} an owner? No one can undo it.", with Cancel and a primary "Demote" / "Make owner".
- **Arrivals section** (1px top divider): "ARRIVALS · {n} WAITING" and "Oldest first". Shows the 3 oldest. Each row:
  - 30×30 avatar with a dashed accent border;
  - name, then "From {site} · {when}";
  - (owners) a role select (Guide/Member/Viewer, default Viewer);
  - primary "Welcome", or "Welcome as viewer" for guides;
  - ghost × to dismiss.

  When more are waiting: ghost "{n} more waiting · open the queue" (opens the Arrivals tab). With none: "No one waiting."
- **Footer:** the disabled "Invite" with "Coming with the roster service"; (owners) sync status on the right: "{n} syncs in flight" with a spinner, or "Storage in sync" with a check.

### Detail page (1j–1q)

**Header:** H1 "Members" plus a "Viewing as guide" outline tag for guides. Summary: "{n} people · {n} owners · {n} guides · …". Right side: (owners) the sync status, "{n} changes syncing to shared storage" or "Shared storage in sync"; and the disabled Invite with "Coming with the roster service" under it (11px).

**Tabs:** People (count), Arrivals (count), Visitors, Permissions. For guides, Visitors shows a lock icon and "Owners only", and can't be selected.

**People (1j, 1k, 1o):**
- Filters: search (240px, "Search people"); role segmented "All / Owners / Guides / Members / Viewers" with counts; listed segmented "Any / Listed / Unlisted"; "Showing {x} of {y}".
- Table columns:
  - owner: `minmax(0,1fr) 112px 80px 130px 96px 104px 28px`: Person, Role, Listed, Storage, Joined, Last seen, chevron;
  - guide: the same without Storage.
  - Header 11px uppercase tracking .08em neutral-700; rows min-height 50px.
- Cells:
  - Person: 30×30 avatar, name 14px 500 plus "you", handle 12px;
  - Role: chip;
  - Listed: square toggle. Only owners can change it;
  - Storage: "✓ Synced" (accent-700), "Syncing" (spinner, accent-700 text, 1px accent-400 border, padding 1/8/1/6), or "— No access" (neutral-600).
- **Expanded row** (padding 16/16/18/52; columns `1.5fr 1fr 1fr auto`, gap 28):
  - ROLE: a segmented Owner / Guide / Member / Viewer control. The current role is filled in accent; options you can't choose are at 40% opacity. Under it, the reason, or for editable people "Demoting asks you to confirm. Every change queues a storage sync."
  - DIRECTORY: the toggle with "Listed in the public directory" / "Not shown publicly", plus "Arrived from {site}" when it applies.
  - SHARED STORAGE (owners): status icon, the access level ("Full access", "Can edit", "Can view" or "No access") and a note:
    - "Sync in flight: updating access to match the {role} role."
    - "Synced with {org} shared storage."
    - "Viewers don’t get shared storage."
  - Secondary "Remove from {org}" (owners, on non-owners other than themselves).
- **Confirm dialogs:**
  - Remove: "Remove {name} from {org}?" / "{First} loses the {role} role[ and comes off the public directory]. Their account stays, and they can come back later as an arrival." / note "Storage access is revoked in the next sync." / action "Remove".
  - Make owner: "Make {name} an owner?" / "No one can change an owner’s role, including you, so this can’t be undone from here." / "Queues a sync: storage access becomes full access." / "Make owner".
  - Demote: "Demote {name} to {role}?" / "{First} goes from {old} to {new}." / "Queues a sync: {First} loses access to {org} shared storage." (to viewer) or "Queues a sync: storage access drops to “{access}”." / "Demote".
- Toasts:
  - "{name} is now {role} · syncing shared storage"
  - "Removed {name} · storage access revoked in the next sync"
  - "{name} welcomed as {role} · syncing shared storage"

**Arrivals (1l):**
- Intro for owners: "Signed-in people who came over from another site on the network. Welcome them as a viewer, or pick a role first. Every welcome queues a storage sync." For guides: "…Guides can welcome them as viewers; owners give other roles."
- Two-column grid of blueprint cards (gap 24px, padding 18px). Each card:
  - 40×40 avatar with a dashed accent border;
  - name in Barlow Condensed 600 19px;
  - "{handle} · signed in from {site} {when}", with the site name in accent-700;
  - the oldest card shows an accent "Waiting {x}" tag.
- Footer of each card (1px top divider):
  - owners: "Join as" plus a select (Guide/Member/Viewer);
  - guides: "Joins as viewer. An owner can change the role later.";
  - then ghost "Dismiss" and primary "Welcome" / "Welcome as viewer".
- Welcoming adds the person as unlisted with storage "pending".
- Empty: a blueprint box with "No one waiting" and "People who sign in here from other sites on the network appear in this queue, ready to be welcomed."

**Visitors (1m, owners only):** anonymous traffic, shown as analytics rather than as people.
- Intro: "Anonymous traffic to the {org} site. Signed-in people from other network sites show up under Arrivals instead." Range segmented: 7 days / 30 days / 90 days.
- **Chart panel:**
  - total visits in Barlow Condensed 600 46px, then "visits", the period and the change ("+12% on the previous week");
  - a 190px bar chart with dashed neutral-300 gridlines at 0, half and max (labels 11px at the right);
  - bars in accent, accent-700 on hover, with a tooltip chip (bg `--color-text`, text `--color-bg`) showing "{date} · {n}";
  - bar gaps of 12px for 7 bars, 6px for 13 weekly bars (90 days), 3px for 30 bars.
- **Top pages:** path 14px, a 4px bar (accent on neutral-200), and the count right-aligned in tabular numbers.
- **Where visits come from:** a 14px stacked bar and a legend:
  - Network sites, broken down by site;
  - Search;
  - Direct;
  - Social;
  - Other.

  The fills go from accent-800 down to neutral-300.

**Permissions (1n):** "Who can do what" + a "Read-only" neutral tag. "Your column is highlighted. Nobody can change their own role, and no one can change an owner’s." The matrix uses the role table above, with columns `1fr repeat(4, 120px)`: role chips in the header, check icons (accent-700), "—" (neutral-400) or text values in accent-800. The current user's column is tinted accent 9%.

**Small org (1p, ≤5 people) and solo (1q):** no tabs, so it shouldn't feel like an enterprise console.
- Left column: a "People" list in a blueprint frame. Each row (padding 14/16) has a 38×38 avatar, name 15px, "Joined {x} · seen {y}", an inline role select (when editable) or chip, the toggle with "Listed" / "Unlisted", the storage status, and a 32×32 remove icon button.
- Right column (330px):
  - an Arrivals mini-card (rows with Welcome, or "No one waiting…");
  - (owners) "Visitors this week": count 36px, a sparkline, and "Most visited: {path}" ("No visits recorded yet." when there are none);
  - a secondary toggle "Who can do what" / "Hide who can do what" that shows the matrix.
- Solo adds: "It’s just you for now. When someone signs in from another site on the network, they’ll show up under Arrivals and you can welcome them with a role."

---

## State management (suggested)

```ts
// Site Builder
type PageKind = 'editor' | 'template';
type CopySlot = { key: string; group: string; label: string; type: 'text'|'url'|'textarea'|'rich'|'image'; value: string; hint?: string; rows?: number };
type SitePage = {
  id: string; title: string; slug: string;          // '' = home, 'exhibitions/after-image' = nested
  kind: PageKind; thumbnailUrl?: string;              // undefined → placeholder
  updatedAt: string; updatedBy: string;
  notes: string;                                      // hub-only
  linkPreview?: string;                               // editor pages
  sharedLayoutFor?: string;                           // e.g. 'event pages'
  copySlots: CopySlot[];                              // template pages
};
type ThemeColors = { paper; surface; ink; line; accent; accent2; frame: string };
type SiteTheme = { look: 'paper'|'framed'|'gallery'; headingFont: string; bodyFont: string; colors: ThemeColors };
type PageException = { pageId: string; colors: Partial<ThemeColors> };
type SavedTemplate = { id; name; fromPageId; createdBy; createdAt; blockCount: number; description: string; puckData: unknown };
type OrgKind = 'artist'|'collective'|'services'|'store'|'gatherings'|'writing';
type OrgIdentity = { name: string; line: string /* ≤120 */; where: string; markUrl?: string; primaryKind: OrgKind; alsoKinds: OrgKind[] };

// Member Management
type Role = 'owner'|'guide'|'member'|'viewer';
type StorageStatus = 'synced'|'pending'|'none';
type Member = { id; name; handle; role: Role; listed: boolean; storage: StorageStatus; joinedAt; lastSeenAt; arrivedFrom?: string };
type Arrival = { id; name; handle; fromSite: string; arrivedAt: string };
```

UI state:
- Site Builder: `view` (card / pop-up / detail), `tab`, `layout` (grid/list), the expanded row id, the pop-up's expanded row id, the search query, the kind filter, a dirty flag per page, the New page dialog (name, slug + touched flag, parent, start), the save-as-template draft, and the identity draft with its dirty flag.
- Members: `view`, `tab`, filters (query, role, listed), the expanded row id, a pending confirm (`{kind, personId, toRole}`), a pending inline confirm in the pop-up, the role chosen for each arrival, and the visitor range.

Data needs:
- pages with their thumbnails and copy slots;
- the theme and page exceptions (read-only here);
- saved templates;
- the org identity;
- members, the arrivals queue, and per-member storage sync status (poll or subscribe, since syncs are async);
- visitor aggregates per range (owners only, enforced server-side).

## Design tokens (Industry)

| Token | Value |
|---|---|
| `--color-bg` | #f2f2f3 |
| `--color-surface` | #e9e9ea |
| `--color-text` | #1d1f20 |
| `--color-accent` | #5980a6 |
| `--color-divider` | `color-mix(in srgb, #1d1f20 16%, transparent)` |
| neutral 100–900 | #f5f5f8, #e7e7ea, #d4d4d7, #b7b7ba, #98989b, #7a7a7d, #5d5d60, #424244, #2b2b2d |
| accent 100–900 | #eef6ff, #d6ebff, #b5d9fd, #94bce3, #749dc4, #597ea3, #416180, #2c455d, #1d2d3d |
| `--font-heading` | "Barlow Condensed", weight 600 |
| `--font-body` | "Barlow" 400/500/700, base 15px / 1.55 |
| spacing `--space-1…8` | 3.4, 6.8, 10.2, 13.6, 20.4, 27.2px |
| radius | none on cards, figures and buttons (square); `--radius-sm/md/lg` = 2 / 4 / 7px for small controls only |
| `--shadow-sm` | `0 1px 2px color-mix(#2b2b2d 14%)` |
| `--shadow-md` | `0 3px 10px color-mix(#2b2b2d 16%)` |
| `--shadow-lg` | `0 12px 32px color-mix(#2b2b2d 22%)` |
| Focus | `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px }` |

**Type sizes used:**
- Big numbers: Barlow Condensed 600 at 52, 46, 36 and 30px.
- Titles: card title 26px (Site Builder) / 21px (Members); pop-up title 24 / 22px; tabs 19 / 17px; section h5 20px.
- Body: 15–16px. Meta: 13–14px. Hints: 12.5px.
- Overline labels: 10.5–12px, uppercase, tracking .1em.

Use accent-700 or darker for any paragraph-size text set in the accent colour; the base accent doesn't have enough contrast for body text.

## Assets

- Icons: Lucide at stroke-width 1.5:
  - Site Builder: `panels-top-left`, `arrow-up-right`, `square-pen`, `list`, `search`, `x`, `plus`, `layout-grid`, `chevron-right`, `sticky-note`, `image`, `bookmark`, `info`, `file`, `check`, `arrow-left`;
  - Members also uses: `users`, `user-plus`, `user-minus`, `lock`, `cloud`, and `loader` (as a rotating spinner).
- Fonts: Barlow and Barlow Condensed (hub). The sample site themes use Libre Caslon Text, Spectral and Source Sans 3 (sample data only).
- There are no raster images. The thumbnails are drawn placeholders; production should use page screenshots.

## Files

- `Site Builder.html`: offline, interactive board (frames 1a–1p).
- `Member Management.html`: offline, interactive board (frames 1a–1q).
- `source/Site Builder.dc.html`: board layout, assumptions, and what folds in from today's pages.
- `source/SiteBuilderCard.dc.html`: every Site Builder state, its sample data and behaviour (logic is in the `<script data-dc-script>` block).
- `source/PageThumb.dc.html`: thumbnail sketches and the no-thumbnail placeholder.
- `source/Member Management.dc.html`, `source/MemberHub.dc.html`: every Member Management state and its behaviour.
- `source/_ds/…/styles.css`: Industry tokens and component classes (`.btn`, `.tag`, `.card`, `.blueprint`, `.dialog`, `.input`).

Repo files the Site Builder designs drew on:
- `apps/sunjay/src/app/manage/page.tsx`
- `apps/sunjay/src/components/manage/new-page-form.tsx`
- `apps/sunjay/src/lib/puck/templates.ts`
- `apps/fourthwayBookreaders/src/app/manage/page.tsx`
- `apps/fourthwayBookreaders/src/app/manage/site/page.tsx`
- `apps/ifac/src/components/hub/AppearanceCard.tsx`
- `apps/ifac/src/lib/theme-tokens.ts`
- `packages/services/src/themes.ts`

## Assumptions to confirm

Site Builder:
- Template pages and their copy slots come from each app; new pages are always editor pages.
- The theme is edited in the existing theme editor. Page exceptions are colours only.
- The profile replaces the `/center` org card form and doesn't toggle hub cards.
- A nested page lives under its parent's address and moves with it. Nesting doesn't add the page to the site menu; that stays in the editor.
- A saved template is a snapshot that keeps the page's blocks, layout and words.

Member Management:
- Storage access follows role.
- Guides see people and arrivals, and can welcome arrivals only as viewers.
- Owners can promote someone to owner, behind a confirm.
- Orgs of 5 or fewer get the single-page layout.
- Arrivals are queued oldest first.
