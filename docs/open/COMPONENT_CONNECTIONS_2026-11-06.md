# Component connections: a block opens a popup, the popup leads on (2026-11-06)

Status 2026-11-06: built on elktours with the decisions taken as proposed in section 3; harness-verified; live since the 21:59 EST rebuild (build `-PVIsxZUU5FL1j9qx4brR`, previous build backed up at `~/eac-backups/next/elktours-20261106-2154.tgz`); not yet used signed in; not committed. Section 6 has what was built. The developer asked for a way for a block to open a Surface UI popup, chosen in the editor, for example a review popup, which then leads to another page. This document lists what the platform already has for that, a model that reuses it, and the decisions that are the developer's.

## 1. What exists

- **Popups that open from an address.**
  - Surface UI opens a popup from an address: `?surface=thread:<id>` (`packages/cms-ui/src/surface/url.ts`). The address can be shared, and Back closes the popup.
  - Elktours registers its own kinds with the same provider: `tour`, `place` and `experience` popups, fed by `/api/surfaces/<kind>/<id>` (`apps/elktours/src/components/surfaces/`, `components/tours/tour-popup.tsx`).
- **Reviews.** `components/reviews/reviews-section.tsx` lists and writes reviews for a `ReviewTarget` (`lib/review-actions.ts`). It is drawn under a place and under a tour stop. It is not a popup of its own.
- **Blocks that link.** `link-button` and the card blocks store a plain `href`. Nothing in a block can open a popup today.
- **Choosing a record.** "From what?" (`packages/direct-edit/src/canvas/records.ts`, 2026-11-06) chooses a record for a prop declared `binds`. It works in the canvas editor, the block popup and Puck Studio's panel. Featured person is the first prop that uses it.

## 2. Proposed model: "Opens"

- **One setting per clickable block or part, called Opens.** It has three answers:
  - Nothing.
  - **A page:** a page of this site, or a web address.
  - **A popup:** a popup kind, then the record it shows, chosen with "From what?".
- **One onward step, called Then.** A popup chosen this way may have one: a button at the foot of the popup that leads to a page. Example: reviews of the Napoléon tour, then "Book this tour", which goes to `/tours/<slug>`. One step keeps a visitor from being led through a maze; Back still closes the popup.
- **Stored as one string, like `person`:**
  - `page:/walking-notes` for a page;
  - `popup:reviews:tour:<id>` for a popup, plus `then: page:/tours/<slug>` when it has an onward step.
  - Only the reference is stored. The popup reads its record per request, under the usual visibility rules.
- **Drawn as an ordinary link:** `<a href="/tours/<slug>?surface=reviews:tour:<id>">`.
  - Without scripts, or for a search engine, it is a link to the record's own page.
  - With scripts, the surface provider opens the popup over the current page.
  - A block needs no knowledge of popups: the host turns the stored string into the link.
- **A new popup kind for reviews.** It would take its target (tour, place, experience), show the existing reviews section and the average, and draw the Then button. The section's own rules for writing a review stay as they are (signed in, with the existing actions).
- **The chooser grows one step in front.** "Opens…" asks for a page or a popup. For a popup it asks which kind (Tour, Place, Experience, Reviews of…, Person), and after that "From what?" picks the record as it does now.

## 3. Decisions for the developer

