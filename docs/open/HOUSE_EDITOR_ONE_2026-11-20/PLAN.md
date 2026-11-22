# One house editor across every app (plan, 2026-11-20)

**Status: plan only.**
- Built from four read-only audits in this folder, plus the PM's own pass over elktours and danamccool:
  - `innergathering-sunjay.md`
  - `ifac-hidden-enneagram.md`
  - `art-auction-katie.md`
  - `artdirect-arts-collective.md`
- The action atlas (`packages/actions/atlas`) was used to list the save capabilities.

**Justin's direction:**
- Every editor adapts to, improves on, or is inherited into ONE house editor.
- `live-editor` is kept as the on-site field/copy layer, and may grow into its own "Fields lens" alongside the codebase.
- His reference for the field UX is the art-auction About page editor.

## 1. The shape: two lenses, one set of doors

| Lens | What it edits | Engine | Reached from |
|---|---|---|---|
| **Fields** | one value at a time: titles, section copy, thread text, bio, promo, banner | `@elkdonis/live-editor` grown into the Fields lens; the shell follows the art-auction About pattern (Edit/Done bar, chips, field dialog) | the page itself ("You can edit this page") |
| **Look** | blocks, layout, per-part looks, Site style | the direct-edit canvas (`mountTreePage`) with Puck one click away (inception: Settings opens the Puck sheet; Edit look opens the canvas popup) | "Edit this page", hub Site Builder card |

The rules:
- **One writer per value.** The Fields lens declines any value stored inside a Puck document; the canvas edits those.
- **One door per site.** "Edit this page" opens the canvas at `/studio/<slug>`, with Puck at `/studio/<slug>/blocks`. The hub Site Builder card is home for pages, menu and style.

## 2. Where every app stands

A = on the house stack already, B = should adopt the shared kit, C = keep its own UI but expose it as a surface, D = retire.

| App | Editor surfaces | A | B | C | D | State in one line |
|---|---|---|---|---|---|---|
| sunjay | 10 | 7 | 0 | 3 | (1 redirect) | the reference: canvas first, inception, templates, records, Menu, Site style. No stale-save guard yet |
| elktours | landing / phone / tour | landing pages canvas-first (live since 02:01 on 11-20); phone pages have the Puck popup | tour-detail layout (plain Puck) | — | — | guard on the landing pages; the tour layout waits for the HeroCombined work |
| hidden-enneagram | 10 | 6 | 0 | 3 | 1? | canvas + Puck + Site style. Lacks inception, records, guard. Helpers copied verbatim from sunjay |
| innergathering | 7 | 0 | 5 | 1 | 1 | early port: Puck at /studio, bare canvas at /canvas, no contract/parts/inception/records/Site style. Dead `page-edits-save` |
| katie | ~6 | 3 | 2 | — | — | Puck-first with parts + templates. No canvas route, no guard, Menu tab not wired. **Its editor files hold another session's uncommitted work** |
| danamccool | — | — | canvas (phase 6 of PUCK_LIFT) | — | — | richest Puck (now partly shared); phases 0-2 rebuilding 11-20 |
| art-auction | 13 | 0 | 2 | 6 (+About) | 0 | own product. Puck pages + store panel; bespoke 3D installations and loft; About/series editors are the Fields-lens model. No direct-edit, no live-editor |
| ifac | 17 | 0 | 4 | 13 | 0 | no /studio, no canvas, no Site style; live-editor user (profile, gallery); raw-JSON sections editor with no validation |
| artdirect | 7 | 1 | 1 | 5 | 0 | person-page designer = Puck with draft + publish (`user_pages`), never used in prod; live-editor bio |
| arts-collective | 12 | 3 | 4 | 5 | 1 (Silex) | classifieds/cards on direct-edit (0 docs stored); org landing Puck-only, unguarded; Site Builder card not mounted |

## 3. Pieces that exist as copies today

