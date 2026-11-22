# Session dump: what was done, why and how (2026-11-20 to 2026-11-22)

Manjushri (Claude, Justin's session system32-10). The dated record with build ids is `LEDGER.md`; intentions and next steps are `HANDOFF.md`; the review is `REORIENT.md`. This file is the plain account.

## What Justin asked for at the start
Get to know the repo and the house editor; understand what Puck really is; make Puck and the React blocks serve the look editor (direct edit) without breaking content; develop the on-page field editor; make every block reachable by assistants and the courses layer. Use sub-agents; show the work in the development app.

## What was done, in order

**1. Research (three Sonnet lanes, read-only).** Puck 0.23 was read from its shipped code: it is a saved list of blocks, an engine for rearranging them, and a studio; only a block's own settings reach the public page; its engine runs with no Puck screen (verified by a run, again on 0.24). The look layer was mapped: four look formats that do not know about each other. Field systems were mapped: eight, with four different "who may save" checks. Output: `puck-internals.md`, `aesthetic-layer.md`, `fields-and-mcp.md`, `DOCTRINE.md`.
Why: to know what could be taken over safely before building on it.

**2. Wave 1 build (three lanes, reviewed, live 2026-11-20).** A crash trap closed (a look on a part named like a slot); looks can vary on hover, focus, press and at phone and tablet widths; one reader over the look formats; one checked door for every change to a page (`packages/house-editor/src/steps`); drafts for org pages; the on-page editor reaching text inside blocks; a list of all blocks for assistants and six read tools; a Sites tab in the development app.
How: each lane wrote a failing check first, an independent reviewer read the result, the PM re-ran every check, then sites were rebuilt one at a time with before-and-after screenshots.

**3. A live fault found and fixed.** The "page changed since you opened it" guard never matched, so page saves were refused on five sites. Fixed in source, rebuilt on three sites and patched in place on two, then properly rebuilt.

**4. Wave 2 (three lanes, reviewed, live 2026-11-21).** The Sites tab edits and publishes pages made of any block; the development org with its own pages; assistant draft tools (switched off: no key allows drafting yet); "When" and "Screen" switches in the real look panel; on-page editing on three more sites.

**5. elktours, block forward (2026-11-21).** The landing title became a real block; seven phone and landing pieces became blocks with settings (page buttons, phone menu, favourite places, guides, experiences, tour list, header cover); Booking options and Map / locations blocks; a neutral model for the stage so a workshop could use it; on-page editing of the phone tour page with one previous version kept; a picture picker with libraries and a media menu that registers pictures where they sit; 46 pictures registered (hidden); the editor page now shrinks beside its panel instead of reflowing.

**6. innergathering (2026-11-21 to 22).** Current offerings and The Grand Forum became real blocks. This shipped untested signed in and broke the editor; it was rolled back, the three faults were found and fixed on a signed-in test copy, and it shipped again. Stored looks are now drawn there.

**7. Closing work.** Two idea pages in the development app; the block list refreshed (192 blocks); the action atlas regenerated; a shared board with the house-editor PM; the review (`REORIENT.md`) and the handoff.

## What I got wrong
- I divided the editors by job (look, words, settings). Justin's rule is the reverse: any editor may change anything, each value has one home. Several things he hit follow from my division.
- I shipped editor changes on a signed-out screenshot check. It cannot see the editor. Nothing touching an editor ships now without a signed-in look on a test copy.
- I built a three-panel editing UI in the development app beside the house editor instead of using the house editor.
- I approved a picture picker that hid the pictures he had just sorted into folders.
- My first rollback of Dana's site was a false alarm I should have checked before acting.

## What is not done
See `HANDOFF.md` section 6. Chief among them: the direct editor writing settings (the banner height); words typed on the canvas; one panel with no settings pop-up; gradients in the look panel (designed, needs an install); About as its own page; Join and other code-drawn pieces as blocks; a key for assistant drafts; the conventions deck, the design skill and the page sheet (sections 8 to 10, proposals only).

## Proposed next session (Justin, 2026-11-22): the code map
"another full inventory and review pass to bulk up what block library currently shows, what components there are and how they wire, map, and making it visible as /codemap on /development ... like atlas."
My view: yes, and it should come before the conventions deck, because the deck's cards need it. Shape: one generated map with three layers that already exist separately: components (what is built once: content library, directory, search, forms, the stage), their faces (blocks, pickers, hub cards, assistant tools: the block list has the blocks), and actions (the atlas has who may do what). The new work is joining them and finding the components and their faces from imports. Drawn in the development app as a map he can click: a component, its faces, where each face is used, what it reads, which actions it triggers. Generated by script so it cannot go stale; checked like the atlas. An earlier session of his worked on codebase graphing: look for its output before starting.
The conventions deck then sits on top: a menu of decks, cards with live exhibits, and a review view that keeps his answers beside the agent's follow-up thinking, so a fresh agent can read the whole exchange later. Names first, then themes.
