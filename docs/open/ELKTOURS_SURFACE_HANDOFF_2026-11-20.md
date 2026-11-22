# Elktours Surface handoff review (2026-11-20)

Review of the design package `design_handoff_elktours_surface` against the code as of 2026-11-19. Sections are filled in progressively; a section marked "pending" is not yet written.

## Surface system
State read 2026-11-20 from the working tree: `packages/cms-ui/src/surface` has uncommitted HOST edits (SurfaceStage.tsx new, `types.ts`, `kinds.ts`, `surface.css`, `index.ts`). "Done" below means in the working tree, not committed or built.

| Package proposal (docs/01, 02, 04, 06) | State 2026-11-20 | Where |
|---|---|---|
| Face anatomy (wash, 2px kind edge, medallion, cue; docs/01) | Exists. The specimen mirrors source; elktours overrides (no lift, ivory borders) are app-side. | `surface.css` face rules |
| Strip variant of the grid (`SurfaceCardGrid variant="strip"`) | Partly, differently shaped: `.eac-stage-strip` / `.eac-stage-face` inside SurfaceStage, not a grid variant. Acceptable: the strip is only used by the stage. | `surface.css:3983`, `SurfaceStage.tsx` |
| SurfaceStage (docs/04) | In progress (HOST, board 23:05): 504 lines, exported from `surface/index.ts:16`. | `SurfaceStage.tsx` |
| `stage` surface size | Done in working tree. | `types.ts:50` |
| `place` kind (glyph ⊙, #8fb3c4) | Done in working tree: glyph and `data-kind="place"` tokens. Size is `standard`; the package proposed `wide`. The place sheet inside the stage is not sized by it, so this only matters for a standalone place popup (open question). | `kinds.ts:38`, `surface.css:96,118`; elktours tokens `globals.css:210-211` |
| Primary-fill tokens `--eac-surface-primary` / `--eac-surface-on-primary` (docs/06) | Done in `.eac-btn--primary` (working tree). Not set in elktours: only needed for the light theme. | `surface.css:760-767` |
| `--eac-surface-danger` fix (docs/01 finding 1) | Done: `hsl(var(--destructive))`. | `globals.css:93` |
| `--eac-font-record` to Venture (docs/01 finding 5) | Done. | `globals.css:208` |
| Light theme as a second token map (docs/06) | Missing: no `.theme-light` or `data-theme` scope in `globals.css`; the owner has not settled the palette (docs/06 status). Surface's primary tokens are the one cms-ui prerequisite and exist. | none |
| Maps inside faces and surfaces (docs/01 finding 3) | Missing. Not needed by the hero (media is a photo or a load-on-press map). | none |
| `/hub` faces instead of link cards (finding 4) | Not checked here; see `docs/open/ELKTOURS_OFFICE_HUB_2026-11-19.md`. | unknown |
| 2a hairline step strip (docs/02) | Missing. `StepIndicator` has only `chips` and `bar` (`wizard/StepIndicator.tsx:38`); the built elktours wizard draws its own pill row (`create-tour-popup.tsx:263`). | none |
| Fields 1a Stacked | Exists (`fields.css`). The prototype uses a sunken fill (#2e3239) and the line colour #727a86; `fields.css:44-56` takes `--fld-line` / `--fld-bg`: map the tokens in elktours, no cms-ui change. | `wizard/fields.css` |
| Fields 1b Registry, 1c Edit in place, 1d Sentence, 1e Write the page, 1g One question per sheet | Missing. Only 1c (captions on Details) and 1f are in the chosen wizard set; neither is a shared component. | none |
| Field 1f Row card (stops list) | Exists app-side only (expandable stop rows in `create-tour/route-step.tsx:239`). | elktours |

Differences between the working-tree strip face and the design (H:155-176), for HOST: rest border uses `--sf-line` (design: ivory at 22%); hover border ivory 60% not set (open border = kind colour, matches); hover shadow `0 14px 30px -12px rgba(0,0,0,.6)` (design `0 18px 36px -12px rgba(0,0,0,.75)`) and rest shadow `0 6px 14px -8px rgba(0,0,0,.6)` not seen in the rules read; numeral at rest is `--sf-fg` with a kind-50% border (design: brass text, border brass 26%); numeral font `--eac-font-numeral` falls back to record (Venture): consistent with the owner's label decision. All are a few pixels or one colour; check in a render (verified by reading CSS only, not by rendering).

Priority for the hero: SurfaceStage, `stage` size, `place` kind, primary tokens (all in progress). The light theme, 2a strip and fields 1b-1e are not on the hero's path.

## Wizard
Package: docs/03, `designs/Create Tour Wizard.html`. Built: `apps/elktours/src/components/office/create-tour/*` (popup 312 lines, steps Description / Route / Details; two-column `lg:grid-cols-[1.2fr_1fr]` layouts, `description-step.tsx:69`, `route-step.tsx:169`). The developer prefers the built wizard's use of space, so nothing below changes its layout. Worth taking from the package, in order (all optional, none verified as missing beyond reading the files):

1. Narrative field per stop with a counter and a fallback placeholder: already built (`types.ts:78`, soft 240 / hard 280). Fix: the comment at `route-step.tsx:317` still says "300 is the limit" (board 23:27: hard 280).
2. Step strip with a per-step status ("done", "todo", "needs attention after a failed Finish"; docs/02 2a). The built pills (`create-tour-popup.tsx:263-271`) show only the current step. Cheap addition: a status word under each pill; no layout change.
3. Details step preview of the public page with inline caption editing and a dashed "Guide's take" slot per stop (docs/03 section 3). Check `details-step.tsx:134` (it already previews narrative); add the slot only if the guide-take is meant to be edited there (it is per guide, `tour_guide_takes`).
4. Confirm-route row: totals (stops, walking distance, time = distance / 75 m per minute + stop durations; estimate 1.3 x straight lines when no path). The built Route step shows km and the router source (`route-step.tsx:304`); add total time. The same figure feeds the stage's "[3 min walk]" flow line.
5. Description rail: the preview of the public TourCard and the readiness checklist (title, summary, meeting point, 2+ stops, and, for the hero, a narrative or fallback per stop).
6. After Save: a compact "Tour saved" surface ("stays off /tours until a date is offered", Back to hub / Offer a date). Built wizard has Offer dates opening the schedule popup (`create-tour-popup.tsx` docstring), which covers it.
7. Map modes (Browse / New place / Draw path) with the nearest-places list and dotted lines: the built map has browse and new place (`route-step.tsx:174-194`); draw-path is not built and the walking route is computed (OSRM) instead. Leave.

Not worth taking: localStorage autosave (the built wizard saves drafts server side), the 1180px full surface prototype chrome, the prototype's custom pin map (the app's `pin-map` is kept).

## Database
Verified 2026-11-20 with read-only `\d` and counts on `elkdonis_dev` (production). Every table the designs need exists except the two gaps in the last rows; no migration is required for the hero itself.

| Design field | Source | Status |
|---|---|---|
| Stop narrative (H:58, strip hover line) | `tour_stops.excerpt` (text). Counts 2026-11-20: 103 stops, 0 with excerpt, 12 with `body`, 7 with `guide_notes`. | Exists, empty. Fallback to the first 1-2 sentences of `body`, then a placeholder (board 23:12). Not `places.body`: the design keeps narrative separate from the place description (docs/04). |
| Place name, address, about (H:61-93) | `places.title`, `address`, `body`, `excerpt`; stop to place by `tour_stops.place_id`. | Exists. Prefer `places.excerpt` for the one-line face, `body` for the open sheet (assumed; check the populated column). |
| Place coordinates, Street View | `places.lat/lng/heading/pitch/fov`, `view_lat/view_lng` (279); stop has the same columns. | Exists. |
| Author-credited place notes (docs/03 "private notes credited per author") | `place_notes` (migration 279: `place_id`, `author_id`, `body`, `created_at`). Legacy single text `places.private_notes` also remains. | Exists. Guides-only: do not render on the public hero. |
| Place website and links (the pills "Official site", "Wikipedia", "Museum site") | `place_links` (`kind` website / wikipedia_en / wikipedia_fr / wikidata / osm; `url` https only; `confident`, `rejected_at`). Counts of usable rows: website 42, wikipedia_en 47, wikipedia_fr 55, wikidata 67, osm 1. | Exists. Read `WHERE confident AND rejected_at IS NULL`. Gap: no `tickets` kind (CHECK `place_links_kind_check`); the "Tickets" pill needs a new kind (migration; owner approval) or is left out. |
| Guide's take / "From your guide" (H:77) | `tour_guide_takes` (279: `thread_id`, nullable `stop_id`, `guide_user_id`, `body`, `media_url`; unique per thread, stop, guide). Per-departure notes: `tour_stop_notes.departure_id` / `run_date`, `promoted_at`. | Exists. Choose the take of `tour_departures.guide_user_id` for the next departure; a null `stop_id` row is the tour-level take. Hide the box when empty (the design's "[The guide's note...]" is a placeholder). |
| Walk minutes to the next stop (H:59, "[3 min walk]") | No column. | Compute: distance between consecutive stop (or place) coordinates x 1.3 / 75 m per minute, the wizard's own estimate (docs/03); STAGE already returns `walkMinutesToNext`. Do not add a column unless a drawn path is stored (none found in the draft types, `create-tour/types.ts`). |
| Time here (H:221 "[20 min]") | `tour_stops.duration_minutes` (30 of 103 filled). | Exists; omit the fact when null. |
| Place hours ("Open"), entry/ticket ("Entry"), "Built" | No column. `places.classification` holds OSM/Wikidata match evidence; 0 places have `opening_hours` in it. `place_links` carries no hours. | Gap. Options (owner approval, not decided): (a) `places.facts jsonb` with `hours`, `entry`, `built`; (b) three nullable text columns; (c) leave the facts out until guides write them. Entry/Built are static, hours go stale: recommend (a) with `hours` shown only when set. Until then render only Time here. |
| Next departure and price (foot H:129, Book layer) | `tour_departures` (`starts_at`, `capacity`, `status` scheduled/cancelled, `guide_user_id`, `note`). Read it through `listTourDepartures()` / `departuresSql()` in `apps/elktours/src/lib/departures.ts:49`, because `booking_slots` replaces the table when `bookingTablesOn()`. | Exists. |
| Places left | `capacity` minus `SUM(party_size)` of bookings with `status = 'confirmed'` (the rule in `apps/elktours/src/lib/collaborate.ts:120`; `awaiting_payment` is the default status and is not counted there). | Exists, derived. Confirm whether holds should count before showing "n places left". |
| Price per person, meeting place, cancellation (Book layer) | Not re-checked here (tour thread / order layer). | Unknown: STAGE owns this; the design shows placeholders. |
| Media: stop photos, alternates, captions | `tour_assets` (`stop_id`, `role`, `variant`, `visible`, `position`, `caption`, `alt_text`, `kind`). `tour_stops.image_url`, `still_url` remain. | Exists. |

