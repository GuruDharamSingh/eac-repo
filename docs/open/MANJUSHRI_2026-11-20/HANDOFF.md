# Handoff: the house editor, after three days (written 2026-11-22)

From: Manjushri (Claude, Justin's session system32-10). For: the next session that picks this up, and the house-editor PM.
Read this first, then `LEDGER.md` (the exact dated record), then `REORIENT.md` (review, six proposed sessions, ten questions and Justin's answers). The shared board for anyone touching editor code is `docs/open/LIAISON/HOUSE_EDITOR_PM.md`: post there before you take a file.

**This is a draft.** Section 2 is Justin's intentions as I understand them; he is being asked to correct it. Where I am unsure I say so.

## 1. Where Justin is trying to get to (his words)

- "in no way do i want to be reacting to puck ... the react html and css / js is all ours through and through ... good components platform ready first in smart ways, then the blocks are just different wrappers over tiny aspects of those."
- "look, words and media, can be done by all. arranging blocks done by both puck and direct editor, and it doesnt really need to change screens ... if its all the same editor anyways."
- "we need some sort of ledger or system to standardize where css and/or colour values are kept. also enriched text settings ... these two along with fields are core and could probably be elevated to theme and then also live editor function."
- "we arent opening two separate sheets for blocks vs html/css ... one sheet/panel, pop ups arent used so much. we could probably use the puck studio as the basis for this ... copy its layout and design, but have it be ours so we can use our direct editor too."
- "a robust morph / translation system, that performs the surgery between a mocking up window that has very free movement and design, and then moving it to publishing ... (basically publishing a new block). we started on a loft versioning structure."
- "we basically need a rosetta stone of this, and its what could feed into the mcp ability and understanding later."

## 2. The aims, as I understand them (to be corrected by Justin)

1. **One rule for values.** Any editor may change anything; each value has exactly one home. No value is stored in two places, and no editor is locked out of a kind of value.
2. **A ledger of homes (the Rosetta stone).** One description, per site and per block, of where every visible value lives: a colour, a text style, a field. Three levels for looks: the site's theme, a block's or part's own look, one instance. Fields live on the record they belong to, or on the block. The ledger is what the editors, the theme, the live editor and the assistant tools all read. It also answers, on any element, "where does this come from?".
3. **Theme owns the shared things.** Colours and text styles (heading, body, caption and so on) are named at theme level; blocks refer to them; a block's own look is the exception, not the rule.
4. **One editing screen, one panel.** Laid out like Puck's studio (blocks at the side, the page in the middle, one panel for the selected thing) but ours, with the direct editor's free movement inside it. Content, Look and Arrange are tabs of one panel. Pop-ups only for what a panel cannot hold.
5. **Free design, then publish.** A mock-up space with free movement; publishing turns an arrangement into something reusable (a pattern or a new block), with versions kept.
6. **Machines read the same map.** The ledger is what assistant tools and lessons use.

## 3. What exists today that these build on

- **The block manifest** (`packages/mcp/src/manifest/`, 192 blocks): each block's settings, parts, slots, tokens, binds and what it reads from its surroundings. This is the Rosetta stone in embryo. It does not yet record where a colour or text style comes from.
- **The checked door** (`packages/house-editor/src/steps`): every change as a step (words, look, tokens, structure), validated against the block's declaration. The house-editor PM asked for two additions: an `unset` step and choosing a record through the door.
- **Looks** (`packages/direct-edit/src/block/morph.ts`): per part, with hover / focus / press and phone / tablet variants; one reader over the three look formats (`read-look.ts`). Drawn on sunjay, elktours, hidden-enneagram and, since 2026-11-21, innergathering's landing blocks.
- **Site style** (the house-editor PM's): theme variables per site; innergathering has about 60 controls.
- **The live editor** reaching block content on sunjay, elktours, hidden-enneagram, innergathering; record fields on the elktours phone tour page with one previous version kept.
- **A Content tab and Sections** on sunjay (the house-editor PM, live 2026-11-21).
- **Drafts** for org pages; assistant read and draft tools (no draft key minted).
- **Patterns**: only whole-page templates and one hand-made About pattern; no insert step outside sunjay's Sections.
- **Puck's parts can be used without its screen**: its engine runs headless (verified), and its fields panel, block list and outline are separate pieces that can be placed in our own layout (`puck-internals.md`, sections 5 and 7; read from code, not yet tried).

## 4. What went wrong, so it is not repeated

- I divided the editors by job (looks, words, settings). Justin's rule is the opposite. Symptoms he hit: a banner whose height will not drag in the direct editor (height is a setting; the handle writes looks), header text not editable on the canvas, "edit text" offering few fields.
- **Values with two homes** found so far: Puck's Style panel vs the look; a typed title vs the record's title; a banner's height as setting vs look; two undo histories; a tour's previous version vs page versions; innergathering hero wording vs its Manage card; theme colours vs colours written on saved boxes (the Mutual Aid section); unnamed theme colours such as the RSVP panel's cream.
- **Editor changes shipped on a signed-out pixel check** broke the signed-in editor on innergathering (2026-11-21). Rule since: nothing touching an editor ships until seen signed in on a test copy. A test editor account exists (the house-editor PM's), allowed on local copies with saves aborted.
- A stored look can be saved and never drawn if a site's config does not turn looks on. Check per site.

## 5. Live state (2026-11-22)

See the last entries of `LEDGER.md` for build ids. All Puck sites are on 0.24. innergathering is on the block-pass build with looks drawn. Source only, not shipped: gradients in the look panel (designed in `reports/LOOKS-gradient.md`; needs `@elkdonis/gradients` linked into `packages/direct-edit`, an install, and rebuilds); the refreshed assistant manifest (arts-collective not rebuilt since 2026-11-21 09:09); elktours "Stop folders" picker tab (needs an elktours rebuild); 46 elktours pictures registered hidden.

## 6. Open, in the order I would take them

1. The ledger of homes: design it against two real pages (innergathering landing, a Para Theater studio page). Start with colours: every colour on the page, its home, a plain name.
2. The direct editor writes settings through the door (the banner's height), and words can be typed on the canvas.
3. One panel: the Content tab everywhere (the house-editor PM's plan), the Look as a tab beside it, the pop-up sheet retired.
4. Text styles at theme level.
5. Patterns and "publish as a block"; one history.
6. About as its own inline-edited page; Join and the remaining code-drawn pieces on innergathering as blocks.
Smaller: `unset` and record-choosing steps; gradients; the tour page's editing bar may cover Book on the phone; the test account shows publicly under elktours "Your guides"; Dana's art archive sometimes draws collapsed (predates this work); the atlas mismatches in `reports/CLOSEOUT.md`.

## 7. Questions put to Justin on 2026-11-22 (answers to be added here)

1. The ledger: something he sees in the editor ("this colour comes from: Theme, Cream panel", with a way to jump there), a standard that agents follow, or both?
2. Levels: are three enough (site theme, a block's or part's look, this one instance)? And should text styles be a small named set at theme level that blocks refer to?
3. One screen: Puck's studio layout with the direct editor inside it, or the canvas with one tabbed side panel? What must never open as a pop-up?
4. Free design then publish: is the published thing a reusable arrangement (data, usable at once) or a new coded block (written by a developer or an agent, reviewed)? Or the first now and the second later?
5. Who owns what next: he has said the house-editor PM owns the plan. Does this session keep the ledger, the door and the assistant side?

## 8. Aims added by Justin on 2026-11-22 (after the five questions)

His answers, in his words where it matters:

- **"Ledger" was a loose word**, not a technical ask. What he wants is the questions made visible: "apps/development ... is supposed to hold and run ui based surveys for me, a way to see the question or problem visually, and visually or interactively give feedback where or what or how i think it is." So "where does this value live, and where should it" becomes something he answers by looking and clicking in the development app, not a document.
- **A pipeline from coded designs to blocks.** "a sort of drafting of a pipeline to bring coded designs into html/css/js blocks, with a system to discriminate from the coded page what could work as blocks or sections/patterns, how to recreate it as a pattern with those ... that discernment needs to be worked out, and perhaps this can be done by setting up an apparatus for feedback and negotiation in apps/development with the blocks there."
- **New block creation as a standard practice**, with assistant tooling around it ("a sort of integrated mcp set up for that"). Pace: patterns first, coded blocks as a deliberate step.
- **Platform-wide components with many faces.** The content library (picker, hub card, uploader), the directory (people, orgs, services, paid work, and their profiles), one search across the platform, a form for making a meeting: each is one component with wide reach that "expose just a little bit in different ways / context to be used in blocks." Content relates to people, so the two work together.
- **One panel / one editing view**: yes, knowing it means more work behind the scenes to keep things in step.

How I read these together (to be corrected):

1. **A platform component has faces.** One component (content library, directory, search, meeting form) is built once with its full reach. A block is one face of it placed on a page. A picker in the editor is another face. An assistant tool is a third. This is the same idea as the "surface recipe" in `EDITING_LANDSCAPE_2026-11-12/detail.md` and the smart-block declaration (`reads`), named from the component's side.
2. **The pipeline has five steps**: take in a coded page; discern (which pieces are already blocks, which are an arrangement of existing blocks, i.e. a pattern, and which are genuinely new); recreate it from those; compare with the original picture; put the result in front of Justin in the development app for feedback, then publish. The discerning step is the unknown, and the development app is where it gets negotiated.
3. **What a new block needs, every time** (the standard practice): a plain component; a declaration (settings with kinds and limits, parts, slots, colour tokens, what it reads from its surroundings, what it binds to, a sample); its styles on the theme's names, not literal colours; registration on both the public and editor sides; checks (it loads, draws from its sample, matches the source design's pixels, declares what it reads); the block list regenerated; a look by a person in the development app. Assistant tooling for this would be: describe what blocks exist (built), propose a split of a coded page into blocks and patterns (not built), scaffold a block from that standard (not built), run the checks and show the result in the development app (partly built: the app draws every block).
4. **What Puck has that we have least of** is not the canvas. The direct editor already draws the real page, with layers, drag and resize. What we lack is (a) a panel that builds a full form for any block's settings from its declaration, including lists of rows and rich text, and (b) dropping blocks into nested places with a live preview of where they will land. Those two are what a single panel should borrow from Puck's parts.

Open questions for him:
- Where do the coded designs come from most often: design-tool exports, pages an agent wrote, or existing site pages to be converted?
- For the feedback apparatus: is the first survey "here is a page cut into pieces, tell me which cuts are wrong", or "here are two ways to rebuild it, pick one"?

## 9. The design-to-blocks pipeline, as Justin described it (2026-11-22)

His words: "most of this is going to be designed by Claude anyways, and Claude Design or something like that ... I'm looking to kind of standardize my own process ... a design system in one part, and then a Claude document or skill that we feed to the design agent ... so that when it builds the UI, it also has some inkling about how this would [be] built out in its code ... handing off in a language of design that the other agent is ready to receive ... knowing it's on the same page as far as the terms are concerned. And then that kind of being fleshed out against templates or blocks that we already have."

So the pipeline is mostly agent to agent, and its weak point is vocabulary. Three artefacts would make it work (none built; proposed for the next session):

1. **A design skill for the designing agent** (Claude Design, or a coding agent using a design skill). It carries: the shared terms (component, face, block, part, setting, pattern, template, theme name); the catalogue of blocks and patterns that exist, in plain words, generated from the block list (`packages/mcp/src/manifest/`) so it is never out of date; the theme's names for colours and text styles (`apps/development/src/data/design-system.json`, the other PM's theme-language work); and the rules a design must follow to be buildable (use theme names, not literal colours; name every section; say for each piece whether it is words, look or behaviour; say where its data comes from; show the phone layout).
2. **A page sheet that travels with every design**: for each section of the page, which existing block or pattern it is, or "new"; its content fields; its restylable parts; the theme names it uses; what it reads from its surroundings; how it behaves on a phone. This is what the receiving agent reads first, and what the development app shows Justin for feedback.
3. **The receiving agent's standard**: the seven things every new block needs (section 8, point 3), and the checks.

Related work already in the repo to build on, not to duplicate: the Claude Design sync in eris `.design-sync`; the design-handoff forms plan (`docs/open/publishing-forms-handoff/PLAN.md`); the development app's design-system proposal and theme-language documents (the other PM's).

His sentence was cut off at "because it's all": ask him to finish it.

## 10. The conventions deck (Justin, 2026-11-22): how names and patterns get decided

His words: "an area of /development, that is like the agent is wondering about a pattern or a theme name or layer (as it reviews sites that are still in old patterns ...) and its saying, this part is currently known as this, but these parts of these other sites are similar and they call it something else, are all three sites talking about the same thing, or is it different? give option, if i say different, it says what do you think it is, some of these other laid out patterns, or enter a fresh idea/convention. then could continue: if thats named this, is this this layer, or does it take effect when grouped, when grouping whats the base layer, how does the theme work on grouped things, does it get the tri colour accent, like this or this or this ... basically another mcp or skill that has to do with question and mocks and running against its own thought flow while being technically shown and corrected. perhaps creating full ui mocks of site in mcp way in apps/dev is the way?"

What this is: an interview the agent runs and Justin answers by looking. Proposed shape (not built):
- **A card** = one question, with two or three live exhibits side by side (the real blocks or page pieces drawn in the development app, which already draws all 192 blocks under any site's theme), a few options, and a box for a fresh name or idea. Follow-up cards depend on the answer (same thing / different; if different, what is it; then layer, grouping, how the theme reaches a group, which accent treatment).
- **Answers are kept** as the platform's conventions: the agreed name of a thing, what counts as the same pattern across sites, how layers and groups take the theme. His answers are the standard. They feed the shared terms in the design skill (section 9), the block declarations and the block list.
- **Agent side**: a small tool set so an agent can post a card with exhibits, read the answers, and carry on its review from them. The agent shows its reasoning as cards and is corrected card by card.
- **First deck**: the decisions already waiting in documents in the development app's folder (the other PM's workers left about 30 open questions: theme language, versions, templates, free move) and the two-homes list in section 4 of this handoff. Those become cards instead of documents.
- **Precedent he already uses**: the review deck in Astro Studio (rate and correct answers; his entries become the standard).
This area of the development app belongs to the other PM's board; propose it there before building.

## 11. Closing note (2026-11-22)
The plain account of the whole session is SESSION_DUMP.md. Justin: the conventions deck is "a sort of mini app experience inside apps/development, where it has a menu [of] decks to go through and a review that shows my answers to questions and the agents subsequent thoughts of it, so later i can review it in total with a fresh agent"; names first, then themes. Next session he proposes a full inventory and review pass shown as /codemap in the development app, "like atlas" (see SESSION_DUMP.md, last section).
