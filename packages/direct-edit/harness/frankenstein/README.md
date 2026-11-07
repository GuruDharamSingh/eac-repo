# Puck plugin and two-room house (experiment, 2026-11-06)

Tests whether direct-edit's "click into a block" works inside Puck's own editor, and whether Puck's editor and the direct-edit canvas can share one document by taking turns. Para Theater's real editor config, contract and `/try` seed; stand-in `/api/blocks/*` rows; isolated Chromium with no network; no database. Nothing outside this folder was changed.

## Packaged plugin (2026-11-06)

The plugin now lives in `packages/page-builder/src/parts/` (`partsPlugin`, exported from `@elkdonis/page-builder`); `parts-plugin.tsx` here is the earlier prototype, kept for `drive.cjs` and `house.cjs`. Parity checklist for the look layer inside Puck: `PARITY.md`.

- `entry-pkg.tsx`: page-builder's `PuckEditor` and the packaged `partsPlugin`, wired as `apps/sunjay/src/components/studio/page-editor.tsx` wires them, with Para Theater's editor config, contract and `/try` seed. Harness only: `pt-band` gets a test part `heading` (`sel: "h2"`) so that the nested feed cards' heading would match it if ownership were not checked.
- `entry-pkg.tsx` query: `?panel=look` mounts direct-edit's `mountLookPanel` (as sunjay does); `?dev=1` turns on the developer tools.
- `drive-pkg.cjs` (built-in panel, `?dev=1`) and `drive-look.cjs` (look panel). Run: `W=<scratch> bash run.sh frankenstein/entry-pkg.tsx:fk.js -- drive-pkg.cjs`, then `W=<scratch> bash run.sh -- drive-look.cjs` (no rebuild needed).

Results 2026-11-06, final source: `drive-pkg.cjs` 58/58, `drive-look.cjs` 30/30, 0 page errors other than offline image loads.

Block popup from Studio (2026-11-06, `docs/open/EDIT_LOOK_POPUP_BRIEF_2026-11-06.md`): `entry-popup.tsx` wires `partsPlugin` exactly as sunjay's page editor does (look panel, `developer` from `?dev=1`, `popup` = `openStudioPopup` with sunjay's `canvasConfig` and contract) on the `/try` seed with two `pt-steps` added (one top level with an empty middle row, one inside the About band). `drive-popup.cjs` routes `/api/blocks/pt-forum` to rows with two topics. Run: `W=<scratch> bash run.sh frankenstein/entry-popup.tsx:fkp.js -- drive-popup.cjs`. Result 2026-11-06: 56/56, screenshots `shots/popup-0*.png`; `drive-pkg.cjs` 58/58 and `drive-look.cjs` 30/30 rerun afterwards.

`drive-look.cjs` covers: Alt+click into the banner's Title; direct-edit's panel in Puck's right column with Size, Layout, Text, Appearance and Effects; the layer tree (block on top, parts nested as drawn, Title selected); no Code tab without `developer`; contrast shown; a Size typed in the canvas panel's own field draws and is one history step; typing slowly in a panel field is one step and one undo takes it back; a row click selects that part; a row hover outlines the part on the canvas; the eye hides a part (faint in the editor) as one step, undone by one undo; Layout Stack on Words draws flex; Tweaks on `section-heading` stores `--blk-accent` in `morph.tokens`; "← Block settings" above the panel; Width shows a four-digit value in Puck's 274 px column; with `?dev=1`: the Code tab, its sheet, "Not kept: position" while typing, only kept declarations stored, and "From <section> color" with "+" after the banner's ink is set.