- **The canvas editor component.**
  - sunjay, elktours and HE each have a 160-170 line `CanvasEditor.tsx`. Elktours differs from sunjay by about 40 lines.
  - innergathering has a 69-line early copy.
  - `withProps`, `resolvedRows` and `holdsData` are duplicated word for word.
- **The page-save action.** The atlas counts 7 near-copies that differ in gate, cleaning (cleanBoxDoc / stripResolved / none), slug rules and revalidation.
- **The picture chooser.** 3+ copies (the cms-ui `makeChoosePicture` now exists).
- **Section copy.**
  - `saveSectionAction` in sunjay and innergathering replaces the whole content row, accepts any key and does not sanitise.
  - The hub `sb-runners` path already merges allow-listed keys with `updated_by`.
- **Field editors.**
  - `profile-field-save`, `gallery-details-save`, `edit-workshop-live`, `site-section-copy-save`, `center-promo-save`, banner, About: all one slot, one value, one gate, one write.
  - Only workshop (arts-collective), ifac profile/gallery and artdirect bio run on live-editor.
- **Theme.**
  - ifac `site-theme-save` and Site style write the SAME `site_themes` row, so ifac can move to Site style without a migration.
  - The person theme (`users.theme`), gallery looks (`user_galleries.settings`) and hub skin (`site_config hub:skin`) are separate.
  - arts-collective's AppearancePanel is Site style on the older live-editor CssPanel.
- **Drafts.** Three models exist:
  - art-auction landing loft: working copy, "Put on the page", "Go back". The live copy is never touched by a save. **Best.**
  - artdirect `user_pages`: draft and live rows, optional org review.
  - art-auction store panel: draft, then submit for review.
  - Bug in all three of the user-store ones: `saveUserPage` flips a published row back to draft (`page-builder/src/user-store.ts:141`). That is why artdirect needs a second row.

## 4. The build

**H1: the shared HouseEditor (one component, every app binds it)**
- **Where it lives:** a new package `@elkdonis/house-editor`. It depends on direct-edit + page-builder, and page-builder must stay free of direct-edit, so it can't go there.
- **What it exports:**
  - `HouseEditor`: the canvas.
  - `HouseWholePage`: PuckEditor with the same plugins.
  - `openHouseLanding`: wraps `openVisitorPage` / `openPageAsTree`.
  - shared helpers: `resolvedRows`, `withProps`, `stripResolved`, `slugProblem`;
  - one `savePageAction` factory (gate, cleaning, slug rules, revalidate, guard).
- **Props**, merged from the three proposals:
  - `slug, orgId, initial, version`
  - `config {canvasConfig, puckConfig, contract}`
  - `save(slug, doc, version) -> {ok, error?, stale?, updatedAt?}`
  - `resolvedKeys, record`
  - `records | sources: SiteSources, choosePicture`
  - `routes {blocks, done}`, `pages`, `nav`, `templates`
  - `saveNotice` (sunjay TEMPLATE_NOTICE), `presets` / `boxify` (HE), `classes` (innergathering)
  - `flags {designTools, inception, developer}`
- **Order:** sunjay → elktours → HE → innergathering become thin binds, each checked to behave the same (tsc + harness + a click-through). The stale-save guard comes on everywhere with it.

**H2: bring the rest onto it**
- katie: after its other session commits.
- danamccool: PUCK_LIFT phase 6.
- art-auction `/edit/<slug>`: never creates `home`.
- arts-collective `/hub/sites/<slug>/design`.
- artdirect person pages: needs the guard on `user_pages`.
- ifac: new `/studio`. It is the largest; schedule last.

**H3: the Fields lens (live-editor grows)**
- **Declare and route:**
  - Components mark fields with `data-field="kind:id:field"` plus a pure-data `defineFields` registry. This extends cms-bindings `fieldRegistry` and dossier fields.
  - Each field maps to an atlas capability and saves through `performAction(id, …)` (packages/actions run.ts). It inherits the Runner gate, zod input, audit row and confirm wording.
  - Most field rows are documentation today, so each needs a small runner.
