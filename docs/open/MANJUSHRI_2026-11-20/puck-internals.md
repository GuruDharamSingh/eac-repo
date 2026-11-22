# Puck 0.23.0 internals: reverse-engineering report (lane P)

Author: P (Puck internals lead), 2026-11-20. Read-only research; nothing was run. Every behaviour below is read from the bundle, not executed. Items marked **unverified** are inferences.

Citation form: `puck-0.23.0/dist/index.js:<line>` (frozen copy at eris `~/scratch/manjushri/puck-0.23.0/`; md5 of `index.js` identical to the installed 0.23.0 file). The original source file is in parentheses, taken from the bundle's `// components/...` / `// lib/...` marker. `rsc.js`, `internal.js` and the `.d.ts` files are cited the same way. House code is cited repo-relative. Where I give a range with `~` the start line is approximate.

Package facts: `@puckeditor/core` 0.23.0 exposes `.` (client; the store file is marked `"use client"`, `index.js:3420`), `./rsc`, `./internal` and css files (package.json `exports`). Runtime deps that leak into behaviour: `@dnd-kit/react` + `@dnd-kit/dom` (drag), `zustand` (store), `@tiptap/*` (richtext), `fast-equals`, `flat` (prop flattening).

---

## 1. Data model

**In plain words.** A page is one JSON object: `root` (page-level props), `content` (the top-level list of blocks) and, only in old documents, `zones`. A block is `{type, props}`; `props.id` is its identity. Modern nesting ("slots") stores child blocks directly inside the parent's props, so the whole page is one tree you can read with no Puck UI.

**Evidence.**
- Types: `Data = {root, content, zones?}`; `ComponentData = {type, props: WithId<Props>} & {readOnly?}` (`puck-0.23.0/dist/actions-DA1J5F56.d.ts`, `type ComponentData`, `type Data`, `type BaseData`). `RootData` accepts legacy `root: {title}` and `root: {props:{title}, readOnly}`.
- Slot value = array of `ComponentData` held in the prop named by a `{type:"slot"}` field. Slots may sit inside `array`/`object` fields: `walkField` recurses via `arrayFields`/`objectFields` and builds the zone name from the property path, e.g. `rows[0].content` (`index.js:1478-1556`, lib/data/map-fields.ts; zone key `${parentId}:${propPath}` at `index.js:1708-1712`).
- Legacy `zones`: keys `"<parentId>:<zoneName>"`. `migrate` converts them to slots and **throws** if a zone has no same-named slot field; it also moves `root.*` to `root.props` (`index.js:19775-19900`, lib/migrate.ts).
- Top-level `content` is the droppable `root:default-zone` (`index.js:1383-1388`). Root is addressed as id `"root"`; `toComponent` shims `{type:"root", props:{...,id:"root"}}` (`index.js:1675`).
- Ids: `generateId(type) = "<type>-<uuid v4>"` (`index.js:1934`, lib/generate-id.ts). On `<Puck>` mount only **root** goes through `populateIds` (`index.js:~19620`, components/Puck/index.tsx); content items must already carry `props.id` (unverified what happens to an id-less item: `walkAppState` indexes by `item.props.id`, `index.js:1740`).
- `walkTree(data, config, cb)` calls `cb(content, {parentId, propName})` for each slot array and the root `content`, recursing; it **throws** `Could not find component config for <type>` for an unknown block type inside a slot (`index.js:1478-1500` and `1959-1990`). `<Render>` instead silently skips unknown types.
- `transformProps(data, {Type: props => newProps, root})` goes through `walkTree`; the output replaces the props except `id` (`index.js:19912-19935`), so a transform must return the whole props object.
- `resolveAllData(data, config, metadata)` is in `index.js:19965` and `rsc.js:1015`.
- `<Render>` client (`index.js:9788`, components/Render/index.tsx) and RSC (`rsc.js:819`, components/ServerRender): no defaultProps, no `resolveData`, no migration. They give the root `{...rootProps, title, editMode:false, id:"puck-root", puck:{renderDropZone,isEditing:false,dragRef:null,metadata}}`, turn slot fields into `Slot` components (`getSlotTransform`, `rsc.js:602`) and `richtext` fields into rendered HTML (`useRichtextProps`, `rsc.js:631`, `index.js:9674`). A block's render receives `item.props` plus `puck`; **top-level keys other than `props` (e.g. `readOnly`, any extra key) never reach the block** (`rsc.js:758-781`).
- **No wrapper element per block on the published route**: `Component.render` is called directly inside the slot's `<div>` (`rsc.js:716-756`, `SlotRender`). Unknown types render `null`.
- RSC detail: a block rendered inside a slot gets `puck = {metadata}` only (no `isEditing`, no `renderDropZone`), because `props.puck` is undefined for slot items (`rsc.js:716-735`); legacy DropZone children get the full `puck` (`rsc.js:758-781`).

## 2. The store

**In plain words.** Puck keeps one zustand store. Its heart is the "app state": your document (`data`), editor UI bits (`ui`, e.g. the selected block) and two lookup tables (`indexes`) that map every block id to its data, parent and path and every zone to its child ids. Every change is a small "action" run through one pure function (the reducer) that rebuilds the lookup tables.