Earlier result the same day, before click-through by depth: 53/53. Covered beyond `drive.cjs` (since amended to the canvas's click-through: the second click picks the outermost part under the pointer, Words, the third Title; a cousin goes to the part inside the shared part; Alt+click the deepest; Enter in; Esc out one part, then to the block): the part's name on its outline; the panel in Puck's right column with Puck's font and corners (Para Theater's sheet sets `border-radius: 0 !important` on every element, Puck's own buttons included); placeholders read from the page; one history step per select or per typing spell, typed slower than Puck's 250 ms debounce; one undo removes a whole spell; Ctrl+Z in a field mid-spell puts back only the spell; typing then clicking Puck's own undo button at once removes the spell and keeps the step before; the CSS box lists "Kept" and "Not kept" (`position: fixed` refused, not drawn); Esc from the canvas and from a panel field; "← Block settings"; a band selected draws no mark on its nested cards' heading, a click there selects the cards (Puck), a second click picks the cards' own heading; repeated parts show their count. Puck logs "`set` is expensive" once per recorded step (12 in the run): `history.setHistories` dispatches `set` with a state that has no `indexes`, so Puck rebuilds them.

## Files

- `parts-plugin.tsx`: a Puck plugin (178 lines without comments). `overrides.iframe` picks a part on a second click inside the selected block (rectangle hit against the contract's selectors) and draws outlines; `overrides.fields` replaces the block's fields with a part panel while a part is selected; writes go through `setPartLook` and Puck's `replace` action.
- `entry.tsx`: page-builder's `PuckEditor` with the plugin. Adds a hidden `morph` field to every block (see Finding).
- `house.tsx`: one document, two rooms (Arrange = PuckEditor + plugin, Shape = `mountTreePage`), one writer at a time; switching is a handoff that cleans the document as a save would, refuses a handoff that drops a prop of a surviving block, and logs it.
- `drive.cjs`, `house.cjs`: drivers. `serve.cjs`: page and stand-in rows. `build.cjs`, `run.sh`: bundle in `eac-dev`, drive in `zenika/alpine-chrome`.

Run (W = a scratch folder holding `h/` with `shim-*.ts*`, `site.css`, `editor.css` from `src/direct-edit.css`, `node_modules/playwright-core`):

    W=<scratch> bash run.sh frankenstein/entry.tsx:fk.js -- drive.cjs
    W=<scratch> bash run.sh frankenstein/house.tsx:house.js -- house.cjs

## Results (2026-11-06)

`drive.cjs` 34/35. Passed: the first click selects the block (Puck), the second click picks the part under the pointer (smallest wins); outlines are drawn; the part panel replaces the block fields; fill and size draw on the part; the stored `morph` equals `setPartLook`'s and survives `cleanMorph` and `cleanBoxDoc`; Puck's history undoes and redoes it (API and Ctrl+Z / Ctrl+Shift+Z); a nested block's part (feed cards in a band) is reached in two clicks; resolvers fetch on open; Publish hands out a document that differs from the seed only by the `morph`; at Puck's 360 px viewport `(min-width: 640px)` stops matching, the guarded title size follows (`min(64px, 11vw)` = 39.6 px), and part picking and outlines still line up. The one failure: the published document's key order differs from the seed's (Puck flattens and expands node props); values are equal.

`house.cjs` 16/16. Covered: a setting and a part look made in Arrange are drawn in Shape; Puck's editor is unmounted while Shape is open; a band moved in Shape (`]`) arrives in Arrange with Arrange's edits intact; two handoffs are logged; the drop rail refuses a lost prop and allows a deleted block.

## Finding

Puck's editor walks every prop through its field transforms, including props that have no field. A `morph` whose part name equals an inline-editable or rich-text field (`title`, `subtitle`, `body`, …) has that part's look replaced by an editor element (`propPath: "morph.parts.title"`), and the block draws no look. Verified in this harness on `pt-banner` (without the hidden field: 23/31, fill and size not drawn; with it: 34/35). Assumed to affect Para Theater's live `/studio/<slug>` Puck editor today for any stored look on such a part; not checked on the site. Published pages are not affected: `<Render>` applies only slot and rich-text transforms by field path. Fix: a `morph` field of `type: "custom"`, `visible: false`, so Puck does not walk into it. 2026-11-06: moved from this harness into `buildPuckConfig` (added when a host passes `morph`); `entry.tsx` and `house.tsx` now use the real config, and both drivers pass as above.

## Not covered

Signed-in use on a real host, real rows, a real save action, `<Render>` of the published document (no published-path file changed), Firefox, Safari, touch, typing in the part panel at length (each number change is one history step).
