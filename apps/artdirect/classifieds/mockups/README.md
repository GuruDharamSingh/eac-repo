# Classified section mock-ups (2026-10-24)

Four new classified sections, each mixing devices from several specimens in `../data/annotations/`. They show the families used as a loose repertoire, not as fixed identities. Justin reviewed them: "looks good".

- Live canvas: https://claude.ai/artifact/8UzW1pDVK277rC98s1Vuum (private to Justin).
- Files here are the exact published source: `canvas.json` (board layout) plus one `.dc.html` per board.
- Format: Claude Design canvas "Design Component" files. Each is a static, fixed 900×1300 px page; markup and inline styles are plain HTML/CSS inside `<x-dc>`, fonts from Google Fonts. The `support.js` script and `<x-dc>`/`<helmet>` wrappers are the canvas runtime's; to reuse a page elsewhere, take the inner `<div>` and the `<style>` rules.
- Copy is newly written (period-flavoured, poetic, arts-network themed). Real details are `[PLACEHOLDER]`s.

## Main.dc.html: The Ledger (magazine back pages)

| Device | Borrowed from |
|---|---|
| Heavy old-style title over a double rule, small-caps running head with folio | cl-024 (1920s magazine) |
| Three columns of justified liners separated by hairlines; bold italic heads centred between rules; caps opening words; Dept./Box codes | cl-024 |
| Vermilion numbered tab "017 LOST & FOUND" | cl-027 (O Heraldo bars) + numbered heads from cl-002/cl-004 |
| "The Night Press" boxed display in Rye woodtype with spaced-caps rule band | cl-037 (1871 woodtype displays) |
| Double-ruled "ATTN: READERS" notice | cl-038 (Tribune) |

Fonts: Libre Caslon Display / Text, Old Standard TT, Oswald, Rye. Paper #f6f1e4, ink #1a1712, accent #d2482a.

## WantAds.dc.html: Want Ads (dense daily)

| Device | Borrowed from |
|---|---|
| Huge heavy grotesque masthead + run-day/deadline table with dot leaders | cl-017/cl-018 (Hastings) masthead structure, cl-039 head face |
| Two-tier black tabs (small kicker over big condensed word) | cl-017/cl-018 (Hastings) |
| Numbered heads with the number flush right between rules | cl-039 (1960s want ads) |
| Six narrow columns of justified liners with caps leads and hanging indent | cl-039 |
| Pink premium liners with red bold leads | cl-015 (Eenadu) |
| Two-column light condensed display "ATTENTION SIGN PAINTERS" | cl-039 displays |
| Agency list "2—Scene Painters—[RATE] day" | cl-039 employment-agency ad |
| Small boxed liners (MODELS WANTED, NOW HIRING) | cl-002 / cl-004 boxed liners |

Fonts: League Spartan, Source Serif 4, Pathway Gothic One, Roboto Condensed. Paper #f4f1ea, pink #f9cfdc, red #c4262e.

## Notices.dc.html: Notices (boxed grid)

| Device | Borrowed from |
|---|---|
| Grid of near-identical boxed notices: heavy condensed head, justified sans body, bold centred name block | cl-008 (Srinagar notices) |
| Double-height reversed head ("STUDIO / CLOSED") with phone numbers in black tags | cl-008 big notice |
| Card of Thanks in slab head + italic serif sign-off | cl-008 serif variant, cl-017 Card of Thanks |
| Bilingual AVISO / NOTICE paired tabs in a yellow box with blue border, interloping into the grid | cl-023 (2más2KC colour mosaic) |
| Reversed "CALL FOR WORK" panel | cl-003 reverse house panel |
| Vermilion banner and blue continuation bar | cl-027 (O Heraldo) |

Fonts: Anton, Arimo, Archivo Black, Alfa Slab One, Libre Caslon Text. Accents #e8502b, #1f3f99, #d7261e, #f6e7a6.

## BackPages.dc.html: Back Pages (mail order)

| Device | Borrowed from |
|---|---|
| Circus woodtype masthead with red offset shadow; yellowed spot-colour paper | cl-030 (Dogstar flyer) |
| Tiny boxed offers with hook headline, typewriter copy and price | cl-030's pasted comic mail-order ads |
| "97-sketch weakling" reversed panel | parody of the classic body-building mail-order ad (no real names used) |
| Scissor-dashed coupon with dotted fill-in lines | cl-016 / cl-010 coupons, cl-030 scissors |
| Inline line-art cut (canvas and brush) | stands in for public-domain cuts |
| Dense CSS grid with spanning boxes | cl-023 / cl-030 modular mosaics |

Fonts: Rye, Archivo Black, Courier Prime, Alfa Slab One, Oswald. Paper #f3e3b0, ink #1b1714, red #b42a22.

## Generated mock-ups (2026-10-24, later session)

The viewer now produces the section from the plane. `/classifieds/mockups?at=i,j&w=3&h=2`
renders a static w×h block of tiles edge to edge. One coherent tile per keyframe,
found by scanning ±40 tiles (grid is per strip, so the column pitch at a tile is
that of its i): ledger −10,−15 · wantads −1,−4 · weekly −31,26 · notices −17,−23 ·
mosaic −11,−14 · backpages −11,−16 · woodtype −31,28 · dense −26,28 · bazaar
−29,24 · lovelines −29,27 · vacancies −1,26 · cinemafare −17,−22 · tabloid −2,4
· photosheet −16,−26.

## Hand mock-ups, second set (2026-10-24)

- `BrokenColumns.html` (artifact https://claude.ai/artifact/YGajTwRdwsEULpgEHpyZfj): four pages whose column grids break part-way down.
- `BoxStudies.html` (artifact https://claude.ai/artifact/WHrgZ7qbxE11Ye9P93Xex3): three sections studying the boxes: dense agate wall (Tribune), staggered board (Observer), many fonts on one grid (Gatesville).
- `ThreeMore.html` (artifact https://claude.ai/artifact/P1h1ciRynWFz3j6gTDMzoW): photo sheet (Rooms & Spaces), What's On listings, Situations Vacant displays. Original copy for an imagined river town; devices from cl-011/004/005, cl-028/032, cl-016. Full pages (checked by render 2026-10-25).
- `FieldStructures.html` (artifact https://claude.ai/artifact/YQcLFfhSpspRHQYVk71bD6): two generated 3400×2200 fields with structures larger than a page (ribbon, coupon strip, circle, staircase, river, long table, giant word). Plain HTML, self-contained, fonts from Google Fonts; "Reseed the texture" regenerates the listings under the structures.

## Observations for the next session

- Mixing works best when one specimen sets the page's skeleton (grid, masthead, body face) and others contribute two or three devices (a tab, a tint, a box).
- Devices that travel well: numbered or two-tier tabs, tinted premium liners, double-ruled notices, scissor coupons, reversed panels, bilingual paired tabs.
- These mocks are hand-composed. Nothing here is a generator or app code, and Justin has not asked for one.