Rules: filter by `org_id` on every query; store jsonb with `db.json(x)`; any migration number comes from `/new-migration` (latest in the tree 2026-11-20: 279).

## Typography
Owner decision (docs/CONVERSATION.md section 4): Basteleur Moonlight for text, Basteleur Bold for titles, Venture for labels; no Brothers. Developer exception, 2026-11-20: Brothers stays the site header's brand title (the Elkdonis name, L and K joined). Verified 2026-11-20 against `apps/elktours/src/app/globals.css` and the components.

Faces available (`globals.css:58-61`, `apps/elktours/public/fonts`): Basteleur 400 (`Basteleur-Moonlight.woff2`), Basteleur 700 (`Basteleur-Bold.woff2`), Brothers (`BrothersTypeface-Regular.otf`), Venture (`Venture-nRqOR.otf`). All four are already declared.

Current state:
- Body is Basteleur 400 (`globals.css:302`). `--font-sans` is Basteleur. Good.
- Labels: `--font-mono` and `--eac-font-record` are Venture (`globals.css:278`, `:208`). Good; `.font-mono` letter-spaces .16em (`:420`).
- Titles are still Brothers everywhere: `--font-serif` (`:275`), `--eac-font-title` (`:205`), `--eac-block-font-title` (`:126`), the `h1`-`h4` rule (`:415`) and `.tiptap-content h2/h3` (`:432`, `:438`, `:490`). Weight is 400 or 600; Brothers has one weight, so 600 is synthesised bold.
- Surface reads `--sf-font-title` = `--eac-font-title`, else `--font-serif` (`packages/cms-ui/src/surface/surface.css:70`), `--sf-font-record` = `--eac-font-record` (`:69`), `--sf-font-body` = `--eac-font-body` or inherit (`:71`). Setting `--eac-font-title` changes every surface title; no change in cms-ui is needed.
- The site header brand is `font-serif` (`apps/elktours/src/components/site-header.tsx:49`). There is no explicit font-feature or ligature rule: the L-K join comes from the Brothers face itself. The footer title (`site-footer.tsx:13`) also uses `font-serif`; the exception names the header only.