- **The shell:** About's on-page bar (Edit/Done), per-row chips (edit, ↑↓, remove, add), a dialog built from declared field kinds (text, rich, media, link), and one save then a toast.
- **To add:**
  - lists of rows;
  - Clear/Remove;
  - a read-only state with a reason;
  - link validation;
  - `boolean` and `color` kinds;
  - a stale result;
  - merge with allow-listed keys;
  - an "Edit the look…" footer that opens the canvas or Puck sheet on that block (replaces `fullEditorUrl`);
  - a cue that looks different from the canvas selection box.
- **First targets:**
  - section copy in both apps, which fixes the replace-any-key action;
  - innergathering center promo;
  - sunjay banner;
  - own profile;
  - thread copy;
  - artdirect dossier fields;
  - art-auction About / welcome letter / series fields.

**H4: drafts and review**
- **Save modes.** Add `saveMode` to the save bar: `instant | draft+publish | draft+review`. PuckEditor already has `onSaveDraft` and `publishedLabel`.
- **Drafts follow the loft model.** A working copy autosaves; "Put on the page" publishes; "Go back" reverts.
- **Storage for org pages:** a sibling `site_config` key (`puckdraft:<slug>`), which needs no migration.
- **Review:** reuse services `submitUserPage` / `reviewUserPage` and ifac's queue UI.
- **Bug:** fix the `saveUserPage` flip.

**H5: one theme model**
- `SiteStyleSchema` is the source of truth.
- `site_themes` gets a scope ladder (org → page → person → row) with diff-only writes.
- Hub skin becomes a choice variable.
- One revalidate policy.
- ifac and arts-collective AppearancePanel move onto it.

**H6: doors and retirements**
- The Site Builder card is mounted everywhere, including arts-collective `/hub/sites/<slug>`.
- Every "Edit this page" door points to the canvas.
- Silex: hide its door and keep the code. It is used by 1 of 24 orgs (HE, being rebuilt on Puck), and its "Edit layout" link is already dead on one page.
- innergathering dead `page-edits-save`: retire.

## 5. Decisions for Justin

1. `@elkdonis/house-editor` as a new package (recommended), or a subpath of direct-edit.
2. Drafts: loft model with a `puckdraft:<slug>` key and no migration (recommended), or a `page_revisions` table with history (needs a migration).
3. Silex: hide its door now and remove it later? This removes the only free-HTML layout path.
4. The Fields lens' first targets: section copy (it also fixes an unsafe action) + center promo + art-auction About generalised.
5. Should art-auction get Site style? Its header is Tailwind code with no site-look variables.
6. Order: H1 first (only refactor plus guard, no visible change), then H3 and H2 in parallel.

## 6. Bugs and risks found along the way (fix early)

- `saveUserPage` flips a published row back to draft (`page-builder/src/user-store.ts:141`; art-auction store panel, artdirect). Not tested against live data.
- `saveSectionAction` (sunjay, innergathering) replaces the whole row, accepts any key and does not sanitise.
- artdirect `/edit` and `/new`: any signed-in person can edit an unclaimed dossier (atlas open note, `oad-actions.ts:138-170`); the URL fields are not validated.
- ifac's raw-JSON sections editor has no validation.
- arts-collective org landing (`saveOrgHome`) has no guard.
- No house editor has a guard except danamccool and elktours landing.

## 7. Decisions (Justin, 2026-11-20)

**1. Where the shared house editor lives: inside `@elkdonis/direct-edit`, not a new package.**
- Justin: "Direct-edit is the house editor too… They should share same package, part of consolidation synergy effort."
- New subpath `@elkdonis/direct-edit/house`: HouseEditor, HouseWholePage, openHouseLanding, the save-action factory and the shared helpers.
  - It may import page-builder and @puckeditor/core, declared as peer dependencies.
  - page-builder must never import direct-edit, so there is no cycle.
  - The other direct-edit subpaths stay plain DOM.
