# Brief: "Edit look" popup, opened from Puck Studio (2026-11-06)

Approved by the developer 2026-11-06 (section 4 decisions as proposed). Status 2026-11-06: steps 1-4 built in source and harness-verified (`drive-popup.cjs` 56/56; `drive-pkg.cjs` 58/58 and `drive-look.cjs` 30/30 rerun; `tsc --noEmit` 0 in six workspaces); not rebuilt, not committed, not tried on the live site. The data block is the forum section (`pt-forum`); the current-series card is not wired. Details: `docs/open/CANVAS_FRAMEWORK_2026-11-02.md` "Block popup from Puck Studio". It adds a second way into the block popup that already works on Para Theater's live "Edit page": double-click a block in Puck Studio (`/studio/<slug>`), edit that one block's look, layout and words directly in the popup, and hand it back to Puck as one undoable change, saved with that page. Agreed in conversation 2026-11-06: our editor stays the house for the live page; Puck is reached from it and reaches into it; per-page looks now, versions later.

## 1. Current state

- **The popup exists** (`packages/direct-edit/src/canvas/popup.ts`, `openBlockPopup`). The canvas opens it on a double-click on a sealed block (`canvas/tree-editor.ts:1275`, `openLarge` at `:418`). It mounts a second tree editor on a working copy `{ root, content: [node] }`, at the block's width on the page. "Use on this page" hands the edited node back, and the page splices it in as one undo step (`tree-editor.ts:428-436`). Discard is free, because the popup has its own undo. Verified on Para Theater's live edit page 2026-11-05 (CANVAS_FRAMEWORK, stone 2 and the popup).
- **What the popup can do today:**
  - the block's props in the right column, through the contract (stone 1, `canvas/block-fields.ts`);
  - its declared parts as rows in the layer tree, with the full look panel and the thin bar (stone 2);
  - Arrange (`canvas/arrange.ts`: picture left or right);
  - sample rows when there is no data.
- **Puck Studio now has part editing in place** (`packages/page-builder/src/parts/`, `mountLookPanel` in `direct-edit/src/puck/look-panel.ts`), wired into `apps/sunjay/src/components/studio/page-editor.tsx` (source only, ships on the next sunjay rebuild). Harness 58/58 and 30/30, rerun 2026-11-06. Checklist: `packages/direct-edit/harness/frankenstein/PARITY.md`.
- **Double-click in Studio today:**
  - on empty space it opens the quick-add menu;
  - on a block it does nothing of ours. `page-builder/src/drag/canvas-menu.tsx:139-147` leaves it "to the block (and to Puck's text editing)", because Puck types into inline-editable fields on the canvas.
- **The motivating block, Numbered steps** (`pt-steps`, `apps/sunjay/src/blocks/small-blocks.tsx:56`):
  - it declares no parts;
  - its steps are a `rows` prop (title and rich text per step), typed today in Puck's right-hand list.

## 2. What the developer gets

1. **Open.** In Studio, double-click a block, or press "Edit look" in the block's action bar. The popup opens over Studio with that block alone, drawn with the same data Puck has: real rows where the resolver found them, sample rows where it did not.
2. **Edit inside the block:**
   - **Words the block owns:** click a step and type its title or text in place. This writes the block's own props, the same values Puck's right panel edits, so the two stay in sync.
   - **Look:** font, size, colour, spacing, background, borders, picture, per part.
   - **Layout inside the block,** as far as the block declares: order of parts, stack or grid, picture left or right.
   - **Settings:** the block's Puck props, in the popup's right column.
3. **Return.** "Use on this page" closes the popup. Puck gets the block back as one `replace`, so one undo in Studio reverts the whole popup session. Publish saves it with the page. "Discard" leaves Puck untouched.
4. **Puck keeps placement:** the block can still be moved, duplicated or deleted in Studio as before.

## 3. Design

- **One popup, two doors.** Reuse `openBlockPopup` and the nested `mountTreePage` unchanged where possible. The Studio door needs:
  - a host-side opener: read the node from Puck (`getPuck().getItemById(id)`), get its rows from Puck's resolved props (the editor config's resolvers already ran), mount the popup over Studio's window (not inside the canvas iframe), and on "Use on this page" `dispatch({ type: "replace", destinationIndex, destinationZone, data: node })` with `getSelectorForId`;
  - resolver-filled props stripped before the hand-back and restored by Puck's own `resolveData` (trigger "replace"), as the canvas save path does with `stripResolved`. Correction 2026-11-06: a plain `dispatch({ type: "replace" })` runs no resolver in Puck 0.23, so the opener puts Puck's own rows back on the node itself and then calls `resolveDataById(id, "replace")` (`packages/page-builder/src/parts/popup.tsx`).
