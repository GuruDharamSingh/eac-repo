# Development app + design system: shared board (2026-11-20)

PM: the main Claude session. Workers: R (web research), D (design system), C (catalogue), B (build).
**Rules:** append only (`>>`), never rewrite. Start each note with `### [R|D|C|B|PM] HH:MM topic`. Read the whole board before starting and again before finishing. Ask another lane a question by writing `@C: ...`; answer on the board. Long output goes in your own file in this folder; the board gets the summary and the path.

## The brief (Justin, a creative, non-technical owner)
Two inspirations make a new third thing:
1. The cms-ui "surface" design system we roughly outlined (packages/cms-ui/src/surface, docs/open/ELKTOURS_SURFACE_HANDOFF_2026-11-20.md).
2. The elktours "create tour" wizard (apps/elktours/src/components/office/create-tour/*), liked for its flexibility and use of space.

Deliver:
- **A design-system suggestion** (early days): bring those together into one proposal.
- **apps/development**, served at arts-collective.com/development, gated to network admins only. It:
  - presents new ideas to the developer as an experience;
  - shows new components and editing processes;
  - holds EVERY Puck block from every app, with a suite for editing them (props, config, settings per block, theming across them);
  - looks like directory.arts-collective.com/classifieds: a wide-open canvas that lays components out and loads more as you move;
  - gives an overview of the design system(s) and theme/colour variables at work across the apps. Exposing them helpfully is the first step to unifying them later.
- Look at similar projects on the web first.

Context: docs/open/HOUSE_EDITOR_ONE_2026-11-20/PLAN.md + PROGRESS.md (house editor, Site style, Fields lens), docs/open/PUCK_LIFT_2026-11-19/PLAN.md.
Hard rules: source only. No rebuilds, restarts, DB writes, commits, pnpm install, or proxy changes; the PM does go-live. Check `git status --short <file>` before editing an existing file; other sessions have uncommitted work.

## Notes

### [R] early research: 5 patterns to borrow (full report follows in research.md)
1. Story-per-variant gallery + live controls (Storybook "args/controls", Ladle, Cosmos "fixtures"): one block = several named presets, shown as cards, with a side panel of editable props that updates the card live. https://storybook.js.org/docs/essentials/controls
2. Theme switcher as a global toolbar toggle that re-skins EVERY card at once (Storybook theme toolbar/decorators), plus a "same block across all brands side by side" row for comparison.
3. Layered tokens: primitives -> semantic (purpose-named) -> per-brand override files; show them as swatch/type tables per brand in columns (Supernova multi-brand, Brad Frost themeable systems https://bradfrost.com/blog/post/the-many-faces-of-themeable-design-systems/, Infinum https://infinum.com/blog/multibrand-design-system-tokens/). Audit first: count hardcoded values vs token uses (Wix token migration guide https://dev.wix.com/docs/wix-design-system/contributing/token-migration-guidelines).
4. Canvas with culling: tldraw only renders shapes inside the viewport and each shape is just a React component, so a wide pannable canvas of block cards can mount lazily (https://tldraw.dev/sdk-features/shapes). Cheaper alternative: CSS-transform pan/zoom plus IntersectionObserver per card.
5. Puck: <Render config data> renders a block outside the editor (field transforms do NOT apply there); <Puck> overrides + usePuck only exist inside the editor. So a card = <Render> with a one-block Data object; the edit panel = a tiny <Puck> or Fields-only override. (https://puckeditor.com/docs/api-reference/components/render , https://puckeditor.com/docs/extending-puck/ui-overrides)
### [C] 14:49 starting; shapes to follow in ~10 min

### [R] final: research done
Full report: ~/eac/docs/open/DEVELOPMENT_APP_2026-11-20/research.md (5 areas, borrow/avoid lists). Key points: cards = Puck Render with one-block data, ONE shared Puck composed of Puck.Fields + Puck.Preview as inspector; token matrix page (rows = meaning, columns = site) with hardcoded-colour flags as the audit; floating ThemePanel-style style panel; CSS-transform canvas + IntersectionObserver instead of tldraw; keep old variable names as aliases; tokens in W3C DTCG JSON (stable Oct 2025).

### [B] 15:05 shapes apps/development will read (@C: match these if you can; I normalise loosely, extra keys are fine)
Files go in apps/development/src/data/ (I copy via `pnpm data:refresh` = scripts/refresh-data.mjs, which reads your folder here).
- blocks.json: `{ "generated": "ISO", "blocks": [ { "id": "hero-banner", "label": "Hero banner", "app": "shared|sunjay|elktours|...", "package": "@elkdonis/blocks", "source": "packages/blocks/src/blocks/hero-banner.tsx", "category": "headers", "description": "...", "dataDriven": false, "interactive": false, "propCount": 9, "parts": ["title","body"], "catalogues": ["SHARED_BLOCKS"], "importable": "yes|app-only", "blocker": "why not importable" } ] }`
- themes.json: `{ "generated": "ISO", "apps": [ { "id": "sunjay", "label": "Sunjay", "source": "apps/sunjay/src/app/globals.css", "vars": { "--background": "#fff", "--primary": "#..." }, "fonts": { "body": "...", "heading": "..." }, "families": ["..."], "counts": { "colours": 12, "fonts": 2 }, "editedBy": "Site style / none" } ] }` (vars = what I apply on a wrapper div to preview a block under that app.)
- design-system.json (@D): `{ "title": "...", "summary": "...", "vocabulary": [ { "token": "--ds-surface", "meaning": "...", "light": "#..", "dark": "#.." } ], "aliases": [ { "from": "--background", "to": "--ds-surface", "apps": ["sunjay"] } ], "notes": ["..."] }`
Shared blocks are ALSO derived at runtime from @elkdonis/blocks (SHARED/PROFILE/FEATURED/STORE_PANEL) + direct-edit BOX_BLOCKS, so those render even before blocks.json lands.

### [D] 15:10 design-system.json shape (v0.1) for B
File: `docs/open/DEVELOPMENT_APP_2026-11-20/design-system.json` (written; prose follows in design-system.md). Top level:
`{ name, version, status, principle, how_aliases_work, layers[{id,label,summary}], groups[{id,layer,label,tokens[{name,kind,description}]}], families[{pattern,package,where,role,tier: hook|internal|app}], aliases[{from,to,family,note}], token_kinds[], surface_kinds[], chrome_regions }`.
- `groups` = the proposed semantic tokens (prefix `--eac-`), by layer (foundations / surfaces / flows / chrome). `kind` is one of color|rgba|hsl|length|font|shadow|easing|duration|choice (same words as SiteVarKind where they overlap), so B can pick a swatch, a type sample or a length bar.
- `aliases` = today's name to proposed role (152 rows). `from`/`to` may be a pattern (contains `*` or `<..>`); `to` of "(kept)" or "(none)" means no role yet. Matrix view: rows = `groups[].tokens[]`, columns = app/family; join through `aliases[].to`.
- For a LIVE value in an app column, read `getComputedStyle(el).getPropertyValue(alias.from)` under that app's theme: the proposed `--eac-ground` etc. are not set anywhere yet.
@C: when your per-app theme table lands I will fold the apps into `families[]` and `aliases[]`.

### [D] 15:40 design-system.md written (first pass)
`docs/open/DEVELOPMENT_APP_2026-11-20/design-system.md` plus `design-system.json` (152 aliases, 8 token groups, 15 families). Core: one role list (`--eac-ground/ink/line/accent/...`) that every old family (`--sf-*`, `--fld-*`, `--frm-*`, `--blk-*`, shadcn, `--dm-*`, `--ig-*`) aliases to, additive and nothing removed; four layers (foundations, surfaces face/sheet/stage/strip, flows, chrome); the wizard's two-pane, pill step row, row card and readiness become shared flow parts. 7 owner questions with picks are in section 5. For B: the "Design systems" view can be (1) the layers, (2) the role-by-app matrix from `groups` x `aliases`, (3) the 19 `surface_kinds` as a swatch row.

### [D] 15:48 json now also matches B shape
@B: design-system.json now carries your keys too: title, summary, vocabulary[{token,meaning,kind,layer,group}] (no light/dark yet: roles are not defined anywhere, resolve live), aliases[{from,to,apps,family,note}], notes[]. The richer groups/families/layers stay.

### [C] 14:56 JSON shapes (blocks.json is live, themes.json shape below; generator: extract-blocks.js in this folder)
**blocks.json** (184 records now, regenerate with the script; also blocks.apps.json = per-app catalogue membership + resolver keys): array of
`{ id, label, description, form: "defineBlock"|"block-literal"|"box-block"|"puck-config", owner: "package:blocks"|"package:direct-edit"|"app:<name>", ownerKind, ownerName, exportName, file, line, componentName, componentFile, category, styling: "tokens"|"tailwind"|null, memberSafe, interactive, dataDriven, hasSample, props:[{name,kind,label,default?,required?,options?[values],min/max/step/unit?,binds?,format?,inlineEditable?,fields?(rows cols),allow?}], propCount, slots:[names], hasParts, parts:[keys], bindsKinds:[], tokens:[{name,type,label}], offeredBy:[app names that list it], resolver:[{app,keys}], importability:{mode:"package"|"app-local"|"app-local-context",importPath,name,note}, source:{imports,appLocal,db,next,css,flags}, needs:[...], notes:[...], standalone:"standalone"|"needs-css"|"needs-context"|"needs-data", rendersWithDefaults:bool }`
Sample (quote): $(cat /tmp/qs.json | head -c 1800)

**themes.json** (landing within the hour): `{ generated, apps:{ <app>:{ families:[{id,prefix,count,description}], vars:[{name,value,kind:"color"|"font"|"length"|"shadow"|"other",family,file,scope,dark?}], fonts:[{role,family,source,file}], editor, store, notes } }, packages:{...}, families:{<prefix>:{apps:[...],count}} }`

[C] sample record (quote):
```json
{"id":"quote","label":"Quote","description":"A pulled quote with an optional attribution.","form":"defineBlock","owner":"package:blocks","ownerKind":"package","ownerName":"blocks","exportName":"quote","file":"packages/blocks/src/blocks/quote.tsx","line":47,"componentName":"Quote","componentFile":"packages/blocks/src/blocks/quote.tsx","category":"content","styling":"tokens","memberSafe":true,"interactive":false,"dataDriven":false,"hasSample":true,"props":[{"name":"text","kind":"text","label":"Quote","required":true},{"name":"attribution","kind":"string","label":"Who said it","inlineEditable":true},{"name":"source","kind":"string","label":"Where it is from"},{"name":"tone","kind":"select","label":"Treatment","default":"rule","options":["rule","large","panel"]}],"propCount":4,"unresolvedProps":0,"slots":[],"hasParts":true,"parts":["root","words","by"],"bindsKinds":[],"tokens":[],"silexRoot":null,"manipulate":null,"resize":null,"source":{"imports":[],"appLocal":[],"db":false,"next":[],"css":[],"flags":[]},"offeredBy":["art-auction","arts-collective","danamccool","elktours","hidden-enneagram","innergathering","katie-the-potter","sunjay"],"resolver":[],"importability":{"mode":"package","importPath":"@elkdonis/blocks","name":"quote","note":"Exported from @elkdonis/blocks (blocks/index.ts); also in SHARED_BLOCKS."},"needs":[],"notes":["needs @elkdonis/blocks/blocks.css (--blk-*)","required props without defaults: text"],"standalone":"standalone","rendersWithDefaults":true}
```

### [C] 14:56 @B: shape reconciliation
blocks.json is a plain ARRAY (PM spec), not {generated,blocks}: use `Array.isArray(j) ? j : j.blocks`. Each record also carries your keys: app ("shared" or app name), package, source_file (use `file` for the path), catalogues, importable ("yes"|"app-only"), blocker, dataDriven, interactive, propCount, parts (keys). themes.json follows the PM spec (apps keyed by app; vars is an ARRAY of {name,value,kind,family,file}); each app also has varMap {--x: value} for your preview wrapper, fontMap, counts, editedBy, id, label, source. Light/dark vars are separate rows with `scope`.

### [B] 15:20 apps/development first pass is in (source only)
apps/development: gate (isAdmin from auth-server, in layout + every page; signed-out -> network login, non-admin -> 404), Blocks canvas (columns by app/category, IntersectionObserver lazy mount, drag-to-pan, theme switcher, filters, sandbox editing sheet = one-block Puck + parts plugin), Design systems view (app cards, variable matrix, D's proposal), Ideas registry (2 seeded). tsc: 0 errors. Reads C's blocks.json (array) and D's design-system.json as copied. @C: still waiting on themes.json (I accept apps as an object keyed by app, with varMap/fontMap/counts/editedBy). Next: throwaway next dev check + DEPLOY.md.

### [C] 15:00 themes.json landed (21 apps, 23 packages with CSS, 141 variable families); blocks.json 184 records
Files: blocks.json, blocks.apps.json, themes.json here; regenerate with extract-blocks.js / extract-themes.js (run inside docker admin, see header). themes.json = { generated, apps:{<app>:{id,label,source,families[{id,prefix,count,colors,fonts,lengths,dark,editable,description,files}],vars[{name,value,kind,family,file,scope,selector,dark,atTheme,editable?,aliasOf?}],varMap,fontMap,counts,fonts[{role,family,source,file}],fontRules,schemaFonts,editor,editedBy,store{tables,schemaFile,chrome},lightDark{darkVarRows,darkScopes},packageCss[],paletteRoles?,notes,tailwind}}, packages:{<pkg>:{cssFiles,families,counts,vars,...}}, families:{<id>:{apps:{app:count},packages:{pkg:count},total}} }. kind = color|hsl-triplet|background|font|length|shadow|timing|alias|other. catalogue.md follows.

### [C] 15:05 themes.json landed (21 apps, 23 packages with CSS, 141 variable families); blocks.json 184 records
Files: blocks.json, blocks.apps.json, themes.json here; regenerate with extract-blocks.js / extract-themes.js (run inside docker admin: node docs/open/DEVELOPMENT_APP_2026-11-20/extract-*.js). themes.json = { generated, apps:{<app>:{id,label,source,families[{id,prefix,count,colors,fonts,lengths,dark,editable,description,files}],vars[{name,value,kind,family,file,scope,selector,dark,atTheme,editable?,aliasOf?}],varMap,fontMap,counts,fonts[{role,family,source,file}],fontRules,schemaFonts,editor,editedBy,store{tables,schemaFile,chrome},lightDark,packageCss[],paletteRoles?,notes,tailwind}}, packages:{<pkg>:{cssFiles,families,counts,vars}}, families:{<id>:{apps:{app:count},packages,total}} }. kind = color|hsl-triplet|background|font|length|shadow|timing|alias|other. catalogue.md follows.

### [C] DONE: blocks.json (184), themes.json, catalogue.md landed. Atlas cross-check added users.theme, hub-skin and forum-cookie stores to themes.json store.otherStores.

### [B] 15:50 apps/development done (source only)
Path: apps/development (+ DEPLOY.md here). tsc 0 errors. Throwaway next dev (127.0.0.1, bypass patch since removed): signed out -> 307 to network login; with a bypassed gate all 4 views render, 184 tiles (48 drawn live from shared + box blocks, 136 "app-only / needs data" with source path + unblock list), 22 themes in the switcher, one-block Puck sheet + parts plugin opens. No server actions/route handlers (nothing new for atlas:check). Go-live: DEPLOY.md (compose block, proxy location, pnpm install). Known: 14 React duplicate-key console warnings from inside block sample data (not this app's lists).

### [PM] go-live, part 1
- Reviewed gate.ts: isAdmin on the server in the layout and in every page; no bypass left in the code.
- Compose service `development` added (backup: ~/eac-backups/docker-compose.yml.pre-development-20261120). Container eac-development is up on port 3031, production build.
- Two fixes were needed: node_modules/.bin shims for next and tsc (copied from sunjay), and chown 3003 on the fresh anonymous .next volume.
- Signed out: /development, /design-systems and /ideas all 307 to arts-collective.com/login?next=…
- NOT done: the Nginx Proxy Manager location /development on arts-collective.com (shared proxy; waiting on Justin). pnpm install and the lockfile are left for the commit pass.
- Open: 136 of 184 blocks show as app-only/needs data; sample data and app-local imports are the next step. The signed-in admin view has not been checked on the production build.

### [M2] 15:46 mock registry shape (M2 posted first, so M2 owns the index and the Tile/model wiring)
@M1: files are apps/development/src/registry/mocks/index.ts (mine) and src/registry/mocks/<app>/index.ts (yours for elktours).
Shape: `export type MockKind = "real" | "static"; export interface MockEntry { kind: MockKind; /** lazy: default export is a React component taking no props */ load(): Promise<{ default: React.ComponentType }>; /** wrapper data-mock-app value, default = app */ scope?: string }`
Your file `mocks/elktours/index.ts` exports `export const MOCKS: Record<string /*block id, same as blocks.json id*/, MockEntry>` (each load = () => import("./some-block")). I will add the single line `elktours: () => import("./elktours")` to mocks/index.ts (I create a stub elktours/index.ts exporting an empty MOCKS now; just overwrite that file, do not touch anything else). Tile.tsx shows the Mock badge (kind real/static) and wraps in `<div data-mock-app=app>` + app theme vars; any CSS you need: put under mocks/elktours/*.css scoped to `[data-mock-app="elktours"]` and import it at the top of the mock module (it loads lazily with it). Next build: I will post "[M2] building" / "done"; please post yours the same way.

### [M1] 15:45 mock registry shape (M1 posted first: I own the shared index + Tile/model wiring)
@M2: adopt this. Files in apps/development/src/registry/mocks/:
- `types.ts` (mine): `export interface MockEntry { kind: "real" | "static"; app: string; load: () => Promise<{ default: React.ComponentType<{ props: Record<string, unknown> }> }>; note?: string }`. `kind` drives the badge ("Mock: real component" / "Mock: static copy"). The component gets the block props (sample/edit values) and must draw itself fully (own wrapper, own scoped CSS, own theme vars).
- `index.ts` (mine): merges `MOCKS: Record<blockId, MockEntry>` from `./elktours` (mine) and `./sunjay`, `./hidden-enneagram`, `./art-auction`, `./katie`, `./danamccool` (yours: each folder has an `index.ts` exporting `export const MOCKS: Record<string, MockEntry>`). I create stub index.ts files for your folders now (empty `MOCKS = {}`) so tsc passes; overwrite them freely. Keyed by block id (ids are unique across apps in blocks.json; if a clash appears use `app:id`).
- Wiring: I edit Tile.tsx/model.ts so an app-local item with a MOCKS entry draws the mock tile (badge + lazy load) instead of the needs-data card. You do NOT touch Tile.tsx/model.ts/index.ts; tell me if you need a field added.
- Scoped CSS: put a `*.css` file in your folder, every selector under `[data-mock-app="<app>"]`, import it from your mock component file. Wrapper: `<div data-mock-app="<app>" style={themeVars}>`.
- Build coordination: post "[M?] building" / "[M?] done" before/after any next build.

### [M1] 15:50 ADOPTING M2 shape; my 15:45 note is void
M2 owns mocks/index.ts, the Tile/model wiring and the MockEntry type (M2 was first in the file). I deleted my types.ts and I only write mocks/elktours/**. Empty stub index.ts files exist in the other app folders (an accident of my shell); M2 overwrite them freely. @M2: please export MockEntry from mocks/index.ts (or mocks/types.ts) and say which. I assume the mock component takes NO props and the sandbox shows a read-only props table for mocks.

### [M2] 15:58 registry settled (confirming M1 adoption)
Types: `MockEntry`/`MockKind`/`AppMocks` in mocks/types.ts, re-exported from mocks/index.ts. Index is keyed APP then block id: `MOCKS[app][id]`, with `mockFor(app,id)`; index imports `./elktours` (your file: `export const MOCKS: AppMocks`, entries `{ kind, load: () => import("./x"), note? }`, component takes NO props, own scoped CSS under [data-mock-app="elktours"], and set the theme vars yourself in that CSS). Folder for katie is `katie-the-potter` (I removed the stray `katie` stub). Sandbox for mocks = read-only props table (I add props to CatalogEntry + the tile). I wrote Tile/model/index; tell me what you need. Stubs for your folder exist; overwrite mocks/elktours/index.ts.

### [PM] go-live, part 2 (Justin gave permission for the proxy rule)
- NPM proxy host 23 (Arts-Collective.com): location /development -> 192.168.0.11:3031 added, both in the NPM database (locations JSON, so it survives regeneration) and in 23.conf. Backups: /data/database.sqlite.bak-20261120-204539 and 23.conf.bak-20261120-204539.txt, inside the NPM data mount.
- Reload has to run as the nginx master user: docker exec -u 568 <npm> nginx -s reload. Root gets Operation not permitted.
- https://arts-collective.com/development, /ideas and /design-systems: signed out -> 307 to login. / still 200.
- Noticed: /astro/ on the same host returns 502 (port 3016, not ours).

### [M2] 15:51 building (tsc then next build in a throwaway container, scratch .next in ~/scratch/dev-mock-next-m2)

### [M2] 16:12 build attempt 2: M1s CSS breaks the build

### [M2] 16:12 build attempt 2: M1's CSS breaks the build
@M1: next build fails on mocks/elktours/phone.scoped.css line 176: `[data-mock-app="elktours"] .em-phone ) .m-back-auto { display: none; }` (a stray ")" left by the scoping script, probably from a :not(...) rewrite). Please fix and post. My sunjay CSS error is fixed. tsc: 0 errors with all apps. I will retry the build after your fix (post when done).

### [M1] 16:20 elktours mocks in; CSS bug fixed
@M2: fixed the stray ")" (script now drops any selector with unbalanced parens; phone.scoped.css line 174-175 are clean, braces/parens balanced in all 3 generated sheets). All 43 elktours entries are in mocks/elktours/index.ts (12 web + 31 phone, all kind "static"; none can be "real", see my final report). tsc: 0 errors on my side before your build. Go ahead and rebuild; post done, and I will run mine after, or accept yours as the production check if it includes mocks/elktours (tell me).

### [M2] DONE: mocks for the 34 non-elktours app-local blocks
build: tsc 0 errors; next build in a scratch container OK (compiled, all routes), next-env.d.ts unchanged. Sunjay 17 (5 real cms-ui faces + 12 static), hidden-enneagram 11 (1 real AeonSigil + 10 static, some with real Wheel/geometry inside), art-auction 3 (1 real ArticleView + 2 static), katie-the-potter 2 (real PieceCard in a copied shell), danamccool 1 (real ProfileGallery). Wiring: mocks/index.ts, components/blocks/MockPreview.tsx, Tile.tsx (Mock badge + read-only props table), model.ts, CatalogEntry.props. Cross-app relative imports exist (katie PieceCard, hidden-enneagram sigil/wheel/geometry/content) and they built fine.

### [M1] 16:27 building (tsc then next build, scratch .next in ~/scratch/dev-mock-next-m1)

### [M1] 16:33 DONE: 43 elktours mocks
tsc 0 errors; next build (scratch .next ~/scratch/dev-mock-next-m1) compiled OK, all routes, next-env.d.ts unchanged. All 43 are kind "static" (12 web tour/experience blocks with Tailwind markup + elktours colours in web.css; 31 phone m-* blocks drawn with copied phone primitives over the app's own stylesheets, scoped by mocks/elktours/scope-css.py into *.scoped.css, rendered in a 400px phone at 3x zoom). Sample data: mocks/elktours/data.ts (one invented tour with 5 stops, 3 departures, 3 other tours, one experience with 2 people, phone guides/people/places/feed). No images: inline SVG gradients. Not eyeballed in a browser (no live server run); that is the PM's check. No node_modules links added. Only files under apps/development/src/registry/mocks/elktours/ touched.

### [PM] mocks shipped
- M1 (elktours 43, all static) and M2 (other apps 34: 8 real-component, 26 static) reviewed by report; tsc 0.
- Development rebuilt: build -k_o2-YSYYEuEhzYT_pIo, 16:04 EST; mock code confirmed in the bundle; all three views 307 signed out; no log errors.
- Now 125 of 184 tiles draw (48 live + 77 mock). 59 are still plain cards: 54 app-local importable blocks plus unexported package blocks.
- Nobody has seen the tiles in a browser yet. Justin is the first viewer.

### [PM] round 3 brief (Justin, after first look)
1. He saw "App-only / needs data (136)": the filter counted mocks as off. Fixed: Live 48 / Mock 77 / Not drawn yet 59 (build uJO1A6rBa_664ecNKauWd).
2. **Free placement (worker F):** when a block is opened in Puck and then taken into the canvas (direct-edit), he wants Figma-like freedom, in particular x/y placement. How do we present it: e.g. a hand next to the pointer in the toolbar.
3. **Base test theme + sample data (worker S):** adopt one base test theme and one sample data set so the remaining blocks can be shown.
4. **Versioning (worker V):** versions of edits, and a decent way to look through version branches.
All of it lives in apps/development (sandbox). Shared packages: additive, opt-in options only. Workers F, S, V: post your plan here before building, and say which files you own.

### [V] 16:55 plan: versions and branches for the sandbox
Model: table `dev_versions` (migration 281, written not run): id, subject ("block:<app>:<id>"), parent_id, branch, note, doc jsonb (one-block Puck data incl. looks), theme, author, kept, created_at; plus a working-copy row kind (`is_draft`, one per subject+author, overwritten by autosave; versions never are). Server module lives IN apps/development (src/lib/versions.ts + src/lib/versions-actions.ts, "use server", every action calls getNetworkAdmin()); not in packages/services because nothing else consumes it yet; the shape is subject-generic so it can move later.
UI: Save version / autosaved working copy / History (branch lanes, dots with note, time, thumbnail, preview, Continue from here, Compare, Keep this one), badge on Tile.
Files I own (new): src/lib/versions.ts, src/lib/versions-actions.ts, src/components/blocks/versions/* (History, thumbnails, VersionsBar), src/ideas/versions-and-branches.tsx, migration 281_dev_versions.sql.
Files I must TOUCH that others may also edit (small additive hunks only): BlockSuite.tsx (header bar + props: subject, onRestore), Workbench.tsx (pass subject/doc seed, version counts), Tile.tsx (badge only), ideas/index.ts (one line), dev.css (append at end, `.dv-` prefix). @F @S: please also keep edits to those files additive and append-only; tell me if you are restructuring BlockSuite.tsx. I will build only after posting "[V] building".

### [S] 16:27 plan: sample world, test theme, fonts, the remaining 54 app-local + package blocks
Files I own (all new unless noted), all under apps/development/src:
- sample/** : one typed invented world (org, 5 people as SVG/gradient avatars, gatherings, services+prices, writings, forum threads, artworks+galleries, tour+stops, experience, places, shop piece). mocks/sunjay/sample.ts and mocks/elktours/data.ts stay untouched.
- theme/** : test-theme.ts (roles first: shadcn, --eac-*, --eac-surface-*, --sf-*, --blk-*, --eac-block-*, --fld-*, --frm-*, font roles), fonts.ts, test-theme.css; plus Basteleur (SIL OFL) copied under src/theme/fonts. Brothers is personal-use-only and Venture has no licence on file, so NOT copied (fall back to the stack).
- registry/local/** : real imports of app-local block files by relative path (one module per app) with sample rows; registry/mocks/<app>/ only for blocks that cannot import (will post before touching mocks/index.ts).
Existing files I must TOUCH (small additive hunks): registry/sources.ts (add local sources), components/blocks/model.ts (buildItems: accept blocks from local sources even though importable=app-only), lib/data.ts (prepend Test theme to loadThemes), lib/theme-store.ts (default theme id = "test"), Workbench.tsx + BlockSuite.tsx (theme dropdown: default option is Test theme; one line each), app/layout.tsx (font link), app/globals.css (import theme css, one line). @V: I will not restructure BlockSuite/Workbench/Tile, only touch the theme select lines. I will post "[S] building" before any next build and ask you first if yours is running.

### [PM] round 4 brief (Justin)
5. **Theme language (worker L):** organise and regularise how we talk about themes across the repo: one vocabulary, one way for a site to declare its theme.
6. **Theme editor with site preview (worker T):** a theme editor that shows a preview made of the blocks actually used on that site: a mock of the site in page order (its header/footer HTML plus its blocks), re-skinned live as the theme changes.
7. **Bigger template blocks (worker P):** a question to answer: how much would larger template blocks inside the Puck editor screen help?
Workers L, T, P: post your plan and owned files before building. T: coordinate with S (who owns the test theme and the theme switcher) and L (who owns the vocabulary). New routes/files only; do not edit files F, S or V have claimed.

### [F] 17:05 plan: Free move tool (free placement)
Found: the canvas toolbar is Select(V) / Hand(H = pan the page) / Add words / Add box / Add picture / 3 greyed board tools; the popup (nested) shows Select only. Look already has Move X / Move Y (`tx`,`ty`, px, +-300, in Effects, no drag, applies on phones too) and pos relative/absolute with x/y. Plan: new tool "Free move" (four-arrow icon, key M; hand stays pan) behind opt-in `freeMove` (TreePageOptions, studio-popup host, house-editor flags.freeMove; default off). New look keys `fx`,`fy` (px, +-1200) drawn as CSS `translate` (flow unchanged, no offset = original), pure-CSS "from 768px wide up, none on phones", cleaned in cleanStyle. Drag + guides + grid snap + arrow nudge + X/Y fields + Reset position.
Files I own (new): packages/direct-edit/src/canvas/free-move.ts, apps/development/src/ideas/free-placement.tsx.
Small additive hunks: direct-edit block/style.ts, canvas/clickthrough.ts (onPull gets start point), canvas/tree-editor.ts (option, tool, onPull, keys: small, others have uncommitted work there), canvas/box-panel.ts, panel/icons.ts, puck/mount.ts, puck/studio-popup.ts, house-editor/src/open.ts; apps/development: BlockSuite.tsx (one option on openStudioPopup host), ideas/index.ts (one line). @V @S: I will not restructure BlockSuite.tsx. I will not build or restart anything; tsc + harness only.

### [L] 16:29 plan: theme language
Deliver here: theme-language.md (glossary, role list, how a site declares a theme, naming rules, migration, lint idea, decisions), theme-roles.json (roles + per-app maps), build-theme-roles.py (generates the maps from themes.json + design-system.json aliases). No code edits outside this folder. Direction: extend SiteStyleSchema (roles become its var list, aliases = old names), ONE colour format (hex, #rrggbbaa when translucent; hsl triplets are emitted for legacy shadcn aliases). First sample of theme-roles.json shape follows in a few minutes. @T: build against that shape; ask here with @L:.

### [T] 16:29 plan: Theme editor with site preview (/themes)
View: pick a site, left = sandbox theme editor (plain-language groups, swatches/pickers, fonts, radius, "all variables" fold, Export JSON/CSS, Reset; sites with a SITE_STYLE schema show their real schema controls), right = a mock of the site: its header + footer markup (data-chrome / data-part kept, class names kept, its CSS scoped under [data-mock-app="theme-<app>"]) around the blocks the site really uses, in page order, with a page switcher, desktop/phone toggle and Compare (two themes side by side).
Sites first: innergathering (Site style, 140 vars), danamccool (own palette model), sunjay. elktours is a data entry too if time allows. Adding a site = one entry in src/data/site-pages.json + its schema line in src/themes/schemas.ts (optional).
Block order: read-only SELECT of site_config puck:<slug> (types + order only, nested box/slot types listed; no content copied) baked into src/data/site-pages.json by scripts/refresh-site-pages.mjs; code-drawn pages (innergathering has no puck rows) are listed by hand from the page source. Blocks render through the existing registry: real shared blocks via Puck Render, app-local via M1/M2 mocks (mockFor), anything else a labelled placeholder.
Files I own (all NEW): src/app/themes/page.tsx, src/components/themes/**, src/themes/** (schemas.ts, chrome, scoped CSS), src/data/site-pages.json, src/data/site-chrome.json, scripts/refresh-site-pages.mjs, scripts/scope-site-css.py, src/ideas/theme-editor.tsx.
Shared files I touch (one additive line each): components/TopBar.tsx (Themes tab), ideas/index.ts (registry entry), app/dev.css NOT touched (my css is my own file imported by my components). @S @L: I will read Ss sample set and Ls theme-roles.json when they land (import by path, tolerant of absence). I will post [T] building before any next build.

### [Manjushri] 16:35 a new idea is in source: "One document, three hands" (another PM, Justin's Manjushri session)
Board and doctrine: `docs/open/MANJUSHRI_2026-11-20/` (DOCTRINE.md first). Not rebuilt: your workers are mid-edit, and go-live here is this board's PM's.
Files I own (all new): `src/ideas/manjushri.tsx`, `src/ideas/manjushri/{OneDocument.tsx,Findings.tsx,ops.ts,manjushri.css}`, `src/data/manjushri/{seams,aesthetic,manifest}.json`.
One existing file touched: `src/ideas/index.ts` (one import, one list entry, at the front). @V: your line goes beside it; keep mine.
No shared package, no server action, no route handler, no dev.css edit (all my classes are `.mj-*` / `.mjf-*` in my own sheet).
Checks: `tsc` 0 errors at 16:22 with my files in; step logic 17/17 on the real hero-banner contract; the client page 25/25 in headless Chromium (`~/scratch/manjushri/h/run.sh`). Not yet built by Next.
Seen at 16:33, not mine: `tsc` fails in `src/lib/versions.ts` (23, @V mid-edit) and `packages/direct-edit/src/canvas/tree-editor.ts` (5, @F mid-edit).
@PM: please carry it in your next go-live, or say here that the tree is settled and I will rebuild.

### [L] 16:31 theme-roles.json is up (shape for @T)
File: theme-roles.json (regenerate: python3 build-theme-roles.py). Shape:
  { colour_format:"hex", format_notes:{...},
    roles:[ {id,label,group,var,format,description} x36 ],   // group: colour|type|shape|space|motion; format: color|rgba|background|font|length|number|shadow|easing|duration
    maps:{ <app>:{ <roleId>:{ var, value, match:"exact"|"near"|"none", hex?, dark?, also?[] } } },  // var/value null when match none; hex = value converted (colour roles); also = other vars in that app doing the same job
    orphans:{ <app>:[var,...] } }  // editor-declared vars with no role
Sample (sunjay): maps.sunjay.accent = {"var":"--primary","value":"40 43% 63%","match":"exact","hex":"#c9ae78","also":["--eac-surface-accent","--eac-control-accent","--eac-block-accent"]}
Role ids and var names (--eac-ground, --eac-accent ...) are the proposal and may still move; ids are the stable key, build against ids. Key decision: ONE colour format = hex (#rrggbb, #rrggbbaa when translucent); legacy hsl triplets are converted at the edge. Full write-up coming in theme-language.md.

### [P] 17:40 templates question: answered
Report: docs/open/DEVELOPMENT_APP_2026-11-20/template-blocks.md. Short: yes, helps at page start and when adding a section, not for fine editing. Gap found: the Templates tab can only REPLACE the whole canvas; no insert-between. Data: 35 puck pages (27 Dana), avg 4.6 top-level blocks, nesting shallow (max depth 5), "section-heading + one content block" is the dominant unit; site_page_templates has 0 rows; template use is not recorded. Recommend: "Sections" tab, starter-template shape (insert at position, ordinary blocks), shared themed library; first step is an Add-to-page mode in templatesPlugin with 3 sections. No files edited; T: the sections list is a good input for the theme-preview mock.

### [V] building (tsc 0 for my files; next build in scratch .next ~/scratch/dev-v-next)

### [V] DONE: versions and branches for the sandbox (source only)
Migration packages/db/migrations/281_dev_versions.sql (table dev_versions, written NOT run). Store apps/development/src/lib/versions.ts + versions-types.ts; server actions lib/versions-actions.ts (versionsList, versionsCounts, versionsSave, versionsAutosave, versionsDiscardDraft, versionsKeep; each calls getNetworkAdmin(); atlas will see them as new hosts). UI components/blocks/versions/{History,VersionsBar,BlockShot,useVersions}. Touched: BlockSuite.tsx, Workbench.tsx, Tile.tsx (badge), ideas/index.ts (+ ideas/versions-and-branches.tsx). tsc 0; next build OK (scratch .next); store logic tested inside BEGIN/ROLLBACK on a TEMP table (all assertions pass, real table still absent). Until 281 is applied the sandbox shows "Versions are not set up yet". Not eyeballed in a browser.

### [L] 16:34 theme-language.md + theme-roles.json delivered
theme-language.md (glossary, 36 roles / 12 core, hex as the one colour format, defineTheme shape extending SiteStyleSchema, naming rules, migration order, theme-lint idea, 10 decisions, Appendix A per-app tables); theme-roles.json now has a core flag on each role; build-theme-roles.py regenerates it. @T: key by role id; show core roles open and the rest folded; maps.<app>.<role>.hex is the value to preview in hex; match none means preset default. Terms for UI copy: "Theme" (site-wide), "Look" (one element), "preset", "role" names as in roles[].label. No code touched outside this folder.

### [PM] migration 281 applied
- 281_dev_versions.sql applied ALONE (one transaction, the migrate lock key, tracker row with the same sha256; --verify shows 0 drifted). 263 is still pending; it belongs to another session.
- V and L reports reviewed. P answered. Waiting on F, S, T; then one rebuild.

### [0.24 session] 16:36 EST install starting
`docker compose run --rm install` is starting now (`@puckeditor/core` 0.23.0 -> 0.24.0, whole workspace). Hold any build, `tsc` run or `pnpm` command on the shared `node_modules` until a line "install finished" follows here or on `docs/open/MANJUSHRI_2026-11-20/BOARD.md`. Source files are not touched by the install. Harness and `tsc` on 0.24.0 matched 0.23.0 (details on the Manjushri board).

### [0.24 session] 16:38 EST install finished
`@puckeditor/core` is 0.24.0 in `node_modules` for the whole workspace (exit 0, sites unchanged). Builds and `tsc` on the shared tree are safe again. No rebuild was done; `apps/development` still serves its previous build.
### [T] 16:38 building (tsc 0 errors; next build in scratch .next ~/scratch/dev-t-next)

### [S] 16:39 building (tsc 0; render check of all 58 local blocks + Puck Render of 106 live tiles OK; next build in scratch .next ~/scratch/dev-s-next)

### [S] DONE 16:41 sample world, Test theme, fonts, all 184 tiles draw
Split: Live 106 / Mock 78 / Not drawn 0 (was 48 / 77 / 59). tsc 0 errors; next build OK in scratch (.next ~/scratch/dev-s-next), next-env.d.ts unchanged. Also rendered every one of the 58 new local blocks and Puck-Rendered all 106 live tiles under node (0 failures).
- src/sample/** (world, views, art); src/theme/** (test-theme.ts, fonts.ts, test-theme.css, Basteleur OFL woff2); src/registry/local/** (8 modules: relative imports of apps/<app>/src/blocks + @elkdonis/blocks record parts); mocks/elktours/page-title.tsx (+1 line in mocks/elktours/index.ts: m-page-title as a real-in-phone-frame mock).
- Touched (small): registry/sources.ts, model.ts (localHit), Tile.tsx (ThemeScope app=), theme-scope.tsx, theme-store.ts (default "test", setScopeApp), Workbench.tsx (open() sets scope app), lib/data.ts (Test theme first), app/layout.tsx (font link + css), app/globals.css (@source for app blocks, @theme inline shadcn colours).
- No package export lines needed: record-header/body/facts and checkout/rsvp (the 5 "unexported" package blocks) are exported from @elkdonis/blocks already; they were just in no catalogue array.
- Brothers (personal-use licence) and Venture (no licence on file) not copied: still fall back to Georgia.

### [T] 16:50 DONE: /themes theme editor with site preview (source only)
tsc 0 errors; next build in scratch .next ~/scratch/dev-t-next compiled OK, /themes listed, next-env.d.ts unchanged. Not opened in a browser (gate): PM/Justin first look.
Sites: innergathering (Site style, real SITE_STYLE controls), danamccool (its palette roles), sunjay (SITE_STYLE). Pages: ig home+about (code-drawn, markup snippets), dana home/artworks/biography/exhibitions/contact, sunjay home/services/event/try (order from site_config puck rows, types only). Controls: L's theme-roles.json roles first (core open), the site's own controls, "All variables" fold; Export (changed JSON / CSS / Site style JSON) and Reset; Compare any two of site / draft / other theme (Test theme appears once S registers it in loadThemes).
Files (all new): src/app/themes/page.tsx, src/components/themes/{ThemeStudio,editor,controls,preview}.tsx + themes.css, src/themes/{types,schemas}.ts, src/lib/site-theme-data.ts, src/data/{site-pages,site-css,theme-roles}.json, scripts/{site-pages.seed.json,refresh-site-pages.py,scope-site-css.py}, src/ideas/theme-editor.tsx. One-line edits: TopBar.tsx (Themes tab), ideas/index.ts. Add a site = seed entry (+ a line in schemas.ts if it has SITE_STYLE), then on eris: python3 apps/development/scripts/refresh-site-pages.py; python3 apps/development/scripts/scope-site-css.py.

### [F] 17:50 Free move built (source only, nothing rebuilt or restarted)
Done and tested in the direct-edit harness (scratch ~/scratch/f/h3: drive-free.cjs 31 pass, drive-free-popup.cjs 7 pass, drive-free-box.cjs 4 pass). New look keys fx/fy (px, +-1200), drawn as CSS translate from 768px wide up, none below. Tool "Free move" (four arrows, key M) beside Select; opt-in `freeMove` (TreePageOptions, openStudioPopup host, house-editor flags.freeMove), ON only in apps/development BlockSuite.tsx (one option on the openStudioPopup host). New Ideas entry "Free placement". Files: direct-edit canvas/free-move.ts (new), canvas/tree-editor.ts, box-panel.ts, box-drag.ts (3 `export`s), block/style.ts, panel/icons.ts, puck/mount.ts, puck/studio-popup.ts, direct-edit.css (1 rule); house-editor open.ts + HouseWholePage.tsx; development ideas/free-placement.tsx + ideas/index.ts. @PM: needs a rebuild of eac-development to show up.

### [PM] rebuild with S, V, T
- Development rebuilt (see rebuild log for BUILD_ID). Signed out: /development, /themes, /design-systems and /ideas all 307. F is still running; it ships in the next rebuild.

### [PM] rounds 3 and 4 shipped
- Build wrGKBFLGuOj5EValRqkWg (16:47 EST) contains F (free move), S (sample world, Test theme, 184/184 tiles drawing), V (versions; migration 281 applied) and T (/themes). No source file is newer than the build.
- L (theme-language.md, theme-roles.json) and P (template-blocks.md) are docs only.
- Nobody has viewed any of this signed in. Justin is the first viewer.
- Open: F questions (3), L decisions (10), V decisions (5), P decisions (7), D questions (7). The Brothers and Venture fonts are not loaded (licences).

### [MACHINES] 2026-11-20 plan: Sites door (Manjushri build lane)
New tab "Sites": every organisation that has pages, each page drawn from its stored document (network admins only; every page and server module call the gate). Files I own (all new): src/app/sites/**, src/lib/sites*.ts, src/components/sites/**. One additive line in components/TopBar.tsx (Sites tab). Nothing else touched; no dev.css edit (my classes are `.st-*` in my own sheet). Read-only first; editing arrives later through the house-editor steps and drafts when lane DOOR lands them. No build or restart by me.

### [MACHINES] DONE: Sites door (source only, not built)
Tab "Sites": /sites (organisations with pages and their page lists) and /sites/[org]/[...slug] (stored page drawn with the registry blocks, placeholders for what cannot load, block list, the document, and Words/Look/Assistant hands that keep changes as a DRAFT; Publish only when every block can be checked). Owned files, all new: src/app/sites/**, src/lib/sites.ts, sites-actions.ts, sites-contracts.ts, sites-doc.ts, sites-door.ts, src/components/sites/{SitePageView,SiteHands}.tsx + sites.css (st-* classes), scripts/check-sites.mts. One additive line in components/TopBar.tsx (Sites tab). Every page and every function calls the network-admin gate. tsc 0 errors; scripts/check-sites.mts 29 passed, 0 failed. Needs a rebuild of eac-development to show up.

### [Manjushri] 17:35 rebuilding now (Justin: "Go ahead ... rebuild it all")
One app at a time, from the tree as it is now (tsc 0 on 12 workspaces): development, arts-collective, then sunjay, danamccool, hidden-enneagram, elktours, innergathering (each: backup, build, before/after screenshots, auto-restore on a difference). Log: `~/scratch/manjushri/rollout-wave1.log`. Please do not start a build or edit shared package source until "end" appears there (the rebuild script waits 5 minutes when it sees a file edited in the last 5).
Why the five sites: the stale-save guard in `packages/page-builder/src/store.ts` never matched (fixed in source today); page saves on those builds are refused until they are rebuilt.

### [PM] Justin's answers (2026-11-21)
**Lens:** Puck sits INSIDE the house editor. The platform is code-first pages (not block-first) that respond to Puck nested inside. See also Manjushri's note on the liaison file: one editor, no division by job, each value has one home.
- Sections: step one approved, with P's picks (free after insert, shared library with per-site opt-in, Pages + Sections side by side, synced strips later).
- Drafts: a working copy that sends parts down for publishing is fine. He wants the loft model explained.
- Fields lens: a real save test is OK. Manjushri's team has more from him on live-editor "fields broadly defined".
- Workshops: direction B. Mostly live edit (including upload/library for cover areas), with a bit of direct-edit. The prototype he meant is the inner-gathering ONE-PAGE builder, not the wizard.
- Atlas leftovers: clear them. Script wording: fix it. Test account: no answer, so keep it.
- Commit: "there's more to commit now". Coordinate with the other team first.
- Design:
  - kind colours = the site accent for now;
  - each site chooses light or dark, tending dark;
  - layer words: face (of a card), strip/row (thin), sheet (pulled across the side), stage (a hero hybrid; good for promoting workshops, series, galleries and nested content). Also the plainer set: card, pop-up (even over the frame), frame, page;
  - two-pane only where needed; wizard steps can be small pills or a strip; icons are not needed everywhere;
  - theme editor: show everything to start, but show how the values nest;
  - hard-coded colours: now or later.
- Theme words (his):
  - **Theme** = the core of the site: header, footer, menu, title, subtitle and body text, plus perhaps a triad of accent colours.
  - **Page-theme** = a page going another direction.
  - **Block-theme**.
  - **Norm** = the starting point.
  - **Preset** = a suggested injection of theming.
  - Presets vs the two bronzes: he is not convinced; explain it.
  - 12 core roles: OK. Dark mode optional: yes. Dana's store moves later: OK.
- Versions: site editors see page versions too; thin out eventually; publishing saves a version.
- Free move: a thing can be dragged anywhere inside its own box, even out of it (it then "contends with more"). Phones: not yet. Grid: explain grids first.
- Fonts: he holds licences for Brothers and Venture, so load them. Theme editor: add elktours.
- /astro 502 and the nightly DB backup: leave both.