- The Fields lens lives in the same package later, as `@elkdonis/direct-edit/fields`. It starts as a wrapper over live-editor.

**5. art-auction gets Site style**, especially so its header and footer can be changed.
- Its header and footer get `data-chrome` / `data-part` parts and site-look variables.
- It must render the same until a style is saved.

Still open: 2 (drafts model), 3 (Silex), 4 (Fields lens first targets).
6 (order): H1 started, in source, on 2026-11-20.

## 8. Correction and further decisions (Justin, 2026-11-20, later)
**Correction to decision 1.** The house editor is "the house of all editors": its own package, `@elkdonis/house-editor`.
- It owns the glue between its members: the direct-edit canvas, page-builder Puck, Site style and the Fields lens.
- direct-edit and page-builder never import each other. Only house-editor imports both.
- H1 was built there.

**Silex:** doors hidden behind a flag (`apps/arts-collective/src/lib/silex-flag.ts`). The code is kept.

**Fields lens first targets:** yes (section copy, center promo).
- The About pattern is NOT adopted yet. Alternatives are being compared, and About may still win.

**Drafts:** read as "go with the recommendation": the loft model with a `puckdraft:<slug>` key and no migration. To confirm.

## 9. Revised shape (2026-11-21): one editor, Puck inside, each value has one home

**Status: plan, posted for Justin and the Manjushri team. Nothing here is built by this section.**
- It replaces the "two lenses" picture in §1.
- It keeps H1 (shared package), H4 (drafts), H5 (themes) and H6 (doors).
- It adopts `docs/open/MANJUSHRI_2026-11-20/DOCTRINE.md` (one document, one checked door) as the engineering base.

### 9.1 Justin's direction, in his words and ours
- "Puck is inside our house editor." The platform is **code-first pages** that respond to Puck nested inside them. It is not block-first.
- Editors are **not divided by job**: "look, words and media can be done by all. arranging blocks done by both puck and direct editor, and it doesnt really need to change screens ... if its all the same editor".
- **Rule:** any editor may change anything; **each value has exactly one home.**
- Block settings are a **Content tab at the top of the side panel**. The separate settings pop-up stays only for what the panel cannot draw.
- The Puck studio is kept and made ours: the content library and directory search become pickers inside it.
- **Menus are blocks** (building on the shared nav store and Menu tab).
- **About is an inline-edited page** (the art-auction About build is the model).

### 9.2 The picture
One page, one document, one editor on the page itself.

| On screen | What it is | Engine underneath |
|---|---|---|
| The page | The real, code-first page. Code draws what it knows; Puck regions sit inside it where the owner composes blocks | Next page + `Render` |
| Click anything | Selects it: a block, a part of a block, a record's value, a piece of chrome | direct-edit canvas (`openHouseLanding` / `HouseEditor`) |
| Side panel, **Content** tab (first) | That thing's settings and words: the same fields Puck shows, drawn in our panel | the block's declared fields; Puck's field renderers where ours lack a control |
| Side panel, **Look** tab | Its look: per part, with When (hover) and Screen (phone) switches | `morph` via the checked door |
| Side panel, **Theme** tab | The Theme / Page-theme / Block-theme ladder for the selection | Site style |
| Typing on the page | Words edited in place (short text). Record values go to the record, and the panel says so | Fields lens, now a behaviour of the same editor, not a separate mode |
| Dragging | Arranges blocks. Free move where allowed. Dragging a handle writes the SETTING it stands for (a banner edge writes Height), never a second copy | steps `move`, `set_prop`, `set_look` |
| "Blocks" / "Sections" / "Pages" rail | Insert a block, a starter section, or start from a page template | Puck's document engine; `sectionsPlugin` |
| Whole-page Puck | Kept as "the studio" for people who prefer it. It has the same panel content, pickers and chrome | `HouseWholePage` |

