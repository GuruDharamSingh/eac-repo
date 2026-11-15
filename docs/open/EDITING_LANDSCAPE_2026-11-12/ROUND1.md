# Editing landscape, round 1 (2026-11-14)

PM: system32-d6. One section per worker; append, do not rewrite another worker's section.

## a2: inception and one door on sunjay (strokes moves 1-2), 2026-11-14

**Live 2026-11-14 ~11:10 EST** in sunjay build `233XY5Fv4hG5pMtcRaV9Z` (previous `GG_g-_iEjJynUxsPCOq4C`; backup `~/eac-backups/next/sunjay-20261114-1104.tgz`; built by fc on Justin's yes). Checked by a2 through the edge, signed out: `/`, `/about` and `/community` 200; `/studio/event-detail`, `/studio/event-detail/blocks` and `/studio/post-detail` 307 to login; `/studio/event-detail/canvas` 307 to `/studio/event-detail`; no `data-site-style` on `/`; header and footer carry `data-chrome`. Not yet used signed in: see the click lists.

Source only: nothing rebuilt, committed or migrated. Para Theater's live site is unchanged until a rebuild, which needs Justin's yes.

### What changed

**Move 1: one door on sunjay (canvas first, as HE did on 2026-11-11)**
- `/studio/<slug>` is now the canvas. Puck on the whole page moved to `/studio/<slug>/blocks`.
- `/studio/<slug>/canvas` redirects to `/studio/<slug>` and keeps the query string, so old links and "Edit this page" on published pages (`lib/puck/render.tsx`, not edited) still work.
- `/studio/home` and `/studio/landing` go to `/`, where the in-place editor is. `/studio/home/blocks` still opens Puck.
- Settings… on a sealed block opens that one block in Puck over the canvas (`openBlockSettings`). It replaces the "Edit its settings" link that navigated away. Rows are resolved again where the block sits (HE's pattern).
- The canvas now honours the New page form's `?template=`. Before, it ignored it.
- `/manage/builder`: Edit goes to the canvas. A quiet "Blocks" link beside it goes to whole-page Puck.
- The Site Builder hub card's `puckEditHref` (`/studio/<path>`) now lands on the canvas, so `hub-card-host.tsx` needed no change.

**Move 2: inception (shared; every new behaviour is opt-in, so other hosts are unchanged)**
- **One layer stack.** A registry on `globalThis[Symbol.for("eac.layer-stack.v1")]`, in `direct-edit/src/canvas/stack.ts` and page-builder's copy `src/layer-stack.ts`. The two are byte-identical below the header; `harness/stack-drift.cjs` checks this and exits 1 on drift.
  - Order comes from the registry, not the DOM. The top layer alone takes Esc.
  - A layer opened alone keeps its CSS z-index; only a layer opened over another is lifted.
  - The canvas popup and the Puck sheet both register and unregister.
- **`openBlockSettings({ plugins, escape })`** (page-builder):
  - `plugins` puts the parts plugin inside the sheet. A block's parts can be clicked into there, and "Edit look" opens direct-edit's popup over the sheet, which hands back into it.
  - `escape`, while the sheet is on top, works in this order: it leaves a field being typed in, then hands a selected part to the picker, then cancels a clean sheet.
  - A sheet with changes is never cancelled by a key, including a look the inner popup handed back. Esc instead shows "This block has changes. Apply them, or Cancel to drop them." in the sheet header and rings Apply and Cancel. No browser dialog.
  - The canvas popup already had this guard: an unchanged popup closes on Esc; one with changes shows its in-page Use / Discard / Keep editing prompt.
- **`inception: true`** (direct-edit `mountTreePage` and tree-editor): Settings… also appears inside the canvas popup and in a part's right-click menu. On close, the selection comes back, a part included.
- **`settingsCache`**: the page and popup mounts share it, so rows fetched for a setting changed inside the popup also draw on the page.
- **`handBack: true`** (parts plugin): the part selected before the popup is selected again after it closes.
- **Parts store** (`parts/picker.tsx`): an editor opened over another gives the outer one its canvas document back on close, instead of null.
- **`openStudioPopup` host `editSettings`**: available, but not wired in sunjay's Puck Studio. Wiring it there would put two Puck editors on one page; see open question 3.
- **sunjay turns on:** `inception`, `editSettings` with sheet `plugins` and `escape` (CanvasEditor), and `handBack` (Studio `page-editor.tsx`).

**Applied for fc (their findings, in my files)**
- `puck/mount.ts`: an empty bound value ("") is cached like any other value, so `service: ""` (the newest service, or the one in the address) draws its row instead of the sample.
- `canvas/interact.ts`: a word part styled `uppercase` no longer saves its words in capitals. `innerText` is read with `text-transform: none !important`, and the element's own inline value is restored afterwards.

### Files
- **sunjay:**
  - new: `app/studio/[slug]/blocks/page.tsx`;
  - changed: `app/studio/[slug]/page.tsx` (now the canvas), `app/studio/[slug]/canvas/page.tsx` (now a redirect), `components/studio/CanvasEditor.tsx`, `components/studio/page-editor.tsx` (`handBack`), `app/manage/builder/page.tsx` (Blocks links).
- **direct-edit:**
  - new: `src/canvas/stack.ts`;
  - changed: `src/canvas/popup.ts`, `src/canvas/tree-editor.ts`, `src/canvas/interact.ts`, `src/puck/mount.ts`, `src/puck/studio-popup.ts`;
  - harness, new: `harness/stack-drift.cjs`, `harness/frankenstein/entry-inception.tsx`, `harness/frankenstein/drive-inception.cjs`;
  - harness, changed: `harness/frankenstein/drive-look.cjs` (it now picks a token block that is on the seed).
- **page-builder:**
  - new: `src/layer-stack.ts`;
  - changed: `src/block-settings.tsx`, `src/parts/picker.tsx`, `src/parts/popup.tsx`, `src/parts/types.ts`.

### Verification (2026-11-14, isolated Chromium, no network, no database)
- **`drive-inception.cjs` 55/55.** Run on sunjay's real CanvasEditor with recording server-action stubs. Covered:
  - Settings… → sheet → Apply, with one undo step.
  - Sheet → Edit look → popup over the sheet (z lifted) → type → Use → sheet → Apply.
  - Esc on an unchanged popup closes only it; the next Esc cancels the clean sheet.
  - Canvas popup → Settings… → sheet over the popup. A dirty Esc asks instead of cancelling; Apply returns to the popup, and Use hands back to the page.
  - Settings… from a part's menu, then Cancel, gives the part its selection back.
  - Mixed stack (page-builder sheet under a direct-edit popup), Esc ×3 walks down (`sheet+popup → sheet → none`) to the original part, and the registry ends empty.
  - A look made in the inner popup → Use → Apply is exactly one canvas undo step: undo removes only the look, and redo restores it.
  - Save carries the heading, the typed title and the `morph`, with no resolver keys on any of 8 data blocks.
  - No page errors.
- **Regression:**
  - `drive-popup.cjs` 56/56 (56/56 before the change, same day);
  - `drive-pkg.cjs` 58/58;
  - `drive-look.cjs` 30/30. It read 28/28 before its fix: two checks were silently skipped after `detail-parts.ts` added parts to blocks that aren't on the seed. A harness fix, not a product change.
- **`stack-drift.cjs`:** identical. Shown failing (exit 1) on a one-byte change, then restored.
- **`tsc --noEmit`** in a throwaway `eac-dev` container with the repo mounted read-only: 0 errors in direct-edit, page-builder, sunjay, hidden-enneagram, elktours, katie-the-potter, innergathering and danamccool.
- **Not verified:**
  - the redirect routes and server pages under Next, which need a build;
  - signed-in use on the live site;
  - Firefox and Safari;
  - touch.
- Scratch setup (outside the repo): `~/scratch/inception` (`run.sh` uses `sudo -n docker`; `run-rec.sh` records server actions).

### What Justin clicks after a Para Theater rebuild (signed in as an editor)
1. **`/manage/builder` → Edit** on the event-detail template.
   - Expect the canvas at `/studio/event-detail`, not Puck.
   - "Blocks" beside Edit opens Puck at `/studio/event-detail/blocks`.
2. **On the canvas, click "How to join" (Numbered steps) → Settings…**
   - Puck opens over the page with only that block. The steps are edited with rich text (fc's richtext field), not raw `<p>`.
   - Change the heading → Apply. The page shows it, and one Undo takes it back.
3. **In that Puck sheet, "Edit look"** (the pen in the block's bar).
   - Expect the look popup on top of the sheet.
   - Pick a step title and set its Size → Use on this page → Apply. One Undo removes only that look.
4. **Double-click a block on the canvas → in the popup, Settings…**
   - Puck opens on top of the popup.
   - Change something and press Esc: it asks "Apply them, or Cancel" instead of closing.
   - Apply → you're back in the popup → Use on this page.
5. **Esc walk.** Right-click a block's heading (a part) → Settings… → Edit look → press Esc three times. You land back on the canvas with the heading still selected.
6. **Old links.**
   - `/studio/<any page>/canvas` lands on `/studio/<any page>`.
   - "Edit this page" on a published page and on a gathering's designed page opens the canvas.
7. **Save on a template** still warns first: "This template draws every event's page…".

### Open questions
1. **Home in-place editor (`/` → Edit page), for Justin.** Not wired, by the PM's call.
   - The home live pieces (`home-stage`, `home-standing`, `home-forum`, `home-join`) declare `props: []`, so a Settings sheet would show only Style. Their HTML comes from `metadata.parts`, which the sheet doesn't receive, so it would draw them empty.
   - "Which gathering?" for Next gathering is today the org's standing meeting, chosen in the meeting popup ("standing").
   - A real door needs a `which` prop on `home-standing` (fc's `blocks/*`): standing, next upcoming, or pick a thread. `app/page.tsx` would read it, and `openVisitorPage` would pass `metadata.parts` to `editSettings`.
2. **Template opened from a record.**
   - "Edit this page" on a gathering's designed page opens `/studio/event-detail`, which draws the next upcoming gathering, not the one you came from.
   - The fix is `?thread=<id>` from `render.tsx`, plus passing `threadId` through `config.client.ts` `viaApi` and `/api/blocks/*`. Those are lib/puck and api files outside this round's split.
3. **Settings… inside the popup in Puck Studio** (`/studio/<slug>/blocks`).
   - The hook exists (`StudioPopupHost.editSettings`) but isn't wired, because it would mount a second Puck over Studio's.
   - The parts store now restores the outer canvas document, but the one-popup guard in `parts/popup.tsx` (`current`) would refuse a third layer.
   - Proposed: leave it off, since Studio's right column already holds the block's settings.
4. **HE.**
   - HE gets the stack (Esc goes only to the top layer), but not `inception`, `escape`, `plugins` or `handBack`. Turning them on is 4 lines in its CanvasEditor, and the same in katie, elktours and innergathering once each has a canvas.
   - Recommend after Justin has clicked through sunjay.
5. **`designTools`** (Figma basics: multi-select, handles, snapping) is on for HE and still off on sunjay. That's one flag. Justin's call.

## fc: sunjay's event page on its surface (detail §5 #1-2, plus pt-steps), 2026-11-14

Source only: nothing rebuilt, committed or migrated. Para Theater's live site (`next start`) is unchanged until a rebuild, which needs Justin's yes. No stored block id, prop name or part name changed.

### What changed

**§5 #1: parts on 13 blocks.** These blocks open on their surface the way Forum and Next gathering do: a page can restyle each piece, and the block's own words can be typed in place.
- The 13 blocks:
  - event detail: `pt-event-header`, `pt-event-about`, `pt-talk-room`, `pt-event-rsvp`, `pt-event-materials`;
  - `pt-offering-card`;
  - services: `pt-services`, `pt-service`, `pt-booking`;
  - writing: `pt-journal`, `pt-article`, `pt-series-nav`;
  - `pt-notice`, which sits on the event-detail template.
- In all, 122 parts. They're selectors over today's markup in one data-only file, `blocks/detail-parts.ts`; no `data-part` attributes were added, so visitor HTML is unchanged (proved below).
- `prop` is set only on the block's own words, never on the record's:
  - headings, the Talk room note, the offering eyebrow and heading;
  - the services intro, empty line and button label (cards and rows);
  - the booking heading;
  - the journal heading, intro and empty note;
  - the series heading;
  - the notice title and body.
- Record words have parts for look only: event title, excerpt and kicker; service name, price and body; piece title, lede and body; offering title and blurb.
- Part names never equal prop names: the heading part is `headline`, the journal's lead piece is `leadPiece`.

**§5 #2: "From what?" can choose a service.**
- `components/landing/person-records.ts` handles `binds: "service"` (`pt-service`, `pt-booking`).
  - The new `"use server"` file `lib/puck/service-actions.ts` supplies the lists and the drawing. Owners and guides only, as with the other choosers.
  - The stored value is the service's slug, as Puck Studio's own `ServicePickerField` stores it. Clearing it ("The visitor's choice (?service=…), else the newest") stores "".
  - Puck Studio keeps its picker. The canvas, its popup and the Studio popup now get the shared chooser.

**pt-steps "Words under it": a rich-text field in Studio (the PM's third item).**
- Puck showed a row's rich-text column as a textarea of raw HTML (`<p>…</p>`). A top-level rich-text prop already gets Puck's rich-text field; a row's column did not.
- `lib/puck/config.client.ts` adds `fields.richtext`: Puck's own rich-text field through `AutoField`, with the same allowed formatting as page-builder's top-level rich text and step-sized headings.
- Stored data is unchanged and opens as it is. What is typed is stored as HTML and sanitised on save as before. In the canvas popup, typing in place already worked.
- `config.client.ts` was outside my file list. The only change there is one `fields` entry plus the `AutoField` import; I told a2.

**Fixes found by the harness, applied by a2 in their files** (their section lists them):
- `puck/mount.ts`: an empty bound value dropped the page's own rows. Without that fix, an unchosen service would draw the example service.
- `canvas/interact.ts`: plain-text commits used `innerText`, so uppercase-styled word parts saved in capitals. This was pre-existing and on every site, including sunjay's existing card label part.

### Files
- **sunjay, new:**
  - `src/blocks/detail-parts.ts`;
  - `src/lib/puck/service-actions.ts`.
- **sunjay, changed:**
  - `src/blocks/{event-blocks,offering-card,service-blocks,writing-blocks,small-blocks}.tsx` (`parts:` lines and imports only);
  - `src/components/landing/person-records.ts`;
  - `src/lib/puck/config.client.ts`.
- **Harness, new:** `packages/direct-edit/harness/event-detail/` (README, entry, drive, drive-steps, probe, stubs).
- **Not touched:** `resolved-keys.ts`, `catalogue.ts`, `data-*.ts` and `records.ts`. They needed no change: resolver keys are as before, and the chooser's interface already fit.

### Verification (2026-11-14)
- **`event-detail/drive.cjs` 104/104.** Isolated Chromium, no network, sunjay's real canvas config, contract and `records` (actions stubbed). Covered:
  - **Contract:** every block declares parts with a root, part names are distinct from prop names, each selector is one complex selector, word parts name text props, and record words carry no prop.
  - **Parts against the drawing:** a look on every part, on the canvas and published, for rich and empty documents. Every element a part's compiled rule matches draws that part's look, with no collisions. 121 of 122 parts are drawn (217 elements on the canvas, 259 published). The one not reached is the offering card's open call, which appears only after "Join the room" is clicked on a live room.
  - **Visitor markup:** with no looks, no morph or editor markup is drawn.
  - **Typing in place:** 12 own-word parts are typed in place and handed back, including a repeated card button and the notice's rich body. The record's title, name and body are not typable.
  - **Service chooser:**
    - an unchosen block draws the page's own row (this proves the mount fix);
    - lists, choose, price shown, slug-only store, undo and redo without a refetch;
    - clear;
    - the booking block;
    - the popup hands back in one step;
    - the save holds references only.
- **`event-detail/drive-steps.cjs` 9/9**, in Puck Studio on frankenstein's `entry-popup` bundle, which is sunjay's real `puckConfig`. A step's words are in Puck's rich-text editor as a paragraph, no textarea shows `<p>`, and typing stores `<p>…</p>` in that row only.
- **`event-detail/probe.mts` 6/6.** Read only against the live database, in the sunjay container.
  - The stored pages are `event-detail`, which holds 6 of the 13 blocks with **no stored looks**, and `try`.
  - Both render **byte-identical** for a visitor with the new definitions and with parts removed (event-detail: 7,193 bytes, drawn for a real gathering).
  - The service loaders behave as the chooser assumes. **The org has no services yet**, so the chooser lists none today.
- **Regression on the same tree:** frankenstein `drive-popup.cjs` 56/56, `drive-pkg.cjs` 58/58, `drive-look.cjs` 30/30 (with a2's seed fix).
- **`tsc --noEmit`** (throwaway `eac-dev`, read-only mount): sunjay 0, direct-edit 0.
- **Not verified:**
  - signed-in use on the live site;
  - a production build;
  - Firefox and Safari;
  - touch;
  - the open call inside the offering card (it needs a live Talk room).

### Open questions
1. **Shared fix for every site.** `page-builder/src/config.tsx` could give every host's rich-text rows columns Puck's rich-text field when `richText` is on. That would replace sunjay's local `fields.richtext`; katie, elktours and HE rows have the same raw-HTML box. It's a shared file, so it's your call.
2. **Services.** Para Theater has none stored. When the first exists, a signed-in check of the chooser on the live canvas is worth one click.
3. **HE/DM from detail §5.**
   - #3: HE's hand-wired slugs would move to `binds:`.
   - #4: DM's 14 site blocks have no parts, and its catalogue offers unfiltered profile/store blocks.
   - #5: the face + parts + live-piece recipe could become part of the kit.
   - These aren't started; the PM listed them outside round 1.
4. **Rebuild.** It needs Justin's yes and ships everyone's uncommitted tree. ops.md: back up first, and build with `NEXT_BUILD_CPUS=4`.

### What Justin clicks after a Para Theater rebuild (signed in as an editor)
1. Open `/studio/event-detail` (a2: now the canvas).
   - Double-click the header: the popup shows its parts in the layer list (Words, Small label, Title, Facts, Cover…).
   - Select Title, change Size: it changes. Double-click Title: it doesn't become typable.
2. Double-click "About this gathering" and type a new heading. Use on this page, then save. Every gathering with a detail page shows it.
3. In the Talk room, double-click the line above the buttons (set a note first in Settings…) and type in place.
4. On a page with "Service (one in full)": select it. Service shows "Choose…", and the drawer lists the site's services. There are none until one is made.
5. `/studio/<page>/blocks` (Puck) → Numbered steps → open a step: "Words under it" is a formatted-text box showing words, not `<p>` tags.

# Round 2: best of the other sites → Para Theater (2026-11-14)

## a2: designTools, Site style, layout door, shared row rich text

**Live 2026-11-14 ~11:10 EST** in sunjay build `233XY5Fv4hG5pMtcRaV9Z` (previous `GG_g-_iEjJynUxsPCOq4C`; backup `~/eac-backups/next/sunjay-20261114-1104.tgz`; built by fc on Justin's yes). Checked by a2 through the edge, signed out: `/`, `/about` and `/community` 200; `/studio/event-detail`, `/studio/event-detail/blocks` and `/studio/post-detail` 307 to login; `/studio/event-detail/canvas` 307 to `/studio/event-detail`; no `data-site-style` on `/`; header and footer carry `data-chrome`. Not yet used signed in: see the click lists.

Source only: nothing rebuilt, committed or migrated. The sunjay rebuild waits on Justin's direct yes to d6; fc runs it.

### 1. designTools on sunjay
- `components/studio/CanvasEditor.tsx` sets `designTools: true`, as HE does: Shift+click multi-select (align, same size, spread, group, delete), top and left handles on boxes, and snapping while resizing. It stays off in the popup, as on HE.
- `drive-inception.cjs` section I: Shift+click the banner with the steps block selected; the panel reads "2 selected" with 10 tools.
- The first attempt clicked the banner's top edge, which sits under the editor's own bar (`.de-pill-page`). That was a test fault, not a product one; the test now clicks the banner's middle.

### 2. Site style → sunjay (from elktours, through `direct-edit/src/site`)
- **New files:**
  - `lib/site-style-schema.ts`: sunjay's own `:root` vars with today's values as defaults: Page, Text, Quiet text, Cards, Bronze, Text on bronze, Rust, Lines, Section banners, Body and Heading fonts (Spectral and Fraunces through their next/font variables), and Corners.
  - Header parts: brand, links, active, tools, account, menu. Footer parts: title, links, note.
  - `lib/site-style.ts` (load and save, as elktours), `lib/site-style-actions.ts` (an editor-gated server action), `components/site-style/SiteStyleButton.tsx`.
- **Changed files:**
  - `components/site-header.tsx` and `components/site-footer.tsx`: `data-chrome` and `data-part` attributes only. The diff shows nothing else; the active link logic is the same expression, named `here()`.
  - `app/layout.tsx`: loads the style and emits `<style data-site-style>` and the fonts link only when something is stored, at the top of `<body>` as elktours does. Renders the button for editors.
  - `components/hub/hub-card-host.tsx`: `themeEditorHref` returns `/?site-style=1`.
- **Doors:**
  - a "Site style" button for editors at the bottom right, above "Edit this page", hidden on `/studio`;
  - the hub Site Builder card's theme link, which opens the editor on `/` on arrival.
- **Visitors unchanged:**
  - read-only DB check: sunjay has no `site_themes` rows and no `site-style:chrome` row; elktours has both;
  - the real `siteStyleCss` and `siteStyleFontsHref` return `""` and `null` for both `null` and `{ theme: {}, chrome: undefined }`, and a saved colour gives exactly `html:root{--background:…}` (`~/scratch/inception/style-empty.mts`).

### 3. Post → detail page, and the layout door (my side; fc does the template)
- **Studio on a record:**
  - New `app/studio/[slug]/record.ts`. `?thread=<id>` and `?piece=<slug>` are read on template slugs only and shape-checked; anything else is dropped. Agreed with fc.
  - The canvas (`page.tsx` → `CanvasEditor` `record`), the Puck sheet and `/blocks` (`page-editor.tsx` `metadata`) pass them as `metadata.threadId` / `metadata.piece`. fc's `viaApi` and `/api/blocks` carry those to the loaders.
  - `record-test.mts`: 7/7.
- **Published door:**
  - `lib/puck/render.tsx`: "Edit this page" goes to `/studio/<slug>`. On a template page it says "Edit this page's layout", carries `?thread=` or `?piece=`, and its title says the layout is shared.
  - This replaces the `/canvas` link; that route still redirects.
- **Posts:**
  - `app/[feed]/[slug]/page.tsx` first tries `renderPuckPage("post-detail", { template: true, metadata: { threadId } })`, with Edit, Remove and Share under it. Otherwise it falls back to today's ArticleView unchanged.
  - Posts follow the journal-piece rule (automatic once a template is published), not the event opt-in. `detailPage`/`readDetailPage` are untouched.
- **Plain pages:** new `components/studio/layout-door.tsx`, shown to editors on the plain post page and the bare journal piece as "Design a layout for pages like this". It opens the template on that record.
- **fc** builds `post-detail` on the shared `record-header` and `record-body` blocks, as a consumer only, plus the resolver and `TEMPLATE_SLUGS`. **That must land before a rebuild.** Until then `record.ts` ignores `?thread=` on post-detail, and a plain page could be created at that name.

### 4. Shared row rich text (page-builder)
- **`config.tsx`:**
  - New `rowFields` option: controls for a rows prop's columns only, used when `fields` has none for that kind.
  - A top-level prop is never touched by it. A host that passes `richText: false` keeps its top-level textareas.
- **`config.client.tsx`:**
  - `buildEditorConfig` defaults `rowFields.richtext` to Puck's formatted field (fc's AutoField approach, generalised, row-sized headings).
  - It's a custom field, so the canvas still gets the HTML string. A host's own `fields.richtext` still wins (sunjay's for now).
- **Reach:** only two rows props in the codebase have rich-text columns: sunjay `pt-steps` and HE `reading-block` steps.
- **`drive-rows.cjs` 13/13** (new `entry-rows.tsx`, with no host override). Open then publish is byte-equal to the seed. Opening a row writes nothing. Bold stays bold. Typing stores HTML in that row only. Plain columns stay inputs.
- tsc 0 in katie, elktours and HE.

### Also applied
- `components/landing/page-editor-mount.ts` passes `records` on fc's ask, so From what? works on `/` (for fc's `which` on home-standing).

### Verification (2026-11-14)
- `drive-inception.cjs` 56/56 (55 + designTools)
- `drive-popup.cjs` 56/56
- `drive-pkg.cjs` 58/58
- `drive-look.cjs` 30/30
- `drive-rows.cjs` 13/13
- `record-test.mts` 7/7
- `stack-drift.cjs`: identical
- `tsc` 0 errors: sunjay, page-builder, direct-edit, HE, katie, elktours (and innergathering and danamccool earlier today)
- **Not verified:**
  - the server routes under `next build` (layout, `[feed]/[slug]`, `journal/[piece]`, the studio pages);
  - the Site style editor on sunjay pages in a browser (elktours' `site-style/style.cjs` 38/38 covers the shared editor);
  - signed-in use.

### What Justin clicks after the rebuild (adds to round 1's list)
1. **Any page, signed in as an editor → "Site style"** (bottom right).
   - Change Page and Bronze and watch them preview, then Close without saving: nothing changes.
   - Save one colour, then sign out: the change shows for visitors.
   - Reset: back to today's look.
2. **`/hub` → Site Builder card → its theme link** opens Site style on `/`.
3. **A post at `/<section>/<post>`:**
   - editors see "Design a layout for pages like this", which opens `/studio/post-detail?thread=…` drawing that post (once fc's template lands);
   - publish the template and the post page is drawn from it; "Edit this page's layout" brings you back.
4. **A gathering with a detail page → "Edit this page's layout"** opens `/studio/event-detail?thread=…` showing THAT gathering, not the next one.
5. **On the canvas, Shift+click two blocks:** align, same size and group appear.
6. **Numbered steps → Settings… → open a step:** its words are formatted text, not `<p>` tags.

### Open
1. **Site style door on the canvas itself.** Today the doors are the page button and the hub link; the button is hidden on `/studio`. A "Site style" item in the canvas menu would be a direct-edit change (shared).
2. **Header and footer colours** are literal hex values in `pts.css` (`#e4cf9c`, `#0b0c0e`…), so theme colours don't reach them; only the chrome part looks do. Moving pts.css to the theme vars would change nothing visible today but would let Bronze reach the header. Justin's call.
3. **When HE should get `rowFields`:** it does automatically on its next rebuild, for `reading-block` steps (same field, same stored HTML).

# Pre-rebuild manifest (a2, 2026-11-14 10:46 EST, read-only)

**What a sunjay `next build` compiles.**
- `apps/sunjay` plus its workspace packages:
  - from package.json, with their workspace dependencies followed recursively: actions, analytics, auth-client, auth-server, blocks, chat, checkout, cms-ui, commerce, db, direct-edit, email, fonts, forum-ui, hub, newsletter, nextcloud, page-builder, payments, pipeline, primitives, redis, series-site, services, types, utils;
  - `transpilePackages` adds nothing beyond these.
- Uncommitted across that set (`git status`): **118 files**. The full listing with mtimes and line counts is in eris `~/scratch/inception/manifest-raw.txt`.
- **The live build** is `GG_g-_iEjJynUxsPCOq4C`, `BUILD_ID` written 2026-11-11 22:12 UTC (17:12 EST), built by the media-placement session. Anything changed before then is already live on sunjay. The split below is about what a NEW build would add.

## A. Ours (fc and a2, rounds 1-2), new to sunjay

**a2:**
- sunjay:
  - `app/studio/[slug]/{page.tsx, canvas/page.tsx, blocks/page.tsx (new), record.ts (new)}`
  - `components/studio/{CanvasEditor.tsx, page-editor.tsx, layout-door.tsx (new)}`
  - `components/landing/page-editor-mount.ts`
  - `app/manage/builder/page.tsx`, `app/[feed]/[slug]/page.tsx`, `app/journal/[piece]/page.tsx`, `app/layout.tsx`
  - `components/site-header.tsx`, `components/site-footer.tsx`, `components/hub/hub-card-host.tsx`
  - `components/site-style/SiteStyleButton.tsx` (new), `lib/site-style{,-schema,-actions}.ts` (new)
  - `lib/puck/render.tsx`
- direct-edit:
  - `src/canvas/{stack.ts (new), popup.ts, tree-editor.ts, interact.ts}`
  - `src/puck/{mount.ts, studio-popup.ts}`
  - harness files (not compiled by the app)
- page-builder: `src/{block-settings.tsx, config.tsx, config.client.tsx, layer-stack.ts (new)}`, `src/parts/{picker.tsx, popup.tsx, types.ts}`

**fc:**
- sunjay:
  - `blocks/{data-blocks, event-blocks, home-blocks, offering-card, service-blocks, shared-parts, small-blocks, writing-blocks}.tsx`, `blocks/detail-parts.ts` (new)
  - `lib/puck/{block-data.ts, config.client.ts, reserved.ts}`
  - `lib/puck/{data-standing, gathering-actions, service-actions, writing-actions, data-profile, profile-actions}.ts` (new)
  - `app/api/blocks/[id]/route.ts`, `app/page.tsx`, `components/landing/person-records.ts`
- direct-edit: `harness/event-detail/*` (not compiled)
- `src/puck/mount.ts` (the "" bound value) and `src/canvas/interact.ts` (the uppercase fix) are fc's findings in a2's files.

## B. Other sessions' work in the tree

**B1. Already live on sunjay** (changed before the 11-11 17:12 build): a new build ships them again, unchanged.

| Files | Session (source) |
|---|---|
| sunjay `app/about/[slug]/page.tsx`, `app/api/center/portfolio/route.ts` (new), `app/api/media/[...path]/route.ts`; services `galleries, media-authz, meeting-content, nextcloud, person-page, presence, profiles, series-form, site-portfolio (new)`; cms-ui `gallery/{SitePortfolioEditor.tsx (new), gallery.css, index.ts}`; db `migrations/264_per_site_placement.sql` | Media ownership and placement (`docs/open/MEDIA_OWNERSHIP_AND_PLACEMENT_2026-11-11.md`). 264 is **applied**: `org_profiles.portfolio` and `user_galleries.shown_on` exist (read-only check today). It built sunjay's current `GG_g…`. |
| blocks `src/blocks/record-parts.tsx` (new), `scripts/record-parts.mts` (new), `src/blocks.css`, `src/blocks/index.ts`, `package.json`, `src/blocks/profile-gallery.tsx`, `src/server/profile.server.tsx` | Record blocks / hidden-enneagram (lane D, system32-a1). Last edited 17:09, so in the live build, and shipped on HE at 17:22 the same day. **Unchanged since.** |

**B2. New to sunjay** (changed after the live build, by other sessions; finished and already live on other apps):

| Files | Session (source) | Live elsewhere |
|---|---|---|
| actions `README.md, src/{agent, catalogue, channel, index, present}.ts, src/server/{channel, routes, run, status}.ts`; services `src/org-domains.ts` (+`listOrgHosts`, read-only), `src/index.ts` (exports); utils `package.json, src/host.ts, src/studio-back.ts (new), scripts/check-studio-back.ts (new)` | Channel on sites / Studio back link (`docs/open/CHANNEL_ON_SITES_2026-11-12.md`) | arts-collective and katie, deployed 11-12 18:20 and 18:45, again 11-14 09:00 (tenant-smoke 9/9) |
| commerce `src/server/series.ts` (+173/-18), `src/server/index.ts`, `scripts/probe-series-entry.mts` (new) | IFAC studio stores and kit (`docs/open/IFAC_STUDIO_STORES_AND_KIT_2026-11-12.md` §4: series entry; probe 21/21, tsc 0) | art-auction 11-12 18:35 and arts-collective 18:45 |
| commerce `src/components/{BidWidget, BuyNowButton}.tsx`; checkout `src/server/stripe.ts`; payments `src/providers/stripe.ts` | Same IFAC session: Stripe setup mode for bidder registration (phone asked on the page, `payment_method_types: ["card"]`, no `phone_number_collection`) | arts-collective 11-12 18:45 ("that session confirmed them ready") |

## C. Flags

1. **fc is still editing.** `lib/puck/{data-profile, profile-actions}.ts`, `block-data.ts`, `config.client.ts`, `person-records.ts`, `blocks/data-blocks.tsx` and `api/blocks/[id]/route.ts` changed after 10:40. Not a clean point until fc says so.
2. **Blocker for round 2 item 3:** the `post-detail` template isn't in yet. `lib/puck/catalogue.ts` has no `record-header`/`record-body`, and `TEMPLATE_SLUGS` has to include `post-detail`. Until both land, the post route falls back to ArticleView (harmless), but `record.ts` ignores `?thread=` on post-detail, and an editor could create a plain page named `post-detail`. So land fc's item, or leave it out, before building.
3. **Type checks:** sunjay `tsc --noEmit` 0 errors at 10:46. Earlier today: direct-edit, page-builder, HE, katie, elktours, innergathering and danamccool 0. No TODO, FIXME, XXX or HACK in any changed `.ts`/`.tsx`.
4. **`packages/blocks` record-parts:** not half-done for sunjay. It's identical to what the live build already compiled, and sunjay doesn't use it yet (fc plans to, as a consumer only). The risk is only if its owner edits it before the build: check `find packages/blocks -newer` against `manifest-raw.txt` first.
5. **Stripe:** the change is bidder registration only. sunjay's paid bookings (`checkout/booking`, payment mode) don't call `startBidderRegistration`. Low risk, but the rebuild still ships `checkout` and `payments` changes into a site that takes card payments. Checking a booking page signed out is enough; no paid test.
6. **Never built under Next:** the round 1-2 server pages (studio routes, `[feed]/[slug]`, `journal/[piece]`, `layout.tsx` with Site style). `next build` is their first check. After it, signed out: `/`, a post, a gathering and a journal piece should return 200 at today's byte sizes ± markers; `/studio/event-detail`, `/studio/event-detail/blocks` and `/studio/event-detail/canvas` should 307; and there should be no `<style data-site-style>` on `/` (no style stored).
7. **Heap:** the 11-11 media session's sunjay build ran out of heap with defaults and passed with `NODE_OPTIONS=--max-old-space-size=4096 NEXT_BUILD_CPUS=2` (media doc). Use the same.
8. **Migrations:** none needed for this build. 264 is applied. 263 (`own_app_domains`, rows only) doesn't matter to sunjay.

## fc, round 2 (2026-11-14): items 1-4 + post-detail, LIVE on Para Theater

**Rebuilt and live** on Justin's yes (to d6: "Yes go ahead rebuild"; to fc: "rebuild now so i can hand test").
- Build `233XY5Fv4hG5pMtcRaV9Z`; the previous build was `GG_g-_iEjJynUxsPCOq4C`.
- Backup: `~/eac-backups/next/sunjay-20261114-1104.tgz` (7,558 files).
- Build command: `docker exec eac-sunjay … NODE_OPTIONS=--max-old-space-size=4096 NEXT_BUILD_CPUS=2 pnpm build`, exit 0, then `docker compose restart sunjay`, serving within 4 s.
- The build carried a2's round 1-2 work too: canvas-first studio, inception, Site style, designTools, layout door and record preview.

### What changed (sunjay, source in `apps/sunjay/src`)
| # | What | Files |
|---|---|---|
| 1 | "Piece (article)": `piece` is `binds: "piece"`. "From what?" lists the site's writing, then each series, in Studio and the canvas. The value is the slug, as before; "" means the address, else the newest. | `blocks/writing-blocks.tsx`, `lib/puck/writing-actions.ts`, `components/landing/person-records.ts`, `lib/puck/config.client.ts` |
| 2 | Template preview from a record. viaApi forwards `metadata.threadId/piece/service` as `atThread/atPiece/atService`, and `/api/blocks/[id]` parses them into the loaders' ctx (shape-checked, editors only). a2's `?thread=` / `?piece=` feeds this. | `lib/puck/config.client.ts`, `app/api/blocks/[id]/route.ts` |
| 3 | "Which gathering" on Next gathering (pt-standing and the home page's home-standing): `which` = `standing` (default; also missing), `next` or `thread:<id>`, through "From what?" (follows the calendar / the site's gatherings). `/` draws each home piece per node (`home-standing#<id>`). | `blocks/shared-parts.ts` (`WHICH_GATHERING_PROP`), `blocks/data-blocks.tsx`, `blocks/home-blocks.tsx`, `lib/puck/data-standing.ts`, `lib/puck/gathering-actions.ts`, `lib/puck/block-data.ts`, `app/page.tsx` |
| 4 | "Profile card" follows the site's guide (DM's pattern). `person` is `binds: "guide"`. "" is the site's guide: an OWNER with a public profile. Para Theater has two owners (Jason, Guru), so `siteConfig.guideSlug` only breaks the tie; it is no longer read by the block. "From what?": the site's guide / the site's people / whoever a gathering names (author, host). The pt-threads "author" list follows the same guide. Labels are gender-neutral now. | `lib/puck/data-profile.ts`, `lib/puck/profile-actions.ts`, `blocks/data-blocks.tsx`, `lib/puck/block-data.ts` |
| + | Post-detail (split A with a2): a `pt-post` block draws the route's post as today's post page does (section link + ArticleView, with ARTICLE parts). `POST_DETAIL_TEMPLATE` is the starting document, and `post-detail` is in `TEMPLATE_SLUGS`. With no published template, the post route draws exactly as before. It is a site block, not the shared record-header/body: those are another session's uncommitted files, and a production build compiles what is on disk. | `blocks/writing-blocks.tsx`, `blocks/writing-sample.ts`, `blocks/detail-parts.ts` (`POST_PARTS`), `blocks/index.ts`, `blocks/resolved-keys.ts`, `lib/puck/data-post.ts`, `lib/puck/templates.ts`, `lib/puck/reserved.ts` |

`person-records.ts` is now one table of kinds: person, opens, record, service, piece, guide, gathering.

### Verification
- **`tsc` sunjay: 0.**
- **Harness, isolated Chromium** (`packages/direct-edit/harness/event-detail/`):
  - `drive.cjs` 143/143, with new sections: G (template preview, Puck + canvas), H (which gathering + home per-node pieces), and the piece and profile choosers;
  - `drive-studio.cjs` 10/10 (piece picker in Puck Studio);
  - `drive-steps.cjs` 9/9;
  - frankenstein `drive-popup.cjs` 56/56;
  - frankenstein `drive-pkg.cjs` 58/58 and `drive-look.cjs` 30/30 (logs in `~/scratch/fc-r1/logs/pre/`).
- **`probe.mts` 26/26, read only, live database:**
  - "standing" (and a missing `which`) is byte-equal to `getStandingMeeting`; "next" is the soonest occurrence; "thread:<id>" is that gathering's next occurrence; another org's gathering draws nothing; no join link signed out;
  - the empty profile is exactly the guide shown before (Jason); a chosen person draws their card; following the gathering's author draws Jason; no public profile or junk draws no card;
  - the post-detail starting template draws a real post (title, body, section link); a gathering is not drawn as a post;
  - visitor HTML is byte-identical with and without the new parts on both stored pages.
- **Edge, signed out, before → after** (`~/scratch/fc-r1/edge/{before,after}.txt`):
  - 13 visitor pages 200 → 200, each about +470 bytes (the build's script list);
  - `/journal/no-such` 404 → 404;
  - `/login`, `/manage`, `/hub` 307 → 307;
  - `/studio/event-detail` 307 → login; `/studio/event-detail/blocks` 404 → 307 → login (new); `/studio/event-detail/canvas` 307 → `/studio/event-detail`;
  - no `data-site-style` on any page;
  - the post `/writing/community-2` draws its article ("Community") with no editor markup or layout door for visitors; the gathering page draws "Ritual Theatre Lab"; `/` holds its home-standing piece and no editor code.

### Item 5 (HE manners): not done, needs a design call
- A canvas probe on Next gathering, measured:
  - `inert` on a block's content stops the canvas picking parts (the selection stays on the whole block);
  - `inert` on the block's root stops the block being selectable at all.
- Clicks in the canvas are already captured by the editor (they select, and never reach the block's handlers: no popup opened).
- Only Tab focus reaches inside blocks: links, the booking form's fields, the Next-gathering button.
- So HE's `<div inert>` (fine on its figure and sound islands, which have no parts) would break sunjay's part editing.
- Options:
  - (a) the canvas sets `tabindex="-1"` on focusables inside nodes while editing, and puts it back on leave (a2's tree-editor);
  - (b) each view takes an `editing` flag and disables its own side-effect controls.
- The placement reason line also waits: sunjay's blocks have no "auto" layout choice yet for it to explain.
- Probes: `~/scratch/fc-r1/h/probe-click.cjs`, `probe-inert.cjs`.

### What Justin can hand-test now (signed in as an editor)
1. **`/studio/event-detail`** (the canvas) → select the event header: Words, Small label, Title, Facts… parts, Size and the like. The title is not typable; "About this gathering" is.
2. **`/studio/event-detail?thread=<gathering id>`** (or "Edit this page's layout" on a gathering): the template draws THAT gathering.
3. **Any page with "Piece (article)"** → Piece → Choose… → the site's writing, or a series → a piece.
4. **A page with Next gathering** (or `/` once saved as a tree) → Which gathering → "The next upcoming gathering", or one gathering.
5. **Profile card** → Whose profile → the site's guide / Guru / "Its author" on a gathering.
6. **A post page** → "Edit this page's layout" → `/studio/post-detail?thread=…` draws that post in the starting layout. Publishing it changes every post page.
7. **`/studio/<page>/blocks`** (Puck) → Numbered steps → a step's "Words under it" is a formatted-text box.

**Rollback:** stop the container, extract the backup into `.next` (ops.md), then restart.

## a2: item 5a, Tab stays in the editor (2026-11-14, source only, batched for the next rebuild)

- **New `packages/direct-edit/src/canvas/quiet-focus.ts`.** While a page is edited, every focusable a block draws gets `tabindex="-1"`: links, buttons, fields, iframes, `[tabindex]`, and `[contenteditable]` from the page's own markup.
  - Each element's own value (a number, or none) is kept in a Map and put back exactly on dispose.
  - A MutationObserver covers nodes a re-render adds, and an element whose own code sets its tabindex again (that becomes the value put back).
  - The editor's chrome is never touched: anything inside `[data-de-ui]` or `[data-edit-skip]`. The editor's own typing in place is not watched.
  - It replaces `inert`: clicks still reach the editor, so part picking is unchanged.
- **`canvas/tree-editor.ts`:** runs it on `scope` after the first draw, and its restore goes first in `dispose()`.
  - On for every tree-editor host, including the popup's nested mount, because the PM asked for it in tree-editor.
  - `quietTab: false` turns it off.
- **Harness: `drive-inception.cjs` section J, 64/64 overall.**
  - Every one of the 65 page focusables is quiet while editing, and the chrome stays tabbable.
  - 40 Tabs and a Shift+Tab from the editor bar never land inside a block.
  - A click on a block's own link still selects the block (no navigation).
  - Fixture on the real module:
    - chrome (`tabindex="4"`) and `[data-edit-skip]` untouched;
    - a node added later is quieted;
    - a value the page sets again is the one restored;
    - after dispose the DOM is **byte-equal** to before, and an added node keeps no tabindex.
- **Regression:**
  - `drive-popup.cjs` 56/56, `drive-rows.cjs` 13/13;
  - the root canvas drives `drive15-rows.cjs` and `drive11.cjs` show 0 failures;
  - tsc 0 errors in direct-edit, sunjay, HE, innergathering and elktours.
- **Reaches:** sunjay, HE and innergathering canvases, and the sunjay home in-place editor, each on its next rebuild.