**Evidence.**
- Store creation: `createAppStore` (`index.js:3440`, store/index.ts). Slices: `history` (`2843`), `nodes` (`2920`), `permissions` (`3014`), `fields` (`3158`), plus `state`, `config`, `plugins`, `overrides`, `metadata`, `iframe`, `dnd`, `fieldTransforms`, `selectedItem`, `zoomConfig`, `status`, `componentState`, `currentRichText`. Typed as `AppStore` in `index-DIZKfHDN.d.ts`.
- Not exported: `createAppStore`, `walkAppState`, `resolveComponentData`. Reachable: the `usePuck` projection (`index.js:17887`), and in non-production builds `window.__PUCK_INTERNAL_DO_NOT_USE = { appStore }` (`index.js:19728`).
- `dispatch(action)` (`index.js:3484`): builds a reducer with the store's `record` and `appStore`, applies it, recomputes `selectedItem = getItem(ui.itemSelector)` (`3492`), then calls the store-level `onAction(action, newState, prevState)`. This `newState` is the private state **including `indexes`**; the reducer's own `storeInterceptor` passes public `{data,ui}` states (`index.js:2554-2570`), but `dispatch` does not give `createReducer` an `onAction`, so the store path is the one `<Puck onAction>` uses (`generateAppStore` hands it to the store, `index.js:19699`). The d.ts types it as `AppState`.
- `PuckAction` union (`actions-DA1J5F56.d.ts`, `type PuckAction`): `insert, duplicate, replace, replaceRoot, reorder, move, remove, setUi, setData, set, registerZone, unregisterZone`, each with optional `recordHistory`.
- Reducer (`index.js:2571-2640`, reducer/index.ts) and what each action recomputes:
  - `insert` (`2030`, reducer/actions/insert.ts): new id `generateId(type)` (or `action.id`); props = `config.components[type].defaultProps` + `id`; nested slot defaults get ids via `populateIds`; only the affected path is re-walked by `walkAppState`'s skip callback.
  - `replace` (`2090`): **throws** if `data.props.id` differs from the node being replaced (`2101-2108`). Nested slot items missing an id get a fresh one (`{id, ...item.props}`: an existing id wins); stale slot zone indexes of the replaced node are deleted. Runs **no resolveData**.
  - `replaceRoot` (`2156`): merges `action.root.props` over the existing root props and **overwrites `readOnly`**; any other key of `action.root` is dropped.
  - `duplicate` (`2190`): the copy **and every descendant in its slots get new ids**; everything else is copied by reference. The copy becomes selected (`ui.itemSelector`).
  - `move`/`reorder` (`2276`, `2325`): same item object, **id unchanged**; no-op for same zone and index. `reorder` is `move` inside one zone.
  - `remove` (`2350`): deletes the node and all nodes whose `path` contains it, their zones, legacy `data.zones` entries and `ui.itemExpanded` entries.
  - `setData` (`2467`): `{...data, ...patch}` then a **full** `walkAppState`; console-warns when given an object.
  - `set` (`1833`): merges state; without `indexes` in the patch it does a full `walkAppState` (and warns); **with `indexes` it trusts them** (history uses this).
  - `setUi` (`2523`): merges `ui`; `revealSelectedItem` auto-expands collapsed outline ancestors of the selected item.
  - `registerZone`/`unregisterZone` (`2413`): legacy dropzones; a module-global `zoneCache` outlives any store.
- `indexes`: `nodes[id] = {data, flatData, parentId, zone, path[]}`, `zones["<parentId>:<zone>"] = {contentIds[], type: "root"|"dropzone"|"slot"}` (`actions-DA1J5F56.d.ts` `PrivateAppState`; built in `walkAppState`, `index.js:1691-1823`). `flatData` is the node with slots removed and props flattened by `flat`, with empty `[]`/`{}` encoded as `"__puck_[]"`/`"__puck_{}"` (`index.js:1619-1665`).
- History (`index.js:2787-2915`): snapshots are the **whole private state** (`indexes` and `ui` included). `record` is `debounce(…, 250)` (`2844`): several recorded actions inside 250 ms collapse into the last one. Undo/redo/`setHistoryIndex`/`setHistories` dispatch `set` with the stored snapshot (so no re-walk) after `tidyState` (clears `ui.field.focus`). Actions record by default except `registerZone, unregisterZone, setData, setUi, set` (`index.js:2556-2565`); `recordHistory` overrides per action. `insertComponent` forces `recordHistory:true` (`11497`); `moveComponent` passes `false` (`11518`) and the drag-end path records with `recordHistory: movedToNewPosition` (`12036`).
- Undo/redo hotkeys: `useRegisterHistorySlice` binds Ctrl/Cmd+Z and Y (`index.js:2818-2823`); the window and the iframe document are both monitored (`useMonitorHotkeys` `2771`, Layout effect `~19345`). Delete/Backspace removes the selected block (`useDeleteHotkeys`, `19130`), skipped when focus is in an input, textarea, select, contentEditable, role=textbox etc. or a dialog is open.
- `onChange(data)`: store subscription on `state.data`, deduped by `deepEqual` against the last emitted value (`index.js:~19736-19748`); not fired for the initial data.
- The `data` prop is read **once** (useState initialisers, `index.js:19613-19650`). Changing it later does nothing; push data via `dispatch({type:"setData"|"set"})` from `usePuck()` or `initialHistory`.
- After mount `resolveAndCommitData()` runs on `setTimeout(0)` (`index.js:3592`): every top-level block and root gets `resolveComponentData(..., "load")` (descendants via recursion) and a changed result is written back with `replace`/`replaceRoot`, which can create a history entry at load.

## 3. Resolution pipeline

**In plain words.** A block can declare a function that fills or corrects its props (`resolveData`), one that changes its fields (`resolveFields`) and one that changes what the user may do (`resolvePermissions`). Puck re-runs them when the block's data changes and remembers the last answer. The memory is keyed only by block id plus a deep comparison of the whole block, so any prop edit (a style prop included) re-runs the resolver.

