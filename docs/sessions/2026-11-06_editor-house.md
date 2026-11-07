# Handover: the editor house, record-driven blocks and Opens (2026-11-06)

This covers one long session on 2026-11-06 (EST). It took Puck and the direct editor ("canvas") from comparison to a working split, then built site-wide style on elktours, part editing and the block popup in Puck Studio, Featured person, a page builder for elktours, and "Opens". Nothing from this session is committed. elktours and Para Theater (sunjay) were rebuilt during it; elktours last at 21:59 EST with everything below. That build also carried another session's look-panel fix (`direct-edit/src/puck/look-panel.ts`: the tab stays open across Puck remounts; katie-the-potter), checked first with `studio.cjs` 16/16 and `drive-look.cjs` 30/30.

## 1. Agreed model (developer decisions)

- **Who does what.** Puck places blocks; the direct editor shapes their look, like GrapesJS on Puck. The canvas editor stays the house for live pages, with sealed blocks.
  - Double-click a block, in the canvas or in Puck Studio, to open it alone in the block popup.
  - The popup edits look, layout and words, then hands the block back as one undo step.
  - Looks are per page now; versioning comes later; deeper integration later.
- **Developer-only tools.** The Code tab and Detach are for developers only (`developer: false` on sites).
- **Live components are about a record:** a thread, artwork, user, org, store or media item. A block stores only a reference. The platform fills it per request under its visibility rules.
  - One shared "From what?" chooser picks the record.
  - No invented roles and no default person; people who RSVP'd are left out.
  - Choices that follow an evolving record are wanted ("host of the next session").