Required change (for whoever edits globals.css; none made by DESIGN):
1. Introduce `--font-brand: "Brothers", "Venture", Georgia, serif` and point the header brand at it (`font-brand` utility or `data-part="brand"` rule) before changing `--font-serif`. If `--font-serif` is changed first, the header loses Brothers. Keep the header's `tracking-wide`, `font-semibold` and size unchanged; do not add `font-variant-ligatures` or `font-feature-settings` there.
2. Switch `--font-serif`, `--eac-font-title`, `--eac-block-font-title` and the `h1`-`h4` and `.tiptap-content` rules to Basteleur, weight 700. Remove the `font-weight: 400` on `h1`-`h4` (`:416`), which would pick Moonlight.
3. Narrative and descriptive text on the stage stays Moonlight (400); stop titles, strip titles, head title and Book price use 700. Kickers, numerals, counters, facts labels and status lines use Venture (`--sf-font-record`); the design draws them in system monospace (H:24 `--r`), which the owner's label decision replaces.
4. Scope: the switch changes every heading on the site (hub, manage, forum pages). If the owner wants only the tour page and surfaces first, set `--eac-font-title` only and leave `h1`-`h4` for a second step (open question).
5. Footer title: leave as is until the owner says whether the exception covers the footer (open question).

Check after the change: header brand renders in Brothers with L and K joined (screenshot, before and after, header region only); stop titles render in Basteleur Bold; no Brothers in the stage.

## Design values for review
Source: `designs/Tour Hero Stage.dc.html` (desktop, "H" below) and `designs/Tour Hero Stage Phone.dc.html` ("HP"), read from inline styles. Package path: `design_handoff_elktours_surface/`. Status: verified against the files, 2026-11-20. Colours are the dark "zinc and brass" tokens: bg #343941, soft #393e46, sunk #2e3239, fg #f1ece2, muted #b9b2a5, faint #84827d, line #727a86, rule #b8b9b9, brass #c9a25c, on-brass #1b1e23, brass-light #dcc08a, place #8fb3c4, route/vermilion #e8805c (H:24).

**Fonts in the file vs the owner decision.** H:24 sets title/narrative font `--t` to Brothers, labels `--r` to system monospace, body `--b` to Basteleur, `--v` Venture. The conversation log (docs/CONVERSATION.md, section 4) records "no more Brothers" and the desktop file was not updated. Build with: narrative, stop titles, strip titles = Basteleur Bold (titles) / Moonlight (narrative); kickers, numerals, status, counters = Venture (not monospace); buttons and pills = Basteleur. See Typography.

**Frame (H:34-39)**
- Artboard 1440x780, padding 30/60, #2a2e35. Hero frame 1320x720, overflow hidden. Photo background plus overlay `linear-gradient(180deg, rgba(20,22,26,0) 55%, rgba(20,22,26,.75) 100%)`.
- Stage: left/right/top 24, height 552; grid rows `auto minmax(0,1fr) auto`; bg rgba(52,57,65,.95), backdrop blur 10px; border 1px rgba(184,185,185,.6); shadow `0 28px 70px -24px rgba(0,0,0,.7)`. Under Book: `translateY(-14px) scale(.985)`, opacity .4, transition .26s / .22s `cubic-bezier(.2,.8,.2,1)`.

