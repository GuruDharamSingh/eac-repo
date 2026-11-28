# innergathering on Radix-style 9-step scales (prototype, 2026-11-27)

Design only. `index.html` is one self-contained file (plain HTML/CSS/JS, one Google Fonts link). It draws the public face of `apps/innergathering` (elkdonis-arts.org) on a five-colour palette, 9-step generated scales, roles as pointers and four section tones. Routes are hash routes: `#/`, `#/offerings`, `#/writing`, `#/about`, `#/login`, `#/hub`. Surfaces follow the stack in `?s=`, for example `#/offerings?s=meet-1/rsvp/done` or `#/writing?s=piece-2`. The Theme button (bottom right, collapsed by default) opens the panel.

Status of claims: **verified** = run in node on the page's own code (`/*CORE*/` block); **assumed** = reasoned, not run.

## Layers as built
1. Palette: Space #E8E4D6, Water #2C4A96, Fire #C9483E, Earth #E4CC4E, Wind #548A5C. The only stored values; editable in the panel.
2. Shades: `genScale` in OKLCH, per scheme. `--l-<name>-1..9` (light) and `--d-<name>-1..9` (dark), plus `neutral` tinted from Space, Water or none (chroma capped at 0.014). `html[data-scheme]` aliases `--water-7` to the active set.
3. Roles: pointers only, e.g. `--solid: var(--fire-7)`. Chosen by the resolver (below), written into the generated style block.
4. Tones: `data-tone` = plain, soft, deep, accent (`data-hue` fire / earth / wind). A tone re-points the roles. Deep always points at the dark scales (navy ground, light text) and accent at the light scales, in both schemes.
5. Blocks (`.btn`, `.card`, `.tag`, `.field`, `.sheet`) read role variables only. No hex outside the palette and the diagnostic overlay badge.

## Step-job table (9 steps)
| Step | Job | Roles |
|---|---|---|
| 1 | Page background | `--bg` |
| 2 | Subtle background (cards, sunken) | `--bg-sunken` |
| 3 | Component background | `--panel` |
| 4 | Component hover / selected | `--panel-hover` |
| 5 | Divider, subtle border (decorative) | `--divider` |
| 6 | Stronger decorative border | `--border` |
| 7 | Solid fill; input border and focus ring | `--solid`, `--ring`, `--ctl-border`, `--a2`, `--a3` |
| 8 | Solid hover; secondary text | `--solid-hover`, `--text-muted`, `--accent-text` |
| 9 | High-contrast text | `--text` |

Refinement of the proposal: step 6 no longer carries the input border and focus ring. Step 6 measures 1.60:1 against step 1 (verified), so it cannot meet 3:1; those jobs moved to step 7. Steps 5 and 6 are decorative (the fill and label carry meaning) and have no ratio requirement. Step 7 keeps the seed's own lightness (clamped), steps 1 to 6 sit on one shared lightness curve per scheme, 8 is one notch further from the ground, 9 is the text step. Dark scales are generated on their own curve (step 1 darkest, 9 light), not by inverting hexes.

## Role map (plain tone)
bg n-1, bg-sunken n-2, panel n-3, panel-hover n-4, divider n-5, border n-6, text n-9, text-muted n-8, accent-text fire-8, solid fire-7, solid-hover fire-8, on-solid n-1 (by contrast), ring water-7, ctl-border n-7, accent-2 earth-7 (label n-9), accent-3 wind-8 (label n-1). Soft: bg space-3, sunken space-4, panel n-1. Deep: water ground from the dark scales, text space-9, solid earth-7. Accent: fire/earth/wind-7 ground (stepped to 8 or 9 when text fails), light text or dark text by contrast. The Roles tab shows the live map for any tone and scheme.