- **Opens.** A Button, Card or Featured person opens a page or a popup (tour, experience, reviews, person). A reviews or person popup may have one Then step to a page. Opens, when chosen, replaces the typed link.
- **Getting paid** is off the Manage pages (the developer's onboarding is done); it stays in `/hub`.
- **Tour layout studio.** The developer reported that Puck displays poorly at `/studio/tour-detail`, and that the tour page's own live editor (title, summary, price and so on, typed on the page) should come into Puck too. Then they said to set it aside for now. Not started.

## 2. State by piece

| Piece | Where | State (2026-11-06) |
|---|---|---|
| Hidden `morph` field | `packages/page-builder/src/config.tsx` | source; live on sunjay |
| Site style (theme, header and footer looks) | `packages/direct-edit/src/site/`, elktours `lib/site-style*`, `components/site-style/` | live on elktours; first save by the developer 17:58 UTC |
| Parts plugin (in-place part looks in Studio) | `packages/page-builder/src/parts/`, `direct-edit/src/puck/look-panel.ts` | live on sunjay (16:23 EST rebuild) |
| "Edit look" popup from Studio | `page-builder/src/parts/popup.tsx`, `direct-edit/src/puck/studio-popup.ts` | live on sunjay; also on elktours Studio |
| Featured person | `packages/blocks/src/blocks/featured-person.tsx`, `@elkdonis/services/featured-people`, `direct-edit/src/canvas/records.ts` | live on elktours (18:29 EST rebuild) |
| elktours page builder | elktours `app/manage/builder`, `app/studio/[slug]`, `lib/puck/*`, `components/studio/*`, `app/[feed]/page.tsx` | live (21:20 EST rebuild, build `skEkqaiLsbrTEcn1yQJrD`) |
| Getting paid off Manage | elktours `app/manage/tours/page.tsx`, `app/api/payouts/return/route.ts` | live |
| Opens, Card from a record, reviews and person popups | `packages/blocks/src/opens.ts`; elktours `lib/opens*.ts`, `components/surfaces/opens-popups.tsx`, `components/hub/HubSurfaces.tsx` | live (21:59 EST rebuild, build `-PVIsxZUU5FL1j9qx4brR`); the signed-out Stripe return to `/hub` shipped with it |

Nothing has been used signed in on either live site except the developer's own Site style save.

## 3. Where to read

- Briefs and boards:
  - `docs/open/EDIT_LOOK_POPUP_BRIEF_2026-11-06.md` (popup, and section 8: record-driven blocks);
  - `docs/open/COMPONENT_CONNECTIONS_2026-11-06.md` (Opens; section 6 has what was built);
  - `docs/open/CANVAS_FRAMEWORK_2026-11-02.md` (dated sections).
- Harness READMEs:
  - `packages/direct-edit/harness/featured/README.md` (Featured person, page builder, how to run everything);
  - `packages/direct-edit/harness/site-style/README.md`;
  - `packages/direct-edit/harness/frankenstein/README.md` and `PARITY.md` (Puck parity checklist).
- Rules added: `.claude/rules/areas/puck-blocks.md`, the last eight lines dated 2026-11-06; `.claude/rules/areas/db.md`, the last two.
- Artifact: "The Editor House", https://claude.ai/artifact/TnTzpdr4vWUbgt1LKbzhYt (ELI5 recap and decision matrix, v2).

## 4. Verification on record (last runs, 2026-11-06)

- **Featured person and Opens** (`harness/featured/`):
  - `featured.cjs` 48/48, `studio.cjs` 16/16, `opens.cjs` 12/12;
  - `strip.mts` 6/6, `opens-grammar.mts` 17/17;
  - read-only live-database probes: `probe.mts`, `probe-thread.mts`, `published.mts`, `opens-published.mts` 13/13.
- **Studio and the popup** (`harness/frankenstein/`): `drive-popup.cjs` 56/56 on Para Theater's config, rerun after the page-builder change. Earlier in the day: `drive-pkg.cjs` 58/58 and `drive-look.cjs` 30/30.
- **Site style:** `harness/site-style/style.cjs` 38/38.
- **Shared blocks:** the blocks smoke test passes.
- **Type checks:** 0 errors in elktours, sunjay, direct-edit, page-builder and blocks. blocks and services still report errors in files this session did not touch (`services/src/gather.ts`, `utils/src/sanitize*.ts`). Run type checks with a throwaway `docker run --rm … eac-dev` container, not the live app container (`docs/reference/ops.md`).

## 5. Operating notes learned

- **Build sentinel.** Next clears `.next` early, so a failed production build leaves no `BUILD_ID`, and sunjay's start sentinel then loops. Back up first. To restore, extract the tarball into `.next`, as on 2026-11-06 16:20 for sunjay.
- **Backup command.** Do not print anything into the tar stream when backing up (`cat BUILD_ID && tar …` corrupted one archive).
- **`"use client"`.** A page-builder module that uses `useSyncExternalStore` needs `"use client"`. The harness does not catch this; only `next build` does (`parts/store.ts`).
- **Permission system.** It may refuse a production build until the developer approves it in the conversation. Test accounts with roles were refused; do not work around either.
- **Bundling probes.** esbuild resolves `./blocks` in `packages/blocks/src/index.ts` to `blocks.css` unless `.css` is left out of `resolveExtensions` (`bundle-node.cjs`).
- **Harness CSS.** The Studio harness inlines its CSS: Puck's canvas loader did not clear on mirrored `<link>`s in the sandbox.

## 5a. 2026-11-07 (continued, EST)

- **Canvas tree rows drag** (source; live on Para Theater since the 00:55 rebuild below): a page node's layer row can be pulled to before or after another row, or into the middle of a box's row (end of its first slot), with the same rules as a pull on the page (`movePuckNode`), one undo step, Escape cancels. `packages/direct-edit/src/canvas/tree-editor.ts` `dragRow`; `startGhostDrag` (`canvas/interact.ts`) gained an optional inside zone and Escape. Harness `harness/drive15-rows.cjs` 24/24; classifieds `drive.cjs` 43/43 and canvas `drive11.cjs` 56/56 unchanged; `drive13.cjs` 404/408, the four failures all P12 (the hero's picture field starts with a stored sample `data:` picture; not caused by this change, judged by inspection only).
- **Three shared layout blocks** in `packages/blocks` (in `SHARED_BLOCKS`; a site offers them by listing their ids): Sticky side (`sticky-split`, CSS only), Tabs (`tab-set`, up to five, island `tab-set.client.tsx`; every panel shows under its name while editing, because the editors take a click on a tab), Sections that open (`accordion-set`, up to six, `<details>`, one-at-a-time by `name`; all open while editing). Harness `frankenstein/drive-layout.cjs` 25/25 (visitor wide and 390 px, and Puck Studio on Para Theater's config).
- **Para Theater** (sunjay) gained Featured person, Opens and Card from a record, adapted from elktours: `lib/opens.ts` (page, `popup:thread:<id>` opens the site's thread popup, `popup:person:<userId>` with an optional Then), `lib/opens-server.ts` (published, PUBLIC, no `min_role`, kinds meeting/series/post, public feed), `lib/featured-person*.ts`, `components/landing/person-records.ts`, `components/studio/person-picker.tsx`, `components/surfaces/opens-links.ts` + `opens-popups.tsx` (person popup loaded on open), HubSurfaces. Catalogue adds `feature-card`, `featured-person` and the three layout blocks. Save strips through the shared `stripResolvedKeys` now. Read-only probe `featured/sunjay-opens.mts` 32/32 against the live database; `drive-popup.cjs` 56/56.
- **Para Theater rebuilt twice:** 00:53 (`Su8efChCS8E8DaEohJSq3`; backup `~/eac-backups/next/sunjay-20261107-0052.tgz`) and 00:55 (`LV6JlyDxGBLmNBQOy-AN4`; backup of the first at `~/eac-backups/next/sunjay-20261107-0054.tgz`). The first put the blocks catalogue in the root layout's script (+119 KB on every page) because the popup bridge imported `FeaturedPerson`; the second loads the person popup on open. Through the edge after the second: 13 visitor pages 200, same byte sizes as before the session's builds except `/writing/why-we-meditate` (+48); home page script +2.6 KB over the pre-session build. The build also shipped other sessions' Manage page gates (signed-out `/manage` 307 body 32 KB to 14 KB) and their additive Stripe options. Not used signed in.
- **elktours tour popup on a phone** (live since the 2026-11-07 07:18 EST rebuild, build `v8uL5DOJKTGmgM5Ek3dH-`; before that source only): the map sticks under the tab strip while the stops scroll beneath it; a stop picked from a pin lands below the map (`components/tours/tour-story.css` `.tour-popup-map`, `tour-popup.tsx`). Harness `featured/tour-phone.cjs` 14/14 with the live tour's public JSON. The same popup-bridge split as Para Theater (`opens-links.ts`, lazy `opens-popups.tsx`); `opens.cjs` 12/12. The rebuild also shipped other sessions' Stripe changes (`commerce`, `payments`, `checkout`, 2026-11-06 23:25) into elktours' card bookings, on the developer's yes (2026-11-07). Verified through the edge after the rebuild: 13 signed-out pages and the tour JSON keep their status codes; the pages are 1.1-2.0 KB smaller, the text differs only in chunk lists and the build id; home-page script 2,098,172 → 1,989,609 bytes (28 → 26 script tags); the served CSS carries `.tour-popup-map` sticky at `top:2.75rem`. Not verified: a booking paid after the rebuild, a real phone. Backup `~/eac-backups/next/elktours-20261107-0717.tgz`.
- **Zoom gallery** (GSAP from npm, whole-page block): decided, then held by the developer before any work.

## 6. Open items, in the order proposed

1. **Try Opens signed in** on elktours (live since 21:59 EST): a Button that opens "Reviews of …, then its page", a Card filled from a tour, and a Featured person's name opening their popup.
2. **Signed-in checks the developer can do:** Para Theater Studio popup and parts; elktours page builder (create, publish, edit), Featured person and Opens.
3. **Tour layout studio** (`/studio/tour-detail`): the display problem the developer reported, and bringing the tour page's live editing into Puck. Set aside by the developer; first render it in a harness (an attempt stalled on Puck's iframe never appearing, and was removed).
4. **Featured picture:** "From what?" with library, tour cover or film poster, person portrait; read-only first; following choices proposed.
5. **Popup rough edges:**
   - at phone width the block shrinks to 28%;
   - line breaks typed in a step become paragraphs;
   - a step's rich text is only editable in the panel;
   - the current-series card is not wired in the popup.
6. **PARITY.md items:** thin bar, right-click look menu, resize vs Puck drag, Detach for developers.
7. **Site style:** contrast per header part; presets; "Edit page" and Site style open at once.
8. **Later:**
   - versions of blocks and pages;
   - saved looks with a site default per block kind;
   - "this page only, or the thread?" for words that come from data;
   - Opens on parts (a Card's picture vs its title);
   - booking straight from a Then.
9. **Overlap with the katie-the-potter session's work (2026-11-06, read 22:20 EST):**
   - **The record kit.** `@elkdonis/blocks/record` (`docs/reference/record-blocks.md`) adds placement- and width-aware layout for record blocks, plus `stripResolvedKeys`. Done 2026-11-06 22:35 EST; live on elktours since the 2026-11-07 07:18 EST rebuild: elktours' save actions use `stripResolvedKeys` with elktours' own `RESOLVED_KEYS`, and the old walker is removed. Both were first run on the same documents; the shared one removed at least as much in every case. One fix went into the shared strip: a stored key named `__proto__` became the new props object's prototype, and now stays data (`Object.fromEntries`). This also reaches katie-the-potter on its next rebuild. Test: `harness/featured/strip.mts`, 12/12. Still open: Card or Featured person could take `layoutProp` and placement. The kit has no record chooser ("pick one in the panel"); its `binds` props could use "From what?" (`direct-edit/src/canvas/records.ts`).
   - **The org-site kit.** `docs/open/ORG_SITE_KIT_BRIEF_2026-11-06.md` phase 4 (from 11-25) moves elktours' shared `/manage` pages into a package. It must keep the Page builder tab and `/manage/builder`, or list them under "elktours keeps … as files".
10. **Commit**, when asked, only this session's files. The tree holds other sessions' work, including in shared files: `packages/blocks/src/index.ts`, `packages/services/package.json`, `CLAUDE.md`.

## 7. Files this session created or changed (for a scoped commit)

- **packages/blocks:**
  - `src/opens.ts`, `src/blocks/featured-person.tsx` (new);
  - `src/blocks/link-button.tsx`, `src/blocks/feature-card.tsx`, `src/blocks/index.ts` (one export line), `src/index.ts` (one export line), `src/blocks.css` (`.blk-fperson*` at the end), `package.json` (`./contract`, `./opens`).
- **packages/services:** `src/featured-people.ts` (new); `package.json` (`./featured-people`).
- **packages/direct-edit:**
  - `src/canvas/records.ts`, `src/site/*` (new);
  - `src/canvas/tree-editor.ts`, `src/canvas/edit-shell.ts`, `src/puck/mount.ts`, `src/puck/index.ts`, `src/puck/studio-popup.ts`, `src/direct-edit.css` (`.de-rec-*` at the end);
  - `harness/featured/*`, `harness/site-style/*`, `harness/frankenstein/*` (new).
  - The look panel, studio popup and other parts were made by the two delegated agents; see `frankenstein/PARITY.md` and the popup brief.
- **packages/page-builder:**
  - `src/config.tsx` (hidden `morph` field), `src/config.client.tsx` (`NoField` for an unclaimed Opens);
  - `src/parts/*` (agents; `store.ts` got `"use client"`).
- **apps/elktours:**
  - **new:** `lib/opens.ts`, `lib/opens-server.ts`, `lib/featured-person.ts`, `lib/featured-person-actions.ts`, `lib/puck/catalogue.ts`, `lib/puck/resolved.ts`, `lib/puck/reserved.ts`, `lib/puck/render.tsx`, `lib/puck/starts.ts`, `components/landing/person-records.ts`, `components/studio/page-editor.tsx`, `components/studio/person-picker.tsx`, `components/manage/new-page-form.tsx`, `components/surfaces/opens-popups.tsx`, `app/manage/builder/page.tsx`, `app/studio/[slug]/page.tsx`;
  - **Site style files** (section 2);
  - **changed:** `lib/puck/config.client.ts`, `lib/puck/config.server.ts`, `lib/puck/actions.ts`, `lib/puck/store.ts`, `app/page.tsx`, `app/[feed]/page.tsx`, `app/manage/layout.tsx` (Page builder tab), `app/manage/tours/page.tsx`, `app/api/payouts/return/route.ts`, `app/hub/page.tsx` (two comments), `app/layout.tsx`, `components/hub/HubSurfaces.tsx`, `components/landing/EditPageButton.tsx`, `components/landing/page-editor-mount.ts`, `components/site-header.tsx`, `components/site-footer.tsx`.
- **apps/sunjay:** `components/studio/page-editor.tsx` (parts plugin and popup), `blocks/small-blocks.tsx` (`pt-steps` parts; agents).
- **Docs:**
  - `docs/open/EDIT_LOOK_POPUP_BRIEF_2026-11-06.md`, `docs/open/COMPONENT_CONNECTIONS_2026-11-06.md`, this handover (new);
  - `docs/open/CANVAS_FRAMEWORK_2026-11-02.md` and `docs/reference/ops.md` (rows updated);
  - `CLAUDE.md` (current-work lines).