**Head (H:40-55)**
- Grid `auto 1fr auto`, gap 14, padding 14/16/14/18, bottom border 2px brass.
- Glyph tile 38x38, bg brass 14%, brass text, Venture .95rem, letter-spacing .06em; holds the numeral (I-IX) or ⌖ on the overview.
- Kicker: .66rem, .14em, uppercase, nowrap. `‹ The walk` crumb (button, fg, underline rgba(241,236,226,.3), offset 3) + "·" (faint) + "Stop III of IX" (overview: "The walk · 9 stops"; no crumb).
- Title 1.22rem, line-height 1.2, letter-spacing -.01em, one line with ellipsis.
- Controls: 32x32 buttons, 1px #727a86 border, bg card, hover border ivory; counter min-width 62, .72rem muted ("III / IX", "Overview"). gap 8.

**Body grid (H:56)** `540px minmax(0,1fr)`.
- Left column: padding 26/30/84 (bottom 84 reserves the place face), overflow hidden.
- Right column: media, border-left 1px #727a86, flush, overflow hidden.

**Narrative and flow line (H:58-60)**
- Narrative 1.5rem, line-height 1.5, colour #ece6da, `text-wrap: pretty`.
- Flow link: margin-top 18, inline-flex gap 8, no border, muted, hover ivory, .74rem; 18px dashed 2px #e8805c rule then text "Then on to IV, Conciergerie · [3 min walk]". Last stop: "The end of the walk · back to the overview". Overview: "Start with stop I, Notre-Dame".

**Place face and sheet (H:61-93)**
- Section absolute left/right/bottom 14; height 62 closed, `calc(100% - 28px)` open (transition .28s); bg card; border 1px rgba(241,236,226,.22) closed, #b8b9b9 open; shadow `0 -18px 34px -18px rgba(0,0,0,.75)`. Accent var `--pk` = #8fb3c4 on a stop, brass on the overview.
- Closed face: height 62, grid `auto 1fr auto`, gap 12, padding 0/14; wash `radial-gradient(124% 96% at 0 0, pk 8%, transparent 64%)`; 2px top edge `linear-gradient(90deg, pk, color-mix(pk 34%, transparent) 40%, transparent 66%)`; medallion 32x32, pk 12% fill / 26% border, glyph ⊙ (overview ⌖); kicker .6rem .14em uppercase 600 "Place · Sainte-Chapelle"; line .85rem muted, nowrap ellipsis ("Royal chapel · Ticket · not included · [20 min]"); cue 24px circle "+", border pk 32%, fill pk 9%.
- Open head: padding 12/12/12/14, bottom 2px pk; tile 34x34; kicker .62rem `‹ Stop III · Place`; title 1.1rem; ← button 32x32.
- Open body: padding 16/18/18, gap 14; facts `dl` 4 columns `max-content 1fr max-content 1fr`, gap 14/8, .88rem, dt .6rem .12em uppercase 600 (stop: Time here, Entry, Built, Open; overview: Length, Group, Meet at, Included); about .95rem / 1.55; "From your guide" box: 1px dashed rgba(232,128,92,.55), padding 9/12, .88rem muted, label .62rem #e8805c; link pills: padding 4/11, radius 999, 1px #727a86, .8rem, "↗" suffix.
- Open foot: padding 10/14, top border 1px #b8b9b9, bg #393e46; status .7rem muted ("In the catalogue · added by [guide]"); button "Open the place page →" padding 7/12, 1px #727a86, .85rem.

**Media (H:95-121)**
- Tabs: top 14 right 14, gap 6, z 2; pills padding 6/13, radius 999, Basteleur .8rem. On: 1px fg, fill fg, text card colour. Off: 1px rgba(241,236,226,.45), bg rgba(27,30,35,.6), text fg. Shown only if more than one kind. Stop: Photos + Street View; overview: Photo, Fly-over, 3D route.
- Load state (Street View, film, 3D): centred column, gap 12; kicker .64rem .16em uppercase #dcc08a; button height 46, padding 0/20, 1px brass border, Basteleur .95rem, bg rgba(27,30,35,.65) (3D route: brass fill, ink text); note ".66rem" "Nothing loads until this is pressed". Loaded stand-in: "[Street View · drag to look around]".
- Photo arrows: 40x40 at left/right 14, vertically centred, 1px rgba(241,236,226,.35), bg rgba(27,30,35,.55); only if more than one photo.
- Caption band: bottom, padding 28/16/12, `linear-gradient(180deg, transparent, rgba(27,30,35,.82))`; caption .85rem italic; count Venture .68rem muted ("2 / 3", "on demand", "loaded").

**Foot (H:123-133)** padding 12/16, top border 1px #b8b9b9, bg rgba(57,62,70,.96). Status .74rem muted: tour name in fg, then "Next walk [Sat date] · [€ price] per person". Buttons gap 8, right-aligned: "Start at stop I" (overview only; padding 8/14, 1px #727a86, bg card, Basteleur .88rem) and **Book** (padding 8/18, brass fill, ink text, Basteleur .88rem; hover brightness .94).

