# IG-fix: the three innergathering landing faults, fixed in source and seen signed in

2026-11-21. Source only: no commit, install, migration, rebuild of a live container or production write. Proof folder: `~/scratch/manjushri/ig/` (scripts `check.cjs`, `boundary.cjs`; logs `before.txt`, `after.txt`, `boundary.txt`; shots in `shots/`; `result-before.json`, `result-after.json`).

## How it was seen
- A scratch production build of `apps/innergathering` (`build-ig.sh before` / `after`, `.next` in `~/scratch/manjushri/ig/next-<label>`), served by one-off container `ig-dev` on `localhost:4025`. (`next dev` did not work for this app: turbopack ran the container out of memory, webpack stops on `sharp`. A production build of the same source is closer to what ships.) Stopped and removed; `next-env.d.ts` is clean in git.
- Signed in as the test editor (guide on `inner_group`) in headless Chromium at 1440 wide. Every POST that is a server action or carries a page document is aborted (none was attempted: nothing was ever saved).
- "Before" = the source as it stood (block pass, plus the other PM's `SiteStyleButton.tsx` fix already in it). "After" = this job's changes.

## Fault 1. Site style button gone: cause confirmed, no edit made by me
- Signed in, editor closed, the page holds exactly one non-button `[data-de-ui]` element: `DIV[data-fields-ui][data-de-ui]`, the Fields lens bar (`FieldsLens.tsx:287`).
- With the other PM's rule in place (`SiteStyleButton.tsx:28`, `:not([data-fields-ui])`) the button is present (`[data-site-style-open]` count 1).
- To reproduce the old rule I removed only the `data-fields-ui` attribute from that element in the browser and nudged the DOM: the button went to 0 (`before.txt` and `after.txt`, "button after lens loses data-fields-ui (old rule): 0"; screenshot `before-1b-lens-unmarked.png`). Removing the element itself brought it back to 1. So the lens element is the whole cause.
- With the editor open the button is hidden (0) as designed, and it is back (1) after closing.
- `SiteStyleButton.tsx` and `FieldsLens.tsx` untouched by me. Fixed by the other PM's one-line change; it ships with the next innergathering build.
- Screenshots: `before-1-landing-signedin.png`, `after-1-landing-signedin.png` (button visible, bottom left).

## Fault 2. "Block settings" opens a blank white popup
**Confirmed cause (the console):** `pageerror: invariant expected app router to be mounted`, thrown inside Puck's drawing of the block. `next/navigation`'s `useRouter()` throws when there is no app router. The offerings band holds `RsvpPanel` (`apps/innergathering/src/components/rsvp-panel.tsx:3,56`, `useRouter()` to refresh after an answer). The swapped block has no `panel` setting, so it draws the default "Are you coming?" panel. The settings sheet (and the canvas) are separate React roots outside Next's router, so the hook threw, React unmounted the whole sheet, and only the white frame stayed. This was none of the three guessed candidates in IG-faults (bare id, parts plugin, morph/orgId), though the bare id is also fixed below because it left the fields empty.
Before: sheet text length 0, 0 fields, Apply missing; one uncaught page error. Screenshot `before-3-settings-offerings.png` (blank). The forum sheet could not be reached after that in the before run (the page stayed paused behind the dead sheet).

**Fixes:**
1. `apps/innergathering/src/lib/puck/router-shim.tsx` (new file, 31 lines): `withRouter(block)` draws a block inside an `AppRouterContext` whose router does nothing, only when no real router is present. The real page is unaffected.
2. `apps/innergathering/src/lib/puck/config.client.ts`: imports `withRouter`; the landing blocks pass through it before they go into `blocks` (`landingForEditor`, two lines), so the canvas and the sheet both draw them. The published (server) config is untouched.
3. `apps/innergathering/src/lib/puck/landing-blocks.ts`: `swapLandingParts` gives the swapped blocks their declared settings (`toDefaultProps(offeringsBand.def)` / `toDefaultProps(grandForum.def)`) with the id, so the sheet shows real values, not blanks. They equal the fallbacks the blocks already used, so the public page is unchanged (proved below).
4. `packages/page-builder/src/block-settings.tsx` (one hunk set, +28/-1): `SettingsBoundary` class around `<Puck>`; on a throw it shows "This block's settings could not be opened." with a Close button (`data-block-settings-cancel`, calls `onDone(null)`, the same path as Cancel, so the layer stack is released) and logs the error. Seen working: I made the endpoint return a bad row (`boundary.cjs`); the sheet showed the message, Close removed it, the panel stayed (`boundary-1-message.png`, `boundary.txt`).

**After:** offerings sheet: 665 characters, 65 fields, Apply present, header "Current offerings: settings", fields show the real values (`after-3-settings-offerings.png`). Forum sheet: 513 characters, 53 fields, Apply present (`after-3-settings-forum.png`). Apply on the offerings sheet after typing " ZZ" in Heading: the canvas heading became "Current Offerings ZZ" in place (`after-4-after-apply.png`); nothing saved. Zero uncaught page errors in the whole run.

## Fault 3. Current offerings smaller, broken image in the editor
**Confirmed cause:** the page never handed the editor its rows, so the canvas drew the block's sample; the sample's cover `/sample-cover.jpg` does not exist. Before: offerings 575 px tall in the editor against 841 on the page (at 1094/1440 scale the page height is 639), the canvas held a second image with `naturalWidth` 0 (`/sample-cover.jpg`), forum 431 against 189.

**Fixes:**
1. `apps/innergathering/src/app/page.tsx`: `landingResolved(list)` helper (imports `LANDING_RESOLVED_KEYS`), and `resolved={landingResolved(filled.content)}` on `<EditPageButton>` in the tree branch (as elktours does). For the offerings it passes `items`, `rows`, `signedIn`, `nextcloudUrl`. For the forum it passes `question`, `signedIn` and `preview` (true only when the page has a conversation): the forum's own render is a React element and cannot go to the browser, so the editor draws a note where the conversation goes.
2. `apps/innergathering/src/components/landing/EditPageButton.tsx`: optional `resolved` prop, forwarded.
3. `apps/innergathering/src/components/landing/page-editor-mount.ts`: `openLandingEditor` takes `resolved` and passes it to `openHouseLanding`.
4. `apps/innergathering/src/components/landing/offerings-block.tsx`: the sample's `coverImageUrl` is `null` (the band already draws no cover when there is none).

**After:** page 1440 wide: offerings 841 px; editor (page fitted to 1094 beside the panel, scale 0.7597): offerings 640 px against an expected 638.9; forum 143 against 143.6. Offerings width 1094 = scaled. Cover `naturalWidth` 440 (loaded); zero broken images on the canvas (`after-2-editor-open.png`).

## Other checks, signed in (all in `after.txt`)
- Editor opens (`.de-vpanel`, html classes `de-vpanel-open de-editing de-fit`) and closes cleanly: Done asks "Leave without saving your changes?" (a changed block was pending), accepted; then no `.de-vpanel`, html class empty, page back at 1440, offerings 841 px.
- The page shrinks beside the panel as one scaled page (root 1094 wide, children scale together); heights match the page at that scale to under 2 px, so nothing reflows.
- RSVP: 1 `.ig-offer-rsvp` before, 1 after opening, changing a setting, and leaving without saving.
- Site style button: present with no editor, hidden while the editor is open, back after closing.
- Console: the only errors are `400` from `challenges.cloudflare.com` (the Turnstile script, third party, present before and after) and `ERR_NETWORK_CHANGED` once during login in one run. Zero uncaught page errors after.
- Assertion tally: before 7 failures (heights, cover, broken image, both settings sheets, page error, forum click); after 0.

## Signed-out landing, 1440 and 390
`~/scratch/he-test/shots.cjs` and `pixdiff.py`: live site A, dev copy, live site B. Live A vs live B: all same (no varying regions on this page). Dev vs A: same, dev vs B: same, at both widths (`shots/ig-live-a`, `ig-live-b`, `ig-dev`). Pixel-identical.

## First-ever-edit question
Can the landing be opened with no saved tree today? No: the page renders from a saved tree now (the swapped blocks are visible, the panel lists them), so the editor is opened with `tree` set. A tree-less page happens only if the row is deleted (the editor's "Restore" calls `restoreLandingAction` -> `deletePage`). In that case the page draws its hand-written markup (`page.tsx:408`, `tree={null}`), where "Current offerings" and "The Grand Forum" are the live parts (`data-landing-part`), not block output. A first edit would adopt them as live parts, as before the block pass, not as plain boxes; a save writes them as parts, and the read-time swap turns them into blocks again. Read from the code, not run: I would have to delete the production row to see it. The `existing` hook gap in `openPageAsTree` therefore does not bite this page today. It would bite a page whose tree is empty while the markup is already drawn by blocks.

## tsc
`apps/innergathering`: 0 errors before, 0 after. `packages/page-builder`: 0 before, 0 after.

## Files
- `apps/innergathering/src/app/page.tsx`
- `apps/innergathering/src/components/landing/EditPageButton.tsx`
- `apps/innergathering/src/components/landing/page-editor-mount.ts`
- `apps/innergathering/src/components/landing/offerings-block.tsx`
- `apps/innergathering/src/lib/puck/landing-blocks.ts`
- `apps/innergathering/src/lib/puck/config.client.ts`
- `apps/innergathering/src/lib/puck/router-shim.tsx` (new)
- `packages/page-builder/src/block-settings.tsx`

## Still open / notes
- Rebuild needed: `innergathering` only (page-builder is bundled into it; other apps that use `block-settings.tsx` get the boundary at their next rebuild, not required). It also carries the other PM's `SiteStyleButton.tsx` line.
- The settings sheet's metadata still has no `orgId` (`page-editor-mount.ts`): not needed by these two blocks; a `thread-feed` block on this landing would need it.
- `router-shim.tsx` imports `next/dist/shared/lib/app-router-context.shared-runtime`, an internal Next path (exists in 16.1.6). Any block that calls `useRouter()` and is shown in an editor root needs the same shim.
- A "Leave a message" widget in the page is unrelated; it was not used.
