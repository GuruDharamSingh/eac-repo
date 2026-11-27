# One theming structure, from five colours (proposal, 2026-11-22)

Manjushri, for Justin's review. First two sites: elkdonis-arts.org (`apps/innergathering`) and Amrit Canada (`apps/amrit-canada`). Findings this rests on: `REVIEW.md` and `INVENTORY.md` in this folder. Nothing here is built into a site yet; the review page in the development app is a sandbox that saves nothing.

## Why start again
- elkdonis-arts.org can store a colour in 14 places; the Site style panel reaches 5. It exposes 148 variables named after old values (`--ig-c-x-f6efe2`), not jobs. The home page shows 16 background colours, 24 text colours and about 57 text styles.
- Amrit Canada has no stored theme: 27 colours typed into one CSS file and 12 more in components.
- So a theme change misses parts of the page (the Join panel carries its own parchment in shared CSS; Mutual Aid has colours typed into its saved boxes).

## The structure: five layers, one home each

| Layer | What it is | Stored? | Who changes it |
|---|---|---|---|
| 1. Palette | Five named colours per site | Yes: the only colours a site stores | The site's theme |
| 2. Shades | Nine steps, light to dark, of each palette colour | No: worked out from layer 1 (`packages/gradients` `roleRamp`, OKLCH) | Nobody; they follow the palette |
| 3. Roles | Jobs with fixed names, the same on every site: ground, panel, soft ground, ink, muted ink, line, accent, on-accent, danger, plus accent 2 and accent 3 (the accent trio) | Yes, as a pointer: "ink = palette colour 2, shade 900". Never a colour value | The site's theme |
| 4. Tones | A section's treatment: plain, soft, deep, accent. A tone re-points the roles inside that section (deep = dark ground, light ink) | The section stores the tone's name only | Whoever edits the page |
| 5. Blocks and parts | Read roles only. A part's look may pick a palette colour and shade. A typed-in colour is allowed but listed as "off palette" | Look stores the pointer (`2.700`), or the literal if off palette | Whoever edits the block |

Text follows the same idea: two families (title, body) and six named text styles (display, title, heading, body, small, label) in place of 57 combinations. Shape: one radius; control and mark radii follow it.

The twelve core roles are the ones Justin already agreed (theme-language.md): ground, panel, ground-soft, ink, ink-muted, line, accent, on-accent, danger, font-body, font-title, radius. New here: the palette layer under them, shades worked out rather than stored, the accent trio, and tones.

## The two palettes (starting values, to be adjusted on the review page)

**elkdonis-arts.org: the Bon elements** (already in the repo: `packages/gradients/src/palettes.ts:76-77`)

| Slot | Name | Value |
|---|---|---|
| 1 | Space | `#E8E4D6` |
| 2 | Water | `#2C4A96` |
| 3 | Fire | `#C9483E` |
| 4 | Earth | `#E4CC4E` |
| 5 | Wind | `#548A5C` |

Roles to start: ground = Space lightest; ink = Water darkest; accent = Fire; accent 2 = Earth; accent 3 = Wind; deep tone = Water dark with Space ink.

**Amrit Canada** (Justin: burnt orange, warm deep blue and white as the trio, then light pink, then orange or warm white)

| Slot | Name | Value |
|---|---|---|
| 1 | White | `#FFFFFF` |
| 2 | Deep blue | `#22295F` |
| 3 | Burnt orange | `#C8550F` |
| 4 | Light pink | `#F4CFD3` |
| 5 | Orange `#F08A24`, or Warm white `#FAF3E7` | his choice |

Roles to start: ground = White; ink = Deep blue darkest; accent = Burnt orange; accent 2 = Deep blue; accent 3 = Light pink; soft ground = Light pink lightest (or Warm white).

## How a site gets onto it (the cut)
1. Store palette and role pointers in the site's existing theme row (`site_themes`); one generated style block sets the role variables.
2. Point every old variable at a role (elkdonis-arts.org: 148 aliases), so the whole site follows the five colours on day one with no page edited.
3. Then remove literals area by area: saved boxes take a tone; shared sign-up and forum CSS read roles; header and footer read roles. Each removal shrinks the "off palette" list on the review page.
4. Amrit Canada: add the theme loader, then replace its 39 literals with roles.

## Open, for Justin (shown as numbered pins on the review page)
N1 five slots as proposed, or a different five. N2 Amrit's fifth colour. N3 which colour is ground on elkdonis-arts.org (Space, or pure white as he has it live now). N4 the accent trio order. N5 tone names and how many. N6 six text styles and their names. N7 may a block type in a colour off the palette at all. N8 dark mode: later or never.

## Open, for the house-editor PM
Variable prefix (`--eac-` is already used with other meanings in `packages/ui/src/eac-theme.css` and innergathering); whether your `accent-soft` / `on-accent` become ramp steps (I propose yes, so tints have one home); where the role pointers sit in `site_themes.vars`.
