# 01 · Surface UI specimen

File: `designs/Surface UI Specimen.dc.html`. Sources: `packages/cms-ui/src/surface/{SurfaceCard,SurfaceShell,SurfacePage,SurfaceProvider,kinds,types}.ts(x)`, `surface.css`, `packages/cms-ui/src/hubsite/{HubPages.tsx,hubsite.css}`, `apps/elktours/src/app/globals.css`.

## The model
- **Face** = `SurfaceCard` in `SurfaceCardGrid`. The whole card is one hit target (`.eac-face-hit`) behind inert content; `.eac-face-live` regions take their own clicks.
- **Surface** = `SurfaceFrame` (masthead / body + optional 272px rail / foot) inside one `<dialog class="eac-surface">` owned by `SurfaceProvider`. Surfaces stack with `open()` / `push()`, and the URL follows the top layer.
- **Page** = `SurfacePage`: the same frame in the page flow, with no scrim and no close.

## Elktours tokens (dark, "zinc and brass")
| Token | Value |
|---|---|
| --sf-bg (card) | #343941 |
| --sf-bg-soft (rail, foot) | #393e46 |
| --sf-fg | #f1ece2 |
| --sf-muted | #b9b2a5 |
| --sf-faint (derived) | ≈ #84827d |
| --sf-line | #727a86 |
| --sf-rule (derived) | ≈ #b8b9b9 |
| --sf-accent | #c9a25c |
| --sf-on-accent | #1b1e23 |
| --sf-danger | unset → #ae3a31 (**fix**) |
| --sf-radius | 0 |
| page ground | #2a2e35 |

Kind accents: post #e8805c; event / meeting / series #c9a25c; workshop / board #7c9c8c; calendar / compose #f1ece2; gallery #dcc08a; neutral #b9b2a5. All other kinds fall back to brass.

Widths: compact 440, standard 640, wide 940, full 1180. At ≤640px a surface becomes a bottom sheet.

## Face anatomy (surface.css)
- Base: min-height 210, padding 56/20/20, corner wash `radial-gradient(124% 96% at 0 0, kind 5%, transparent 64%)`.
- 2px top edge in the kind colour, fading to transparent at 66%.
- Medallion: 32×32 at top 16 / left 18, kind 12% fill, kind 26% border. It fills solid on hover.
- Cue: 24px circle at top 15 / right 15. "+" opens a surface, "→" navigates.
- Text: kicker mono .64rem / .14em uppercase. Title 1.26rem. Blurb .86rem muted, 36ch max.
- Elktours override: no lift on hover; border ivory 22% at rest, 60% on hover.
- Variants: `layout="header"`, `tools`, `href`, `disabled`, `wide`, `small`.

## Surface anatomy
- Head: grid `auto 1fr auto`, gap 14, padding 14/16/14/18, 2px kind bottom border. Glyph tile 38×38. Kicker mono .66rem, which becomes a `‹ crumb ·` when the surface is stacked. Title 1.22rem, one line. Icon buttons 32×32.
- Main: padding 20/22/22.
- Rail: 272px on the soft ground. It stacks first on phones.
- Foot: padding 12/16 on the soft ground, top border in --sf-rule. Status in mono .74rem. One primary action.

## Findings (still to act on)
1. Danger colour fails contrast. Set `--eac-surface-danger: hsl(var(--destructive))` (#e8805c).
2. Places have no kind and borrow "neutral". Proposed `place` kind: glyph ⊙, accent #8fb3c4 on dark or #3c7fa6 on light, size wide.
3. No face or surface draws a map; position is lat/lng text. Reuse `pin-map.tsx` / `places-map.tsx`.
4. `/hub` mostly uses hubsite `HubLinkCard` (plain links), not faces.
5. Two label voices: the surface uses mono kickers, while BusinessCard and the catalogue rows use opacity text. The owner has since chosen **Venture** for labels (see 05), so map `--eac-font-record` to Venture.