- **Where the code sits.** The opener lives with the parts plugin in `packages/page-builder/src/parts/`. The popup and editor are injected by the host (as `mountLookPanel` is today), so page-builder still does not import direct-edit and direct-edit still does not import `@puckeditor/core`.
- **Styles inside the popup.** The block must draw with the site's CSS outside the iframe. Studio's main document already loads the site stylesheet (Puck copies it into the iframe from there, per `.claude/rules/areas/puck-blocks.md`); verify that the popup's stage gets the same fonts and tokens (the canvas passes `scope`, the element whose classes carry over).
- **Typing into rows.** For `pt-steps`:
  - declare parts (heading, list, step, number, step title, step text);
  - mark each row's elements with `editItem("steps", index)` (`packages/blocks/src/edit-item.ts`), so a click maps to `steps[index].title` or `.text`;
  - typing in the popup writes that row's value;
  - rich text goes through the same sanitiser the save path uses (`sanitizeRichText` / `<RichText>`).

  This is new for row props in the popup. Today the popup types only into own `words` blocks.
- **Words that come from data** (a series title, an event name) stay locked in the popup, with a note saying where they are edited. The later "change it for this page, or change the thread?" question is out of scope.
- **Studio's in-place part editing stays** as the quick path; the popup is the focused path. Both use `mountLookPanel`.

## 4. Decisions (approved as proposed, 2026-11-06)

1. **Gesture.** Double-click on a block, an "Edit look" button in the block's action bar, or both. Double-click collides with Puck's typing into inline fields (titles typed on the canvas). Proposed: both, with double-click on an inline-editable field left to Puck's typing.
2. **First block for the pilot.** Proposed: `pt-steps` (the case named), then one data block (the current-series card or the forum section) to prove real rows.
3. **What "layout inside the block" may change for owners.** Proposed: order of parts, stack or grid, picture left or right, alignment, and size as Hug / Fixed / Fill. Free positioning stays out, as in the canvas.
4. **Developer-only tools in the popup** (Code tab, Detach). Proposed: the same `developer` switch as the parts plugin (off on sunjay).

## 5. Work plan

1. Studio opener and hand-back (mount over Studio, `replace`, one undo, discard, Esc).
2. `pt-steps` parts and row markers; typing into rows in the popup, with sanitising.
3. Data block in the popup from Studio (real rows from Puck's resolved props).
4. Harness: extend `harness/frankenstein` with `entry-popup.tsx` and `drive-popup.cjs` on sunjay's real config and the `/try` seed:
   - open by gesture;
   - type a step and see it in Puck's right panel;
   - style a part;
   - "Use on this page" = one Puck undo step;
   - Discard leaves the data byte-equal;
   - publish carries `morph` and the typed text;
   - nested and data blocks;
   - phone width;
   - no page errors.
5. Record in PARITY.md and CANVAS_FRAMEWORK; no rebuild without the developer's go.

Estimate (assumed): one focused session for 1–2 with the harness, half a session for 3.

## 6. Constraints

- **Source only:** no rebuild, restart, commit, install or database write.
- **Shared tree:** run `git diff` before editing shared files (`config.tsx`, `page-editor.tsx`, `small-blocks.tsx`).
- **Published markup:** a block with no morph and no new marks must publish the same markup. Check `pt-steps` signed-out HTML before and after, since row markers add attributes.
- **Register:** neutral, per `.claude/rules/01-writing-register.md`.

## 7. Open items (later, not in this brief)

- Versions of a block or page (saved earlier states, "dog-ears", `page_revisions`): the direction is kept, the work is not started.
- Saved looks and a site default per block kind, beside Site style (see PARITY.md's design note).
- The CMS question for data words ("this page only, or the thread itself?").

## 8. Next after this brief: components driven by a record (decided 2026-11-06)

- A live component is always about a record: a thread (post, event, series, session, tour, service), a user, an org, an artwork, a store or listing, a media item. It stores only the reference; the platform fills it per request with its normal visibility rules (min_role, Private media, org from the deployment).
- One shared "from what?" chooser for every such block: the kind of source, then the item; a source can also come from an enclosing box ("About: …") or from a template's route.
- Featured person: a simple menu of the org's members, or the referenced thread's associated people as stored — `threads.author_id` (author), `meeting_hosts` (per occurrence, with its stored `role` label), and for a series its sessions' hosts through `series_sessions`. No invented roles; no default person. People who RSVP'd (`thread_rsvps`) are left out. Following choices are wanted: e.g. "host of the next session" follows an evolving series.
- Featured picture: asks what it is from (library, a thread's cover or gallery, an artwork, a person's portrait or gallery, a store item). Adding a picture into a thread is a separate, permissioned write, kept apart from reading.
- First test case: elktours landing (hero text, a box beside it, Featured person in it). Built after the popup.
- Status 2026-11-06: Featured person built in source for the elktours landing editor. It covers the shared chooser (`direct-edit/src/canvas/records.ts`), the block (`packages/blocks/src/blocks/featured-person.tsx`) and the resolver (`@elkdonis/services/featured-people`), with follows for author, next session host and next departure guide. Harness 41/41; read-only probes against the live database. Live on elktours since the 18:29 EST rebuild (not yet used signed in); not committed. Puck Studio's panel still shows `person` as a text box. Featured picture is not started. Details: `packages/direct-edit/harness/featured/README.md`.
