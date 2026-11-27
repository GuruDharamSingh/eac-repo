# INPLACE: one window, no popup (2026-11-23)

Source only. No commit, no live rebuild or restart, no database write, nothing posted.

## Gestures now
- Click selects the block. Double-click on a block goes one level in, in place: the part under the pointer is selected, same panel, the rest of the page drawn quieter (a shadow on the click sheet; block box and page height measured identical). A click on another part of that block selects it directly.
- Double-click on a part already selected acts on its words: typed in place when the block keeps them as a setting; from a record, the Fields lens's own panel opens (its load, save and warning line); otherwise one plain line says why. A double-click where no part sits also says so.
- Esc: words, part, block, nothing; one press each. The hint line says all this for what is selected. A repeating part reads "Card title: applies to every card title in this block (3)." Looks are stored once per part name; no block stores a look per repeat.

## Where the popup can still open
House editor: nowhere (`largeView`, default off in `mountTreePage`; `flags.largeView` in house-editor). Still reachable, not house editor: katie-the-potter `page-editor.tsx` and elktours `mobile-page-editor.tsx` pass `popup:` to Puck themselves (left for your call). The development app's sandbox calls `openStudioPopup` (same opener as `openBlockPopup`); neither touched, the switch sits at the callers. Checked by reading and tsc only.

## Files
direct-edit: `canvas/tree-editor.ts`, `canvas/clickthrough.ts` (pick, up, veil hooks), `puck/mount.ts`, `direct-edit.css`. house-editor: `open.ts`, `landing.ts`, `HouseWholePage.tsx` (popup off, `recordFields`), `fields/FieldsLens.tsx` (`RecordFieldPanel`), `fields/open-record.tsx` (new), `fields/index.ts`. elktours: `tour-card.tsx` (part classes, `data-words-from`), `tour-cards-block.tsx` (six repeating parts), `page-editor-mount.ts`, `lib/tour-fields-registry.ts` (warning says it changes the tour everywhere). Harness: new `inplace.ts`, `inplace.html`, `drive18-inplace.cjs`; `drive17-resize`, `drive14-hand`, `drive14-tools` updated to the new gestures.

## Counts, before then after
check-steps 143/143, check-fields 155/155, check-look 202/202, drive17 34/0 then 34/0, drive18 new 43/0 (failed before), drive13 416/7 then 416/7, drive14 197/4 then 236/2. tsc 0 in all eight projects.

## Signed in on elktours: NOT DONE
The test account is now `viewer` on elktours (read from the database in my throwaway container; still guide on the other three): no Edit button, /manage redirects. I did not work around it. A production build ran in a one-off copy (now removed): signed in, the landing draws three cards with the new parts. Ready once the role is restored (a database write, your go): `~/scratch/manjushri/inplace/elk/elk-inplace.cjs`, `serve-inplace.sh`, `run-elk.sh`.
Stand-in instead (headless, real canvas, real lens panel, elktours' real registry, stub load and save): no popup, part selected, "applies to every" line, title colour changed all three cards (stored once), Esc ladder, record panel with warning line and the title, Save reached the lens's save, typed heading types in place, phone width opens, zero console errors. Shots `~/scratch/manjushri/inplace/shots/ip-1..4`, copied to the scratchpad.

## Record step
Wired for tour titles (the lens already had a tour door). Missing: signed-in confirmation. After Save the card text updates, but the canvas draws from rows fetched at open, so a later redraw can show the old title until reload.

## Decided myself / slips
`data-words-from` puts tour ids in public HTML. First start of the throwaway copy had the reminder timer on about a minute (it only claims unclaimed due reminders; the live server claims them). A `docker exec` into live `eac-elktours` was refused and not retried. The popup's click fault: not looked for.

## Sunjay signed in (2026-11-23, follow-up)
Throwaway production copy (port 4026, timers off from the first start, every non-GET aborted, removed). 24 ok, 0 fail, zero console errors. Landing: double-click on Next gathering's title goes in (no popup, part selected, page quieter, hint line); one click on another part selects it; forum topic titles (several): colour changed every one, panel says it applies to every; Esc gives block then nothing; phone width opens. On /studio: typed banner title goes in then types in place, Esc keeps the part; the settings sheet offers no "Edit look" or large view. Shots: `~/scratch/manjushri/inplace/sunjay/` and the scratchpad copy.
Not possible: the lens panel and Save on a gathering. Sunjay's landing editor passes no record door and its cards (shared `SurfaceCard`) carry no record id, so the canvas says the site does not say which record; a gathering is read only in the lens anyway. Needs a card change you decide.
Changed: the repeat line also shows for a part drawn more than once (my narrowing had dropped it); drive18 43/0, drive14 236/2 unchanged.
Popup `popup:` still passed at `apps/katie-the-potter/src/components/studio/page-editor.tsx:28` and `apps/elktours/src/components/studio/mobile-page-editor.tsx:23`.