**Evidence.**
- `resolveComponentData` (`index.js:3268-3345`, lib/resolve-component-data.ts; same code `rsc.js:900`). The cache `cache = {lastChange: {}}` is **module-level** (`index.js:3267`), keyed by component id to `{item, resolved, parentId}`. Skip rule (`3287-3292`): `trigger === "move"` skips unless the parent changed; any other trigger except `"force"` skips when `deepEqual(item, oldItem)`, returning the cached `resolved` node. So a change anywhere in the item re-runs `resolveData` with `changed.<prop>` from `getChanged` (`index.js:2985`, per top-level prop `deepEqual`).
- Merge: `props = {...item.props, ...resolved.props}`; `readOnly` is copied only `if (Object.keys(readOnly).length)`, so a resolver **cannot clear** an earlier `readOnly` (`3307-3312`). Children in slots are resolved recursively with `parent` = the resolved item (`3316-3335`).
- `resolveData(data, {changed, lastData, metadata, trigger, parent, root})`; `trigger` is `"insert"|"replace"|"load"|"force"|"move"`; `metadata` = `<Puck metadata>` merged with `config.components[type].metadata` (`3302`). Typed in `actions-DA1J5F56.d.ts` (`ComponentConfigInternal.resolveData`).
- Editor wrapper `appStore.resolveComponentData` (`3562`): loading indicator after 50 ms, then `permissions.refreshPermissions` for the item.
- Who triggers it in the editor: (a) mount `"load"`; (b) Fields panel `createOnChange` (`12423`): resolve the *proposed* item with `"replace"`, then dispatch `replace` with the resolved node; (c) `insertComponent` (`11479`): dispatch `insert`, select, then `resolveAndReplaceData(…, "insert")`; (d) `moveComponent` (`11509`) with `"move"`; (e) inline text/richtext edits: `resolveAndReplaceData(node, getState, "replace", writeThrough=true)` (`9970`, `10004-10050`), i.e. every keystroke is a resolve plus a `replace`; (f) public `usePuck().resolveDataById/BySelector(id, trigger)` (`17851-17880`), which resolve and dispatch `replace` **only if `didChange`**.
- A bare `dispatch({type:"replace"})` runs none of this (house rule confirmed). The house recipe is dispatch plus `resolveDataById(id,"replace")` (`packages/page-builder/src/drag/item-focus.tsx:327-341`).
- `resolveAllData` (`index.js:19965`, `rsc.js:1015`): fresh `cacheStore` per call; resolves root, then content, trigger `"force"`; also handles legacy zones. Reading the code (unverified by run): `resolveComponentData` already recurses into slots, then `resolveNode` re-walks the resolved slot arrays and resolves each child again, (0.23 only; fixed in 0.24, see the last section) so a block at depth *d* gets about *d+1* `resolveData` calls per request. A cost multiplier for resolvers that query the DB, and a reason for the house `remember` memo (`packages/page-builder/src/config.tsx:~488`).
- `resolveFields` (`useRegisterFieldsSlice`, `index.js:3175-3255`): runs when the selected node changes; compares `lastResolvedData` only for the same id; the result is applied only if that item is still selected and config unchanged. Fields never feed back into data.
- `resolvePermissions` (`index.js:3014-3100`): per-item cache `{lastPermissions,lastData,lastParentId}`; re-runs on prop change, parent change or force; `useRegisterPermissionsSlice` subscribes to `state.data` and `config` (`~3128-3160`). `getPermissions({item|type|root})` merges `globalPermissions` (all true) <- `config.components[type].permissions` <- resolved (`~3085-3125`).
- `readOnly`: `{propPath: true}`, wildcard `rows[*].title` supported (`buildMappers`, `index.js:9555-9572`). It disables the sidebar widget (`12507`) and inline editing for that path. It is stored in the document beside `props`.
- Metadata channel: `<Puck metadata>`/`<Render metadata>` reaches every block as `puck.metadata` and every resolver as `metadata`. In the edit canvas it is `{...metadata, ...config.components[type].metadata}` (`10744`); on the RSC route and in slot children it is the raw `metadata` (`rsc.js:716-735, 770`). Changing the `metadata` prop after mount is applied (`generateAppStore` effect, `19699-19720`) but re-runs no resolver.

## 4. Fields and transforms

**In plain words.** Fields are the form widgets in the right sidebar. Puck edits only props that have a field; other props travel along untouched. Separately, in the canvas Puck swaps some prop values for live widgets (a text prop becomes a typing area, a richtext prop a Tiptap editor, a slot prop a drop area). Those swaps ("field transforms") run on the props before your block sees them.

**Evidence.**
- Field types: `text, textarea, number, select, radio, array, object, external, richtext, custom, slot` (`actions-DA1J5F56.d.ts`, `type Field`). Built-in widgets: `defaultFields` (`index.js:8094`); `overrides.fieldTypes[type]` replaces any; `custom` always goes through its own `render` or the override (`8123-8133`).
- Edit path writes only the field's key: `createOnChange` builds `{...currentProps, [fieldName]: value}` (`index.js:12423`). Props without a field survive because the whole props object is spread back.
- **Transform walk trap (verified):** `walkField` handles a value by its own field only if `fields[propKey]` exists; for an object-valued prop with no object field it recurses with the **parent's** `fields` (`index.js:1517-1537`: `objectFields = fields[propKey].type === "object" ? objectFields : fields`). A nested key named like one of the block's fields is processed as that field type. It applies to every mapper walk: canvas transforms, `walkTree`, resolve slot mapping, `resolveAllData`. The house fix (hidden `object` field, `objectFields:{}`) works for exactly this reason (`packages/page-builder/src/config.tsx:475`).
- Same walk: arrays with no `array` field are returned as-is (`1507-1516`); an `object` field defaults missing slot keys to `[]` (`defaultSlots`, `1437`).
- **Canvas props are flattened and rebuilt (verified in code; effect unverified by run).** In edit mode a block gets `expandNode({type, props: nodes[id].flatData.props})` (`index.js:10719`): slots stripped, props flattened by `flat` (`.` separator), then unflattened (`1619-1665`). A property **name containing a dot** (a style map keyed `w-1.5`, `.btn.big`) would be split into nested objects in the editor only, not on the published route.
- Edit transform pipeline (`index.js:10784-10800`): `slot` (DropZoneEdit) + `getInlineTextTransform` (`10095`) + `getRichTextTransform` (`10238`) + plugin `fieldTransforms` + `<Puck fieldTransforms>` (later wins). `useFieldTransformsTracked` memoises per changed prop (`9837-9890`). Public type `FieldTransforms`: keyed by field type, `fn({value, propName, propPath, field, isReadOnly, componentId})`.
- Inline text: `contentEditable: true` on a `text`/`textarea`/`custom`(string value) field turns the prop into `<span contenteditable="plaintext-only">`, writing through `setDeep` + `resolveAndReplaceData(…,"replace",true)` (`index.js:10004-10050`). Click selects the block (`~10060-10075`). The span is registered with `registerOverlayPortal` (`9905`) so pointer events do not start a drag.
- Richtext: default `contentEditable` is **true**; the editor is a lazy Tiptap component (`index.js:10141-10240`). Published/RSC output is the stored HTML via `dangerouslySetInnerHTML` (`index.js:9640`, `rsc.js:635-650`). Field options: `options` (extension toggles), `tiptap.extensions`, `renderMenu`, `renderInlineMenu`. `currentRichText` in the store drives the action-bar rich menu (`~9044-9062`).
- `ui.arrayState[arrayId] = {items:[{_arrayId,_originalIndex,_currentIndex}], openId}` is **UI-only** bookkeeping for array rows (`index.js:6855-6911`), never written into `data`.
- The fields form lists the keys of `config.components[type].fields` (or the `resolveFields` result) (`index.js:3175`, `12505-12525`). A field with `visible:false` is shown nowhere but stays in data.

