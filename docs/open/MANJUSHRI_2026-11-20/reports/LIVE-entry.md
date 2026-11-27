# LIVE-entry: one Edit button, Live edit (2026-11-23)

Source only. No commit, no live rebuild or restart, no database write, nothing posted. Containers I started (throwaway sunjay and elktours copies, harness browsers) are removed; none left.

## What it does
- One round Edit button (`@elkdonis/house-editor/entry`, `<EditEntry>`), bottom left, replaces "Edit page", "Site style" and "Edit wording" on sunjay and elktours. Hover (mouse), click or tap (stays open), Enter or Space opens; two smaller blobs bud out through a goo filter: **Live edit** and **Edit page**. Esc, a press elsewhere, or choosing folds them back. Reduced motion: no filter, they just appear. Visitors and people without edit rights get no button and no markup (the layout gate is unchanged).
- **Edit page**: the in-place page editor on the home page (sunjay, elktours). On any other page it goes to the studio link that page already shows as "Edit this page" (as today); if the page has none (e.g. /about) the child is not offered.
- **Site style is a button in the page editor's edit bar** ("Site style"), hosting the unchanged `SiteStyleEditor` and its own save in the right-hand column (330 wide, same place as the panel). Where Edit page leaves the page (no in-place editor), Site style is a small third blob, so it is never lost. The `/?site-style=1` hub link still opens it.
- **Live edit**: pencil cursor over editable things, tool strip at the pointer, slim bar (Live edit is on, Show pencils switch, Done), right-click content info (read only, plain words), pencils off by default, Esc or Done leaves. Roles are the lens's own checks (`editable()`, server `authorize`).
  - words: Edit words in place (Enter saves, Esc drops) or Open in the panel; rich words: Bold, Italic, Link, Save (sunjay only, where the site gives the safe cleaner).
  - picture: Upload a new photo, Choose from the library (the site's own MediaPicker, `/api/upload`, tabs Upload / This site / My files), Describe it (greyed with a plain line when the block has no description setting; the banner has none).
  - record field: Edit this field (the lens's panel, warning line, own save) and Where this comes from.
  - Never a silent click: a thing that looks like a field but is not says why.

## Per site
- sunjay: all of the above. Pictures and rich words work.
- elktours: wired the same; I gave its lens the site's picture chooser (it had none, so pictures were not offered before). No rich words (no cleaner passed). Tour titles open the tour's field with its warning.
- Missing: elktours upload only through that chooser; nothing invented.

## Checks, before then after
check-steps 143/143, check-fields 155/155, check-look 202/202, drive17 34/0, drive18 43/0, drive13 416/7, drive14 236/2: all identical after. tsc 0 in all eight projects. New harness `drive19-entry` (real button and lens, stub saves): 61/0.

## Seen signed in (throwaway production copies, timers off, every non-GET aborted, credentials never printed)
- sunjay, 1440 and 390: 50 ok, 0 fail, zero console errors (only the aborted fetches). Button, children, keyboard, Live edit on /try (39 editable things, strips, typed heading: load request aborted, old words restored with a plain line; picture upload control present, not used; right-click info on words, block box, picture; pencils on and off; Esc), Edit page, Site style in the column, third blob on /about, signed out: no button.
- elktours: viewer and signed out, 1440 and 390: 9 ok, 0 fail; no button, page draws. Not seen as an editor (the test account is a viewer there), so the phone lift (72px above its bottom bar) is unseen.
- Shots: `~/scratch/manjushri/live/shots/` and the scratchpad copy.

## Not built: Puck's settings form in the Content tab
Not a mount-point change. The sheet is a whole `<Puck>` (header, canvas, fields) in a modal that resolves Apply or Cancel (`block-settings.tsx`); the Content tab is plain-DOM HTML strings the panel redraws fully on any tab change (`content-tab.ts`, `panel.ts`). It would take: a fields-only mode of the form that applies as you type (form change), a React root hosted in the panel that survives its redraws (Content tab change), and the resolver rows path from `editSettings`.

## Files
house-editor: `src/entry/{EditEntry.tsx,store.ts,site-style.tsx,index.ts}` (new), `src/fields/live.tsx` (new), `src/fields/FieldsLens.tsx`, `src/fields/index.ts`, `src/landing.ts`, `package.json`, `harness/{entry.tsx,entry.html,drive19-entry.cjs}` (new). direct-edit: `canvas/edit-shell.ts`, `canvas/tree-editor.ts`, `puck/mount.ts` (edit-bar button). sunjay and elktours: `components/edit-entry/EditEntryMount.tsx` (new), `landing/EditPageButton.tsx` (now renders nothing, registers the page's editor), `landing/page-editor-mount.ts`, `app/layout.tsx`, `fields/FieldsLensMount.tsx`.

## Decisions and slips
Round blob forced on sunjay despite its square-corner rule. The old floating Site style files stay, unused. The "Edit this page" link remains on builder pages (a second way in). The drivers were written after the code, not before. Save and upload were never sent to production.