**Strip (H:155-176)**
- Container: left/right 36, bottom 16, flex, gap 8, align end. 11 faces: The walk (⌖), I-IX, Book (◆).
- Face: flex 1 1 0, padding 6/6/9, column gap 7, bg `radial-gradient(124% 96% at 0 0, brass 7%, transparent 64%)` over rgba(52,57,65,.94), blur 8px, overflow hidden, transition .2s.
- Border: rest 1px rgba(241,236,226,.22); hover 1px rgba(241,236,226,.6); open 1px #c9a25c.
- Shadow: rest `0 6px 14px -8px rgba(0,0,0,.6)`; hover `0 18px 36px -12px rgba(0,0,0,.75)`. Hover also `translateY(-10px)`.
- 2px top edge brass gradient (as the place face). Cover height 44, hover 84, stripe pattern `repeating-linear-gradient(135deg, rgba(241,236,226,.05) 0 6px, transparent 6px 12px)` over a tone or gradient; no-photo stops use `radial-gradient(ellipse at 50% 120%, #4a5160, #1d2026 70%)` plus ◎.
- Medallion: top 5 left 5, min 22x22, Venture .6rem; open: brass fill, ink text; rest: bg rgba(27,30,35,.85), brass text, 1px rgba(201,162,92,.26). Cue (hover only): top 5 right 5, 22px circle, brass 32% border, bg rgba(27,30,35,.7), "+" ("→" on Book).
- Title: .8rem, line-height 1.15, 2-line clamp, min-height 2.3em, padding 0/2.
- Hover extra: kicker .56rem .14em uppercase 600 (kind, plus " · Street View" when no photo) and first clause of the narrative, .7rem / 1.35 muted, followed by "…".
- Book face cover: `linear-gradient(135deg, #c9a25c, #8a6d3a)`; text "[€ price] per person" / "Next [Sat date]".

**Book layer (H:135-153)** event surface 440 wide, left 50%, top 64, margin-left -220; bg card; border 1px #b8b9b9; shadow `0 30px 80px -20px rgba(0,0,0,.85)`. Head padding 12/14/12/16, 2px brass, tile 36x36 ◆, kicker `‹ {tour title} · Book`, title "Book this walk" 1.2rem. Body padding 18/20, gap 16: price 2rem (title face) + "per person" .9rem muted; "Pick a date" label .86rem 700 + pills (padding 7/14, radius 999, on = fg fill, off = 1px #727a86 muted); People row with 34x34 stepper buttons (1-12); dl Meet at / Cancel. Foot padding 12/16, bg soft, status "2 x [€ price]", button "Book now" (padding 8/18, brass).

**Phone (HP:37-250, docs/04)** 390x844. Media band 300px high; scroll area bottom 166; narrative 1.22rem / 1.5 #ece6da; dock fixed bottom, height 166, rows `86px auto`, bg rgba(43,47,54,.96), blur 10px; strip faces 86 wide (open one 132 and shows kind); foot: tour name, next date, counter, Book 44px high; place and Book are bottom sheets over a scrim with a handle and ← 44px. Not read line by line; check HP before building the phone variant.