## 5. Every extension seam

**In plain words.** Puck is built to be re-skinned: almost all its chrome can be replaced, the whole layout can be swapped for your own, and any component rendered inside `<Puck>` can read and drive the store. What it does not offer is a per-block wrapper in the canvas or on the published page.

**`<Puck>` props** (`index.d.ts` `PuckProps`): `config, data, ui, onChange, onPublish, onAction, permissions, plugins, overrides, fieldTransforms, renderHeader*(deprecated), headerTitle, headerPath, viewports, iframe, dnd, initialHistory, metadata, dictionary, height, _experimentalFullScreenCanvas, _experimentalVirtualization, children`.

**Overrides actually consumed** (grep of `overrides.` in `index.js`; the exported `overrideKeys` const lists only ten, the consumed set is larger):

| key | replaces | consumed at |
|---|---|---|
| `puck` | wrapper around the whole layout (inside DragDropContext) | `index.js:19371` |
| `header`, `headerActions` | top bar / its right buttons | `18165-18168` |
| `preview` | wrapper around `Preview` inside the canvas root | `18708` |
| `iframe` | wrapper **inside the iframe** around the page; receives `document` | `16338, ~16360` |
| `fields` | wrapper around the fields form (`isLoading`, `itemSelector`) | `12546` |
| `fieldLabel` | every field label | `8071` |
| `fieldTypes` | per-type field widget (`custom` too) | `8123-8133` |
| `drawer` (alias `components`, deprecated) | components list wrapper | `12749-12754` |
| `drawerItem` (alias `componentItem`, deprecated) | one entry in the components list **and** the drag preview of a new block | `12597-12603`, `10834` |
| `outline` | wrapper around the outline tree | `17753` |
| `actionBar` | floating bar over the selected block (`label`, `parentAction`, `children`) | `8977` |
| `componentOverlay` | content in the selection overlay box (`hover`, `isSelected`, `componentId`, `componentType`) | `8981` |

`componentItem` is **not** a canvas wrapper (a common mistake): it styles the drawer entry. No override wraps a block in the canvas.

- `plugins` (`Plugin`): `{name, label, icon, render, overrides, fieldTransforms, mobilePanelHeight}`. `render` + `name` makes a **left-rail tab** (`index.js:19426`). Plugin `overrides` and the prop `overrides` are folded by `loadOverrides` so each plugin override **wraps** the previous one, receiving it as `children` (`17797-17828`; `fieldTypes` composed per type). Built-in `blocks`, `outline`, `fields` plugins are added unless a plugin named `fields` is passed (`~19400-19440`, `19205-19282`); `legacySideBarPlugin` exists. House: `packages/page-builder/src/parts/plugin.tsx:35-60` (iframe, fields, actionBar overrides).
- `usePuck()` (warns without selector), `createUsePuck()`, `useGetPuck()` (`index.js:17887-17990`). Projection `UsePuckData`: `appState` (public `{data,ui}`), `config`, `dispatch`, `getPermissions`, `refreshPermissions`, `resolveDataById`, `resolveDataBySelector`, `selectedItem`, `getItemBySelector`, `getItemById` (**throws** on an unknown id), `getSelectorForId`, `getParentById`, `history{back,forward,setHistories,setHistoryIndex,histories,index,hasPast,hasFuture}`, `dictionary`, plus an undocumented `__private.appState` with `indexes` (`17921`). Hooks throw outside `<Puck>`.
- `@puckeditor/core/internal`: exactly one export, `createReducer({record?, onAction?, appStore})` (`internal.js:935-1001`; `internal.d.ts`). Every action I read touches `appStore.config` only.
- Compositional parts `Puck.Preview({id}), Puck.Fields({wrapFields}), Puck.Components, Puck.Outline, Puck.Layout` (`index.js:19768-19772`). Passing `children` to `<Puck>` replaces the default grid, still inside `DragDropContext` and `overrides.puck` (`Layout`, `index.js:19314-19580`, the `children || <FrameProvider>…` branch near `19470`). The default layout owns `Canvas` (zoom, viewport switcher), which compositional use does not get.
- Exported UI atoms: `Action, ActionBar, AutoField, Button, Drawer, DropZone, FieldLabel, Group, IconButton, Label, RichTextMenu, Separator, registerOverlayPortal, renderContext, setDeep` (`index.d.ts`).
- `iframe: {enabled, waitForStyles, syncHostStyles}`, all default true (`index.js:19285`). `AutoFrame` (`16138-16210`): `<iframe srcDoc=… id="preview-frame">` with `#frame-root[data-puck-entry]`; React content is a **portal** from the host tree (context, hooks and React events keep working; DOM events happen in the iframe document). `CopyHostStyles` (`15933-16137`): clones every `style` and `link[rel=stylesheet]` of the parent `<head>` into the iframe; a `MutationObserver` on the parent head mirrors added/removed nodes and `<style>` text edits; `<html>`/`<body>` attributes are copied **once**. Not mirrored: `adoptedStyleSheets`, `insertRule` edits, styles in `<body>`, later attribute changes on html/body. `syncHostStyles:false` mirrors nothing (host must style the frame, e.g. via `overrides.iframe` + `document`).
- `viewports: [{width, height?, label?, icon?}]` with `ui.viewports.current`; defaults 360/768/1280/100%. The canvas scales the iframe with CSS `transform: scale(zoom)` (`18869`), so geometry measured in the host is scaled and inside the iframe is not.
- `permissions` (global), `config.components[x].permissions`, `resolvePermissions`: keys `drag, duplicate, delete, edit, insert` plus custom booleans. `drag:false` disables the sortable and sets `data-puck-disabled` (`8854`); the action bar hides Duplicate/Delete accordingly.
- `ui` initial state is shallow-merged over `defaultAppState.ui` (`19613-19640`); an initial `itemSelector` is honoured (`3480`).
- `onAction(action, newState, prevState)`, `onChange(data)`, `onPublish(data)` (header Publish only, `18207`), `headerPath` (`18248`), `dictionary`, `height`.
- `dnd: {disableAutoScroll, disableOutlineDrag, behavior: "auto"|"fluid"|"static"}` (`actions-DA1J5F56.d.ts` `DndConfig`; consumed `index.js:19497`, outline `17523`).
- Component config also has `inline`, `label`, `metadata`, `permissions`, `defaultProps`, `fields`, `resolveFields/Data/Permissions` and `config.categories`.

