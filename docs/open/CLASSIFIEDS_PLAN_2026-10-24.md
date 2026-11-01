# Classifieds: the continuous section — plan and open questions

2026-10-24. The classifieds site on ArtDirect (directory.arts-collective.com):
one unbroken classified section with no page edges, read by panning and
zooming (the microfiche is the navigation idea only), mixing real platform
entries with procedurally generated filler in looks drawn from a catalog of
real classified pages. This document records what was built in the first UI
session, how it fits the platform, what to build next, and the questions the
developer has to answer. The catalog itself is in `apps/artdirect/classifieds/`
(HANDOFF.md, README.md there).

**Framing reset (2026-10-24, developer):** no separate pages, no gaps between
them, no zoom bands or film overlays; zooming only scales. The plane is one
continuous section whose *boxes* carry the variety and take on a theme in
areas. The first build (sheets with staggered borders, ghost sheets far out)
was replaced the same day; the table below describes the second build.

## Current state (2026-10-24, source only, not deployed)

Built this session in `apps/artdirect` (all new files; no shared file edited):

| File | What |
|---|---|
| `src/classifieds/rng.ts` | hash, seeded PRNG, 2-D value noise. Everything on the plane derives from integer cell coordinates, so a spot is the same on every visit. |
| `src/classifieds/catalog.ts` | 14 keyframe recipes (one per style family + split of modern-condensed into tabloid/cinemafare): columns, gutter, padding, header device, unit mix, entry-type bias, masthead copy, devices borrowed, specimens. Also the global ratio dials `RATIOS` and the classification labels `CLASSES`. |
| `src/classifieds/style.ts` | The style field. Five axis groups (grid, type, colour, header device, unit mix) each weight the keyframes by their own noise field; a slow *coherence* field decides whether the groups follow one shared theme (an area reads as one keyframe) or drift apart (one keyframe's grid with another's faces). The grid group is sampled per strip (j = 0) so column pitch and rules run unbroken down the plane. Continuous tokens blend; discrete ones take the group's winner with per-tile jitter. `voices` lists the keyframes a box may sample its own faces from. `styleVars()` emits `--cl-*` custom properties. |
| `src/classifieds/copy.ts` | Generated copy by entry type (classified lead/body pairs with a 1-in-8 stranger's lead, notices, personals, mail-order offers, posters, listings, agency lists, profiles, house ads); `profileAd()` turns a real dossier into an ad. |
| `src/classifieds/plane.ts` | Tiles of 1000×1400 world px are only the unit of generation and sit edge to edge on one paper. Bin-packing: shortest column first, wide units (2–3 columns) wait until their columns are level, fillers (insertion codes) pad; every column is flushed to the tile's bottom so the seam is a box edge. Each box samples a *voice* (faces, border style, tint, reverse, shadow, alignment) from the local theme, wider where coherence is low. Section banners ("WANT ADS", "AMAZING OFFERS!") are wide units inside the flow, not page mastheads. Real entries: home cell (a wide display) + echoes that link home. `findNearest()`. |
| `src/classifieds/Sheet.tsx` | `TileView`: one tile as DOM, absolutely positioned boxes over the strip's column rules. Real text in real fonts at zoom 1; the viewer scales the world with a transform so type re-rasterises sharp at every zoom. No far-out mode. |
| `src/classifieds/Microfiche.tsx` | The reader: pan (drag, wheel, arrows), zoom at the pointer (ctrl+wheel, pinch, double-click, slider; 20 %–300 %, scale only), URL hash `#x,y,z`, random landing spot, HUD (reel/frame readout, keyframe under the centre), focus panel (the ad, real/generated, home-spot link, this box's voice and "why it looks like this"), keyframe catalog panel with "go to the nearest", keys panel. |
| `src/app/classifieds/page.tsx` | `/classifieds`: fixed full-viewport viewer over the site layout; loads real entries. |
| `src/app/classifieds/mockups/page.tsx` | `/classifieds/mockups?at=i,j&w=3&h=2`: a static w×h block of the section, edge to edge, for review. |
| `src/app/classifieds/microfiche.css` | One paper colour for the whole plane; box rules written once against `--u-*` (the box's voice) falling back to `--cl-*` (the tile's theme); border classes `.cl-b-*`; header devices `.cl-d-<device>`; grain. |
| `src/app/classifieds/fonts.tsx`, `reals.ts` | Google Fonts link for every catalog family; `loadRealEntries()` (dossiers today). |

Verified 2026-10-24 in a dev preview container (`cl-preview`, port 3113,
own `.next` volume; the live `eac-artdirect` was not touched): `tsc` clean for
these files; `/classifieds` renders 9 tiles / ~550 boxes at 100 % and 15 tiles
/ ~740 boxes at 50 % with no console errors; `/classifieds/mockups?at=-12,-16&w=3&h=2`
renders a 3×2 block edge to edge (screenshots shown to the developer). Not
verified: touch/pinch on a device, Safari, performance on a slow machine, the
live build.

## How the plane is organised (decisions from the developer's Q&A, applied)

- **Keyframes, not bins.** The catalog's families are keyframe norms in one
  CSS parameter space. Regions hold to one (thematic presence); between them
  the axes morph independently. Add a look = add a family in `families.ts` and
  a recipe in `catalog.ts`; no CSS change needed because every unit rule reads
  the `--cl-*` tokens.
- **One section, no pages.** There are no mastheads, running heads, borders or
  gaps; a section banner appears inside the flow about once in six coherent
  tiles. Column rules run unbroken down each strip.
- **Boxes carry the variety.** Each box samples its own faces, border style
  (rule, solid, heavy, double, dashed, rounded, none), tint, reverse and
  shadow from the local theme, so an area reads as a family resemblance
  between boxes, and between areas the boxes drift box by box.
- **Entry types and dials.** `classified | notice | seasonal | listing | poster
  | mailorder | profile`, weighted by `RATIOS` × the local keyframes' bias.
- **Home + echoes.** A real entry has one home cell (hash of its id), rendered
  as a wide display with a double rule; it echoes elsewhere about once or
  twice per 100 sheets as a liner or boxed liner, and the focus view links
  from an echo to the home spot.
- **Tell real from generated.** Focus view tags each ad; real ones link to
  their ArtDirect file.
- **Look.** Paper only; a light photocopy grain from a per-area field. No film
  overlay, vignette or zoom modes (developer, 2026-10-24).

## Integration with the platform

Where real content comes from (next step, in order of effort):

1. **Dossiers** (done): `listDossiers()` → `profile` ads. ~200 cap.
2. **Organisations**: `organizations` + `org_profiles` → `profile` ads of
   kind `card` (business-card display) linking to the org's home
   (`listOrgHomes` in services).
3. **Events and series**: `threads` where kind ∈ {event, meeting, series}
   with a future start → `poster` and `listing` ads; venue and time from the
   thread; link to the thread on its site. Respect `min_role` (migration 188)
   and `OFF_FEED_KINDS`.
4. **Store listings**: `@elkdonis/commerce` artworks and lots → `classified`
   "For Sale" liners and `display` ads with the price; link to the market.
5. **Services / offerings**: `service` threads → "Services" liners.
6. **Member posts placed as ads**: a new `threads.kind = "classified"` (add it
   to `OFF_FEED_KINDS`) with metadata `{ entryType, preferredLook?, customCss?,
   homeCell }`, posted from a standard form (`/classifieds/place`), optional
   look preference, subject to the plane's variation. Needs a migration for a
   `classified_placements` sidecar if home cells and expiry are to be
   queried; otherwise metadata suffices.
7. **Archive text** from the specimens (OCR of the public-domain pages:
   cl-024 1920s magazine, cl-037 1871 Pioneer) → `origin: "archive"` ads.

Mechanics:

- `loadRealEntries()` is the one seam: it returns `RealEntry[]` (an `Ad` and a
  home cell). Each source above is a function appended there. Fetch once per
  page load (server), cap at a few hundred, and cache for a minute.
- Home cells today are `hash(id) → [-20..20, -14..14]`; a visitor lands at
  random in `[-30..30, -20..20]`. As entries grow, widen both ranges together.
- Echo chance is `1.6 / N` per real entry per sheet, so echoes stay at one or
  two per sheet whatever N is.
- Search and jump: a client-side index of real entries (name → home cell) is
  enough at this scale; generated filler is not searchable.
- Translate option, respond, pricing: not started (HANDOFF.md).
- The site header stays in the layout; the viewer covers it. Add a
  "Classifieds" `NavLink` to `SiteHeader.tsx` when the route goes live.
- Deploy: artdirect runs in production mode; follow `docs/reference/ops.md`
  (back up `.next`, check `git status`: the tree holds other sessions' work).

## Field structures (2026-10-24, developer direction)

Patterns larger than a page that break the routine of the listings and use
the field: the developer named a Love Lines ribbon running diagonally across
many pages and a long row of coupons or restaurants. Mock-ups:
`apps/artdirect/classifieds/mockups/FieldStructures.html` (artifact
https://claude.ai/artifact/YQcLFfhSpspRHQYVk71bD6) shows a diagonal ribbon with
a row of hearts, a full-width coupon strip, a circular ad with copy on the
rim, a staircase of reversed tabs, a meandering blank river with a running
line, a row of venue cards (the long table) and a word three pages wide. The
ads are bin-packed around each structure (the structure gives, per column
span, the y-interval it blocks).

For the generator: a structure is a deterministic shape in world space
(line + thickness, rectangle, circle, sine channel, stair of rectangles)
placed by a sparse hash over the plane so each kind recurs every few hundred
tiles at most; `tileAt()` asks the structures touching the tile for their
blocked intervals before packing, then renders the structure's own DOM from
the tile that owns its origin (structures crossing tile seams must be drawn
once, in world coordinates, by a layer above the tiles). Ribbons of
seasonal personals, coupon strips, long tables of venues and circular
"eye" ads map to entry types already in the dials.

## Dials, bands, editorial, worlds (third build, 2026-10-24 evening)

- **Dials** (`src/classifieds/dials.ts`): ten axes 0–10: density, breaks,
  heterogeneity, colour, fontMix, borders, headers, scale, structures,
  editorial. Every keyframe carries a preset (`PRESETS` in `catalog.ts`; e.g.
  dense = 10,1,1,2,1,1,6,1,1,0; mosaic = 3,6,9,9,9,9,5,8,5,2). The field
  blends the presets by the keyframe weights at a spot, then the reader's
  dials push each axis 0.6 per point from 5. `style.ts` turns density into
  type size, leading, gutter and column pitch and borders into rule and box
  weight; `plane.ts` turns the rest into run lengths, head chance, box kinds,
  voice spread, wide-unit chance, white space inside displays, banner
  chance and the editorial share. HUD panel "Dials" (key D) with five
  presets (Neutral; Dense, narrow, one face; Colour, big boxes, white space;
  Broken, many faces; The newspaper). The hash carries them: `#x,y,z;d=…`.
- **Bands**: a tile is one to three horizontal bands, each with its own
  column count and gutter (`bandsFor`, by the breaks dial); the first band
  keeps the strip's grid so rules continue from the tile above, later bands
  break it with a rule across. This is the generator form of the
  BrokenColumns mock-ups.
- **Editorial**: `article` (headline, deck, body with a drop cap, byline)
  and `weather` (a table) are unit kinds under entry type `editorial`; the
  editorial dial sets their share, so at 10 the matrix reads as a newspaper
  that is still made of boxes.
- **Worlds**: `rng.ts` folds a world seed into every hash
  (`setWorldSeed`); the Dials panel has a World field and "Random world"; the
  hash carries `;w=N`. Same rules, different plane.
- **Focus → link**: a real entry's panel has one "Open on <site> →" button
  (`ad.href`, external links in a new tab); echoes keep the "home spot" link.
- Verified in the dev preview at one spot under five dial settings (tsc
  clean, no console errors, screenshots shown). Left running for the
  developer on the LAN: http://192.168.0.11:3113/classifieds (dev mode, hot
  reload). Not deployed: a production build would ship every other
  session's uncommitted artdirect changes.

Open from this build: the colour dial can only tint with what the local
keyframes carry (a mono region stays mono at colour 10); the dials panel
regenerates every visible tile at once (fine at 15 tiles, no transition);
the camera is custom (pointer events + one transform), which is enough and
avoids a dependency; a library such as panzoom would add inertia only.

## Templates (fourth build, 2026-10-24 night)

The developer found the generated plane flat next to the mock-ups: one
keyframe's two faces, one border, 10 px everywhere. Cause: the style field
(sharp softmax over keyframes) chose one voice per area and the box
sampling drew from it narrowly. Fix, in `src/classifieds/templates.ts`:

- **Box templates**: ~60 treatments ported from the hand mock-ups (agate
  caps liner, Spartan boxed liner, DQ italic Caslon under a slab, blackletter
  box, Righteous display with a script "We're hiring!", script logo card,
  yellow phone box, red/blue/teal mosaic displays, comic offer with price,
  comic reverse, coupon, woodtype stacks, Anton notices with reversed head,
  Love Lines slab personals, cinema listings, agency list, photo-liner,
  Spartan and Anton house ads, Playfair and Oswald articles, the weather
  box). Each carries faces, head scale, body scale, border, fill slot,
  edge colour, shadow, alignment, wide preference and affinities to
  keyframes.
- **Head templates**: 15 devices (italic rule, numbered, two-tier black tab,
  reverse bar, red/blue colour tabs, tint bar, yellow icon label, paired,
  small caps, spaced caps, town bar, boxed title, rule label).
- **Palettes**: eight from the specimens (mono, observer, bazaar, mosaic,
  comic, herald, weekly, green); an area picks one from the colour group's
  winner, the colour dial can force mono or open the set; fills come from
  the palette slots, so colour is coherent within an area.
- **Draw**: weight = base × ((1 − het) × (0.04 + 3 × Σ affinity × keyframe
  weight) + het × 0.6), then the dials bend it (borders, scale, colour, font
  mix). Nothing is excluded; the theme is a majority. `SHARPNESS` lowered
  from 9 to 5 so the keyframe weights are mixtures.
- **Heads per tile or per run** by the heterogeneity dial.
- **Focus**: the box itself opens enlarged (same voice, ~1.9×, no clipping)
  with the entry's links and the "why" below; click anywhere on a box.
- Verified: 169 tiles generate in Node without error after fixing a `find`
  whose predicate re-rolled the id per element; four spots rendered, no
  console errors. Not yet deployed: the production build step was blocked
  for the session (the live `.next` is backed up at
  `~/eac-backups/next/artdirect-20261024-0541.tgz`; the build and restart
  commands are in the handover message and in `docs/reference/ops.md`
  "Build and deploy a production-mode app"). The LAN preview at
  http://192.168.0.11:3113/classifieds serves the current source.

Open: the colour dial still cannot invent colour in a mono-leaning area
beyond the palette switch at colour > 7.5; the body size is still one
value per tile (templates scale it, but a 7 px agate next to a 14 px
display within one column needs per-box sizes from the catalog).

## Zones, topography, catalog to 155 (fifth build, 2026-10-25)

Developer's review of the fourth build: body text too small and out of
proportion to heads; a visible lattice of 1000×1400 tiles each with its own
grid, clipped at the bottom; too random, no rhythm; stand-out boxes
(yellow) recurring. Changes:

- **Zones** (`src/classifieds/zones.ts`): rows 1100–2600 px high, zones
  1000–3200 px wide, offset per row like brickwork. A zone keeps one column
  grid for its whole extent and its columns are flushed to its bottom, so
  rules run for pages and seams are staggered and infrequent. The dial
  `breaks` lets a zone depart from its strip's pitch. `tileAt(r, k)` now
  generates a zone; the style is sampled at the zone's centre.
- **Topography** (`style.ts` `centresNear`): one thematic centre per 9×9
  block of tiles at a hashed offset, with a keyframe, a radius (2–5.5 tiles)
  and a strength; every axis group holds to the centre's keyframe with a
  Gaussian falloff, between centres the groups follow their own noise and
  mix. Coherence = sum of holds. This replaces the plain noise coherence
  and is the "centres that disintegrate and reform" the developer described.
- **Type**: body size 10–13.5 px at neutral (was 7–10), column pitch wider
  to match; display/poster/card boxes take their own size 0.95–1.35×;
  display height slack reduced (boxes were over-estimated).
- **Rarity**: templates marked `rare` are drawn seldom and at most twice per
  zone; no template repeats back to back.
- **Catalog**: 155 box templates (`TEMPLATES_2` ported from the annotation
  notes: one per device the 39 specimens show, from the oval-head Daily News
  display to the Tribune disclaimer and the Pioneer timetable with dot
  leaders) plus 15 head devices and 8 palettes. CSS for every device under
  `cl-t-*` in `microfiche.css`.
- Verified: 1046 zones over a 60k×60k window generate without error, 145 of
  155 templates appear; four spots rendered with no console errors.
- **Deployed 2026-10-25** with the developer's permission: `pnpm build` in
  `eac-artdirect` (exit 0; `/_not-found` cookies message is the known noise),
  `docker compose restart artdirect`, `/classifieds` and `/` 200 through the
  edge. The build shipped every uncommitted artdirect change in the tree.
  Backup of the previous build: `~/eac-backups/next/artdirect-20261024-0541.tgz`.
  The display-height tightening made after the build started is in the
  preview only until the next rebuild.

## Sections and twists (sixth build, 2026-10-25, source only)

Developer's review of the fifth build: no definition of a centre; everything
reads as one paper; the mock-ups' robustness never appears. Diagnosis: the
field blends keyframes everywhere, so no spot is ever generated the way a
mock-up is composed. Change:

- **Sections** (`src/classifieds/sections.ts`): one whole-page recipe per
  mock-up (12: wantads, bazaar, notices, pioneer, backpages, collaborators,
  observer, gatesville, photosheet, whatson, vacancies, ledger): exact pitch,
  gutter, body size, rule, head device(s), a short weighted box set, palette,
  entry-type voice, run length, banner, house fillers, and for the record its
  fonts and reusable graphics.
- **Twists** (30): named variations that bend a section without leaving it
  (reversed heads, colour tabs, pink premium liners, yellow boxes, a coupon,
  a wide poster, double rules, bigger/smaller body, narrower/wider columns,
  no heads, long runs, blackletter, script, woodtype intrusions, notices in,
  editorial, profiles, second palette, mono, liners only, more displays,
  house ads, banner, grey panels…). A zone inside a centre takes 1–3 twists
  by hash, so one section yields dozens of pages that are plainly the same
  paper. This is the developer's "15–30 variants per page" as a generator
  rather than hand work.
- **Centres generate from sections**: `centresNear` assigns each centre a
  section; the hold has a plateau (full inside r/2, zero at 1.6 r; radius
  3–7 tiles). Inside a centre the zone takes the section's grid, body,
  palette and rule, draws boxes and heads from the section's own set with
  probability = hold (the open catalog keeps 1 − hold, so intrusions
  happen), uses its run lengths, head chance, banner and fillers. Between
  centres the open catalog and the dials apply as before.
- **Review grid**: `/classifieds/mockups?section=<id>&n=12[&twists=a,b]`
  renders N twist-variants of a section as full 900×1300 pages.
- Three new hand mock-ups (`mockups/ThreeMore.html`) with original copy are
  the sources of the photosheet, whatson and vacancies sections. The
  developer's rule for mock-ups: full pages, filled to the foot, original
  work (not specimen copy with words swapped).
- Status: `tsc` clean; not yet rendered or deployed (the previous turn was
  interrupted to fix the mock-ups). Next: render the review grid for each
  section, tune box sets so each section fills like its mock-up, deploy.

## Contagion: how one box dictates the look around it (design note, 2026-10-24)

The developer's direction: the advanced aesthetic is not placed structures but
*natural harmonies* of the generation, where the morphing of themes and the
larger patterns arise from the boxes themselves; and the basic operation is
that any box can be opened and edited, and a person can make a box whose
styling then spreads to its surroundings. Proposed model:

- **A box is a sample, not an instance.** Every box carries a *voice* (faces,
  size, border, tint, alignment, case, lead treatment, density) as plain
  values. Generated boxes sample their voice from the local field; an
  authored box declares one. The field is the thing that changes.
- **Authored boxes are sources.** The style field is today a sum of noise
  fields over the keyframes. Add a second term: for every authored box with
  a home cell, a *source* that pulls the field toward that box's voice, with
  a strength that falls off with distance (a kernel of a few tiles) and with
  age (newer boxes pull harder, old ones settle in). The field at a spot
  becomes: noise-weighted keyframes + Σ sources. A box therefore makes a
  neighbourhood in its own image; two sources near each other blend; a
  strong source lifts the coherence of its area so the look holds.
- **Contagion is per axis.** A source may carry only some axes (a font but
  no colour, a border but no grid). Unset axes keep drifting with the noise,
  so a hand-set box never freezes its surroundings; it tints them.
- **Keyframes are just old sources.** A keyframe is an authored voice with no
  home cell and a very wide kernel. Promoting an approved custom look to a
  keyframe (HANDOFF.md "Catalog growth") is a change of kernel width, not a
  new mechanism.
- **Structures grow from runs.** The large patterns (ribbons, strips, stairs,
  rivers) need not be placed: give some sources a *direction* and a *length*
  (a ribbon source is a line of sources; a strip is a row; a stair a
  diagonal sequence), generated by the same sparse hash that places echoes.
  Where several coupon boxes sit on one line the strip appears by itself;
  where personals cluster along a diagonal the ribbon follows them. The
  structure layer then only draws the connective tissue (the rule, the
  hearts, the scissors) between boxes that already line up. This is the
  "natural harmony" version; the placed version in FieldStructures.html is
  the fallback for rhythms the harmonies do not produce.
- **How it continues or stops.** Each source has a kernel radius and a decay
  curve; an array of sources along a line has a probability per step of
  ending, turning, forking or changing voice (a Markov walk over the sparse
  hash), so a ribbon runs for pages and then peters out into ordinary
  liners. The same walk decides how far a theme region extends before it
  fades into the next.
- **Editing.** Opening a box (focus view) exposes its voice as a form: faces
  from the catalog's pool, size, border, tint, alignment, case, and the
  axes it broadcasts. Real entries save the voice to the entry's metadata
  (`threads.metadata.classified.voice` for posted ads; a sidecar for dossier
  and org ads). Generated boxes can be "claimed" (copied into a new authored
  box at that cell, i.e. a post with a chosen look). Edit rights follow the
  entry's owner and org, resolved from `getServerSession()`.
- **Data.** `classified_sources(id, entry_ref, cell_i, cell_j, voice jsonb,
  axes text[], strength, radius, created_at)` queried by cell range; the
  client fetches the sources within the viewport ±kernel and folds them into
  `styleAt()` before packing. Sources are few (one per authored box) so the
  query is cheap at this scale.

Open: whether a source can carry copy conventions too (the matrimonial voice,
the box-number habit), which would let a tone spread the way a face does.

## Next steps

1. Developer review of the keyframes on `/classifieds/mockups` and of the
   drift (coherence) feel on `/classifieds`; tune `SHARPNESS`, group scales
   and the coherence scale in `style.ts`.
2. Height estimate: boxes are clipped at their estimated height; a measured
   layout pass (client-side measure → re-pack the tile) would remove clipped
   last lines and the slack inside boxes.
3. Repetition: the copy pools are small (about 50 classified pairs, 15
   notices, 14 offers), so the same lines recur within a screen. Grow the
   pools, add archive text (OCR of the public-domain specimens) and let real
   entries take over the share.
4. Real content sources 2–5 above; then the posting form (6).
5. Performance: 48 tiles cap, ~50 boxes each; at 20 % zoom on a wide screen
   that is the whole cap. Consider `content-visibility: auto` per tile.
6. Images: public-domain cuts for `stack`/`display`; portraits from dossiers
   in the `cut` slot (media served only when a path has no `Private/`).
7. Annotation review: the 39 draft annotations wait for the developer.

## Open questions for the developer

1. **Landing.** Random spot every visit, or the same spot per visitor
   (cookie) so the plane feels like a place they left? (Built: random.)
2. **Nonsense ratio.** One in eight generated classifieds borrows a
   stranger's lead ("INVIGILATOR, for a move across town…"). Keep, raise, or
   remove?
3. **Colour.** The paper is one colour for the whole plane; keyframe paper
   colours now appear only as box tints (the comic mail-order pink on single
   boxes). Should areas be allowed to tint the paper itself (a soft field
   behind the boxes), or stay on one paper?
4. **Home spot look.** Real entries at home are a wide display with a double
   accent rule. Should the home spot also carry the poster's preferred look
   verbatim (custom CSS), and how much may the plane vary it?
5. **Echo density.** One or two echoes of real entries per sheet; enough to
   feel the platform behind the filler, or too many?
6. **Banners.** A section banner ("WANT ADS", "NOTICES") sits in the flow
   about once in six coherent tiles. More, fewer, or none?
7. **Reading the fiche.** Reel/frame readout counts from 500 at the origin.
   Keep the numbers, or name reels (letters, dates, section names)?
8. **Languages.** Should generated filler in some regions be in other
   languages (Spanish paired tabs exist; Indian specimens are bilingual)?
9. ~~**Column grid.** Column pitch changes only across the plane (per strip),
   never down it.~~ Answered 2026-10-24: columns should be able to be broken.
   Next build: let the pitch change down a strip as well, with bands of a
   different column count inside a tile (the hand mock-ups in
   `apps/artdirect/classifieds/mockups/BrokenColumns.html` show the shapes:
   six agate columns into three wide ones, a notice grid into seven lines of
   personals, unequal column widths, two papers side by side).

## History

- 2026-10-24: Opus session annotated 39 specimens, wrote 13 families, four
  mixed mock-ups (Claude Design canvas). Developer: "families are a loose
  repertoire"; "don't build UI until asked".
- 2026-10-24 (this session): developer asked for the viewer, the CSS
  standardisation and the plan. Mid-session clarification: keyframes with
  natural morphing, both thematic regions and drift; keyframes stay
  extensible. First build: separate sheets with staggered gaps and zoom
  bands. Developer: wrong idea; one continuous section, no gaps, zoom only
  scales, boxes too plain and repetitive. Second build (same day): continuous
  tiles, per-strip grid, bin-packing, per-box voices, banners in the flow.
  Verified in a dev preview; not deployed.