## Contrast
Resolver: each role has an ordered list of candidate steps; the first that passes against every ground it sits on wins. Fill, hover fill and label are chosen together. Pairs checked: text on bg / sunken / panel / hover (4.5), muted and accent-text on bg / panel (4.5), label on solid / hover / accent-2 / accent-3 (4.5), solid on bg, ring and ctl-border on bg / panel (3).
- Verified (node, default palette, Space tint): 6 tones x 2 schemes = 204 pairs, 0 fail. Also 0 fail with the Water tint.
- Step changes the check forced: (1) focus ring and input border from step 6 to 7 (above). (2) accent-3 fill wind-7 to wind-8 (label 4.06:1 at step 7, either label colour). (3) deep accent-2 fill fire-7 to fire-8 on the dark scale (4.17:1). (4) `--on-solid` on fire-7 measured 4.49:1 with step 1 at L 0.985; step 1 raised to L 0.992 (4.58:1), so the button keeps the brand Fire. (5) dark step 7 floor raised from L 0.58 to 0.64 because fire-7 with a dark label was 4.1:1. (6) accent·wind and accent·fire grounds move to step 8 (white text on step 7 fails or is marginal).
- Limits (verified): with extreme seeds (very dark Earth) accent·earth text on hover can fail (1.6:1); the Contrast tab shows it as FAIL rather than hiding it. Pale seeds pass but step several roles to 9.

## Not verified
- **Not rendered in a browser.** Chrome was unreachable. Verified only: syntax and no runtime error when the script's render, panel (all four tabs), steps overlay and scheme switch run against a stub DOM for all routes and surfaces. Layout at 390 / 820 / 1440 and "no sideways scroll at 390" are by construction (media queries, `overflow-x:clip`, grid collapse; the brand shrinks to 19px) and assumed.
- Fonts: Venture, Brothers and Basteleur are referenced by relative path to `apps/innergathering/public/fonts` (not copied). Opened outside the monorepo layout they fall back to Cinzel and Cormorant Garamond. Kept the site's faces; no reason found to change.
- Steps overlay labels (`data-reads`) were not seen on screen.

## Design choices
Square corners (2px). Phone surfaces are bottom sheets with square edges, a 3px solid top rule, a thin grab bar and a full-width primary under the thumb. Fire is the action colour; Earth and Wind appear as tags, rules, ticks and the cities band; no accent is a page ground except the one cities band (accent·wind). Not reused: art-auction's light paper / vermilion / rounded sheets. Fire is Fire, but only as solid and link text on a near-white ground; softened by the Space-tinted `soft` tone.
Surface rules followed: one primary in the foot, head carries Share (offers) or Aa (reading), crumb pops a layer, Esc pops, scrim closes, RSVP then done layers.

## Content
Public strings from `apps/innergathering/src/app/page.tsx`, `about/page.tsx`, `components/site-header.tsx`, `site-footer.tsx`, `rsvp-panel.tsx`, `landing/JoinSection.tsx`. Meetings, pieces, board names and the hub are placeholders (Member A, Host A, "sample" counts); nothing comes from members' content. The hub view mirrors the bands in `app/hub/page.tsx` (This week, Make, You, General Chat, Errands) with no real data.

## Sources read (path:line)
- docs/open/THEME_SYSTEM_2026-11-22/STRUCTURE.md:1-60 (layers, Bon palette, N1 to N8)
- packages/gradients/src/ramps.ts:30-80 (`roleRamp`, L/C curves; the page's `genScale` ports the approach with its own 9-step curves)
- apps/innergathering/src/app/layout.tsx and globals.css:76-115 (three site fonts), :224-253 (current `--ig-c-*` colours)
- apps/innergathering/src/app/page.tsx:100-400 (hero, offerings, join, forum, fundraising, cities, board, vision), about/page.tsx, login/page.tsx, [feed]/page.tsx, hub/page.tsx
- apps/development/designs/publication-surfaces-2026-11-27/README.md:19-33 (core rules)
- INVENTORY.md and REVIEW.md in the theme folder were not read in full (assumed covered by STRUCTURE.md's summary).
- Developer preferences from the memory folder: feedback_studio_light_style, feedback_form_look, feedback_design_pace, project_innergathering_design_session.

## Open questions
1. Look: this is one built direction (white ground, Fire action, Space soft tone, navy deep). feedback_design_pace says agree the look before building; confirm or redirect.
2. N3: page ground white-ish (as built, step 1) or Space itself? Soft tone uses Space-tinted step 3 (#efede6).
3. Are steps 5 and 6 allowed to be decorative-only, with ring and input border on 7?
4. Neutral tint: Space (warm) or Water (cool)?
5. Deep and accent tones use the same look in both schemes. Acceptable for dark mode (N8)?
6. Should the resolver run at save time (stored as pointers) or on each theme load?
7. Primary action in dark scheme becomes #df5c50 (lighter than the seed Fire) to hold label contrast. Accept?