Placeholders in square brackets ([price], [Sat date], [20 min], [3 min walk], [Opening hours], the guide's note) are not data: they map to the fields in Database.

## Phone stage values (2026-11-20)
Source: `designs/Tour Hero Stage Phone.dc.html` ("HP", line numbers below) and the foot of `designs/Tour Detail Page Phone v2.dc.html` ("V2"). Read from inline styles; status: read from source, not yet compared with a live render. Viewport 390x844; the design draws a 10px bezel and a 46px status bar (HP:34-35), which are not part of the page.

**Colours** (HP:24; scoped to the stage wrapper, regardless of the site palette). card `--bg` #343941; soft `--soft` #393e46; sunk #2e3239; ink `--fg` #f1ece2; muted `--mu` #b9b2a5; faint `--fa` #84827d; line `--ln` #727a86; rail line `--rl` #b8b9b9; brass `--k` #c9a25c (light brass text #dcc08a); on-brass ink `--ok` #1b1e23; place `--pc` #8fb3c4; route #e8805c; page ground #2a2e35; narrative text #ece6da. Dock bg rgba(43,47,54,.96) with blur 10px. Scrim rgba(20,18,16,.55) (HP:110).

**Fonts** (HP:13-24). Owner decision overrides the file: titles and the card/sheet h2, strip titles, price figure: Basteleur 700; narrative and body: Basteleur 400; labels, kickers, numerals, medallions, TOURS: Venture. The file sets `--t` to Brothers/Venture (HP:24) and monospace `--r` for small labels; use Venture for those labels. Brothers stays only in the site header, outside the stage.

**Media band** (HP:38-63). Height 300, relative, bg stripe `repeating-linear-gradient(135deg, rgba(241,236,226,.05) 0 6px, transparent 6px 12px)` over `linear-gradient(160deg, <stop tone or #3a3f47 for film/map/Street View>, #1f2228)`. Content block centred, gap 10, padding 60/20/30 (clears the status bar).
- Tabs (HP:48-53): left/right 12, top 52, flex gap 6, horizontal scroll, shown only with 2+ labels. Pill height 34, padding 0/14, radius 999, .8rem. On: 1px ink border, ink fill, text card colour. Off: 1px rgba(241,236,226,.45), bg rgba(27,30,35,.6), ink text.
- Dots (HP:61): bottom-right of the caption row, gap 4; on 14x4 ink; off 4x4 rgba(241,236,226,.45); one dot per slide (photos plus the load slide). No counter.
- Arrows (HP:55-58): 44x44, left/right 10, top 150, 1px rgba(241,236,226,.35), bg rgba(27,30,35,.55); photo slides only, and only with more than one photo.
- Caption row (HP:59-62): bottom 0, padding 26/14/10, `linear-gradient(180deg, transparent, rgba(27,30,35,.88))`, .8rem; caption italic, one line, ellipsis; dots flex none.
- Photo placeholder (HP:40): "[photo · caption]" 10.5px, rgba(241,236,226,.7).
- Load-on-press (HP:41-44): button height 46, padding 0/18, gap 8, 1px brass border, .92rem, bg rgba(27,30,35,.65), ink text; the 3D route button is brass-filled with #1b1e23 text. Glyph + label: Street View "◎ Load Street View", film "▶ Watch the fly-over", map "⌖ Explore the 3D route". Under it ".62rem" muted "Loads only when pressed". Loaded state: bracketed label 10.5px rgba(241,236,226,.85) ("Street View · drag to look around", "Fly-over playing · muted", "3D route · drag to orbit").
- Overview media: Photo, Fly-over, 3D route tabs (HP:203). A stop: its photos as "Photos" plus a "Street View" tab (HP:204).

**Stage under the media** (HP:64-90; scrolls with the band, scroll area `bottom:166` HP:37, scrolls to top on stop change HP:179). Article bg card, min-height 400.
- Masthead (HP:65-78): grid `auto minmax(0,1fr) auto`, gap 12, padding 12/10/12/16, bottom border 2px brass. Glyph tile 38x38, bg brass 14%, brass text, Venture .95rem (numeral I-IX, or ⌖ on the overview). Kicker: .6rem, letter-spacing .14em, uppercase, nowrap, gap 6; "‹ The walk" crumb button (underline rgba(241,236,226,.3), offset 3) + faint "·" + "Stop III of IX" (overview: "The walk · 9 stops", no crumb). Title 1.25rem, line-height 1.2, margin-top 2, wraps (no ellipsis). ‹ › buttons 44x44, gap 4, 1px #727a86, bg card.
- Body (HP:79): padding 18/18/28, grid gap 16. Narrative 1.22rem, line-height 1.5, #ece6da, `text-wrap: pretty`. No counter in the masthead (it lives in the dock foot).
- Flow link (HP:81): min-height 44, no border, muted, .72rem, 18px 2px dashed #e8805c rule, gap 8, text ends " →". Texts: "Start with stop I, Notre-Dame"; "Then IV, Conciergerie · [3 min walk]"; last stop "The end of the walk · back to the overview".
- Place face (HP:82-87): grid `auto minmax(0,1fr) auto`, gap 12, min-height 64, padding 0/12, 1px rgba(241,236,226,.22), wash `radial-gradient(124% 96% at 0% 0%, pk 8%, transparent 64%)` over card; 2px top edge `linear-gradient(90deg, pk, pk 34% at 40%, transparent 66%)`. Glyph tile 32x32 (bg pk 12% on card, 1px pk 26%, pk text) ⊙ on a stop, ⌖ on the overview. Two lines, both nowrap/ellipsis: kicker .58rem .14em uppercase 600 ("Place · Notre-Dame", overview "About this tour"); line .82rem muted ("Cathedral · Free entry"). Trailing "+" 26px circle, 1px pk 32%, bg pk 9%, pk text. pk = place #8fb3c4 on a stop, brass on the overview.
- "Your guide" note (HP:88): flex gap 10, padding 9/12, 1px dashed rgba(232,128,92,.55), .85rem muted; label .58rem .12em uppercase #e8805c.

**Dock** (HP:93-109). Absolute bottom, height 166, z 20, grid rows `86px auto`, align-content end, bg rgba(43,47,54,.96), blur 10px, top border 1px #b8b9b9. Home-indicator bar 120x4 at bottom 8, rgba(241,236,226,.55) (a device element; omit on a real phone).
- Strip (HP:94): flex gap 6, padding 8/14/8, x scroll with `scroll-snap-type: x proximity`, scrollbar hidden. Faces: "The walk" (⌖), stops I-IX, "Book" (◆): 11 faces. Open face scrolled to `offsetLeft - 14` on change (HP:178).
- Face (HP:96-99): 86 wide x 70 tall; the open stop, 132 wide (the open Book face stays 86); `transition: width .22s cubic-bezier(.2,.8,.2,1)`; bg card; border 1px rgba(241,236,226,.22), open 1px brass; 2px brass top edge gradient (as the place face). Cover 32 tall (stripe over the stop tone, or `radial-gradient(ellipse at 50% 120%, #4a5160, #1d2026 70%)` when the stop has no photo; overview `#3a3f47`; Book `linear-gradient(135deg, #c9a25c, #8a6d3a)`). Medallion top 5 left 5, min 22x20, padding 0/3, Venture .56rem, 1px brass; open: brass fill, #1b1e23 text; rest: bg rgba(27,30,35,.85), brass text. Text block padding 5/7/6, gap 1: title .74rem, line-height 1.15, nowrap ellipsis; open face adds a second line .52rem .12em uppercase #dcc08a with the kind ("Cathedral", "Overview", Book "[€ price]").
- Tone list for photo stops (HP:185): #6d6559 #5f6a6e #5f5a6e #5b5f66 #6e6150 #566259 #6a5d52 #5d6470 #6b6457; overview #5b5650.
- Foot (HP:103-107; with the way back from V2:58): flex, gap 12 in HP (10 in V2), padding 8/14/26, top border 1px rgba(184,185,185,.35). Order left to right: way back pair, name block, counter, Book. 26px bottom padding keeps clear of the home indicator.
  - Way back (V2:58): bordered pair, height 44, 1px #727a86; "‹ TOURS" link (padding 0/9, Venture .6rem, letter-spacing .14em, ink; aria "All tours") then "⌂" (36 wide, left border 1px #727a86, .9rem; aria "Home"). Flex none.
  - Name block: tour name Basteleur 700 .88rem (HP; V2 .85rem bold), nowrap ellipsis; second line "Next [Sat date] · [€ price] pp", .62rem (V2 .7rem) muted. flex 1, min-width 0.
  - Counter (HP:105): .64rem muted; "Overview" or "III / IX".
  - Book (HP:106): height 44, padding 0/22, 1px brass, bg brass, text #1b1e23, .92rem.

**Bottom sheets** (HP:110-150). Scrim: absolute inset 0, z 30, rgba(20,18,16,.55); tap closes. Sheet: absolute left/right/bottom 0, z 35, bg card, top border 1px #b8b9b9, shadow `0 -20px 50px -20px rgba(0,0,0,.8)`. Handle 40x4, radius 999, rgba(241,236,226,.35), margin 8/0/2, centred.
- Header (both sheets): grid `auto minmax(0,1fr) auto`, gap 12, padding 8/10/12/16, bottom border 2px (pk for place, brass for book). Tile 36x36 (bg pk 14%). Kicker .6rem .14em uppercase: "‹ Stop III" crumb (closes; overview "‹ The walk") + faint "·" + "Place" (book: "‹ <tour title> · Book"); title 1.15rem, line-height 1.2. "←" back button 44x44, 1px #727a86, bg card.
- Place sheet (HP:113-128): max-height 80%, grid rows `auto auto minmax(0,1fr) auto`. Body padding 16/16/18, gap 14, scrolls. Facts `dl` two columns `max-content 1fr`, gap 14/8, .88rem, dt .58rem .12em uppercase 600 (Time here, Entry, Built, Open; overview: Length, Group, Meet at, Included). About .95rem / 1.55. Link chips: min-height 36, padding 0/12, radius 999, 1px #727a86, .82rem, "↗". Foot (HP:127): padding 10/14/28, top border 1px #b8b9b9, bg #393e46; status .66rem muted ("In the catalogue"; overview "9 stops · [Length]"); "Place page →" button min-height 44, padding 0/14, 1px #727a86, .85rem.
- Book sheet (HP:131-149): body padding 16, gap 16. Price 1.8rem line-height 1 ("[€ price]") + "per person" Basteleur .85rem muted. "Pick a date" .86rem bold; date pills min-height 40, padding 0/15, radius 999, .85rem; on: ink fill/card text; off: 1px #727a86, muted. People row: label .86rem bold; steppers 44x44, 1px #727a86, count Venture-or-mono centred min-width 20. "Meet at" / "Cancel" `dl` .85rem. Foot padding 10/14/28, bg #393e46, top border 1px #b8b9b9; "N × [€ price]" .68rem muted; "Book now" height 48, padding 0/24, brass, .95rem.

**Behaviour** (HP:172-272). Selecting a stop closes any sheet, scrolls the stage to the top and the strip so the open face sits at the left. Book face opens the Book sheet and shows as selected in the strip (open width stays 86). Slide index is kept per stop; load-on-press state is kept per stop and kind. No swipe between stops (the design names it as a later gesture).

## Phone index and everything values (2026-11-20)
Source: `designs/Tour Detail Page Phone v2.dc.html` ("V2", line numbers below), frames 4b and 4c; status: read from source, not compared with a render. Palette as in "Phone stage values". Every label is Venture; text and titles Basteleur (V2:28: "Brothers is gone"; Moonlight for text, Bold for titles). Where V2's 4a stage differs from `Tour Hero Stage Phone` (media 290 vs 300, narrative 1.08rem vs 1.22rem, title 1.2rem vs 1.25rem, kicker Venture .66rem/.16em vs .6rem/.14em, tab height 32 vs 34), the stage values above stay (HP is the interactive file).

**Flow** (V2:62, 95). 4a Stage full screen, one swipe snaps to 4b Index full screen, then free scroll through 4c. Swiping back returns to the stage. Tapping an index row jumps the 4c scroll to that section.

**4b Index** (V2:65-93). Fixed top bar under the status area (V2:67-71): grid `auto 1fr auto`, gap 10, padding 8/12, bg rgba(52,57,65,.97), bottom 2px brass; tile 30x30 (brass 14% fill, brass numeral, Venture .72rem); kicker "BACK TO THE WALK · STOP III" Venture .58rem .16em muted; title Basteleur 700 .92rem; "↑" 44x44 button, 1px #727a86 (returns to the stage). Body (V2:72): padding 18/16/12, grid rows `auto auto auto 1fr`, gap 14, bottom clears the 92px bar.
- Heading: "BEFORE YOU GO" Venture .66rem .18em brass; tour name Basteleur 700 1.2rem, one line, ellipsis.
- Facts strip (V2:74-79): 4 equal columns, gap 1 on #727a86 (1px outer border), cells bg card, padding 8; label Venture .52rem .14em muted (LENGTH, WALK, GROUP, PRICE), value Basteleur 700 .9rem ("≤ 10" for group).
- Next-date row (V2:80-85): button, grid `52px 1fr auto`, gap 12, padding 10/12, 1px rgba(241,236,226,.22), brass wash `radial-gradient(124% 96% at 0% 0%, brass 8%, transparent 64%)`, 2px top edge `linear-gradient(90deg, brass, transparent 66%)`. Date chip 1px brass border, padding 4/0: "NEXT" Venture .52rem brass, date 700 .85rem. Middle: "Sat · 10:00" 700 .92rem, "6 of 10 left · 3 more dates" .74rem muted. Trailing "→" brass .8rem. Tap jumps to section 03.
- Contents list (V2:86-90): `ol`, top border 1px #b8b9b9; rows min-height 44, padding 3/4, grid `28px 1fr auto`, gap 10, bottom border 1px #727a86, hover bg rgba(69,74,83,.38). Number Venture .7rem .08em brass; title 700 .92rem; line .74rem muted, one line ellipsis; trailing "↓" faint #84827d .85rem. Seven rows: 01 What to expect ("2 h 30 · flat · runs in rain"), 02 The route ("9 stops · 2.4 km across the island"), 03 Dates & times ("4 offered · next Sat 22 Nov"), 04 Meeting point, 05 What's included ("Guide, headsets · tickets extra"), 06 Your guide ("[Guide name] · and their take"), 07 Good to know ("Cancellation, what to bring").
- Bottom bar (V2:92): 92 tall (no strip), padding 10/14/0, bg rgba(43,47,54,.97), top border 1px #b8b9b9; way-back pair 46 tall, name (700 .9rem, "Sat 22 Nov · 10:00" i.e. the chosen date) over "[price] per person" .7rem muted, Book 46 tall, padding 0/22, brass fill, 700 .92rem. Home-indicator bar as on the stage (device element).

**4c Everything** (V2:98-175). Top: status area then a sticky pill bar (V2:100): top 44, z 4, flex gap 6, horizontal scroll, padding 10/12, bg rgba(52,57,65,.97), bottom border 1px #b8b9b9. Pills height 34, padding 0/12, radius 999, .78rem nowrap; on: ink fill, card text, 1px ink; off: 1px #727a86, transparent, muted. Scroller starts at top 99, bottom 92; a jump scrolls to `section.offsetTop - 64`; the active pill follows scroll (section whose `offsetTop - 80 <= scrollTop`; last one at the bottom); a jump locks the scroll-spy for 250 ms. Trailing spacer 120.
- Section heading (all, e.g. V2:108): `h3` flex gap 10, padding-bottom 6, bottom border 1px #b8b9b9, Venture .72rem .18em uppercase; number brass; optional right-aligned note (margin-left auto, .06em, muted: "9 STOPS", "[€ 35] PP"). Section padding 20-24/18/8 (last 24/18/24), grid gap 12.
- 01 What to expect: lead 700 1.1rem / 1.45; 2x2 grid gap 1 on #727a86 (PACE, LANGUAGE, ACCESS, WEATHER), cells padding 10/12, label Venture .56rem .14em muted, value Basteleur; bullet list .92rem / 1.5, gap 6, padding-left 1.1rem.
- 02 The route: map placeholder 150 tall, 1px #727a86, stripe over #262a30, "route map · tap for the 3D route" .72rem muted; list 1px #727a86 border, rows min-height 46, padding 6/12, grid `28px 1fr auto`, gap 12, bottom border, bg card: numeral square 26x26 Venture .6rem (current stop brass fill + #1b1e23; others 1px brass + brass text); title 700 .9rem, kind .72rem muted; trailing "20 min ↑" .72rem muted.
- 03 Dates and times (kind event): list in a 1px #727a86 frame; each row a button, min-height 58, padding 8/12, grid `52px 1fr auto`, gap 12, bottom border, bg card. Day chip 1px #727a86, padding 4/0: day Venture .52rem muted, date 700 .9rem. Middle: "10:00 · English" 700 .92rem; "6 of 10 left" .72rem muted. Trailing state: Chosen (brass fill, #1b1e23, padding 6/12, .8rem), Choose (1px #727a86), Full (1px dashed #727a86, faint, not pickable). Choosing a date fills the bottom bar's label and the index's next-date row.
- 04 Meeting point: card with 2px place-colour top edge (#8fb3c4), 1px rgba(241,236,226,.22); map placeholder 120 tall; row padding 12, grid `1fr auto`: place 700, address + "10 min before the start" .74rem muted; "Directions ↗" button min-height 40, padding 0/12, 1px #727a86, .8rem.
- 05 What's included: two columns gap 16, .88rem / 1.5; included list with brass "✓" (gap 8, row gap 6); not-included list muted with "–".
- 06 Your guide: card padding 14, grid `60px 1fr`, gap 14, 2px top edge `linear-gradient(90deg, #e8805c, transparent 66%)`; photo square 60x60 (stripe 5/10 over #2e3239); name 700 1.05rem; "English, Français · [n] walks led" .72rem muted. Under it the dashed note: 1px dashed rgba(232,128,92,.55), padding 9/12, label "THEIR TAKE" Venture .56rem .16em #e8805c, text .85rem muted.
- 07 Good to know: `dl` `max-content 1fr`, column gap 14, row gap 10, .88rem / 1.5; dt Venture .56rem .14em, padding-top 5 (CANCEL, BRING, TICKETS, CONTACT).
- Reviews are not in the design; MAIN decides where they go (after 07 as a plain section, or inside 06).
