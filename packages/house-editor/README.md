# @elkdonis/house-editor

The house of all editors: the glue between the editors, so an app binds one thing instead of copying a 170-line component.
Only this package imports both `@elkdonis/direct-edit` and `@elkdonis/page-builder`; they never import each other
(direct-edit stays plain DOM, page-builder stays free of direct-edit).

## Members

| Lens | Package | Used here as |
|---|---|---|
| Canvas (blocks, layout, parts' looks) | `@elkdonis/direct-edit` | `mountTreePage`, `openStudioPopup`, `mountLookPanel`, `openPageAsTree` |
| Puck (whole page, one block's settings) | `@elkdonis/page-builder` | `PuckEditor`, `partsPlugin`, `openBlockSettings`, the store and `savePage` |
| Site style | `@elkdonis/direct-edit/site` | later |
| Fields (one value at a time) | `@elkdonis/live-editor` | later: `./fields` |

## Exports

- `.` (client): `HouseEditor` (the canvas), `HouseWholePage` (Puck with the same plugins), `openHouse`, `openHouseLanding`, and the helpers `resolvedRows`, `withProps`, `holdVersion`.
- `./server`: `createSavePageAction` and the pure helpers. No React, no Puck: an app's `"use server"` file calls it.

## How the members talk

- **One stored document**: `site_config puck:<slug>`, Puck JSON. The canvas and Puck read and write the same row.
- **One layer stack**: `Symbol.for("eac.layer-stack.v1")` on `window`. Each layer (canvas, settings sheet, popup) registers, so Esc closes the top one and dirty checks ask before a layer is thrown away.
- **Hand-offs**:
  - canvas `editSettings` calls page-builder `openBlockSettings`, then the block is resolved again where it sits;
  - Puck `partsPlugin` opens direct-edit's `openStudioPopup` / `mountLookPanel` ("Edit look"), and `handBack` selects the part again when the popup closes.
- **Save path**: editor -> the app's gated `savePageAction(slug, doc, version)` (built with `createSavePageAction`: gate, slug rules, `stripResolvedKeys`, `cleanBoxDoc`, page-builder `savePage`, revalidate).
  The version is `loadPageWithVersion().updatedAt`; each save returns the next one. A changed row answers `{ ok: false, stale: true }`: nothing is written and the editor keeps its edits.