There is no screen change between these. The Puck sheet opens only as a fallback for a control the panel cannot draw yet.

### 9.3 "One home" rules
The door (`@elkdonis/house-editor/steps`) enforces these, and the panel shows them.
1. **A block setting** lives in the block's `props`. Puck's fields, the Content tab, typing on the page and drag handles all write that one prop.
2. **A look** lives under `morph` (on a canvas box, `look`). Puck's Style panel values are read through it. A look value and a setting never duplicate each other: if a block declares a Height setting, the look offers no height.
3. **A record's value** (a gathering title, an artwork) lives on the record. Editing it on a page changes the record, through that record's own action and gate, and the panel says "This changes the gathering itself".
4. **A theme value** lives on the theme ladder (Theme → Page-theme → Block-theme). A look may point at a theme role; it does not copy the colour.
5. **Chrome** (header, footer, menu) lives in Site style looks plus the nav store. A menu block reads the same store.
6. Every element on the page carries a mark that says which home it has, so any editor, an assistant, or a lesson can say where a value comes from.

### 9.4 Work order (each step ships alone; shipping is paused until Justin says)
Owner: PM = this session; M = Manjushri team.

| # | Step | You would see | Owner |
|---|---|---|---|
| A | **Content tab in the side panel**: the selected block's settings drawn from its declared fields, written through `set_prop`; the settings pop-up becomes "More settings…" | Click a block, edit its settings beside the page, no pop-up | PM builds on M's door |
| B | **Handles write settings**: a block declares which setting a handle stands for (`manipulate` / `resize` already exist on blocks) | Drag a banner's edge; its Height setting changes in the Content tab | PM, with M's findings |
| C | **Type on the page for block words** (the lens reaches block parts that name a setting: M has this in source) and record values with the "changes the record" line | Click a title and type; a gathering title asks before renaming the gathering | M (lens) + PM (panel line) |
| D | **Sections** (step one running now), then the Blocks / Sections / Pages rail inside the on-page editor, not only in the studio | "+" between blocks on the page | PM |
| E | **Drafts**: one model: M's `puck-draft:<slug>` working copy + "Put on the page" / "Go back" + a version saved on publish (`dev_versions` generalised); site editors see page versions | Edits wait as a working copy; History shows versions | PM + M |
| F | **Theme ladder in the panel** (Theme, Page-theme, Block-theme, Norm, Preset), using the role list in `DEVELOPMENT_APP_2026-11-20/theme-language.md` with Justin's words | A Theme tab that shows how values nest | PM |
| G | **Menus as blocks; About as an inline page** | Edit the menu where it sits; About edits like the art-auction About | M proposes, PM plans |
| H | **Studio made ours**: content library and directory search as pickers inside Puck | Pick a gathering or a person from inside the editor | M |
| I | Retire the duplicates as each step lands: per-app settings pop-up wiring, `/manage/pages` section form, Dana's own Theme tab storage | Fewer doors that do the same thing | PM |

### 9.5 What stays true from before
- direct-edit and page-builder still never import each other; `@elkdonis/house-editor` is the only place that knows both.
- Signed-out pixel checks do not cover the editor. Every editor step is checked signed in on a localhost dev copy before any rebuild, and Justin looks before it ships.
- Every agent posts on `docs/open/LIAISON/HOUSE_EDITOR_PM.md` before touching shared editor code.

### 9.6 Decisions for Justin
1. **Content tab first** (step A) as the next build after Sections? (PM pick: yes.)
2. **Whole-page Puck:** keep as "the studio" beside the on-page editor (pick), or fold away once the panel can do everything?
3. **Record edits on a page:** always ask before changing the record (pick), or only the first time per session?
4. **The two near-identical bronzes** (elktours, sunjay): one shared colour or two independent ones?