## 6. The canvas internals

**In plain words.** The canvas is an iframe. Every non-inline block is wrapped by Puck in a `<div>` that handles clicks and dragging; the blue outline and action bar are separate elements floating above it, positioned by measuring the block. Dragging uses dnd-kit, which waits 200 ms and 5 px before starting, so a quick click selects instead of drags.

**Evidence.**
- `DropZone` (`index.js:11125`) chooses by context `mode`: `edit` -> `DropZoneEdit` (`10849`), otherwise `DropZoneRender` (`11086`, used by `<Render>`). `DropZoneEdit` renders `<div data-puck-dropzone="<zoneCompound>" data-testid="dropzone:…" style="--puck-slot-min-empty-height">` (`~10990-11010`), registers a dnd-kit droppable (enabled only when empty and deepest), and decides `targetAccepted` with `isComponentAllowed` (`9345`).
- Slot `allow/disallow`: the canvas honours the props passed to the Slot call **over** the field's (`getSlotTransform` spreads `dzProps` after `field.allow`, `index.js:9592-9604`), while the outline's drag constraints read the **field only** (`getZoneConstraints`, `16488-16496`).
- `DropZoneChild` (`10684`): reads `nodes[id].flatData.props` and `data.type`, expands them (`10719`), adds `puck {renderDropZone, isEditing:true, dragRef, metadata}` and `editMode:true`, applies transforms, renders inside `DraggableComponent`. For `inline:true` components, render receives `puck.dragRef` and must attach it to its own root; otherwise Puck adds `<div ref={dragRef}>` around it (`~10795-10830`). **That wrapper does not exist on the published page**: CSS that depends on being a direct child (flex/grid items, `> *`, `:first-child`, margin collapse) can differ in the editor unless the block is `inline`.
- `DraggableComponent` (`8743-9318`): `useSortable({id, group: zoneCompound, type:"component", collisionPriority: depth, Feedback clone})`; on the element it sets `data-puck-component=<id>`, `data-puck-dnd=<id>`, **`el.style.position = "relative"`** (never reset) and click/mouseover/mouseout listeners (`9074-9083`). Click: `stopPropagation` unless the target is inside `[data-puck-overlay-portal]`, then `setUi({itemSelector:{index,zone}})` (`~8984-9010`). A block that needs `position:absolute|fixed|sticky` on its own root loses it to Puck's inline style in the editor only (**unverified by run**).
- The overlay is a **React portal** into the iframe `<body>` (or `[data-puck-preview]` without iframe), `data-puck-overlay`, absolutely positioned from `getBoundingClientRect` + scroll, refreshed by a ResizeObserver and a 100 ms rect poll while selected or dragging (`~9150-9207`, `MEASURE_EVERY_MS` `8724`). It holds `actionsOverlay > actions > CustomActionBar` and `overlayWrapper > CustomOverlay` (`~9230-9310`). Default action bar: select-parent, label, rich-text menu, duplicate, delete (`8729`).
- Selection is `ui.itemSelector = {index, zone}`, not an id; `selectedItem` is derived in `dispatch` (`3492`). `getSelectorForId` converts (`9958`). Being index-based, it goes stale after inserts/moves above the block until Puck rewrites it (duplicate and insert set it explicitly).
- Background click (target lacking `data-puck-component`/`data-puck-dropzone`) clears selection with `recordHistory:false` (`18825`); `Preview` does the same (`~16349`).
- Pointer handling: `useSensors` configures one dnd-kit `PointerSensor`; touch needs a 200 ms delay; mouse/other needs **200 ms delay and 5 px** (`index.js:6127-6150`). dnd-kit swallows pointer propagation while dragging; Puck listens on `document.body` in capture for pointermove (`~11385-11397`) and re-dispatches iframe pointermoves to the host (`BubbledPointerEvent`, `16281`). A third-party element inside a block starts a block drag after the delay unless it stops `pointerdown` in capture; `registerOverlayPortal(el,{disableDrag, disableDragOnFocus})` does that, also stops `mouseover` (Puck's hover outline) and tags `data-puck-overlay-portal` (`9905-9945`).
- Caveat: a click inside a portal-tagged element bubbles to every ancestor block listener (they skip `stopPropagation` for it) and the **outermost** block's selector write wins; Puck's own widgets stop the click themselves (`onClickCapture` + `stopPropagation`, `~10060-10075`). A custom overlay should do likewise (**unverified by run**).
- "layout vs normal components": 0.23 has no layout class. The split is `inline:true` (own root, gets `dragRef`) vs wrapped. Slot zones have `type:"slot"`, legacy ones `"dropzone"`.
- `DragDropContext` (`11749-12260`) keeps a `zoneStore` (`previewIndex`, `draggedItem`, depth indexes). New blocks from the drawer dispatch via `insertComponent` (`11479`), moves via `moveComponent`/drag-end (`12036`). The outline has its own dnd (`17337-17560`, `disableOutlineDrag`).
- Preview mode: `ui.previewMode = "edit"|"interactive"`; interactive renders the client `<Render>` on the live state data inside the same iframe (`16328-16372`; hotkeys `18020`).
- DOM contract usable from outside: `[data-puck-component=<id>]`, `[data-puck-dropzone=<zone>]`, `[data-puck-entry]` (iframe mount root; carries `data-puck-preview-mode`), `[data-puck-preview]`, `[data-puck-overlay]`, `[data-puck-overlay-portal]`, `data-puck-disabled`, `iframe#preview-frame`, `#puck-canvas-root`, `#puck-portal-root`. The house leans on `data-puck-component` in about ten places (`packages/page-builder/src/parts/find.ts:31`, `drag/canvas-drag.tsx:179`, `drag/item-focus.tsx:214`, `drag/canvas-menu.tsx:99`).
- Puck never saves: the header Publish calls `onPublish(state.data)` (`18207`).

## 7. Headless possibilities

**In plain words.** Yes: the document engine can run with no Puck screen. Puck ships its reducer as a standalone export and the server-side `resolveAllData`, `walkTree`, `migrate`, `transformProps` are public. Missing as public functions: the indexed-state builder and the per-block resolver; both can be worked around. And `<Puck>` can be mounted with its chrome replaced, so another editor owns the screen while Puck stays the drag-and-drop and document engine.

**Evidence and recipe (unverified by run; derived from code).**
- Exported engine parts: `createReducer` from `@puckeditor/core/internal` (`internal.js:935`; it loads `react` only for a shim and uses `crypto.randomUUID` or `getRandomValues`, `internal.js:447-478`, so Node-safe); `migrate`, `walkTree`, `transformProps`, `resolveAllData` from the root and `/rsc` (`rsc.d.ts`).
- Bootstrapping without `walkAppState` (not exported): start from an empty private state `{data:{root:{props:{}},content:[],zones:{}}, ui:<defaults>, indexes:{nodes:{},zones:{}}}` and reduce `{type:"setData", data}` (full walk) or `{type:"set", state:{data}}`; both rebuild `indexes` (`index.js:1833, 2467`). Then reduce `insert/replace/move/duplicate/remove` with `createReducer({appStore:{config}})`: ids, slot placement, defaults and duplicate semantics identical to the editor.
- Not in the reducer: history, permissions, resolution. Per-block `resolveData` headless: `resolveComponentData` is internal. Options: (a) `resolveAllData(data, config, metadata)` over the whole document (public, fresh cache, `"force"`); (b) copy the ~80-line function (`index.js:3268-3345`), which depends on the internal `mapFields`. `resolvePermissions` and `resolveFields` have no headless entry.
- `defaultProps` are applied only by `insert` and by mount; `replace` and `Render` apply none.
- Noise only: `createReducer` console-warns on `setData`/`set`; `migrate` logs.
- Fully re-chromed `<Puck>`: pass `children`, optionally `overrides.puck`, and render `Puck.Preview` (canvas iframe + overlay) wherever the external editor wants it. Puck keeps the store, history hotkeys (window + iframe), delete hotkey, DnD context, selection, overlay and resolve-on-load. Sidebar, header, outline and drawer are optional. Caveat: no `Canvas` means no zoom/viewport switcher and the host must size the frame (unverified).
- External access to the store: child components calling `usePuck`/`useGetPuck` (public); dev only: `window.__PUCK_INTERNAL_DO_NOT_USE.appStore`.
- `getItemById`/`getParentById` throw on an unknown id (`index.js:17909-17922`); `usePuck().appState` has no `indexes` (use `__private.appState`, internal).

## 8. Where an external CSS / aesthetic layer can attach without touching content

Survival matrix from the code (D duplicate, M move between slots, U undo/redo, R resolveData, P published `<Render>` on the RSC route):

| attach point | D | M | U | R | P | notes |
|---|---|---|---|---|---|---|
| **A. props namespace** (`props.look`, `props.morph`; the house pattern) | yes (props copied; the object is shared by reference with the original, treat as immutable) | yes | yes (in snapshot) | merged: `{...item.props, ...resolved.props}`; a resolver returning a whole new `look` overwrites it | yes, block must read it | house ships it (`packages/page-builder/src/config.tsx:465-477`). Needs hidden `object` field (walk trap); dotted keys split in canvas; any change re-runs `resolveData` |
| **B. extra top-level key on ComponentData** (`{type, props, style}`) | yes (`{...item}`) | yes | yes | yes (`{...item}`) | **no** (block never receives it) | dropped for root by `toRoot`/`replaceRoot` (`3352`, `2156`); `validatePage` may strip it (unverified); `onChange/onPublish` carry it. Useful only if the host post-processes `data` before `Render` |
| **C. `metadata` side-car keyed by id** (`<Puck metadata>` and `<Render metadata>`) | no (copy has a new id; needs `onAction` to copy the entry) | yes (id stable) | no (not in history) | readable (`params.metadata`), no re-run on change | yes if every block reads `puck.metadata` + its `id` | RSC slot children get raw metadata; canvas merges per-component metadata |
| **D. host-owned document keyed by id**, CSS injected by `overrides.iframe`/host | no without `onAction` remap | yes | no unless snapshotted with Puck history | n/a | yes (host emits CSS) | published DOM has no `data-puck-component`; blocks must print a hook from the `id` prop (`rsc.js:758`) |
| **E. CSS on `[data-puck-component=<id>]`** inside the iframe (`drag/item-focus.tsx:214`) | n/a | n/a | n/a | n/a | **no** | attribute exists only in the editor; pure editing-time overlay |
| **F. `config.root.render`** | n/a | n/a | n/a | n/a | yes | root props and children only |
| **G. a render HOC applied to every component in `config`** | yes | yes | yes | yes | yes | the only per-block wrapper present on canvas and publish; house builds config once (`buildPuckConfig`) |

Ids: regenerated on `insert` and `duplicate` (the copy **and all descendants**, `index.js:2190-2250`), on `replace` only for nested slot items lacking one (`2090-2150`), on `populateIds` at mount for root. Never regenerated by `move`, `reorder`, `replace` of the node itself (its id must not change), `setData`, undo/redo, `resolveData`, `migrate`, `transformProps` (`{id: item.props.id, ...}`). **No copy/paste in 0.23** (grep for clipboard finds only an icon): duplicate is the only clone path, so the house templates/paste flows re-id through `walkTree`/insert themselves.

Advice for the aesthetic lane: publish-critical style goes in **A**; editing-time chrome uses **E**; **C/D** only for data allowed to lose undo and duplicate behaviour, and then wire `onAction` to copy entries on `action.type === "duplicate"` (new ids can be found by diffing `indexes.nodes` of the two states the store-level `onAction` receives).

## 9. Best practices worth breaking

| Puck convention | what a dominant outside editor must take over | exact failure mode if done naively |
|---|---|---|
| Fields sidebar is the edit surface | writing props (`replace` + `resolveDataById`), validation, readOnly | bare `replace` skips `resolveData` (bound/derived props go stale); `replace` with a changed `props.id` **throws** (`2101`); `replaceRoot` drops unknown root keys |
| `data` prop read once at mount | the document source of truth | updating the prop later is ignored; `setData` is a full re-walk and is not recorded in history by default |
| Own history (whole-state snapshots, 250 ms debounce) | undo for non-Puck state (sidecars, selection, zoom) | Puck undo restores `data`+`ui` but not external stores, so they desync; two Ctrl+Z handlers fight (Puck binds window and iframe); edits within 250 ms merge into one undo step |
| Selection = `ui.itemSelector` (index+zone) | selection model, hit-testing, multi-select | external id selection must go through `getSelectorForId`; indexes go stale after sibling insert/move; no multi-select exists, multi-edit means several dispatches each with its own history entry unless inside 250 ms |
| iframe canvas | pointer events, coordinates, zoom | host overlays see CSS-scaled geometry; iframe events do not reach host listeners; only `style`/`link` in head are mirrored; `data-puck-*` vanish on publish |
| Action bar, outline, drawer chrome | insert, delete, duplicate, reorder UI | hiding chrome with CSS leaves hotkeys live (Delete/Backspace removes the selected block; guarded only for input/textarea/select/contentEditable/role/dialog, `19130`) |
| dnd-kit after 200 ms + 5 px | pointer ownership for resize/drag handles | handles on a block start a block drag unless `registerOverlayPortal`ed or `pointerdown` is stopped in capture; clicks bubble to ancestors and the outermost block wins selection |
| Wrapper `<div>` in canvas, none on publish | layout parity | editor and published layout diverge for flex/grid children and `position`; `inline:true` removes the wrapper but Puck then forces `position:relative` on the block root |
| Blocks see only `props` | a per-block style channel | style outside `props` never reaches `Render` (matrix B) |
| Canvas props go through `flat` | style value shapes | keys with `.` are split; non-plain values (Date, class instances) not preserved (unverified) |
| resolveData cache = whole-item deepEqual | cost of style edits | every style edit re-runs the resolver; memoise (the house has `remember`) |
| Slots as the only nesting | structural edits | reducer actions keep `indexes` right; hand-editing slot arrays needs `setData`/`set` (full re-walk) |

## 10. Upgrade risk (0.23 -> 0.24+)

Public (typed in `.d.ts`): `Puck` props, overrides `header, headerActions, fields, fieldLabel, fieldTypes, drawer, drawerItem, outline, puck, preview, actionBar, iframe, componentOverlay`, `plugins`, `usePuck/createUsePuck/useGetPuck`, `Render`, `resolveAllData/walkTree/migrate/transformProps`, `registerOverlayPortal`, atoms, `FieldTransforms`, `iframe`, `dnd`, `permissions`, `metadata`, the `PuckAction` union and `onAction`.

Semi: `@puckeditor/core/internal` (`createReducer` only; in package `exports`), `usePuck().__private`, `_experimentalFullScreenCanvas`, `_experimentalVirtualization`, deprecated aliases (`components`, `componentItem`, `renderHeader*`).

Internal: store/slice shapes, `window.__PUCK_INTERNAL_DO_NOT_USE`, `data-puck-*` attributes and the wrapper `<div>`, the 250 ms debounce, `flat` expansion, the module resolve cache, `walkAppState` internals, the `indexes` shape, PointerSensor timings, AutoFrame srcDoc and ids.

---

## Contradictions and refinements to `puck-blocks.md`

1. "Declare slot `allow`/`disallow` on the `PropDef`, not on `<Region>`: Puck 0.23 reads permissions from the field only." Partly wrong: the canvas **does** honour `allow/disallow` passed to the Slot component (`index.js:9592-9604`); only the outline drag constraints are field-only (`16488`). The rule is still good (outline parity) but the stated reason is inexact.
2. "`<Render>` applies no defaults and runs no resolvers": confirmed (`rsc.js:819-870`).
3. "`<Render>` transforms only slots and rich text, by field path" (`config.tsx:~460`): confirmed for `Render`; the editor also transforms `contentEditable` text/textarea/custom strings (`index.js:10095`), so a `custom` field with `contentEditable` would be touched in the canvas.
4. "Puck's canvas takes a click on a button inside a block": confirmed, the listener is on the wrapper element and calls `stopPropagation` (`~8990`).
5. New traps not in the rules file: (a) an editor-only wrapper `<div>` for non-inline blocks; (b) inline `position:relative` forced on the wrapped element; (c) canvas props are flattened/unflattened so dotted keys split; (d) `resolveAllData` resolves deeper blocks repeatedly; (e) a resolver can never clear `readOnly`; (f) `replaceRoot` drops unknown root keys; (g) `getItemById`/`getParentById` throw on missing ids; (h) RSC slot children get `puck = {metadata}` only; (i) the `data` prop is read once.

## Recommended seams, ranked

1. **Props namespace (`look`/`morph`) with a hidden object field**: the only channel that publishes, survives duplicate/move/undo/resolve, needs no internals. Already live.
2. **`usePuck`/`useGetPuck` + `dispatch({type:"replace"})` + `resolveDataById(id,"replace")`**: the supported write path, same as the Fields panel (`index.js:12423`).
3. **`overrides.iframe`** (document handle, style injection, overlay mounting in the canvas) plus **`registerOverlayPortal`** for handles that must not start a drag.
4. **`<Puck>` children / `overrides.puck` / `Puck.Preview`**: lets direct-edit own the screen while Puck stays DnD and document engine.
5. **`onAction`** as the change bus: sidecar remap after `duplicate`/`insert`, audit, MCP echo.
6. **`@puckeditor/core/internal` `createReducer`** with public `resolveAllData`/`migrate`/`walkTree`: the headless document engine for MCP.
7. **`actionBar` and `componentOverlay` overrides**: replace the block selection chrome.
8. **`metadata`**: read-only context shared by all blocks (theme tokens), not per-block style.
9. **Config-level render HOC**: the only wrapper seam that exists on both canvas and publish.
10. `fieldTransforms`/`fieldTypes`: edit-time widgets, no publish effect.

## Open questions

- Does an id-less item in `data.content` get an id at mount? (`walkAppState` indexes by `props.id`; no `populateIds` for content.)
- Real cost of `resolveAllData` double resolution: measure on a deep page.
- Dotted-key flattening in canvas props: reproduce with `{ "a.b": 1 }`.
- Forced inline `position:relative` vs published parity for `inline:true` blocks: reproduce with a sticky block.
- `createReducer` + `setData` on a minimal bare state: likely fine (code only spreads), untested.
- `Puck.Preview` without `Canvas`: sizing and `status` READY handling in compositional mode.
- Does `onAction` really receive `indexes` on the live `<Puck>` path (code says yes, `index.js:3484-3492`)? Confirm in a browser.

## 0.23 -> 0.24

**In plain words.** 0.24.0 changes very little of what the doctrine stands on. The document engine, the actions, the id rules, the history, the canvas wrapper and the published render are the same code. What moved is the edges: the server-side resolver is fixed so each `resolveData` runs once, the published `<Render>` can now take `fieldTransforms`, slot containers forward extra attributes, and the action bar can carry a drag handle. Nothing was removed and no override key was added.

Method: file-marker diff of `index.js` (0.23 frozen copy vs 0.24.0), then diffs of `internal.js`, `rsc.js` and the `.d.ts` files. Bundle: `puck-0.24.0/dist/` (folder `@puckeditor+core@0.24.0_..._oi3wpbjsngmuo4oufd3ix6wpl4`). 0.24 line numbers below are `puck-0.24.0/dist/index.js:<n>` unless noted.

**Unchanged (verified by diff or reading)**
- `internal`: `internal.js` is byte-identical to 0.23 in the diff (empty), `createReducer` is still the only export (`internal.js:953`, `internal.d.ts`); the bootstrap via `setData`/`set` still works the same way (`index.js:1889`, `2523`).
- `PuckAction` union unchanged: no new actions, no copy/paste (grep for clipboard finds nothing). `replace` still runs no `resolveData` (`2146`, body identical); `resolveDataById` still exists with the same `trigger` argument (`19161`); `usePuck` projection identical.
- Duplicate id rule unchanged: copy and all descendants re-id'd (`2246`).
- `walkField` still falls back to the parent's fields for an unfielded object prop (`1597`), so the `look.items` trap in `resolveAllData` (and the editor transforms) is **unchanged**; the house hidden-`object`-field fix stays necessary.
- Canvas: `flat` flatten/unflatten of node props (`1717-1730`), the editor-only `<div ref={dragRef}>` for non-inline blocks (`12163`), `data-puck-component`/`data-puck-dnd` and forced `el.style.position = "relative"` (`10308-10310`) all unchanged.
- History: `record` still `debounce(..., 250)` (`2916-2929`); `setHistories` unchanged. Sensor still 200 ms delay + 5 px (`6226`); `registerOverlayPortal` unchanged (`11270`).
- Overrides consumed: same keys (`puck 20686`, `preview 20017`, `iframe 17630`, `fields 13577`, `outline 19039`, `actionBar 10211`, `componentOverlay 10215`, `fieldTypes`). Plugin type unchanged. `window.__PUCK_INTERNAL_DO_NOT_USE` still dev only (`21044`).
- RSC `<Render>` still gives a block only `props`, `id`, `puck` and no wrapper (`puck-0.24.0/dist/rsc.js:854-900`).

**Changed**
- **`resolveAllData` now resolves slot children once** (`puck-0.24.0/dist/rsc.js:1142-1182`, `resolveChild`/`resolveNode`): the repeated-resolution cost I inferred for 0.23 is gone. `resolveComponentData` (`index.js:3341-3385`) gained the optional `resolveChild` argument.
- **`<Render fieldTransforms>`** (client and rsc; `rsc.d.ts`, `rsc.js:930`, `useRenderProps` `rsc.js:699`): published-route transforms by field type, run with readOnly forced on; a user transform for `richtext` makes Puck skip its default richtext render (`rsc.js:656`). This is the first Puck-supported hook on the published side.
- **Slots and DropZones forward extra props** (`data-*`, aria, className, handlers) to the `as` element; `children`/`dangerouslySetInnerHTML` are stripped with a warning (`rsc.js:763`, `actions-Dgllwd-W.d.ts` `SlotProps`).
- **Drag handle**: `dnd.enableDragHandle`, `ActionBar.DragHandle` export, `dragHandle`/`dragHandleRef` props passed to `overrides.actionBar` (`9991`, `10452-10458`, `10529`). Whether whole-block drag is switched off when the handle is on: not verified.
- **Fields UI**: `checkbox` field, collapsible/`variant` object fields, `renderFields` on a component config, `fields` override receives a per-field `fields` map, exports `FieldGroup`, `Tab`, `InlineTextField`; `UiState` gains `fieldTab`, `expandedFieldGroups`; `FieldRenderFunctions` may override `custom`.
- Internal refactor (no behaviour change found): `lib/props/render/use-render-props` and `lib/props/editor/use-editor-props` replace `use-slots`; the drag/drop code is reorganised.

**Does anything break a house assumption?** No assumption in `puck-blocks.md` breaks. One note: the rule about the `resolveAllData` walk over object props still holds in 0.24. The house `remember` memo remains useful for editor resolves (cache by whole-item deepEqual unchanged) but the server double-resolution rationale is gone.

**Not verified:** behaviour at runtime (nothing was run); `enableDragHandle` semantics; allow/disallow semantics were not re-diffed; the many CSS/tiptap internals not related to the doctrine.
