
## art-auction Site style (2026-11-20)
Source only: nothing rebuilt, restarted, migrated or committed.
- Added: `apps/art-auction/src/lib/site-style-schema.ts`, `site-style.ts`, `site-style-actions.ts`; `src/components/site-style/SiteStyleButton.tsx`.
- Changed: `app/layout.tsx` (async; loads style, emits `<style data-site-style>` only when a style is saved; button only for `getPagesEditor`), `components/site-header.tsx`, `site-nav.tsx`, `site-footer.tsx` (data-chrome / data-part only), `package.json` (+@elkdonis/direct-edit), `next.config.ts` (transpilePackages), `pnpm-lock.yaml` (importer entry for art-auction, 3 lines, additive over other sessions' uncommitted lock edits). Local symlink `apps/art-auction/node_modules/@elkdonis/direct-edit` created (what pnpm install would make).
- Theme: site_themes ('market', page_key '') + site_config `site-style:chrome`. Vars: --background --foreground --muted-foreground --wall --card --muted --primary --primary-foreground --secondary --live --border, fonts body/heading (heading also .font-serif), --radius. Defaults checked equal to globals.css :root (11 hsl + radius, 0 mismatches).
- Chrome: header parts brand, links, messages, cta, account, cart, menu; footer parts title, blurb, links. Gate: getPagesEditor (platform admin or owner/guide of `market`), re-checked in the action; action revalidates ("/", "layout").
- Not covered: /about and series pages hide SiteHeader/SiteFooter (SiteChrome) and draw their own chrome; admin/studio/panel left alone. OS-dark visitors keep the dark palette (media-query rule out-ranks saved vars).
- Verify: tsc 0 `error TS`. Dev-server render diff NOT done (one-off needed `--user root` over the bind mount; blocked). Existing DB rows for market style: none found (read-only psql).
- Later: header nav is a code array in site-header.tsx; loadSiteNav could feed it.
- PM review fixes (2026-11-20): (1) Rendering: no regression. Production build manifest (`docker exec eac-art-auction`, read-only: .next/prerender-manifest.json) prerenders only `/_global-error`; every other route, `/` and `/about` included, was already dynamic because the root layout's SiteHeader and NetworkBar read cookies/headers (and 64 route files set force-dynamic/revalidate). Sunjay and elktours also call getViewer in their layouts. So no (a)/(b) needed; per-request cost is two small queries (site_themes, site_config) plus getPagesEditor (null when signed out). (2) Dark: globals.css OS-dark block changed from `:root:not(.light)` to `html:not(.light)` (same element, specificity 0,1,1 = saved `html:root`; saved style loads later in body so it wins; still beats light `:root` 0,1,0). Defaults unchanged in both modes. Consequence: a saved light page colour also shows to dark visitors (no separate dark set in the schema). tsc: 0 `error TS`.

## Silex door hidden (2026-11-20)
Flag: SILEX_EDITOR_ENABLED = false in apps/arts-collective/src/lib/silex-flag.ts (plain constant, flip to true to restore).
Gated: SilexLaunchButton (returns null), SilexSurfaceControls call in ConsoleSettings, "Edit layout" pill in SubdomainEditorBar, /edit/[slug] (redirects to /hub/sites/<slug>). HubCard "Coming soon - Silex" label now just "Coming soon".
Untouched: api/silex/* routes, SilexLayout rendering, silex-published, DB columns.
Still reachable by URL: api/silex/token, layout, publish, auth, assets, templates.
Where the replacement door goes: the "Edit layout" slot in SubdomainEditorBar (after Workshops) and the Site and address section of ConsoleSettings.
tsc: 0 error TS. No rebuild, restart, DB write or commit.

## H1 direct-edit/house (2026-11-20)
Source only; nothing rebuilt, restarted, committed, migrated or written to the DB.

**Location changed mid-task (Justin):** the house editor is its own package, `packages/house-editor` (`@elkdonis/house-editor`), not a direct-edit subpath. direct-edit is back to untouched (no house code, package.json reverted). Only house-editor imports both direct-edit and page-builder.

- New `packages/house-editor/`: package.json (exports `.` and `./server`), tsconfig.json, README.md, src/{HouseEditor.tsx, HouseWholePage.tsx, open.ts (openHouse), landing.ts (openHouseLanding), save.ts (createSavePageAction, holdVersion), walk.ts (resolvedRows, withProps), server.ts, index.ts}.
- sunjay: components/studio/{CanvasEditor.tsx 172->50, page-editor.tsx ->54}, lib/puck/{actions.ts (savePageAction via factory, now takes expectedUpdatedAt), store.ts (loadPageWithVersion, savePage expected)}, app/studio/[slug]/{page,blocks/page}.tsx pass version (stale-save guard is new on sunjay), package.json + next.config.ts.
- elktours: components/studio/{CanvasEditor.tsx 168->43, page-editor.tsx 36->18}, lib/puck/actions.ts (savePageAction via factory), package.json + next.config.ts. Puck editor keeps handBack off.
- tsc 0 errors: house-editor, direct-edit, page-builder, sunjay, elktours, hidden-enneagram, innergathering. esbuild bundle of house-editor index resolves.
- Hand-made symlinks (a rebuild must run pnpm install; lockfile NOT updated): apps/sunjay/node_modules/@elkdonis/house-editor, apps/elktours/node_modules/@elkdonis/house-editor, packages/house-editor/node_modules/{react,react-dom,typescript,@puckeditor/core,@types/node,@types/react,@types/react-dom,@elkdonis/direct-edit,@elkdonis/page-builder,@elkdonis/blocks}.
- Direct-edit harness NOT run: it bundles scratch copies of app canvas code, not house-editor; no direct-edit source changed by this step.
- Not browser-tested.

## PM: signed-in browser checks (2026-11-20, ~03:00 EST)

**Test editor.** Justin said "You can create test admin".
- Account `house-editor-test@example.com`, display name "House editor test (Claude)".
- Role: guide on danamccool and elktours only. Created through the GoTrue admin API with email_confirm, so no email was sent.
- Auth id `bb77984c-0bdc-4e47-bb39-33dae6723794`.
- Credentials are in eris `~/eac-backups/test-accounts/house-editor-test.txt` (mode 600, outside the repo).
- Delete it when house-editor testing ends: its user_organizations rows, its users row and its auth user.

**How it was run.**
- Throwaway `next dev` copies of each app ran in one-off containers on 127.0.0.1, with `.next` in a scratch folder (chmod 777).
- elktours needed `INTER_APP_JWT_SECRET=` (so the network sign-in hand-off doesn't fire) and `NEXT_PUBLIC_APP_URL=http://127.0.0.1:4021`, plus `/login?sso=1`. Use `localhost`, not 127.0.0.1: the cookie domain and the redirect host must match.
- Headless chromium (zenika/alpine-chrome) and node with playwright-core, over CDP, on the host network. Scripts are in `~/scratch/he-test/{check,elk}.cjs`; screenshots are in `out/` and `out-elk/`.
- The password was read from the file inside the container and never printed.
- Any request carrying a page document was aborted, so nothing was saved. The dev copies are stopped, and `next-env.d.ts` was restored in both apps.

**danamccool (phases 0-2 source, the same code as the live build GRrtubbUIAq-XEq4zmip6).**
- Sign-in lands on `/studio/art-archive`. The editor renders her grid.
- Rail tabs: Blocks, Outline, Pages, Galleries, Media, Menu, Theme.
  - Pages: lists her pages and the 167 gallery chip.
  - Menu: her 14 items, with sub-items indented (Biography under About).
  - Galleries: opens Art Archive, 167 items.
  - Media: 671 files, 450 in use.
- Selecting the grid opens the picture-level fields ("Picture 2 of 167 in Art Archive").
- `/hub` lists pages and media.
- **0 console or page errors.**

**elktours (the NEW source: house-editor binds from H1).**
- `/studio/canvas-test` mounts the canvas on the starting document: section heading + text. The page pill, the right panel (Properties/Tweaks, layer tree, contract fields, Size, Layout) and a disabled Save all show.
- `/studio/canvas-test/blocks` loads Puck signed in.
- **0 errors.**
- "Settings…" was not reached by the script's click: the section heading has parts, so Settings may sit in the block's "…" menu. Not checked by hand.

## H1b HE + innergathering (2026-11-20)
Source only; no rebuild, restart, DB write or commit.

- **hidden-enneagram**: components/studio/CanvasEditor.tsx 162->71, page-editor.tsx 102->74 (HouseEditor / HouseWholePage binds); lib/puck/actions.ts uses createSavePageAction (same gate, message, ROUTE_SLUGS rule, strip+cleanBoxDoc, revalidate; now takes expectedUpdatedAt); store.ts adds loadPageWithVersion and savePage(expected); both studio routes pass `version`. Kept: prepare=boxify, presets, TEMPLATE_NOTICE, flags inception:false (as before), Puck handBack off.
- **innergathering**: CanvasEditor.tsx 69->41, PuckEditor.tsx 25->15 (HouseEditor / HouseWholePage); actions.ts via factory (gate, revalidate /p/<slug>, cleanBoxDoc kept); store.ts + both routes (/studio/<slug>, /studio/<slug>/canvas) pass version. Flags designTools:false, inception:false (as before), hostStyle paddingTop 44, no editor-shape config so no "Settings...".
  - resolvedKeys {"thread-feed":["items"]} (its only resolving block). Difference: the canvas used to mark every prop of every node as resolved; now only `items`. Saves now strip thread-feed `items` (previously stored; the published page resolves it again).
  - Landing "Edit page" (components/landing/page-editor-mount.ts) now uses openHouseLanding (designTools:false, classes inView, restore kept). Landing version is NOT read, so its first save is unguarded; later saves hold the version. Threading it = loadPageWithVersion in app/page.tsx + EditPageButton prop.
- **API addition** (optional, default unchanged): HouseFlags.sheetParts (default true) in house-editor open.ts. HE sets false so the settings sheet has no parts plugin, as today.
- Symlinks (hand-made, no pnpm install; lockfile not updated): apps/hidden-enneagram/node_modules/@elkdonis/house-editor, apps/innergathering/node_modules/@elkdonis/house-editor. package.json dep and next.config transpilePackages added in both.
- tsc: 0 `error TS` in house-editor, hidden-enneagram, innergathering, sunjay, elktours. Direct-edit harness not run; not browser-tested.
- Innergathering canvas-first (not done): make `/studio/<slug>` the canvas with routes.blocks `/studio/<slug>/blocks`; move the Puck page to `[slug]/blocks/page.tsx`; make `[slug]/canvas` redirect to `/studio/<slug>`; update links to /studio/<slug> (manage/builder, canvas blockEditorHref, requireOrgEditor return paths); add puckConfig (+ contract if wanted) to the loader so "Settings..." appears, and flip designTools/inception to taste; add a page list for HousePages.


## Fields lens pilot B+C (2026-11-20)

Source only: no rebuild, no restart, no DB write, no commit. tsc (error TS count): packages/house-editor 0, packages/live-editor 0 (unchanged), apps/sunjay 0.

**Design (Justin: "B and C together").** B: a declared short text field (`inline: true`) is typed in place, plain text, Enter/blur saves, Esc cancels. C: any other field, or any field of a record, opens a right panel listing ALL declared fields of that `kind:id`, focused on the clicked one (Save, Cancel, Clear, "Edit the look..."). An "Edit page / Done" bar switches the lens on and off. Cue = dashed teal underline plus a floating "field" tag, not the canvas selection box.

**Files (all new unless noted)**
- `packages/house-editor/src/fields/registry.ts`: `defineFields`, `FieldSpec` (extends live-editor `FieldDef`, adds `rich | boolean | color`, `inline`, `max`, `optional`, `readOnly`), `parseFieldRef`, `resolveFields`, `checkValue`, `linkOk`. Pure data, server-safe.
- `.../fields/save.ts`: `createFieldsActions({registry, authorize, perform?, routes, declines?})` gives `load` and `save`: allow-list, per-field validation, stale check (`version`), capability runner or host fallback.
- `.../fields/FieldsLens.tsx` (client): bar, cue, inline editing, side panel, lazy cms-ui `RichTextEditor`, picture chooser hook, notices, stale "Reload".
- `.../fields/index.ts` (client barrel), `.../fields/server.ts` (server barrel).
- `packages/house-editor/package.json` (edited): exports `./fields`, `./fields/server`; dependencies `@elkdonis/cms-ui`, `@elkdonis/live-editor` (pnpm-lock NOT updated; run `pnpm install` when allowed).
- Symlinks: `packages/house-editor/node_modules/@elkdonis/cms-ui -> ../../../cms-ui`, `.../live-editor -> ../../../live-editor`.
- sunjay (new): `src/lib/fields.ts` (registry), `src/app/fields/actions.ts` (server actions; saves via `runHubAction` -> `performHubAction` -> runner `site-section-save`), `src/components/fields/FieldsLensGate.tsx` (server, editors only), `src/components/fields/FieldsLensMount.tsx` (client).
- sunjay (edited, small): `src/app/page.tsx`, `src/app/about/page.tsx`, `src/components/site-footer.tsx` (data-field attributes; footer also renders the gate).

**Pilot fields (section copy, org_site_sections)**
- `section:hero:eyebrow|title` (inline), `section:hero:subtitle` (panel), `section:about:body` (panel), `section:footer:body|note` (inline).
- Not declared: `about.title` (a slot, but no page draws it), `materials.body` on /community (not a slot, the runner would refuse), visiting/resources slots (no page draws them).
- Home: only the code-drawn branch carries data-field. Once `puck:landing` is saved the words are canvas text and have no data-field (one writer).

**Retire `/manage/pages`:** the lens now covers hero, about and footer. Remaining un-covered copy: materials.body. When that becomes a slot (or a Puck block), remove the SectionEditor form in `app/manage/pages`, `saveSectionAction` in `lib/cms/actions.ts`, and the link to it; the Site Builder hub card already writes the same table through the same runner.

## PM: Fields lens signed-in check on a sunjay dev copy (2026-11-20)

**Setup.** The test account got the guide role on sunjay too. The sunjay dev copy ran on localhost:4022 (`INTER_APP_JWT_SECRET=`, `NEXT_PUBLIC_APP_URL=http://localhost:4022`). Script: `~/scratch/he-test/lens.cjs`; screenshots: `out-lens/`.

**What passed on `/about`:**
- 5 declared fields: hero eyebrow and subtitle, about body, footer body and note.
- The "Edit wording" bar shows for the editor.
- The cue is a dashed teal underline plus a "field · Main line" tag.
- B: a click makes the field editable in place; Esc restores the text.
- Enter sends the save as a server action. The script intercepted and aborted it, and the bar showed "Could not save. Try again."
- C: the panel "Banner wording" lists the three hero fields with their live values, focused on the clicked one. It has Clear per field, Save disabled until there is a change, Cancel and "Edit the look…".
- Done turns editing off.
- A visitor (no cookies) sees no bar, only the inert `data-field` attributes.
- 1 console error: the save that was deliberately aborted.

**Not yet run:**
- A real save round trip. It writes live sunjay wording, so it waits for Justins OK.
- The stale path.
- The rich and image inputs: no pilot field uses them.

Dev copy stopped; next-env.d.ts restored.

## Rollout (Justin: sunjay and innergathering first)
- 03:24 EST sunjay LIVE, build 5JX6yVz3HarDrl6OSjLCJ. Previous build backed up at ~/eac-backups/next/sunjay-20261120-0323.tgz.
  - Ships: the H1 house-editor bind with the stale-save guard, the Fields lens pilot ("Edit wording"), and the data-driven menu with its Menu tab. Also ships shared packages since 11-17, including other sessions: cms-ui surface, studio wordart, gradients.
  - Checks, signed out: / /about /community /publications all 200; /studio and /hub send visitors to login; visitors see no lens bar; the footer differs only by data-field attributes and the note <span>; no log errors.
- innergathering: to build after its Site style work is reviewed.

## innergathering Site style (2026-11-20)
Source only: nothing rebuilt, restarted, migrated or committed.
- Added: apps/innergathering/src/lib/site-style-schema.ts, site-style.ts, site-style-actions.ts; src/components/site-style/SiteStyleButton.tsx.
- Changed: app/layout.tsx (loads style in the existing Promise.all; one <style data-site-style> only when saved; button only when viewer.canEdit), components/site-header.tsx, site-footer.tsx (data-chrome / data-part only). package.json, next.config.ts and the node_modules/@elkdonis/direct-edit symlink already existed; no symlinks made, no lockfile edit.
- Theme: site_themes (org inner_group, page_key empty) + site_config site-style:chrome. Vars: background (also replaces the body gradient when set), foreground, muted-foreground, card, secondary, muted, primary, primary-foreground, gold, smoke, border, body font, heading font (h1-h4), radius. Defaults checked equal to globals.css :root (12 of 12, 0 mismatches; font stacks match body and h1-h4 rules).
- Chrome: header parts brand (wordmark span), links (every nav link), account (Account/Web-Portal button), menu (phone toggle + sheet); footer parts social, contact, cta (Leave a Message), legal. Chrome rules are !important so they beat the literal hex in globals.css.
- Gate: getApiEditor (owner/guide of inner_group), re-checked in the action; revalidatePath("/", "layout"). Button hidden on /studio /manage /hub /account, and while any non-button data-de-ui element (canvas bars) is in the DOM. Bottom left, above Edit page.
- Visitor unchanged: org has no site_themes row and no site-style:chrome row (read-only psql); siteStyleCss returns "" for null so no <style>, no font link.
- Dark: nothing on this site sets .dark and there is no OS-dark rule, so all visitors see the light palette; saved html:root (0,1,1) out-ranks .dark (0,1,0) anyway.
- Rendering: root layout already force-dynamic and reads getViewer; prerender-manifest.json in eac-innergathering lists only /_global-error. No route changed mode.
- Not covered: hex-literal marketing/landing/workshop/about pages follow only the shared vars; landing hero has its own header (not a chrome region). Footer contact dialog colours untouched.
- Later: header nav is a code array in site-header.tsx (feeds from org_feeds + About, then member doors by session); loadSiteNav could feed the code part, feeds already data. tsc: 0 error TS.
- 03:33 EST innergathering LIVE, build sCIOYEh7D-XLdBQy9mEzN. Previous build backed up at ~/eac-backups/next/innergathering-20261120-0332.tgz.
  - Ships: the H1b house-editor binds with the stale-save guard (landing first save unguarded), and Site style for header and footer (org inner_group; nothing emitted until a style is saved).
  - Checks, signed out: / 200, /about 200, /center 307 and /workshops 404 (same as before the build). Header and footer markup is identical apart from data-chrome/part. No data-site-style emitted. No log errors.

## innergathering: hard-coded CSS made stylable (2026-11-20)
Source only: no rebuild, restart, DB write or commit.
- Converted 449 literals in LIVE rules: 232 hex, 136 rgba, 73 font stacks, 8 Tailwind arbitrary colours. Files: app/globals.css, app/landing.css, components/landing/offering-call.css, components/site-footer.tsx, app/page.tsx, app/about/page.tsx, components/feed-banner.tsx. Defaults live in one `:root` block in globals.css; schema in new lib/site-style-ig-vars.ts, spread into site-style-schema.ts.
- 41 colour variables (--ig-c-*, kind color, grouped by palette family), 5 font variables (--ig-font-*) plus the existing --site-font-heading/body now used by the literal Venture/Basteleur stacks. 88 translucent --ig-a-* variables (exact rgba) and 2 odd font stacks are defined but NOT in the editor: no schema kind holds alpha.
- Landing hero is now chrome region "hero" (data-chrome on the header, data-part eyebrow/title/subtitle/tagline/cta/signin).
- Not converted: dead landing.css rules (~170 unused classes; 258 rules skipped, list /tmp/igconv/skipped.txt), unused components/landing/WorkQuestion.tsx, `@theme inline`, `.dark`, editor UI (SiteStyleButton, EditPageButton), studio/**.
- Check: every replaced literal vs its default, 449/449 equal; restoring defaults reproduces each original file. tsc 0 error TS.
- Editor now has about 60 theme controls; a "More colours" fold would help (not built).
- 04:16 EST innergathering LIVE, build p9cf9HlR4p0buLhHJhg4P. Hard-coded CSS made stylable: 449 literals converted, 41 colour + 5 font vars in the editor, and a Landing hero chrome region.
  - Pixel check: 9 pages x desktop/phone, signed out, live. The before baseline was stable (before vs before2 identical), and before vs after was ALL SAME (18/18). Scripts: ~/scratch/he-test/{shoot.sh,shots.cjs,pixdiff.py}.

## innergathering lean-up (2026-11-20)

Source only: no DB writes, no rebuild, no commit, no pnpm install. tsc (`apps/innergathering`) clean after every batch.

- Batch 1: deleted `components/manage/compose-launcher.tsx` (77), `components/landing/WorkQuestion.tsx` (110), `lib/page-edits-actions.ts` (18), `components/ui/{dialog,form,popover,radio-group,separator,sheet,tooltip}.tsx`. Removed from `lib/landing.ts` the whole "threads on the landing" section (`listFeaturedThreads`, `listMiniFeed`, `LandingThread`, `Row`, `map`, `COLS`; -113) and from `lib/data.ts` `getNextInFeed`, `getThreadsByAuthor` (-35). Unexported (kept the code) `postFormSchema`, `meetingFormSchema`, `forumHrefs`, `torontoInputToDate`, `emailRoutes`, `OidcClient`, `ValidatedAuthCode`, `signHs256`, `MemberCard`, `GuideSocialLink`, `EDITOR_ROLES`. KEPT the four server actions (`loadPieceListingAction`, `setPieceListingAction`, `getStoreStateAction`, `setStoreSectionAction`): all are registered in the atlas. Atlas still lists `page-edits-actions.ts` (`orgapps.editing.ts:167`); regenerate it.
- Batch 2: deleted `app/manage/compose/page.tsx` (45) and `components/manage/compose-workspace.tsx` (69); `questionnaire-actions.ts:32` now `/hub/compose`.
- Batch 3: `getLandingConfig` no longer reads `initiative`, `featured_artist`, `featured_events`; types removed. DB rows untouched.
- Batch 5: deleted `.next.bak.20260920161658` (212 MB). tsconfig left as is (dot-dirs are not matched by `**/*`).
- Batch 4: removed 20 deps from `package.json` (dnd-kit x3, tiptap x6, excalidraw, hookform/resolvers, react-hook-form, date-fns, six scoped radix, @elkdonis/types). Lockfile NOT updated; needs `pnpm install` in the dev image. `@elkdonis/types` still named in `next.config.ts` transpilePackages (left, another agent's file).
- Batch 6: `landing.css` 4049 -> 1815 lines (311 dead rules plus 7 unreferenced @keyframes). Rule dead only if every selector names an unused class (exact token, template-prefix aware, across src + packages/*/src), restricted to classes in the earlier agent's skipped list or the initiative/grant/philosophy/signup/cwq/wq/fundraising/featured/inquiry/mantine families. Rules with a mix of dead and live selectors kept (18). Kept `--mantine-font-family*` vars (packages/ui workshop-ui reads one). Kept `:root` in globals.css. Backup of the old file: `/tmp/landing.orig.css` on eris.
- Batch 7: deleted `app/api/center/quotes/route.ts` (zero code references; atlas already marks it dead).
- Batch 8 not done: `Dockerfile.prod`, `scripts/status-production.sh`, `scripts/migrate-production.sh`, `apps/inner-gathering` workspace.
- Screenshot: `/`, `/about`, `/forum`, `/hub`, `/hub/compose`, `/manage`, `/center`, `/login`, `/offerings/<slug>`, `/blog`; desktop and phone. `/manage/compose` and `/api/center/quotes` now 404.

## Rollout, round 2 (2026-11-20 ~10:10-10:40 EST)
- hidden-enneagram LIVE: build SpPQmnH56DRpw0_bpueaj. Pixel check ALL SAME.
- arts-collective LIVE: build Ut_IKLxk28Kj3Rlft7hoE (Silex doors hidden). Screenshots never finished loading (networkidle never reached); pages 200, no errors.
- elktours LIVE: build zb31UIiGgHxGuWBWQL-i0, after an auto-restore that was a false alarm. The only difference is the phone home box at (32,403)-(366,653), which also changes between baselines.
- art-auction LIVE: build TT3FgHvUtDTQbpC32r9JG (Site style), after an auto-restore that was a false alarm. Differences are the rotating artwork carousel and the auction countdown; layout and colours checked identical by eye.
- innergathering lean-up LIVE: build oIAZV1BsyF4EHhV-GjuQJ. 18/18 pixel-identical; /manage/compose and /api/center/quotes now 404.
- Lesson: rollout.sh auto-restore needs a noise mask for live carousels and countdowns.

## Site style: folds + alpha colour (2026-11-20)

Source only (no rebuild, no DB writes, no commit). Two additive features in `packages/direct-edit/src/site/`:

- **Folds.** `SiteVar.fold?: string`. A group whose first variable has `fold` is drawn closed inside a `<details data-site-style-fold>` titled with that string; groups sharing a title share one disclosure (summary shows "(n changed)"). No `fold`: rendered exactly as before.
- **`kind: "rgba"`.** Accepts `rgba()/rgb()`, `#rrggbb`, `#rrggbbaa` (validated in `cleanVar`, stored trimmed and otherwise untouched). Editor control: colour picker + opacity % + exact-string text field; picker/opacity write `rgba(r, g, b, a)`. Emitted on `html:root` like every other theme var. New exports: `rgbaParts`, `rgbaString`. `varHex` returns the base colour for rgba.
- Files: `site/style.ts`, `site/SiteStyleEditor.tsx`, `site/index.ts` (tree-editor.ts and mount.ts untouched).

innergathering: the 7 `Palette · ...` groups (41 vars) carry `fold: "More colours"`; 88 `--ig-a-*` vars in new `src/lib/site-style-ig-alpha.ts` (groups Translucent · Navy 20, Gold 18, Other golds 14, Paper and light 20, Dark grounds and black 8, Blue/violet/red 8; fold "Translucent colours"), each with a usage hint. The original 14 controls and 5 fonts stay open. Check: `node apps/innergathering/scripts/check-ig-alpha-defaults.mjs` gives ":root 88, schema 88, mismatches 0". Not added: the 2 odd font stacks (`--ig-font-x-*`). With no saved style nothing is emitted, as before.

tsc clean: direct-edit, innergathering, sunjay, katie-the-potter, elktours, hidden-enneagram, art-auction.
- 10:53 EST innergathering LIVE, build QhmG2ZP3lhmmQpajMZ9vA: Site style folds plus the rgba kind (41 palette colours under More colours; 88 translucent colours editable). 18/18 pixel-identical; no log errors.

## Chores (2026-11-20)
- Dockerfile.prod: whole file built only apps/inner-gathering, so git rm (unused per ops.md). status-production.sh:31 line removed; migrate-production.sh exec on inner-gathering-prod replaced by an echo (its "Migrations complete" message is now misleading).
- apps/inner-gathering git mv to archive/inner-gathering; pnpm-workspace.yaml is apps/* + packages/* only. No live imports; only comments, docs, rules, README:103. pnpm-lock.yaml:1953 still lists the importer (no install run). scripts/workspace-graph/build.mjs:35 still lists it as retired.
- Atlas inventory regenerated; atlas:check still fails. Fixed: orgapps.editing.ts:167 (savePageEditsAction host), apps.innergathering.center.ts ignored center/quotes entry. Left: apps.inner-gathering.legacy.ts (101 ignored keys now not in inventory), orgapps.commerce.shop.ts:227-228 (2 claimed workshop-join keys), danamccool 2 claimed sql keys, 12 needs-review rows (not touched). Atlas check-types passes.

## Title colour fix (2026-11-20)
- Cause: the hero title and header wordmark carry their own colours (--ig-c-navy-deep, gold), so a Whole-region Text colour never reached them. Editor click-to-pick and part colour were verified working on a dev copy.
- Fix: an opt-in ChromeRegion.cascadeColor in direct-edit/site. The region root colour is emitted as [data-chrome=r] [data-part] before part rules, and part colours still win. Enabled for innergathering hero, header and footer. elktours (which has saved nav/footer root colours) is unaffected.
- LIVE 11:30 EST, build CzSa7HWC-9yC3rj__Vu-b. 18/18 pixel-identical.
- Trial pages deleted (whats-on, try-it, showcase). Backup at ~/eac-backups/innergathering-trial-pages-20261120.json.
- Stray PROGRESS block removed. Backup of the file at /tmp/PROGRESS.bak.md.
- Test account: also guide on inner_group.

## elktours tour media: folders and DB (2026-11-20, proposal only)
From the session "Tour media folder structure". Nothing changed in code, DB or Nextcloud.
- State (read-only queries + WebDAV listing): `EAC_Network/elktours/Stops/<TOUR>/` (12 folders, ~100 files) is read per request by `apps/elktours/src/lib/stop-folder-photos.ts` (name matching, Commons credit lookup); no DB row refers to these files. `tour_assets` (migrations 233/235/237) already carries `thread_id` / `stop_id` / `place_id`; 228 elktours rows, none with `place_id`. Places are shared: 102 stops -> 88 places.
- Proposal (awaiting Justin): DB rows in `tour_assets` decide what a file belongs to; folders are filing. `Places/<place-slug>/` for place photos (reused by every tour), `Tours/<tour-slug>/` for cover/hero/tour-only photos, `Tours/<tour-slug>/Private/` for guide notes and documents. A scan step registers new files as hidden `tour_assets` rows with credit stored once. Picker for a stop gets tabs: this stop's place, this tour, all site files.
- Overlap with the house editor: only the picture chooser. If built, the place/tour tabs would go through cms-ui `MediaPicker` `libraries` (and so `makeChoosePicture` / HouseEditor `choosePicture`), not a new chooser. No house-editor file is needed.
- Found: `Stops/Financial Admin Assistance Resources FRANCE Enterprise/` holds 4 PDFs with no `Private/` segment; anonymous GET of one through elktours `/api/media` returned 200 application/pdf (verified 2026-11-20). Not moved; waiting on Justin.