1. **First blocks.** Which blocks get Opens first? Proposed: Button, Card and Featured person (the person's popup or page).
2. **Review popup: read or write.** Read only, or also let a signed-in visitor write a review from it, as on a place? Proposed: as on a place (read, and write when signed in).
3. **How far a chain goes.** One Then step, or popups that open further popups? Proposed: one step.
4. **Popup kinds offered.** Tour, place, experience and reviews are this site's. Should thread and person popups (shared kinds) be offered too? Proposed: yes for person, later for thread.

## 4. Rules and constraints

- Read a popup's record through the public API and the same visibility rules as its page: a stored reference must not reveal a draft, a member-only thread, or another org's record.
- ~~Let a block keep an `href` that wins over Opens, the same "typed beats bound" rule as `feature-card` (`.claude/rules/areas/puck-blocks.md`).~~ Corrected 2026-11-06: Opens, when chosen, replaces the typed link. "Goes to" and "Opens" answer the same question, and an Opens is chosen on purpose. A Card's other typed fields still win over its record.
- Store no copy of the record in the page.

## 5. Open questions

- Whether "Then" should also offer booking straight from the popup (the tour popup's Dates tab already books) or only a page.
- Whether Opens belongs on parts too, for example a card's picture opening a gallery while its title opens the page.

## 7. Para Theater (2026-11-07, live since the 00:55 EST rebuild)

- The same model on sunjay: Opens to a page, to a gathering, series or piece of writing in the site's own thread popup (`popup:thread:<id>`, no Then: that popup has its own actions), or to a person (`popup:person:<userId>`, optional Then). Card is filled from a gathering, series or piece. Files: `apps/sunjay/src/lib/opens.ts`, `lib/opens-server.ts`, `components/surfaces/opens-links.ts`, `opens-popups.tsx`.
- The click bridge is its own module and the popups load on open (also applied to elktours, live since the 2026-11-07 07:18 EST rebuild: home-page script down 108 KB): the first build, with the popups in the root layout, added about 119 KB of script to every page.
- Verified: read-only probe `packages/direct-edit/harness/featured/sunjay-opens.mts` 32/32 against the live database (an archived post, a series session, another org's thread and a Then after a thread popup draw nothing). Not used signed in.

## 6. Built (2026-11-06, live on elktours since 21:59 EST)

- **Shared, in `@elkdonis/blocks`:**
  - `src/opens.ts`: `OPENS_PROP` (`binds: "opens"`), `Opened`, `openedAttrs` (a safe href, plus `data-opens` with the popup);
  - Button (`link-button`), Card (`feature-card`) and Featured person declare `opens` and draw `opened`.
- **Editors:**
  - an `opens` prop that a site has not claimed gets no field, in Puck (`page-builder/src/config.client.tsx` `NoField`) and in the canvas popup (`direct-edit/src/canvas/tree-editor.ts`);
  - Para Theater and other sites therefore see nothing new.
- **elktours:**
  - `lib/opens.ts`: the grammar, pure: `page:/path`, `popup:tour|experience:<id>`, `popup:reviews:<tour|experience|place>:<id>`, `popup:person:<userId>`, and `>page:/path` for Then (reviews and person only).
  - `lib/opens-server.ts`:
    - `resolveOpens` and `cardRecord`, which read only published, public records of the org, public non-archived places, and people with a public profile;
    - the chooser lists.
  - Actions, owners and guides only: `opensSourcesAction`, `opensChoicesAction`, `opensDrawAction` (`lib/featured-person-actions.ts`).
  - The chooser (`components/landing/person-records.ts`) handles `person`, `opens` and `record`; Studio's panel field takes any of them.
  - Card is in the page catalogue and is filled from a tour or experience (`cardRecord`).
  - Resolvers in both configs; `RESOLVED_KEYS` strips `who`, `opened` and `bound` before a save.
  - Popups (`components/surfaces/opens-popups.tsx`), registered in `components/hub/HubSurfaces.tsx`:
    - `ReviewsPopup` (the existing reviews section, with a Then button);
    - `PersonPopup`;
    - `bindOpensLinks`: a click on `a[data-opens]` opens the popup. Modifier keys, a middle click, unknown kinds and links inside the editors follow the link.
- **Verified in harnesses (`packages/direct-edit/harness/featured/`):**
  - `opens-grammar.mts`: 17/17 accepted and refused forms.
  - `opens-published.mts`, read-only against the live database, 13/13 resolver cases. A draft or archived tour, a draft experience, a private place, another org's thread and a place profile as a person all draw nothing. Button, Card and Featured person draw the record's page with `data-opens`; a forged stored `opened` is overwritten.
  - `opens.cjs`, 12/12: the click opens the reviews popup with its Then button, Escape closes it, the person popup opens; a plain link, an unknown kind and Ctrl-click follow the link.
  - `featured.cjs`, 48/48: Opens in the landing editor, including undo and save.
  - `studio.cjs`, 16/16.
  - Para Theater's `drive-popup.cjs`, 56/56 after the page-builder change.
  - Blocks smoke test passes. Type checks are 0 in elktours, sunjay, direct-edit, page-builder and blocks, apart from errors already present in `services/src/gather.ts` and `utils/src/sanitize*.ts`.
- **Not verified:** a signed-in use on the live site; writing a review from the popup when signed in (the section's own path, unchanged); touch, Safari, Firefox.
